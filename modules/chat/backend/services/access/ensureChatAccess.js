/**
 * FICHIER : modules/chat/backend/services/access/ensureChatAccess.js
 * RÔLE : Vérifie que l'entité a le module chat et que l'utilisateur n'est pas refusé.
 */

const { ObjectId } = require('mongodb');
const getEntityId = require('./getEntityId');
const getUserId = require('./getUserId');
const { COLLECTION_ENTITY_USER_ACCESS } = require('../collections');

async function ensureChatAccess(database, req) {
  const entityId = getEntityId(req);
  const userId = getUserId(req);
  if (!entityId || !userId) {
    return { ok: false, status: 403, message: 'Entité ou utilisateur non déterminé.' };
  }

  const entitiesCol = database.getCollection('entities');
  const servicesCol = database.getCollection('services');
  const userAccessCol = database.getCollection(COLLECTION_ENTITY_USER_ACCESS);
  const chatServiceDoc = await servicesCol.findOne({
    $or: [
      { slug: 'chat' },
      { slug: 'module-chat-ia' },
      { name: /chat/i }
    ]
  });
  const entityDoc = await entitiesCol.findOne({ _id: new ObjectId(entityId) });
  const authorized = Array.isArray(entityDoc && entityDoc.services_authorized)
    ? entityDoc.services_authorized.map((x) => String(x))
    : [];
  if (!chatServiceDoc || !authorized.includes(String(chatServiceDoc._id))) {
    return { ok: false, status: 403, message: 'Module chat non autorisé pour cette entité.' };
  }

  const explicitUserAccess = await userAccessCol.findOne({ entity_id: entityId, user_id: userId });
  if (explicitUserAccess && explicitUserAccess.enabled === false) {
    return { ok: false, status: 403, message: 'Utilisateur non autorisé à utiliser le module chat.' };
  }

  return { ok: true, entityId, userId };
}

module.exports = ensureChatAccess;
