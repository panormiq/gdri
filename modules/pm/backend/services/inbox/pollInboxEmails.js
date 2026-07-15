/**
 * FICHIER : modules/pm/backend/services/inbox/pollInboxEmails.js
 * RÔLE : Interroge la boîte mail PM et crée des cartes pour les nouveaux messages.
 */

const loadPmMailConfig = require('./loadPmMailConfig');
const fetchUnreadEmails = require('./fetchUnreadEmails');
const ensureInboxIndexes = require('./ensureInboxIndexes');
const createCardFromEmail = require('./createCardFromEmail');

const PROCESSED = 'pm_inbox_processed';

async function pollInboxEmails(db, entrepriseId, options = {}) {
  await ensureInboxIndexes(db);
  const mail = await loadPmMailConfig(entrepriseId);
  if (!mail.imap) {
    return {
      success: false,
      message: 'Aucune configuration IMAP pour PM. Configurez /api/mail/config/pm ou héritez du module mail.',
      created: [],
      skipped: 0
    };
  }

  const limit = Math.min(Number(options.limit) || 20, 50);
  let emails = [];
  try {
    emails = await fetchUnreadEmails(mail.imap, limit);
  } catch (error) {
    return {
      success: false,
      message: 'Erreur IMAP: ' + error.message,
      created: [],
      skipped: 0
    };
  }

  const processedCol = db.collection(PROCESSED);
  const created = [];
  let skipped = 0;

  for (const email of emails) {
    const messageId = String(email.messageId || '').trim();
    if (!messageId) {
      skipped += 1;
      continue;
    }
    const exists = await processedCol.findOne({
      entrepriseId: String(entrepriseId),
      messageId
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    const card = await createCardFromEmail(db, entrepriseId, {
      ...email,
      ownerUserId: options.actorUserId || email.ownerUserId || null
    });
    await processedCol.insertOne({
      entrepriseId: String(entrepriseId),
      messageId,
      cardId: card.cardId,
      processedAt: new Date()
    });
    created.push(card);
  }

  return {
    success: true,
    message: `${created.length} carte(s) créée(s), ${skipped} ignorée(s)`,
    created,
    skipped,
    inheritedFrom: mail.inheritedFrom
  };
}

module.exports = pollInboxEmails;
