/**
 * FICHIER : modules/gderpi/backend/services/unites/getUniteById.js
 */

const toUniteEntry = require('./toUniteEntry');

const COLLECTION = 'gderpi_unites';

async function getUniteById(db, entrepriseId, uniteId) {
  const id = String(uniteId || '').trim();
  if (!id) return null;
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    uniteId: id
  });
  return toUniteEntry(doc);
}

module.exports = getUniteById;
