/**
 * FICHIER : modules/chat/backend/services/settings/listEntityUserAccess.js
 * RÔLE : Liste les users de l'entité avec leur flag d'accès chat.
 */

const { ObjectId } = require('mongodb');
const { COLLECTION_ENTITY_USER_ACCESS } = require('../collections');

async function listEntityUserAccess(database, entityId) {
  let entityOid;
  try {
    entityOid = new ObjectId(entityId);
  } catch (_) {
    return { ok: false, status: 400, message: 'entity_id invalide.' };
  }

  const usersCol = database.getCollection('users');
  const accessCol = database.getCollection(COLLECTION_ENTITY_USER_ACCESS);
  const [users, accessList] = await Promise.all([
    usersCol.find({
      $or: [
        { currentEntrepriseId: entityOid },
        { 'entreprises.entrepriseId': entityOid }
      ]
    }).project({ _id: 1, email: 1, role: 1 }).toArray(),
    accessCol.find({ entity_id: entityId }).toArray()
  ]);

  const accessMap = new Map(accessList.map((a) => [String(a.user_id), a.enabled !== false]));
  const out = users.map((u) => {
    const uid = String(u._id);
    return {
      user_id: uid,
      email: u.email || '',
      role: u.role || '',
      enabled: accessMap.has(uid) ? accessMap.get(uid) : true
    };
  });

  return { ok: true, data: out };
}

module.exports = listEntityUserAccess;
