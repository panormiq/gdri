/**
 * FICHIER : modules/annuaire/backend/services/organisations/syncOwnOrganisationFromEntity.js
 * RÔLE : Alimente l'organisation siège depuis la fiche entité GDRI (option A : si bootstrap).
 */

const path = require('path');
const { ObjectId } = require('mongodb');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));
const { spreadAddressFromEntity } = require('./organisationAddress');

const COLLECTION = 'annuaire_organisations';

async function syncOwnOrganisationFromEntity(db, entrepriseId) {
  const eid = String(entrepriseId);
  if (!eid || eid === 'SYSTEM') return null;

  let entity = null;
  try {
    const mainDb = await database.connect();
    entity = await mainDb.collection('entities').findOne({ _id: new ObjectId(eid) });
  } catch (_) {
    return null;
  }
  if (!entity) return null;

  const own = await db.collection(COLLECTION).findOne({ entrepriseId: eid, isOwnEntity: true });
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

  if (entity.address && !String(own.adresse || '').trim() && !update.adresse) {
    const legacyAddr = String(entity.address).trim();
    if (legacyAddr) update.adresse = legacyAddr;
  }

  if (Object.keys(update).length <= 1) return null;

  await db.collection(COLLECTION).updateOne({ _id: own._id }, { $set: update });
  return update;
}

module.exports = syncOwnOrganisationFromEntity;
