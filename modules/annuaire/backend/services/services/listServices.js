/**
 * FICHIER : modules/annuaire/backend/services/services/listServices.js
 */

const ensureServiceIndexes = require('./ensureServiceIndexes');
const seedDefaultServices = require('./seedDefaultServices');
const toServiceEntry = require('./toServiceEntry');

async function listServices(db, entrepriseId, options = {}) {
  await ensureServiceIndexes(db);
  const organisationId = String(options.organisationId || '').trim();
  if (!organisationId) throw new Error('organisationId requis');

  const org = await db.collection('annuaire_organisations').findOne({
    entrepriseId: String(entrepriseId),
    organisationId
  });
  if (!org) throw new Error('Organisation introuvable');

  if (org.isOwnEntity || org.gderpiBoutiqueId || org.scope === 'interne') {
    await seedDefaultServices(db, entrepriseId, organisationId);
  }

  const docs = await db.collection('annuaire_services')
    .find({ entrepriseId: String(entrepriseId), organisationId })
    .sort({ sortOrder: 1, libelle: 1 })
    .toArray();

  let items = docs.map(toServiceEntry);
  const q = String(options.search || '').trim().toLowerCase();
  if (q) {
    items = items.filter((s) => [s.code, s.libelle].join(' ').toLowerCase().includes(q));
  }
  return items;
}

module.exports = listServices;
