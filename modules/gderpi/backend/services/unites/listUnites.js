/**
 * FICHIER : modules/gderpi/backend/services/unites/listUnites.js
 */

const seedDefaultUnites = require('./seedDefaultUnites');
const toUniteEntry = require('./toUniteEntry');

const COLLECTION = 'gderpi_unites';

async function listUnites(db, entrepriseId, options = {}) {
  await seedDefaultUnites(db, entrepriseId);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const query = { entrepriseId: eid };
  if (options.actifOnly) query.actif = { $ne: false };
  const q = String(options.search || '').trim().toLowerCase();
  let cursor = col.find(query).sort({ sortOrder: 1, libelle: 1 });
  const docs = await cursor.toArray();
  let items = docs.map(toUniteEntry).filter(Boolean);
  if (q) {
    items = items.filter((u) =>
      [u.code, u.libelle].join(' ').toLowerCase().includes(q)
    );
  }
  return items;
}

module.exports = listUnites;
