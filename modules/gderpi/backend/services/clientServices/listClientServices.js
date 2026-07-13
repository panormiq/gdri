/**
 * FICHIER : modules/gderpi/backend/services/clientServices/listClientServices.js
 */

const seedDefaultClientServices = require('./seedDefaultClientServices');
const toClientServiceEntry = require('./toClientServiceEntry');

const COLLECTION = 'gderpi_client_services';

async function listClientServices(db, entrepriseId, options = {}) {
  await seedDefaultClientServices(db, entrepriseId);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const query = { entrepriseId: eid };
  if (options.actifOnly) query.actif = { $ne: false };
  const q = String(options.search || '').trim().toLowerCase();
  const docs = await col.find(query).sort({ sortOrder: 1, libelle: 1 }).toArray();
  let items = docs.map(toClientServiceEntry).filter(Boolean);
  if (q) {
    items = items.filter((s) =>
      [s.code, s.libelle].join(' ').toLowerCase().includes(q)
    );
  }
  return items;
}

module.exports = listClientServices;
