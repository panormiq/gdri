/**
 * FICHIER : modules/chat/backend/services/access/getEntityId.js
 * RÔLE : Résout l'entity_id depuis le JWT (ou ?entity_id= pour ADMIN_GDRI).
 */

function getEntityId(req) {
  const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
  if (isAdminGdri && req.query && req.query.entity_id) {
    return String(req.query.entity_id).trim();
  }
  const entityId = req.user && (req.user.currentEntrepriseId || req.user.entrepriseId);
  return entityId ? String(entityId) : null;
}

module.exports = getEntityId;
