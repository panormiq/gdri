/**
 * Middleware de contrôle d'accès Workflow
 * Fichier : backend/modules/workflow/middleware/requireWorkflowRole.js
 */

function requireWorkflowRole(roles = []) {
  const allowed = new Set([...(roles || []), 'ADMIN_GDRI', 'superadmin']);

  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    if (!allowed.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé pour ce module'
      });
    }

    next();
  };
}

module.exports = { requireWorkflowRole };
