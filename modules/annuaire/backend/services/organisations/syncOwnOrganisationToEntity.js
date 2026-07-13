/**
 * FICHIER : modules/annuaire/backend/services/organisations/syncOwnOrganisationToEntity.js
 * RÔLE : Remonte l'identité entreprise (Annuaire) vers la fiche entité GDRI.
 */

const path = require('path');
const { formatAddressForEntity } = require('./organisationAddress');
const { getCompanyOrganisationDoc } = require('./getCompanyOrganisation');

async function syncOwnOrganisationToEntity(db, entrepriseId) {
  const eid = String(entrepriseId);
  if (!eid || eid === 'SYSTEM') return null;

  const own = await getCompanyOrganisationDoc(db, eid);
  if (!own) return null;

  const Entity = require(path.join(__dirname, '../../../../../backend/models/Entity'));
  const update = { updated_at: new Date() };

  const name = String(own.raisonSociale || '').trim();
  if (name) update.name = name;

  const siret = String(own.siret || '').trim();
  if (siret) update.siret = siret;

  const address = formatAddressForEntity(own);
  if (address) update.address = address;

  const logo = String(own.logo || '').trim();
  if (logo && logo.startsWith('data:image/')) {
    update.logo = logo;
  }

  if (Object.keys(update).length <= 1) return null;

  const entity = await Entity.update(eid, update);
  return entity ? update : null;
}

module.exports = syncOwnOrganisationToEntity;
