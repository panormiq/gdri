/**
 * FICHIER : modules/chat/backend/services/utils/applyServerModelOverrides.js
 * RÔLE : Fusionne server_id / model du payload dans req.body pour resolveRuntimeConfig.
 */

function applyServerModelOverrides(req, payload = {}) {
  if (payload && payload.server_id) {
    req.body = { ...(req.body || {}), server_id: payload.server_id };
  }
  if (payload && payload.model) {
    req.body = { ...(req.body || {}), model: payload.model };
  }
}

module.exports = applyServerModelOverrides;
