/**
 * Connecteur Mail entrant — poll IMAP via infra Mail.
 */

const path = require('path');
const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');
const {
  loadMailConfigForConnector,
  listMailAccounts,
  resolveImapConfigForAccount
} = require('../../backend/core/connectors/mail-infra-helper');

function getMailService() {
  const mailModule = require(path.join(__dirname, '../../modules/mail/backend'));
  return mailModule.getMailService();
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
    const limit = Math.min(Math.max(Number(settings.pollLimit) || 20, 1), 100);
    const rawMessages = await mail.getImapService().fetchMessages(imapRaw, {
      unseenOnly,
      limit,
      sinceUid: cursor?.lastUid || null
    });

    const messages = rawMessages.map((raw) => this.normalize(raw, ctx.instance.mapping, {
      source: 'mail-in',
      sourceRef: String(raw.uid || raw.messageId || ''),
      text: raw.text || raw.subject || '',
      author: {
        id: raw.fromEmail || null,
        name: raw.fromName || raw.fromEmail || null,
        email: raw.fromEmail || null
      },
      metadata: {
        subject: raw.subject || '',
        mailbox: imapRaw.mailbox,
        accountRef: String(accountRef)
      }
    }));

    const lastUid = rawMessages.length
      ? Math.max(...rawMessages.map((m) => Number(m.uid) || 0))
      : (cursor?.lastUid || 0);

    return {
      messages,
      cursor: {
        lastUid,
        lastPollAt: new Date().toISOString(),
        count: rawMessages.length
      }
    };
  }
}

module.exports = MailInConnector;
