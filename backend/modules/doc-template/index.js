/**
 * Module Doc-Template - Gestion de documents et templates
 * Fichier : backend/modules/doc-template/index.js
 * 
 * Fonction : Point d'entrée du module Doc-Template
 * - Gère les collections, templates et documents
 * - Utilise multi-DB (une base par entreprise)
 */

const database = require('../../config/database');

/**
 * Initialise le module Doc-Template (appelé par le système de modules)
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB (base principale)
 */
async function init(app, db) {
  console.log('  📄 Initialisation module Doc-Template...');
  
  // Le module est initialisé, les routes seront chargées par loadModules
  console.log('  ✅ Module Doc-Template prêt');
}

/**
 * Retourne les routes du module Doc-Template
 * @returns {Express.Router} Routeur Express avec routes API
 */
function getRoutes() {
  return require('./routes');
}

module.exports = {
  init,
  routes: getRoutes
};
