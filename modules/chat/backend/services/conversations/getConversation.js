/**
 * FICHIER : modules/chat/backend/services/conversations/getConversation.js
 * RÔLE : Charge une conversation scopée entity+user.
 */

const ensureChatAccess = require('../access/ensureChatAccess');
const parseObjectId = require('../utils/parseObjectId');
const serializeConversation = require('./serializeConversation');
const { COLLECTION_CONVERSATIONS } = require('../collections');

async function getConversation(database, req, conversationId) {
  const access = await ensureChatAccess(database, req);
  if (!access.ok) return access;

  const oid = parseObjectId(conversationId);
  if (!oid) {
    return { ok: false, status: 400, message: 'conversationId invalide.' };
  }

  const col = database.getCollection(COLLECTION_CONVERSATIONS);
  const doc = await col.findOne({
    _id: oid,
    entity_id: access.entityId,
    user_id: access.userId
  });
  if (!doc) {
    return { ok: false, status: 404, message: 'Conversation introuvable.' };
  }
  return { ok: true, conversation: serializeConversation(doc) };
}

module.exports = getConversation;
