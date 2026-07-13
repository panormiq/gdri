const { COLLECTION, ensureIndexes } = require('./bonLivraisonCollection');
const toBonLivraisonEntry = require('./toBonLivraisonEntry');

async function getBonLivraisonById(db, entrepriseId, bonLivraisonId) {
  await ensureIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    bonLivraisonId: String(bonLivraisonId).trim()
  });
  return toBonLivraisonEntry(doc);
}

module.exports = getBonLivraisonById;
