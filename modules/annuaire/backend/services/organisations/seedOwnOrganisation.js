/**
 * FICHIER : modules/annuaire/backend/services/organisations/seedOwnOrganisation.js
 */

const ensureOrganisationIndexes = require('./ensureOrganisationIndexes');
const toOrganisationEntry = require('./toOrganisationEntry');

const COLLECTION = 'annuaire_organisations';

async function seedOwnOrganisation(db, entrepriseId) {
  await ensureOrganisationIndexes(db);
  const eid = String(entrepriseId);
  const existing = await db.collection(COLLECTION).findOne({ entrepriseId: eid, isOwnEntity: true });
  if (existing) return toOrganisationEntry(existing);

  const now = new Date();
  const doc = {
    entrepriseId: eid,
    organisationId: `own-${eid}`,
    raisonSociale: 'Mon entreprise',
    type: 'entreprise',
    scope: 'interne',
    roles: ['interne'],
    isOwnEntity: true,
    identitySource: 'bootstrap',
    isPrimaryCompany: true,
    siret: '',
    formeJuridique: '',
    tvaIntracommunautaire: '',
    rcs: '',
    capitalSocial: '',
    adresse: '',
    adresseComplement: '',
    codePostal: '',
    ville: '',
    pays: 'France',
    logo: '',
    email: '',
    telephone: '',
    siteWeb: '',
    notes: '',
    gderpiClientId: null,
    gderpiFournisseurId: null,
    createdAt: now,
    updatedAt: now
  };
  await db.collection(COLLECTION).insertOne(doc);
  return toOrganisationEntry(doc);
}

module.exports = seedOwnOrganisation;
