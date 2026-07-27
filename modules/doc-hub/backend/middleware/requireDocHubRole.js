/**
 * FICHIER : modules/doc-hub/backend/middleware/requireDocHubRole.js
 * RÔLE : Contrôle d'accès par rôles du module Doc-Hub (ADMIN_GDRI/superadmin toujours autorisés).
 */

function requireDocHubRole(roles = []) {
  const allowed = new Set([...(roles || []), 'ADMIN_GDRI', 'superadmin']);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { requireDocHubRole };
