/**
 * FICHIER : modules/annuaire/backend/services/services/deleteService.js
 */

const COLLECTION = 'annuaire_services';

async function deleteService(db, entrepriseId, serviceId) {
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    serviceId: String(serviceId).trim()
  });
  if (!doc) return false;

  const used = await db.collection('annuaire_contacts').countDocuments({
    entrepriseId: String(entrepriseId),
    serviceId: String(serviceId).trim()
  });
  if (used > 0) throw new Error('Service utilisé par des contacts');

  await db.collection(COLLECTION).deleteOne({
    entrepriseId: String(entrepriseId),
    serviceId: String(serviceId).trim()
  });
  return true;
}

module.exports = deleteService;
