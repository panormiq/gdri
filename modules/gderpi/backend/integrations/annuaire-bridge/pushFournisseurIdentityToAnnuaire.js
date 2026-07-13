/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/pushFournisseurIdentityToAnnuaire.js
 * RÔLE : Pousse l'identité fournisseur GDERPI vers l'organisation Annuaire liée.
 */

const path = require('path');

async function pushFournisseurIdentityToAnnuaire(db, entrepriseId, fournisseur) {
  const orgId = String(fournisseur?.annuaireOrganisationId || '').trim();
  if (!orgId) return null;

  const updateOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/updateOrganisation'
  ));

  return updateOrganisation(db, entrepriseId, orgId, {
    raisonSociale: fournisseur.raisonSociale,
    siret: fournisseur.siret,
    siteWeb: fournisseur.siteWeb,
    notes: fournisseur.notes
  });
}

module.exports = pushFournisseurIdentityToAnnuaire;
