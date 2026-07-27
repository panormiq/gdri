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

    const out = [];
    list.forEach((att, index) => {
      if (!att || !att.content) return;
      const filename = safeFileName(att.filename || `attachment-${index + 1}`);
      const absPath = path.join(baseDir, filename);
      fs.writeFileSync(absPath, att.content);
      const relUrl = `/uploads/mail-in/${encodeURIComponent(String(ctx.entrepriseId || 'entity'))}/${encodeURIComponent(uid)}/${encodeURIComponent(filename)}`;
      out.push({
        filename,
        contentType: att.contentType || 'application/octet-stream',
        size: Number(att.size) || (Buffer.isBuffer(att.content) ? att.content.length : 0),
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
      return { messages: [], cursor: cursor || { error: 'accountRef manquant' } };
    }

    const config = await loadMailConfigForConnector(ctx.database, ctx.entrepriseId);
    if (!config) {
      return { messages: [], cursor: cursor || { error: 'compte mail absent' } };
    }

    const imapRaw = resolveImapConfigForAccount(config, accountRef, settings.mailbox || 'INBOX');
    if (!imapRaw) {
      return { messages: [], cursor: cursor || { error: 'imap config absent' } };
    }

    const mail = getMailService();
    const unseenOnly = settings.unseenOnly !== false;
    const includeAttachments = settings.includeAttachments !== false;
    const limit = Math.min(Math.max(Number(settings.pollLimit) || 20, 1), 100);
    const fromContains = settings.fromContains || '';
    const subjectContains = settings.subjectContains || '';

    const rawMessages = await mail.getImapService().fetchMessages(imapRaw, {
      unseenOnly,
      limit,
      sinceUid: cursor?.lastUid || null,
      includeAttachments
    });

    const filtered = rawMessages.filter((raw) => {
      const fromHay = `${raw.fromName || ''} ${raw.fromEmail || ''}`;
      return matchesContains(fromHay, fromContains) && matchesContains(raw.subject, subjectContains);
    });

    const messages = filtered.map((raw) => {
      const attachments = includeAttachments ? this.persistAttachments(raw, ctx) : [];
      return this.normalize(raw, ctx.instance.mapping, {
        source: 'mail-in',
        sourceRef: String(raw.uid || raw.messageId || ''),
        text: raw.text || raw.subject || '',
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
        matched: messages.length
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
    if (op === 'seen' || op === 'mark-seen' || op === 'mail.seen') {
      const result = await imap.markSeen(imapRaw, uid);
      return { success: true, message: `Message UID ${uid} marqué lu`, data: result };
    }
    return { success: false, message: `Opération ${operation} non supportée` };
  }
}

module.exports = MailInConnector;
