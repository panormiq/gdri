const { COLLECTION } = require('./bonLivraisonCollection');

async function ensureBonLivraisonIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, bonLivraisonId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, commandeClientId: 1, createdAt: -1 });
  await col.createIndex({ entrepriseId: 1, numero: 1 });
}

module.exports = ensureBonLivraisonIndexes;
