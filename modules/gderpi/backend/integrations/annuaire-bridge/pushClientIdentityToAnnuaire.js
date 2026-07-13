/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/pushClientIdentityToAnnuaire.js
 * RÔLE : Pousse l'identité client GDERPI vers l'organisation Annuaire liée (sans contacts).
 */

const path = require('path');

async function pushClientIdentityToAnnuaire(db, entrepriseId, client) {
  const orgId = String(client?.annuaireOrganisationId || '').trim();
  if (!orgId) return null;

  const updateOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/updateOrganisation'
  ));

  return updateOrganisation(db, entrepriseId, orgId, {
    type: client.type,
    raisonSociale: client.raisonSociale,
    prenom: client.prenom,
    nom: client.nom,
    siret: client.siret,
    siteWeb: client.siteWeb,
    notes: client.notes
  });
}

module.exports = pushClientIdentityToAnnuaire;
