/**
 * FICHIER : modules/gderpi/backend/services/clientServices/getClientServiceById.js
 */

const toClientServiceEntry = require('./toClientServiceEntry');

const COLLECTION = 'gderpi_client_services';

async function getClientServiceById(db, entrepriseId, clientServiceId) {
  const id = String(clientServiceId || '').trim();
  if (!id) return null;
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    clientServiceId: id
  });
  return toClientServiceEntry(doc);
}

module.exports = getClientServiceById;
