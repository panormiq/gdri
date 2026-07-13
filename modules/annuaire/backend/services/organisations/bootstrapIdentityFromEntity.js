/**
 * FICHIER : modules/annuaire/backend/services/organisations/bootstrapIdentityFromEntity.js
 * RÔLE : Préremplit une identité entreprise depuis la fiche entité GDRI.
 */

const path = require('path');
const Entity = require(path.join(__dirname, '../../../../../backend/models/Entity'));
const { spreadAddressFromEntity } = require('./organisationAddress');

async function bootstrapIdentityFromEntity(entrepriseId, target = {}) {
  const eid = String(entrepriseId || '').trim();
  if (!eid || eid === 'SYSTEM') return { ...(target && typeof target === 'object' ? target : {}) };

  const out = { ...(target && typeof target === 'object' ? target : {}) };
  let entity = null;
  try {
    entity = await Entity.findById(eid);
  } catch (_) {
    return out;
  }
  if (!entity) return out;

  if (!String(out.raisonSociale || '').trim() && String(entity.name || '').trim()) {
    out.raisonSociale = String(entity.name).trim();
  }
  if (!String(out.siret || '').trim() && String(entity.siret || '').trim()) {
    out.siret = String(entity.siret).trim();
  }

  const addr = spreadAddressFromEntity(entity.address);
  if (!String(out.adresse || '').trim() && addr.adresse) {
    out.adresse = addr.adresse;
    if (!String(out.pays || '').trim()) out.pays = addr.pays;
  }

  const logo = String(entity.logo || '').trim();
  if (!String(out.logo || out.logoUrl || '').trim() && logo.startsWith('data:image/')) {
    out.logo = logo;
  }

  return out;
}

module.exports = bootstrapIdentityFromEntity;
