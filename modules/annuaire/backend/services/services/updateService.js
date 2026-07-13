/**
 * FICHIER : modules/annuaire/backend/services/services/updateService.js
 */

const getOrganisationById = require('../organisations/getOrganisationById');
const toServiceEntry = require('./toServiceEntry');
const makeServiceCode = require('./makeServiceCode');

const COLLECTION = 'annuaire_services';

async function updateService(db, entrepriseId, serviceId, patch = {}) {
  const existing = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    serviceId: String(serviceId).trim()
  });
  if (!existing) throw new Error('Service introuvable');

  const p = patch && typeof patch === 'object' ? patch : {};
  const update = { updatedAt: new Date() };
  if (p.libelle !== undefined) {
    update.libelle = String(p.libelle || '').trim();
    if (p.code === undefined && update.libelle) update.code = makeServiceCode(update.libelle);
  }
  if (p.code !== undefined) update.code = makeServiceCode(p.code);
  if (p.actif !== undefined) update.actif = p.actif !== false;
  if (p.sortOrder !== undefined) update.sortOrder = Math.round(Number(p.sortOrder) || 0);

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), serviceId: String(serviceId).trim() },
    { $set: update }
  );

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    serviceId: String(serviceId).trim()
  });
  return toServiceEntry(doc);
}

module.exports = updateService;
