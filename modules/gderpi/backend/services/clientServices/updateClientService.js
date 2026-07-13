/**
 * FICHIER : modules/gderpi/backend/services/clientServices/updateClientService.js
 */

const normalizeClientService = require('./normalizeClientService');
const getClientServiceById = require('./getClientServiceById');

const COLLECTION = 'gderpi_client_services';

async function updateClientService(db, entrepriseId, clientServiceId, data) {
  const id = String(clientServiceId || '').trim();
  if (!id) throw new Error('Identifiant service requis');
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const existing = await col.findOne({ entrepriseId: eid, clientServiceId: id });
  if (!existing) throw new Error('Service introuvable');
  const normalized = normalizeClientService({ ...existing, ...data, id });
  if (!normalized.libelle) throw new Error('Libellé service requis');
  const conflict = await col.findOne({
    entrepriseId: eid,
    code: normalized.code,
    clientServiceId: { $ne: id }
  });
  if (conflict) throw new Error('Ce code service existe déjà');
  const now = new Date();
  await col.updateOne(
    { entrepriseId: eid, clientServiceId: id },
    { $set: { ...normalized, updatedAt: now } }
  );
  return getClientServiceById(db, eid, id);
}

module.exports = updateClientService;
