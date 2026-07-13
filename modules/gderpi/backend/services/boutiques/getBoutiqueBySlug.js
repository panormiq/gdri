/**
 * FICHIER : modules/gderpi/backend/services/boutiques/getBoutiqueBySlug.js
 * RÔLE : Récupère une boutique par slug entreprise.
 */

const ensureBoutiqueIndexes = require('./ensureBoutiqueIndexes');
const toBoutiqueEntry = require('./toBoutiqueEntry');

const COLLECTION = 'gderpi_boutiques';

async function getBoutiqueBySlug(db, entrepriseId, slug) {
  await ensureBoutiqueIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    slug: String(slug || '').trim()
  });
  return toBoutiqueEntry(doc);
}

module.exports = getBoutiqueBySlug;
