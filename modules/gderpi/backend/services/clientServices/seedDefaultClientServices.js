/**
 * FICHIER : modules/gderpi/backend/services/clientServices/seedDefaultClientServices.js
 */

const ensureClientServiceIndexes = require('./ensureClientServiceIndexes');
const normalizeClientService = require('./normalizeClientService');

const COLLECTION = 'gderpi_client_services';

const DEFAULTS = [
  { code: 'commercial', libelle: 'Commercial', sortOrder: 10 },
  { code: 'technique', libelle: 'Technique', sortOrder: 20 },
  { code: 'administration', libelle: 'Administration', sortOrder: 30 },
  { code: 'comptabilite', libelle: 'Comptabilité', sortOrder: 40 },
  { code: 'sav', libelle: 'SAV', sortOrder: 50 }
];

async function seedDefaultClientServices(db, entrepriseId) {
  await ensureClientServiceIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const count = await col.countDocuments({ entrepriseId: eid });
  if (count > 0) return false;
  const now = new Date();
  const docs = DEFAULTS.map((item) => {
    const normalized = normalizeClientService(item);
    return {
      entrepriseId: eid,
      clientServiceId: normalized.id,
      ...normalized,
      createdAt: now,
      updatedAt: now
    };
  });
  if (docs.length) await col.insertMany(docs);
  return true;
}

module.exports = seedDefaultClientServices;
