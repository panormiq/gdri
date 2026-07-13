/**
 * FICHIER : modules/gderpi/backend/services/clientServices/ensureClientServiceIndexes.js
 */

const COLLECTION = 'gderpi_client_services';

async function ensureClientServiceIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, code: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, actif: 1, sortOrder: 1 });
}

module.exports = ensureClientServiceIndexes;
