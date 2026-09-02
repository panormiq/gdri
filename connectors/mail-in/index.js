/**
 * Connecteur Mail entrant — poll IMAP via infra Mail.
 */

const fs = require('fs');
const path = require('path');
const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');
const {
  loadMailConfigForConnector,
  resolveImapConfigForAccount
} = require('../../backend/core/connectors/mail-infra-helper');

function getMailService() {
  const mailModule = require(path.join(__dirname, '../../modules/mail/backend'));
  return mailModule.getMailService();
}

function safeFileName(name) {
  return String(name || 'attachment.bin')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'attachment.bin';
}

function bufferFromAttachmentContent(content) {
  if (!content) return null;
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (typeof content === 'string') return Buffer.from(content, 'binary');
  if (content && content.type === 'Buffer' && Array.isArray(content.data)) {
    return Buffer.from(content.data);
  }
  return null;
}

function matchesContains(haystack, needle) {
  const n = String(needle || '').trim().toLowerCase();
  if (!n) return true;
  return String(haystack || '').toLowerCase().includes(n);
}

class MailInConnector extends BaseConnector {
  async testConnection(ctx) {
    const accountRef = ctx.instance.settings?.accountRef;
    if (!accountRef) {
      return { success: false, message: 'Compte mail (accountRef) requis' };
    }
    const config = await loadMailConfigForConnector(ctx.database, ctx.entrepriseId);
    if (!config) {
      return { success: false, message: 'Aucun compte mail — configurez Paramètres > Connecteurs > Mail' };
    }
    const imapRaw = resolveImapConfigForAccount(
      config,
      accountRef,
      ctx.instance.settings?.mailbox || 'INBOX'
    );
    if (!imapRaw) {
      return { success: false, message: 'Configuration IMAP introuvable pour ce compte' };
    }
    const mail = getMailService();
    const result = await mail.getImapService().testConnection(imapRaw);
    return result;
  }

  persistAttachments(raw, ctx) {
    const list = Array.isArray(raw.attachments) ? raw.attachments : [];
    if (!list.length) return [];

    const uid = String(raw.uid || raw.messageId || 'unknown');
    const baseDir = path.join(
      __dirname,
      '../../backend/uploads/mail-in',
      String(ctx.entrepriseId || 'entity'),
      uid
    );
    fs.mkdirSync(baseDir, { recursive: true });

    const usedNames = new Set();
    const out = [];
    list.forEach((att, index) => {
      if (!att) return;
      let filename = safeFileName(att.filename || `attachment-${index + 1}`);
      if (usedNames.has(filename.toLowerCase())) {
        const ext = path.extname(filename);
        const stem = ext ? filename.slice(0, -ext.length) : filename;
        filename = safeFileName(`${stem}-${index + 1}${ext}`);
      }
      usedNames.add(filename.toLowerCase());
      const meta = {
        filename,
        contentType: att.contentType || att.mimeType || 'application/octet-stream',
        size: Number(att.size) || 0
      };
      const buf = bufferFromAttachmentContent(att.content);
      if (!buf || !buf.length) {
        if (att.path && fs.existsSync(att.path)) {
          out.push({
            ...meta,
            size: meta.size || fs.statSync(att.path).size,
            path: att.path,
            url: att.url || null
          });
          return;
        }
        out.push(meta);
        return;
      }
      const absPath = path.join(baseDir, filename);
      fs.writeFileSync(absPath, buf);
      const relUrl = `/uploads/mail-in/${encodeURIComponent(String(ctx.entrepriseId || 'entity'))}/${encodeURIComponent(uid)}/${encodeURIComponent(filename)}`;
      out.push({
        ...meta,
        size: buf.length,
        path: absPath,
        url: relUrl
      });
    });
    return out;
  }

