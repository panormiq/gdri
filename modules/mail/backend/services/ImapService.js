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
   * Lit des messages IMAP (poll connecteur mail-in).
   * @param {Object} rawConfig
   * @param {{ unseenOnly?: boolean, limit?: number, sinceUid?: number|null }} [options]
   */
  async fetchMessages(rawConfig, options = {}) {
    const cfg = this.normalizeConfig(rawConfig);
    const unseenOnly = options.unseenOnly !== false;
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const sinceUid = options.sinceUid != null ? Number(options.sinceUid) : null;

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
          source: true
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
          out.push({
            uid: msg.uid,
            messageId: msg.envelope?.messageId || String(msg.uid),
            subject: msg.envelope?.subject || '(sans sujet)',
            fromEmail,
            fromName,
            text,
            date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null
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
}

module.exports = ImapService;

