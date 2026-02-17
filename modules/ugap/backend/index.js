/**
 * Module UGAP - Configurateur de bateaux
 * Fichier : modules/ugap/backend/index.js
 */

const routes = require('./routes');

/**
 * Initialise le module
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB principale (passée par GDRI)
 * 
 * Note: Les middlewares importent directement `database` depuis backend/config/database
 * pour accéder à database.getEntrepriseDb() (système multitenant).
 * C'est la même approche que tous les autres modules GDRI.
 */
async function init(app, db) {
  console.log('  🚤 Initialisation module UGAP v2.0...');
  
  // Créer les index MongoDB si nécessaire
  try {
    // Les collections seront créées automatiquement lors de la première insertion
    console.log('  ✅ Module UGAP initialisé');
  } catch (error) {
    console.warn('  ⚠️  Erreur lors de l\'initialisation UGAP:', error.message);
  }
}

/**
 * Retourne les routes du module
 * @returns {Express.Router} Routeur Express
 */
function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
