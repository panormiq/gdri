/**
 * FICHIER : modules/chat/backend/services/conversations/serializeConversation.js
 * RÔLE : Mappe un document conversation Mongo vers la forme API.
 */

function serializeConversation(doc) {
  return {
    _id: doc._id.toString(),
    entity_id: doc.entity_id,
    user_id: doc.user_id,
    title: doc.title || 'Conversation',
    context: doc.context || '',
    server_id: doc.server_id || null,
    model: doc.model || null,
    messages: Array.isArray(doc.messages) ? doc.messages : [],
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
}

module.exports = serializeConversation;
