/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/pushBoutiqueIdentityToAnnuaire.js
 * RÔLE : Pousse l'identité boutique GDERPI vers l'organisation Annuaire liée.
 */

const path = require('path');
const buildBoutiqueAnnuaireNotes = require(path.join(
  __dirname,
  '../../../../annuaire/backend/services/integrations/gderpi/buildBoutiqueAnnuaireNotes.js'
));

async function pushBoutiqueIdentityToAnnuaire(db, entrepriseId, boutique) {
  const orgId = String(boutique?.annuaireOrganisationId || '').trim();
  if (!orgId) return null;

  const updateOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/updateOrganisation.js'
  ));

  const patch = {
    raisonSociale: boutique.raisonSociale || boutique.nom,
    siret: boutique.siret,
    formeJuridique: boutique.formeJuridique,
    tvaIntracommunautaire: boutique.tvaIntracommunautaire,
    rcs: boutique.rcs,
    capitalSocial: boutique.capital,
    adresse: boutique.adresse,
    codePostal: boutique.codePostal,
    ville: boutique.ville,
    pays: boutique.pays,
    siteWeb: boutique.siteWeb,
    email: boutique.email,
    telephone: boutique.telephone,
    logo: boutique.logoUrl,
    notes: buildBoutiqueAnnuaireNotes(boutique),
    _syncFromGderpi: true
  };
  if (boutique.isPrincipale === true) {
    patch.isPrimaryCompany = true;
  }

  return updateOrganisation(db, entrepriseId, orgId, patch);
}

module.exports = pushBoutiqueIdentityToAnnuaire;
