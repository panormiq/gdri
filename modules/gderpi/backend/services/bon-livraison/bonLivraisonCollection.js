const COLLECTION = 'gderpi_bons_livraison';

async function ensureIndexes(db) {
  const ensureBonLivraisonIndexes = require('./ensureBonLivraisonIndexes');
  await ensureBonLivraisonIndexes(db);
}

module.exports = { COLLECTION, ensureIndexes };
