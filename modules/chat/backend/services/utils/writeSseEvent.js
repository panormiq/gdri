/**
 * FICHIER : modules/chat/backend/services/utils/writeSseEvent.js
 * RÔLE : Écrit un événement SSE JSON sur la réponse HTTP.
 */

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

module.exports = writeSseEvent;
