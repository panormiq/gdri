/**
 * FICHIER : modules/annuaire/backend/services/contacts/ensureContactIndexes.js
 */

async function ensureContactIndexes(db) {
  const col = db.collection('annuaire_contacts');
  await col.createIndex({ entrepriseId: 1, contactId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, organisationId: 1 });
  await col.createIndex({ entrepriseId: 1, email: 1 });
  await col.createIndex({ entrepriseId: 1, userId: 1 });
}

module.exports = ensureContactIndexes;
