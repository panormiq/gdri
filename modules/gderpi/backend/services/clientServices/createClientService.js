/**
 * FICHIER : modules/gderpi/backend/services/clientServices/createClientService.js
 */

const ensureClientServiceIndexes = require('./ensureClientServiceIndexes');
const normalizeClientService = require('./normalizeClientService');
const toClientServiceEntry = require('./toClientServiceEntry');

const COLLECTION = 'gderpi_client_services';

async function createClientService(db, entrepriseId, data) {
  await ensureClientServiceIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const normalized = normalizeClientService(data);
  if (!normalized.libelle) throw new Error('Libellé service requis');
  const taken = await col.findOne({ entrepriseId: eid, code: normalized.code });
  if (taken) throw new Error('Ce code service existe déjà');
  const now = new Date();
  const doc = {
    entrepriseId: eid,
    clientServiceId: normalized.id,
    ...normalized,
    createdAt: now,
    updatedAt: now
  };
  await col.insertOne(doc);
  return toClientServiceEntry(doc);
}

module.exports = createClientService;
