/**
 * FICHIER : modules/pm/backend/services/cards/ensureCardIndexes.js
 * RÔLE : Crée les index Mongo pour les cartes PM.
 */

const COLLECTION = 'pm_cards';

async function ensureCardIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, cardId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, boardId: 1, columnId: 1 });
  await col.createIndex({ entrepriseId: 1, 'gderpi.devisId': 1 });
  await col.createIndex({ entrepriseId: 1, 'annuaire.contactId': 1 });
  await col.createIndex({ entrepriseId: 1, 'annuaire.organisationId': 1 });
  await col.createIndex({ entrepriseId: 1, 'sourceEmail.messageId': 1 });
}

module.exports = ensureCardIndexes;
