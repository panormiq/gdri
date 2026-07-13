/**
 * FICHIER : modules/pm/backend/services/inbox/ensureInboxIndexes.js
 * RÔLE : Index pour le suivi des e-mails PM déjà traités.
 */

const COLLECTION = 'pm_inbox_processed';

async function ensureInboxIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, messageId: 1 }, { unique: true });
}

module.exports = ensureInboxIndexes;
