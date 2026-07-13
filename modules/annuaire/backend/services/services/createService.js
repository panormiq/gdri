/**
 * FICHIER : modules/annuaire/backend/services/services/createService.js
 */

const ensureServiceIndexes = require('./ensureServiceIndexes');
const getOrganisationById = require('../organisations/getOrganisationById');
const normalizeService = require('./normalizeService');
const toServiceEntry = require('./toServiceEntry');

const COLLECTION = 'annuaire_services';

async function createService(db, entrepriseId, data = {}) {
  await ensureServiceIndexes(db);
  const organisationId = String(data.organisationId || '').trim();
  if (!organisationId) throw new Error('organisationId requis');

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) throw new Error('Organisation introuvable');

  const normalized = normalizeService({ ...data, organisationId });
  if (!normalized.libelle) throw new Error('Libellé du service requis');

  const now = new Date();
  const doc = {
    entrepriseId: String(entrepriseId),
    organisationId,
    serviceId: normalized.id,
    code: normalized.code,
    libelle: normalized.libelle,
    actif: normalized.actif,
    sortOrder: normalized.sortOrder,
    createdAt: now,
    updatedAt: now
  };
  await db.collection(COLLECTION).insertOne(doc);
  return toServiceEntry(doc);
}

module.exports = createService;
