/**
 * FICHIER : modules/chat/backend/services/conversations/appendConversationMessages.js
 * RÔLE : Persiste les messages user/assistant et met à jour model/server_id.
 */

const serializeConversation = require('./serializeConversation');

async function appendConversationMessages(col, oid, {
  existingMessages,
  userMessage,
  assistantText,
  model,
  serverId
}) {
  const now = new Date();
  const nextMessages = [
    ...existingMessages,
    { role: 'user', content: userMessage, created_at: now.toISOString() },
    { role: 'assistant', content: assistantText, created_at: now.toISOString() }
  ];

  await col.updateOne(
    { _id: oid },
    {
      $set: {
        messages: nextMessages,
        model,
        server_id: serverId,
        updated_at: now
      }
    }
  );

  const updated = await col.findOne({ _id: oid });
  return serializeConversation(updated);
}

module.exports = appendConversationMessages;
