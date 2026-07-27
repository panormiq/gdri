/**
 * FICHIER : modules/chat/backend/services/utils/consumeSseBuffer.js
 * RÔLE : Parse un buffer SSE (événements séparés par \\n\\n) et appelle onJson pour chaque data.
 * @returns {string} reste non consommé
 */

function consumeSseBuffer(buffer, onJson) {
  let rest = buffer;
  let idx;
  while ((idx = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        onJson(JSON.parse(raw));
      } catch (_) {
        /* ignore */
      }
    }
  }
  return rest;
}

module.exports = consumeSseBuffer;
