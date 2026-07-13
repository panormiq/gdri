/**
 * FICHIER : modules/pm/backend/services/integrations/annuaire/ensureGderpiClientForOrganisation.js
 * RÔLE : Crée un client GDERPI pour une org Annuaire si absent (pont à la demande).
 */

const path = require('path');
const isAnnuaireAvailable = require('./isAnnuaireAvailable');
const isGderpiAvailable = require('../isGderpiAvailable');

async function ensureGderpiClientForOrganisation(db, entrepriseId, organisationId) {
  if (!isAnnuaireAvailable() || !isGderpiAvailable()) return null;
  if (!organisationId) return null;

  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../../annuaire/backend/services/organisations/getOrganisationById.js'
  ));
  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) return null;
  if (org.gderpiClientId) return org;

  const createGderpiClientFromOrganisation = require(path.join(
    __dirname,
    '../../../../../annuaire/backend/services/integrations/gderpi/createGderpiClientFromOrganisation.js'
  ));
  const result = await createGderpiClientFromOrganisation(db, entrepriseId, organisationId);
  return result.organisation;
}

module.exports = ensureGderpiClientForOrganisation;
