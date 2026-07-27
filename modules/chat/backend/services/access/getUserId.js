/**
 * FICHIER : modules/chat/backend/services/access/getUserId.js
 * RÔLE : Résout l'user_id depuis le JWT.
 */

function getUserId(req) {
  return req.user && (req.user.user_id || req.user.sub || req.user._id)
    ? String(req.user.user_id || req.user.sub || req.user._id)
    : null;
}

module.exports = getUserId;
