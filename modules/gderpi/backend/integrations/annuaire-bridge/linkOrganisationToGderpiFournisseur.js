/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/linkOrganisationToGderpiFournisseur.js
 * RÔLE : Pose le lien bidirectionnel organisation Annuaire ↔ fournisseur GDERPI.
 */

const path = require('path');

async function linkOrganisationToGderpiFournisseur(db, entrepriseId, organisationId, fournisseurId) {
  const updateOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/updateOrganisation'
  ));
  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/getOrganisationById'
  ));

  const orgId = String(organisationId || '').trim();
  const fid = String(fournisseurId || '').trim();
  if (!orgId || !fid) throw new Error('Lien annuaire/fournisseur incomplet');

  const org = await getOrganisationById(db, entrepriseId, orgId);
  if (!org) throw new Error('Organisation annuaire introuvable');

  const roles = [...new Set([...(org.roles || []), 'fournisseur'])];
  await updateOrganisation(db, entrepriseId, orgId, {
    gderpiFournisseurId: fid,
    roles
  });
}

module.exports = linkOrganisationToGderpiFournisseur;
