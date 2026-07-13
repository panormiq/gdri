/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/maybeSyncGderpiFromOrganisation.js
 * RÔLE : Déclenche la sync GDERPI si l'organisation est liée (client, fournisseur, boutique).
 */

const syncGderpiClientFromOrganisation = require('./syncGderpiClientFromOrganisation');
const syncGderpiFournisseurFromOrganisation = require('./syncGderpiFournisseurFromOrganisation');
const syncGderpiBoutiqueFromOrganisation = require('./syncGderpiBoutiqueFromOrganisation');
const getOrganisationById = require('../../organisations/getOrganisationById');

async function maybeSyncGderpiFromOrganisation(db, entrepriseId, organisationId) {
  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) return null;

  if (org.gderpiClientId) {
    return syncGderpiClientFromOrganisation(db, entrepriseId, organisationId);
  }
  if (org.gderpiFournisseurId) {
    return syncGderpiFournisseurFromOrganisation(db, entrepriseId, organisationId);
  }
  if (org.gderpiBoutiqueId) {
    return syncGderpiBoutiqueFromOrganisation(db, entrepriseId, organisationId);
  }
  return null;
}

module.exports = maybeSyncGderpiFromOrganisation;
