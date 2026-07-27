/**
 * FICHIER : modules/chat/backend/services/conversations/startConversation.js
 * RÔLE : Crée une conversation (contexte optionnel, override serveur/modèle).
 */

const resolveRuntimeConfig = require('../runtime/resolveRuntimeConfig');
const applyServerModelOverrides = require('../utils/applyServerModelOverrides');
const { COLLECTION_CONVERSATIONS } = require('../collections');

async function startConversation(database, req, payload = {}) {
  applyServerModelOverrides(req, payload);
  const runtime = await resolveRuntimeConfig(database, req);
  if (!runtime.ok) return runtime;

  const now = new Date();
  const doc = {
    entity_id: runtime.entityId,
    user_id: runtime.userId,
    title: (payload.title && String(payload.title).trim()) || 'Nouvelle conversation',
    context: (payload.context && String(payload.context).trim()) || '',
    server_id: runtime.serverId,
    model: runtime.model,
    messages: [],
    created_at: now,
    updated_at: now
  };

  const col = database.getCollection(COLLECTION_CONVERSATIONS);
  const result = await col.insertOne(doc);
  return {
    ok: true,
    conversation: { ...doc, _id: result.insertedId.toString() }
  };
}

module.exports = startConversation;
