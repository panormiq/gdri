/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/linkOrganisationToGderpiClient.js
 * RÔLE : Pose le lien bidirectionnel organisation Annuaire ↔ client GDERPI.
 */

const path = require('path');

async function linkOrganisationToGderpiClient(db, entrepriseId, organisationId, clientId) {
  const updateOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/updateOrganisation'
  ));
  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/getOrganisationById'
  ));

  const orgId = String(organisationId || '').trim();
  const cid = String(clientId || '').trim();
  if (!orgId || !cid) throw new Error('Lien annuaire/client incomplet');

  const org = await getOrganisationById(db, entrepriseId, orgId);
  if (!org) throw new Error('Organisation annuaire introuvable');

  const roles = [...new Set([...(org.roles || []).filter((r) => r !== 'prospect'), 'client'])];
  await updateOrganisation(db, entrepriseId, orgId, {
    gderpiClientId: cid,
    roles
  });
}

module.exports = linkOrganisationToGderpiClient;
