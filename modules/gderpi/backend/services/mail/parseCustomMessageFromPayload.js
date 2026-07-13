/**
 * Extrait un message personnalisé optionnel du corps d'une requête d'envoi.
 */

function parseCustomMessageFromPayload(payload) {
  const raw = payload?.customMessage ?? payload?.message ?? payload?.personalMessage ?? '';
  return String(raw || '').trim();
}

module.exports = parseCustomMessageFromPayload;
