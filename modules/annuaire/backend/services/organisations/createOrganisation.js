/**
 * FICHIER : modules/annuaire/backend/services/organisations/createOrganisation.js
 */

const ensureOrganisationIndexes = require('./ensureOrganisationIndexes');
const normalizeOrganisation = require('./normalizeOrganisation');
const toOrganisationEntry = require('./toOrganisationEntry');

const COLLECTION = 'annuaire_organisations';

async function createOrganisation(db, entrepriseId, data = {}) {
  await ensureOrganisationIndexes(db);
  const normalized = normalizeOrganisation(data);
  if (normalized.isOwnEntity) {
    throw new Error('Organisation interne réservée — utilisez seedOwnOrganisation');
  }
  if (normalized.type === 'entreprise' && !normalized.raisonSociale) {
    throw new Error('Raison sociale requise');
  }
  if (normalized.type === 'particulier' && !normalized.nom && !normalized.prenom) {
    throw new Error('Nom requis pour un particulier');
  }
  if (!normalized.roles.length) {
    normalized.roles = normalized.scope === 'interne' ? ['interne'] : ['prospect'];
  }

  const now = new Date();
  const doc = {
    entrepriseId: String(entrepriseId),
    organisationId: normalized.id,
    raisonSociale: normalized.raisonSociale,
    prenom: normalized.prenom,
    nom: normalized.nom,
    type: normalized.type,
    scope: normalized.scope,
    roles: normalized.roles,
    siret: normalized.siret,
    email: normalized.email,
    telephone: normalized.telephone,
    siteWeb: normalized.siteWeb,
    notes: normalized.notes,
    isOwnEntity: false,
    gderpiClientId: normalized.gderpiClientId,
    gderpiFournisseurId: normalized.gderpiFournisseurId,
    gderpiBoutiqueId: normalized.gderpiBoutiqueId,
    boutiqueOrganisationIds: normalized.boutiqueOrganisationIds,
    createdAt: now,
    updatedAt: now
  };
  await db.collection(COLLECTION).insertOne(doc);
  return toOrganisationEntry(doc);
}

module.exports = createOrganisation;
