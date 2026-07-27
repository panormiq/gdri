/**
 * ImapService - Gestion de la réception d'emails via IMAP
 * Fichier : backend/modules/mail/services/ImapService.js
 *
 * Objectif initial :
 * - fournir une brique générique pour se connecter en IMAP (ex. OVH) et tester la connexion
 * - permettre ensuite à d'autres modules (newsletter → posts Facebook, etc.) de récupérer les messages
 */

const { ImapFlow } = require('imapflow');

class ImapService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Normalise une config IMAP venant de mail_configs.config.imap_config
   * @param {Object} rawConfig
   * @returns {{host:string, port:number, secure:boolean, auth:{user:string, pass:string}, mailbox:string}}
   */
  normalizeConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw new Error('Configuration IMAP invalide ou manquante');
    }

    const host = rawConfig.host || rawConfig.server || rawConfig.hostname;
    const port = rawConfig.port != null ? Number(rawConfig.port) : 993;
    // OVH : SSL/TLS sur 993
    const secure = rawConfig.secure != null ? Boolean(rawConfig.secure) : true;
    const user = rawConfig.user || rawConfig.username || rawConfig.login;
    const pass = rawConfig.password || rawConfig.pass;
    const mailbox = rawConfig.mailbox || rawConfig.folder || 'INBOX';

    if (!host || !user || !pass) {
      throw new Error('Configuration IMAP incomplète (host, user, password requis)');
    }

    return {
      host,
      port,
      secure,
      auth: { user, pass },
      mailbox
    };
  }

  /**
   * Teste simplement la connexion IMAP (sans rien lire).
   * @param {Object} rawConfig - imap_config brut depuis Mongo
   * @returns {Promise<{success:boolean, message:string}>}
   */
  async testConnection(rawConfig) {
    let client;
    try {
      const cfg = this.normalizeConfig(rawConfig);
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });

      await client.connect();
      // Verrouiller la mailbox juste pour vérifier l'accès
      await client.getMailboxLock(cfg.mailbox);
      await client.logout();

      return {
        success: true,
        message: `Connexion IMAP OK sur ${cfg.host}:${cfg.port}, boîte ${cfg.mailbox}`
      };
    } catch (error) {
      if (client) {
        try {
          await client.logout();
        } catch (_) {
          // ignore
        }
      }
      return {
        success: false,
        message: `Erreur IMAP: ${error.message}`
      };
    }
  }

  /**
   * Collecte les parties pièce jointe depuis bodyStructure ImapFlow.
   * @param {Object} node
   * @param {Array} out
   */
  collectAttachmentParts(node, out = []) {
    if (!node || typeof node !== 'object') return out;

    if (Array.isArray(node.childNodes) && node.childNodes.length) {
      for (const child of node.childNodes) {
        this.collectAttachmentParts(child, out);
      }
      return out;
    }

    const disposition = String(node.disposition || '').toLowerCase();
    const filename =
      (node.dispositionParameters && (node.dispositionParameters.filename || node.dispositionParameters.name)) ||
      (node.parameters && (node.parameters.name || node.parameters.filename)) ||
      null;

    const type = String(node.type || '').toLowerCase();
    const subtype = String(node.subtype || '').toLowerCase();
    const isMultipart = type === 'multipart';
    const isTextBody = type === 'text' && (subtype === 'plain' || subtype === 'html') && disposition !== 'attachment';
    const looksAttached =
      disposition === 'attachment' ||
      (filename && disposition !== 'inline') ||
      (filename && type && type !== 'text' && !isMultipart);

    if (!isMultipart && looksAttached && node.part && !isTextBody) {
      out.push({
        part: String(node.part),
        filename: String(filename || `part-${node.part}.${subtype || 'bin'}`),
        contentType: `${type || 'application'}/${subtype || 'octet-stream'}`,
        size: Number(node.size) || 0
      });
    }
    return out;
  }

  async streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Lit des messages IMAP (poll connecteur mail-in).
   * @param {Object} rawConfig
   * @param {{
   *   unseenOnly?: boolean,
   *   limit?: number,
   *   sinceUid?: number|null,
   *   includeAttachments?: boolean
   * }} [options]
   */
  async fetchMessages(rawConfig, options = {}) {
    const cfg = this.normalizeConfig(rawConfig);
    const unseenOnly = options.unseenOnly !== false;
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const sinceUid = options.sinceUid != null ? Number(options.sinceUid) : null;
    const includeAttachments = options.includeAttachments === true;

    let client;
    const out = [];
    try {
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.mailbox);
      try {
        const query = {};
        if (unseenOnly) query.seen = false;
        if (sinceUid && sinceUid > 0) query.uid = `${sinceUid + 1}:*`;

        for await (const msg of client.fetch(query, {
          uid: true,
          envelope: true,
          source: !includeAttachments,
          bodyStructure: includeAttachments
        })) {
          const fromAddr = msg.envelope?.from?.[0];
          const fromEmail = fromAddr?.address || '';
          const fromName = fromAddr?.name || fromEmail;
          let text = msg.envelope?.subject || '';
          if (msg.source) {
            const raw = msg.source.toString('utf8');
            const bodyMatch = raw.match(/\r\n\r\n([\s\S]*)/);
            if (bodyMatch && bodyMatch[1]) {
              text = bodyMatch[1].trim().slice(0, 4000) || text;
            }
          }

          const attachments = [];
          if (includeAttachments && msg.bodyStructure) {
            const parts = this.collectAttachmentParts(msg.bodyStructure, []);
            for (const partInfo of parts) {
              try {
                const downloaded = await client.download(msg.uid, partInfo.part, { uid: true });
                if (!downloaded || !downloaded.content) continue;
                const content = await this.streamToBuffer(downloaded.content);
                const metaName =
                  (downloaded.meta && (downloaded.meta.filename || downloaded.meta.name)) ||
                  partInfo.filename;
                attachments.push({
                  filename: String(metaName || partInfo.filename),
                  contentType:
                    (downloaded.meta && downloaded.meta.contentType) || partInfo.contentType,
                  size: content.length,
                  content
                });
              } catch (err) {
                console.warn(
                  `  ⚠️ IMAP PJ uid=${msg.uid} part=${partInfo.part}:`,
                  err.message
                );
              }
            }

            // Corps texte si pas de source brute
            if (!text || text === (msg.envelope?.subject || '')) {
              try {
                const textPart = this.findFirstTextPart(msg.bodyStructure);
                if (textPart) {
                  const downloaded = await client.download(msg.uid, textPart, { uid: true });
                  if (downloaded && downloaded.content) {
                    const buf = await this.streamToBuffer(downloaded.content);
                    text = buf.toString('utf8').trim().slice(0, 4000) || text;
                  }
                }
              } catch (_) {
                // ignore body text fallback
              }
            }
          }

          out.push({
            uid: msg.uid,
            messageId: msg.envelope?.messageId || String(msg.uid),
            subject: msg.envelope?.subject || '(sans sujet)',
            fromEmail,
            fromName,
            text,
            date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
            attachments
          });
          if (out.length >= limit) break;
        }
      } finally {
        lock.release();
      }
      await client.logout();
      return out;
    } catch (error) {
      if (client) {
        try { await client.logout(); } catch (_) { /* ignore */ }
      }
      throw error;
    }
  }

  findFirstTextPart(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node.childNodes) && node.childNodes.length) {
      for (const child of node.childNodes) {
        const found = this.findFirstTextPart(child);
        if (found) return found;
      }
      return null;
    }
    const type = String(node.type || '').toLowerCase();
    const subtype = String(node.subtype || '').toLowerCase();
    const disposition = String(node.disposition || '').toLowerCase();
    if (type === 'text' && subtype === 'plain' && disposition !== 'attachment' && node.part) {
      return String(node.part);
    }
    if (type === 'text' && subtype === 'html' && disposition !== 'attachment' && node.part) {
      return String(node.part);
    }
    return null;
  }

  /**
   * Marque un message comme lu.
   * @param {Object} rawConfig
   * @param {number|string} uid
   */
  async markSeen(rawConfig, uid) {
    return this.withMailbox(rawConfig, async (client) => {
      const n = Number(uid);
      if (!n) throw new Error('UID IMAP invalide');
      await client.messageFlagsAdd(n, ['\\Seen'], { uid: true });
      return { success: true, uid: n, action: 'seen' };
    });
  }

  /**
   * Supprime un message IMAP (flag Deleted + expunge via messageDelete).
   * @param {Object} rawConfig
   * @param {number|string} uid
   */
  async deleteMessage(rawConfig, uid) {
    return this.withMailbox(rawConfig, async (client) => {
      const n = Number(uid);
      if (!n) throw new Error('UID IMAP invalide');
      await client.messageDelete(n, { uid: true });
      return { success: true, uid: n, action: 'delete' };
    });
  }

  /**
   * @param {Object} rawConfig
   * @param {(client: import('imapflow').ImapFlow) => Promise<any>} fn
   */
  async withMailbox(rawConfig, fn) {
    const cfg = this.normalizeConfig(rawConfig);
    let client;
    try {
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.mailbox);
      try {
        return await fn(client, cfg);
      } finally {
        lock.release();
      }
    } finally {
      if (client) {
        try { await client.logout(); } catch (_) { /* ignore */ }
      }
    }
  }
}

module.exports = ImapService;
