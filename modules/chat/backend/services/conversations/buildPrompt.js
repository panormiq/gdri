/**
 * FICHIER : modules/chat/backend/services/conversations/buildPrompt.js
 * RÔLE : Construit le prompt texte à partir du contexte, de l'historique et du message.
 */

function buildPrompt({ context, memory, userMessage }) {
  const safeContext = (context || '').trim();
  const memoryBlock = (memory || [])
    .map((item) => `[${item.role}] ${item.content}`)
    .join('\n');
  return [
    safeContext ? `Contexte:\n${safeContext}\n` : '',
    memoryBlock ? `Historique récent:\n${memoryBlock}\n` : '',
    `Question utilisateur:\n${userMessage}`
  ].filter(Boolean).join('\n');
}

module.exports = buildPrompt;
