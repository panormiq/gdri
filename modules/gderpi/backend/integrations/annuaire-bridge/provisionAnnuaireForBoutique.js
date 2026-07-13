/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/provisionAnnuaireForBoutique.js
 * RÔLE : Crée ou lie une organisation Annuaire interne pour une boutique GDERPI.
 */

const path = require('path');
const buildBoutiqueAnnuaireNotes = require(path.join(
  __dirname,
  '../../../../annuaire/backend/services/integrations/gderpi/buildBoutiqueAnnuaireNotes.js'
));
const bootstrapIdentityFromEntity = require(path.join(
  __dirname,
  '../../../../annuaire/backend/services/organisations/bootstrapIdentityFromEntity.js'
));
const setPrimaryCompanyOrganisation = require(path.join(
  __dirname,
  '../../../../annuaire/backend/services/organisations/setPrimaryCompanyOrganisation.js'
));

async function provisionAnnuaireForBoutique(db, entrepriseId, normalized, rawData = {}) {
  const upsertOrganisationFromGderpi = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/integrations/gderpi/upsertOrganisationFromGderpi.js'
  ));
  const importContactsForGderpiOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/integrations/gderpi/importContactsForGderpiOrganisation.js'
  ));

  const fromAnnuaire = String(rawData._fromAnnuaireOrganisationId || '').trim();
  const requestedOrgId = fromAnnuaire || String(rawData.annuaireOrganisationId || '').trim();
  const boutiqueId = String(normalized.id || '').trim();
  const label = String(normalized.raisonSociale || normalized.nom || 'Boutique').trim();

  const existingBoutiqueCount = await db.collection('gderpi_boutiques').countDocuments({
    entrepriseId: String(entrepriseId)
  });
  const shouldBePrimary = normalized.isPrincipale === true || existingBoutiqueCount === 0;

  let identityPayload = {
    organisationId: requestedOrgId || `gderpi-boutique-${boutiqueId}`,
    raisonSociale: label,
    type: 'entreprise',
    scope: 'interne',
    roles: ['boutique'],
    siret: normalized.siret,
    formeJuridique: normalized.formeJuridique,
    tvaIntracommunautaire: normalized.tvaIntracommunautaire,
    rcs: normalized.rcs,
    capitalSocial: normalized.capital,
    adresse: normalized.adresse,
    codePostal: normalized.codePostal,
    ville: normalized.ville,
    pays: normalized.pays,
    email: normalized.email,
    telephone: normalized.telephone,
    siteWeb: normalized.siteWeb,
    logo: normalized.logoUrl,
    notes: buildBoutiqueAnnuaireNotes(normalized),
    gderpiBoutiqueId: boutiqueId
  };
  identityPayload = await bootstrapIdentityFromEntity(entrepriseId, identityPayload);

  const { org } = await upsertOrganisationFromGderpi(db, entrepriseId, identityPayload);

  await importContactsForGderpiOrganisation(
    db,
    entrepriseId,
    org.organisationId,
    normalized.contacts,
    'interne'
  );

  const removeRedundantOwnOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/removeRedundantOwnOrganisation.js'
  ));
  await removeRedundantOwnOrganisation(db, entrepriseId);

  if (shouldBePrimary) {
    await setPrimaryCompanyOrganisation(db, entrepriseId, org.organisationId);
  }

  return org.organisationId;
}

module.exports = provisionAnnuaireForBoutique;