  async ingestPoll(ctx, cursor) {
    const settings = ctx.instance.settings || {};
    const accountRef = settings.accountRef;
    if (!accountRef) {
      return {
        messages: [],
        cursor: {
          error: 'accountRef manquant',
          debug: {
            request: { accountRef: null, mailbox: settings.mailbox || 'INBOX' },
            response: { error: 'accountRef manquant — choisissez un compte sur le bloc Données' }
          }
        }
      };
    }

    const config = await loadMailConfigForConnector(ctx.database, ctx.entrepriseId);
    if (!config) {
      return {
        messages: [],
        cursor: {
          error: 'compte mail absent',
          debug: {
            request: { accountRef: String(accountRef), entrepriseId: ctx.entrepriseId },
            response: { error: 'Aucun compte mail configuré (Paramètres > Mail)' }
          }
        }
      };
    }

    const imapRaw = resolveImapConfigForAccount(config, accountRef, settings.mailbox || 'INBOX');
    if (!imapRaw) {
      return {
        messages: [],
        cursor: {
          error: 'imap config absent',
          debug: {
            request: { accountRef: String(accountRef), mailbox: settings.mailbox || 'INBOX' },
            response: { error: 'Configuration IMAP introuvable pour ce compte' }
          }
        }
      };
    }

    const mail = getMailService();
    const { resolveMailPollQuery } = require('../../backend/core/connectors/mail-query-helper');
    const query = resolveMailPollQuery(settings);
    // Agent Data reads (Tester, bloc Données, run manuel) must fetch PJ.
    // Incremental connector poll stays on the instance setting (can stay lean).
    const includeAttachments = settings._agentRead ? true : query.includeAttachments;
    const fromContains = query.fromContains;
    const subjectContains = query.subjectContains;
    const sinceUid = settings._agentRead
      ? null
      : (Number(cursor && cursor.lastUid) > 0 ? Number(cursor.lastUid) : null);
    const agentRead = settings._agentRead === true;
    const imap = mail.getImapService();
    let rawMessages = [];
    let strategy = 'search';
    let imapMeta = {};

    const unwrapLatest = (result) => {
      if (Array.isArray(result)) return { messages: result, meta: {} };
      return {
        messages: (result && result.messages) || [],
        meta: (result && result.meta) || {}
      };
    };

    try {
      if (agentRead && query.pollByCount) {
        strategy = 'latest';
        const latest = unwrapLatest(await imap.fetchLatest(imapRaw, query.pollLimit, { includeAttachments }));
        rawMessages = latest.messages;
        imapMeta = latest.meta;
      } else {
        const fetchOpts = {
          unseenOnly: agentRead ? false : query.unseenOnly,
          limit: query.pollByCount ? query.pollLimit : 100,
          sinceUid,
          includeAttachments,
          fromContains,
          subjectContains,
          since: query.since,
          newestFirst: agentRead || query.pollByCount
        };
        rawMessages = await imap.fetchMessages(imapRaw, fetchOpts);
        if (agentRead && !rawMessages.length && fetchOpts.since) {
          strategy = 'latest-fallback';
          const latest = unwrapLatest(await imap.fetchLatest(imapRaw, query.pollLimit || 20, { includeAttachments }));
          rawMessages = latest.messages;
          imapMeta = latest.meta;
        }
      }
    } catch (err) {
      return {
        messages: [],
        cursor: {
          error: err.message,
          debug: {
            request: {
              strategy,
              accountRef: String(accountRef),
              mailbox: imapRaw.mailbox,
              host: imapRaw.host || null,
              pollLimit: query.pollLimit,
              agentRead
            },
            response: { error: err.message, stack: String(err.stack || '').split('\n').slice(0, 4) }
          }
        }
      };
    }

    const filtered = rawMessages.filter((raw) => {
      const fromHay = `${raw.fromName || ''} ${raw.fromEmail || ''}`;
      if (!matchesContains(fromHay, fromContains) || !matchesContains(raw.subject, subjectContains)) {
        return false;
      }
      return true;
    });

    const messages = filtered.map((raw) => {
      const attachments = includeAttachments ? this.persistAttachments(raw, ctx) : [];
      return this.normalize(raw, ctx.instance.mapping, {
        source: 'mail-in',
        sourceRef: String(raw.uid || raw.messageId || ''),
        text: raw.text || '',
        from: raw.fromEmail || raw.fromName || '',
        subject: raw.subject || '',
        channel: 'mail',
        author: {
          id: raw.fromEmail || null,
          name: raw.fromName || raw.fromEmail || null,
          email: raw.fromEmail || null
        },
        attachments,
        metadata: {
          subject: raw.subject || '',
          mailbox: imapRaw.mailbox,
          accountRef: String(accountRef),
          fromEmail: raw.fromEmail || '',
          fromName: raw.fromName || '',
          date: raw.date || null,
          attachmentCount: attachments.length
        }
      });
    });

    const lastUid = rawMessages.length
      ? Math.max(...rawMessages.map((m) => Number(m.uid) || 0))
      : (cursor?.lastUid || 0);

    return {
      messages,
      cursor: {
        lastUid,
        lastPollAt: new Date().toISOString(),
        count: rawMessages.length,
        matched: messages.length,
        note: (() => {
          const bits = [];
          if (strategy === 'latest' || strategy === 'latest-fallback') {
            bits.push(`${messages.length}/${rawMessages.length} des ${query.pollLimit} plus récents`);
            if (imapMeta.mailboxExists != null) bits.push(`boîte=${imapMeta.mailboxExists}`);
          } else if (!messages.length) {
            bits.push('Aucun mail IMAP (filtres, dossier ou boîte vide).');
          } else {
            bits.push(`${messages.length} mail(s)`);
          }
          if (fromContains) bits.push('filtre expéditeur');
          if (subjectContains) bits.push('filtre sujet');
          if (strategy === 'latest-fallback') bits.push('sans fenêtre de date');
          const attTotal = messages.reduce((n, m) => n + ((m && Array.isArray(m.attachments)) ? m.attachments.length : 0), 0);
          if (includeAttachments) bits.push(`${attTotal} pièce(s) jointe(s)`);
          return bits.join(' · ');
        })(),
        debug: {
          request: {
            strategy,
            accountRef: String(accountRef),
            mailbox: imapRaw.mailbox,
            host: imapRaw.host || imapMeta.host || null,
            pollByCount: query.pollByCount,
            pollLimit: query.pollLimit,
            pollByDate: query.pollByDate,
            unseenOnly: query.unseenOnly,
            fromContains: fromContains || null,
            subjectContains: subjectContains || null,
            agentRead,
            includeAttachments
          },
          response: {
            mailboxExists: imapMeta.mailboxExists != null ? imapMeta.mailboxExists : null,
            range: imapMeta.range || null,
            rawCount: rawMessages.length,
            matched: messages.length,
            uids: rawMessages.slice(0, 8).map((m) => m && m.uid).filter(Boolean),
            samples: rawMessages.slice(0, 3).map((m) => {
              const body = String((m && m.text) || '').replace(/\s+/g, ' ').trim();
              const atts = Array.isArray(m && m.attachments) ? m.attachments : [];
              return {
                from: (m && (m.fromEmail || m.fromName)) || '',
                subject: (m && m.subject) || '',
                textChars: body.length,
                textPreview: body.slice(0, 180),
                textPart: (m && m.textPart) || null,
                structure: (m && m.structure) || null,
                textTried: (m && m.textTried) || null,
                attachmentCount: atts.length,
                attachmentParts: Array.isArray(m && m.attachmentParts) ? m.attachmentParts : [],
                attachmentNames: atts.slice(0, 8).map((a) => a && a.filename).filter(Boolean)
              };
            })
          }
        }
      }
    };
  }

