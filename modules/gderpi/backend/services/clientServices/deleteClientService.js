/**
 * FICHIER : modules/gderpi/backend/services/clientServices/deleteClientService.js
 */

const COLLECTION = 'gderpi_client_services';

async function deleteClientService(db, entrepriseId, clientServiceId) {
  const id = String(clientServiceId || '').trim();
  if (!id) return false;
  const res = await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), clientServiceId: id },
    { $set: { actif: false, updatedAt: new Date() } }
  );
  return res.matchedCount > 0;
}

module.exports = deleteClientService;
