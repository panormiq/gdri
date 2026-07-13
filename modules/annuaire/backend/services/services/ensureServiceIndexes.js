/**
 * FICHIER : modules/annuaire/backend/services/services/ensureServiceIndexes.js
 */

async function ensureServiceIndexes(db) {
  const col = db.collection('annuaire_services');
  await col.createIndex({ entrepriseId: 1, serviceId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, organisationId: 1, code: 1 });
}

module.exports = ensureServiceIndexes;
