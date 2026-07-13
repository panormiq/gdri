/**
 * FICHIER : modules/annuaire/backend/services/organisations/organisationToEntrepriseInfo.js
 * RÔLE : Projection organisation Annuaire → format entrepriseInfo (modules consommateurs).
 */

function organisationToEntrepriseInfo(org, { entityLogo = '' } = {}) {
  const o = org && typeof org === 'object' ? org : {};
  const logo = String(o.logo || o.logoUrl || entityLogo || '').trim();
  return {
    raisonSociale: String(o.raisonSociale || '').trim(),
    formeJuridique: String(o.formeJuridique || '').trim(),
    adresse: String(o.adresse || '').trim(),
    adresseComplement: String(o.adresseComplement || '').trim(),
    codePostal: String(o.codePostal || '').trim(),
    ville: String(o.ville || '').trim(),
    pays: String(o.pays || 'France').trim() || 'France',
    siret: String(o.siret || '').trim(),
    tvaIntracommunautaire: String(o.tvaIntracommunautaire || '').trim(),
    rcs: String(o.rcs || '').trim(),
    capitalSocial: String(o.capitalSocial || '').trim(),
    telephone: String(o.telephone || '').trim(),
    email: String(o.email || '').trim(),
    siteWeb: String(o.siteWeb || '').trim(),
    logoUrl: logo
  };
}

module.exports = organisationToEntrepriseInfo;
