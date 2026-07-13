/**
 * FICHIER : modules/gderpi/backend/services/unites/ensureUniteIndexes.js
 */

const COLLECTION = 'gderpi_unites';

async function ensureUniteIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, code: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, actif: 1, sortOrder: 1 });
}

module.exports = ensureUniteIndexes;
