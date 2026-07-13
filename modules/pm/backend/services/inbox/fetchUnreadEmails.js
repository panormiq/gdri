/**
 * FICHIER : modules/pm/backend/services/inbox/fetchUnreadEmails.js
 * RÔLE : Récupère les e-mails non lus via IMAP pour le module PM.
 */

const { ImapFlow } = require('imapflow');

function normalizeImap(raw) {
  const host = raw.host || raw.server;
  const user = raw.user || raw.username || raw.login;
  const pass = raw.password || raw.pass;
  if (!host || !user || !pass) {
    throw new Error('Configuration IMAP incomplète pour PM');
  }
  return {
    host,
    port: raw.port != null ? Number(raw.port) : 993,
    secure: raw.secure !== false,
    auth: { user, pass },
    mailbox: raw.mailbox || raw.folder || 'INBOX'
  };
}

async function fetchUnreadEmails(imapConfig, limit = 20) {
  const cfg = normalizeImap(imapConfig);
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth
  });

  const results = [];
  await client.connect();
  const lock = await client.getMailboxLock(cfg.mailbox);
  try {
    const uids = await client.search({ seen: false }, { uid: true });
    const slice = uids.slice(-limit);
    for await (const msg of client.fetch(slice, {
      uid: true,
      envelope: true,
      flags: true
    })) {
      const from = msg.envelope?.from?.[0];
      const fromEmail = from?.address || '';
      const fromName = from?.name || '';
      const subject = msg.envelope?.subject || '(sans objet)';
      results.push({
        messageId: msg.envelope?.messageId || `uid:${msg.uid}`,
        uid: msg.uid,
        subject,
        fromEmail,
        fromName,
        receivedAt: msg.envelope?.date || new Date(),
        snippet: subject,
        bodyText: subject
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return results;
}

module.exports = fetchUnreadEmails;
