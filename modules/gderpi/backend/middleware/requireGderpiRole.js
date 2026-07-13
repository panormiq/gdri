/**
 * FICHIER : modules/gderpi/backend/middleware/requireGderpiRole.js
 * RÔLE : Factory middleware — contrôle les rôles autorisés pour GDERPI.
 *
 * ENTRÉES : liste de rôles, req.user
 * SORTIES : next() ou 403
 *
 * DÉPEND DE : aucun
 * NE PAS : résolution DB entreprise
 *
 * APPELÉ PAR : routes.js
 */

function requireGderpiRole(roles = []) {
  const allowed = new Set([...(roles || []), 'ADMIN_GDRI', 'superadmin']);

  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    if (!allowed.has(user.role)) {
      return res.status(403).json({ success: false, message: 'Accès refusé pour ce module' });
    }
    next();
  };
}

module.exports = { requireGderpiRole };
