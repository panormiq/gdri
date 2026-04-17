/**
 * Routes admin : rechargement des modules à chaud, redémarrage optionnel.
 * Réservé aux ADMIN_GDRI.
 * Fichier : backend/routes/admin.js
 */

const express = require('express');
const moduleRegistry = require('../core/module-registry');
const { loadNewModules } = require('../core/module-loader');
const { authenticateJWT } = require('../config/jwt');

/**
 * Middleware : exige le rôle ADMIN_GDRI
 */
function requireAdminGdri(req, res, next) {
  if (req.user && req.user.role === 'ADMIN_GDRI') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Accès refusé. Réservé aux administrateurs GDRI.'
  });
}

/**
 * Factory : crée le routeur admin en lui passant app et db (pour loadNewModules).
 * @param {Express} app - Instance Express
 * @param {object} db - Instance base MongoDB
 * @returns {express.Router}
 */
function createAdminRouter(app, db) {
  const router = express.Router();

  /**
   * POST /api/admin/modules/reload
   * Re-scanne les dossiers modules et charge les nouveaux modules sans redémarrer le serveur.
   */
  router.post('/modules/reload', authenticateJWT, requireAdminGdri, async (req, res) => {
    try {
      moduleRegistry.rediscover();
      const newlyLoaded = await loadNewModules(app, db);
      res.json({
        success: true,
        message: newlyLoaded.length > 0
          ? `${newlyLoaded.length} module(s) chargé(s) à chaud.`
          : 'Aucun nouveau module à charger.',
        newlyLoaded
      });
    } catch (error) {
      console.error('Erreur reload modules:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du rechargement des modules.'
      });
    }
  });

  /**
   * GET /api/admin/modules/status
   * Liste les modules enregistrés et leur état (chargé ou non).
   */
  router.get('/modules/status', authenticateJWT, requireAdminGdri, (req, res) => {
    const modules = moduleRegistry.getModules().map(m => ({
      name: m.name,
      displayName: m.displayName || m.name,
      loaded: m.loaded,
      enabled: m.enabled,
      routes: m.routes || []
    }));
    res.json({ success: true, modules });
  });

  /**
   * POST /api/admin/restart
   * Demande un arrêt propre du processus (PM2/systemd le redémarre).
   * Désactivé par défaut : définir ALLOW_ADMIN_RESTART=true pour l'activer.
   */
  router.post('/restart', authenticateJWT, requireAdminGdri, (req, res) => {
    if (process.env.ALLOW_ADMIN_RESTART !== 'true' && process.env.ALLOW_ADMIN_RESTART !== '1') {
      return res.status(403).json({
        success: false,
        message: 'Redémarrage désactivé. Définir ALLOW_ADMIN_RESTART=true pour l\'activer.'
      });
    }
    res.json({
      success: true,
      message: 'Redémarrage demandé. Le processus va s\'arrêter ; le gestionnaire (PM2, systemd) le relancera.'
    });
    setTimeout(() => {
      console.log('🔄 Arrêt demandé par l’admin (redémarrage)...');
      process.exit(0);
    }, 500);
  });

  return router;
}

module.exports = createAdminRouter;
