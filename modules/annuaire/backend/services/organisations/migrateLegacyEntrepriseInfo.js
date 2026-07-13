/**
 * FICHIER : modules/annuaire/backend/services/organisations/migrateLegacyEntrepriseInfo.js
 * RÔLE : Migration ponctuelle ugap_devis_settings.entrepriseInfo → organisation siège.
 */

const { getCompanyOrganisationDoc } = require('./getCompanyOrganisation');

const COLLECTION = 'annuaire_organisations';

const IDENTITY_FIELDS = [
  'raisonSociale', 'formeJuridique', 'adresse', 'adresseComplement', 'codePostal', 'ville', 'pays',
  'siret', 'tvaIntracommunautaire', 'rcs', 'capitalSocial', 'telephone', 'email', 'siteWeb', 'logoUrl'
];

function hasIdentityData(info) {
  const i = info && typeof info === 'object' ? info : {};
  return IDENTITY_FIELDS.some((field) => {
    const value = field === 'logoUrl' ? i.logoUrl || i.logo : i[field];
    return String(value || '').trim() !== '';
  });
}

function isAnnuaireIdentityEmpty(org) {
  const o = org && typeof org === 'object' ? org : {};
  return !String(o.raisonSociale || '').trim()
    && !String(o.siret || '').trim()
    && !String(o.adresse || '').trim()
    && !String(o.email || '').trim()
    && !String(o.telephone || '').trim();
}

async function migrateLegacyEntrepriseInfo(db, entrepriseId, legacyInfo) {
  if (!hasIdentityData(legacyInfo)) return null;

  const own = await getCompanyOrganisationDoc(db, entrepriseId);
  if (!own || !own.isOwnEntity) return null;
  if (!isAnnuaireIdentityEmpty(own)) return null;

  const legacy = legacyInfo && typeof legacyInfo === 'object' ? legacyInfo : {};
  const update = {
    updatedAt: new Date(),
    identitySource: 'client'
  };

  IDENTITY_FIELDS.forEach((field) => {
    if (field === 'logoUrl') {
      const logo = String(legacy.logoUrl || legacy.logo || '').trim();
      if (logo) update.logo = logo;
      return;
    }
    const value = String(legacy[field] || '').trim();
    if (value) update[field] = value;
  });

  if (Object.keys(update).length <= 2) return null;

  await db.collection(COLLECTION).updateOne({ _id: own._id }, { $set: update });
  return update;
}

module.exports = {
  migrateLegacyEntrepriseInfo,
  hasIdentityData
};
