/**
 * FICHIER : modules/annuaire/backend/services/organisations/syncEntityToOwnOrganisation.js
 * RÔLE : Descend la fiche entité GDRI vers Annuaire (option A : si non personnalisée par le client).
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));
const { ObjectId } = require('mongodb');
const hasGderpiBoutiques = require('./hasGderpiBoutiques');
const ensureInternalOrganisation = require('./ensureInternalOrganisation');
const { spreadAddressFromEntity } = require('./organisationAddress');

const COLLECTION = 'annuaire_organisations';

async function syncEntityToOwnOrganisation(entrepriseId) {
  const eid = String(entrepriseId);
  if (!eid || eid === 'SYSTEM') return null;

  const mainDb = await database.connect();
  let entity = null;
  try {
    entity = await mainDb.collection('entities').findOne({ _id: new ObjectId(eid) });
  } catch (_) {
    return null;
  }
  if (!entity) return null;

  const entrepriseDb = await database.getEntrepriseDb(eid);
  if (await hasGderpiBoutiques(entrepriseDb, eid)) {
    return null;
  }

  await ensureInternalOrganisation(entrepriseDb, eid);
  const own = await entrepriseDb.collection(COLLECTION).findOne({ entrepriseId: eid, isOwnEntity: true });
  if (!own) return null;

  if (String(own.identitySource || 'bootstrap') === 'client') {
    return null;
  }

  const update = { updatedAt: new Date() };
  const entityName = String(entity.name || '').trim();
  const entitySiret = String(entity.siret || '').trim();
  const currentName = String(own.raisonSociale || '').trim();

  if (entityName && (!currentName || currentName === 'Mon entreprise')) {
    update.raisonSociale = entityName;
  }
  if (entitySiret && !String(own.siret || '').trim()) {
    update.siret = entitySiret;
  }

  const addr = spreadAddressFromEntity(entity.address);
  if (addr.adresse && !String(own.adresse || '').trim()) {
    update.adresse = addr.adresse;
    if (!String(own.pays || '').trim()) update.pays = addr.pays;
  }

  const entityLogo = String(entity.logo || '').trim();
  if (entityLogo && entityLogo.startsWith('data:image/') && !String(own.logo || '').trim()) {
    update.logo = entityLogo;
  }

  if (Object.keys(update).length <= 1) return null;

  await entrepriseDb.collection(COLLECTION).updateOne({ _id: own._id }, { $set: update });
  return update;
}

module.exports = syncEntityToOwnOrganisation;
