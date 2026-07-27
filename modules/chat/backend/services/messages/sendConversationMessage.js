/**
 * FICHIER : modules/chat/backend/services/messages/sendConversationMessage.js
 * RÔLE : Envoi non-streaming : generate IA + append messages.
 */

const resolveRuntimeConfig = require('../runtime/resolveRuntimeConfig');
const applyServerModelOverrides = require('../utils/applyServerModelOverrides');
const parseObjectId = require('../utils/parseObjectId');
const buildPrompt = require('../conversations/buildPrompt');
const appendConversationMessages = require('../conversations/appendConversationMessages');
const { COLLECTION_CONVERSATIONS } = require('../collections');

async function sendConversationMessage(database, req, conversationId, payload = {}) {
  applyServerModelOverrides(req, payload);
  const runtime = await resolveRuntimeConfig(database, req);
  if (!runtime.ok) return runtime;

  const oid = parseObjectId(conversationId);
  if (!oid) {
    return { ok: false, status: 400, message: 'conversationId invalide.' };
  }

  const userMessage = payload && payload.message ? String(payload.message).trim() : '';
  if (!userMessage) {
    return { ok: false, status: 400, message: 'message est requis.' };
  }

  const col = database.getCollection(COLLECTION_CONVERSATIONS);
  const conversation = await col.findOne({
    _id: oid,
    entity_id: runtime.entityId,
    user_id: runtime.userId
  });
  if (!conversation) {
    return { ok: false, status: 404, message: 'Conversation introuvable.' };
  }

  const memorySize = Number(payload.memory_size) > 0 ? Number(payload.memory_size) : 20;
  const existingMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const memory = existingMessages.slice(-memorySize);

  const prompt = buildPrompt({
    context: conversation.context,
    memory,
    userMessage
  });

  const generation = await runtime.client.generate(prompt, {
    model: runtime.model,
    temperature: payload.temperature != null ? Number(payload.temperature) : undefined,
    max_tokens: payload.max_tokens != null ? Number(payload.max_tokens) : undefined
  });

  if (!generation || generation.success !== true) {
    return {
      ok: false,
      status: 502,
      message: generation && generation.error && generation.error.message
        ? generation.error.message
        : 'Erreur IA pendant la génération.'
    };
  }

  const assistantText = generation.data && generation.data.response
    ? String(generation.data.response)
    : '';

  const serialized = await appendConversationMessages(col, oid, {
    existingMessages,
    userMessage,
    assistantText,
    model: runtime.model,
    serverId: runtime.serverId
  });

  return {
    ok: true,
    response: assistantText,
    conversation: serialized,
    model: runtime.model,
    server_id: runtime.serverId
  };
}

module.exports = sendConversationMessage;