  /**
   * Actions IMAP : delete / mark-seen (utilisable via FlowExecutor).
   */
  async emit(ctx, operation, payload = {}) {
    const op = String(operation || '').replace(/^emit\./, '');
    const settings = ctx.instance.settings || {};
    const accountRef = payload.accountRef || settings.accountRef;
    if (!accountRef) {
      return { success: false, message: 'accountRef requis' };
    }

    const uid = payload.uid || payload.sourceRef;
    if (!uid) {
      return { success: false, message: 'uid / sourceRef requis' };
    }

    const config = await loadMailConfigForConnector(ctx.database, ctx.entrepriseId);
    if (!config) {
      return { success: false, message: 'compte mail absent' };
    }
    const mailbox = payload.mailbox || settings.mailbox || 'INBOX';
    const imapRaw = resolveImapConfigForAccount(config, accountRef, mailbox);
    if (!imapRaw) {
      return { success: false, message: 'imap config absent' };
    }

    const imap = getMailService().getImapService();
    if (op === 'delete' || op === 'mail.delete') {
      const result = await imap.deleteMessage(imapRaw, uid);
      return { success: true, message: `Message UID ${uid} supprimé`, data: result };
    }
    if (op === 'seen' || op === 'mark-seen' || op === 'mail.seen' || op === 'mail.mark-seen') {
      const result = await imap.markSeen(imapRaw, uid);
      return { success: true, message: `Message UID ${uid} marqué lu`, data: result };
    }
    if (op === 'unseen' || op === 'mark-unseen' || op === 'mail.unseen' || op === 'mail.mark-unseen') {
      const result = await imap.markUnseen(imapRaw, uid);
      return { success: true, message: `Message UID ${uid} marqué non lu`, data: result };
    }
    if (op === 'move' || op === 'mail.move') {
      const folder = payload.folder || payload.mailboxDest || payload.destination;
      if (!folder) return { success: false, message: 'folder requis' };
      const result = await imap.moveMessage(imapRaw, uid, folder);
      return { success: true, message: `Message UID ${uid} déplacé vers ${folder}`, data: result };
    }
    return { success: false, message: `Opération ${operation} non supportée` };
  }
}

module.exports = MailInConnector;
