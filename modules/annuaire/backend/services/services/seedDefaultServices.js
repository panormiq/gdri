/**
 * FICHIER : modules/annuaire/backend/services/services/seedDefaultServices.js
 */

const ensureServiceIndexes = require('./ensureServiceIndexes');
const normalizeService = require('./normalizeService');

const COLLECTION = 'annuaire_services';

const DEFAULTS = [
  { code: 'direction', libelle: 'Direction', sortOrder: 5 },
  { code: 'commercial', libelle: 'Commercial', sortOrder: 10 },
  { code: 'technique', libelle: 'Technique', sortOrder: 20 },
  { code: 'administration', libelle: 'Administration', sortOrder: 30 },
  { code: 'comptabilite', libelle: 'Comptabilité', sortOrder: 40 },
  { code: 'achats', libelle: 'Achats', sortOrder: 45 },
  { code: 'sav', libelle: 'SAV', sortOrder: 50 }
];

async function seedDefaultServices(db, entrepriseId, organisationId) {
  await ensureServiceIndexes(db);
  const eid = String(entrepriseId);
  const oid = String(organisationId);
  const count = await db.collection(COLLECTION).countDocuments({
    entrepriseId: eid,
    organisationId: oid
  });
  if (count > 0) return false;

  const now = new Date();
  const docs = DEFAULTS.map((item) => {
    const normalized = normalizeService({ ...item, organisationId: oid });
    return {
      entrepriseId: eid,
      organisationId: oid,
      serviceId: normalized.id,
      ...normalized,
      createdAt: now,
      updatedAt: now
    };
  });
  if (docs.length) await db.collection(COLLECTION).insertMany(docs);
  return true;
}

module.exports = seedDefaultServices;
