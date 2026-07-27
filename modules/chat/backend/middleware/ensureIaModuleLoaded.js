/**
 * FICHIER : modules/chat/backend/middleware/ensureIaModuleLoaded.js
 * RÔLE : Vérifie que le module IA (dépendance Chat) est chargé.
 */

const path = require('path');
const moduleRegistry = require(path.join(__dirname, '../../../../backend/core/module-registry'));

function ensureIaModuleLoaded(req, res, next) {
  const iaModule = moduleRegistry.getModule('ia');
  if (!iaModule || iaModule.loaded !== true) {
    return res.status(503).json({
      success: false,
      message: 'Module ServerIA non disponible. Activez le module IA avant d’utiliser Chat.',
      code: 'CHAT_DEPENDENCY_IA_MISSING'
    });
  }
  return next();
}

module.exports = { ensureIaModuleLoaded };
