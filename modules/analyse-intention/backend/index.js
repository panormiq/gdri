/**
 * Module Analyse d'intention
 * Fichier : modules/analyse-intention/backend/index.js
 *
 * Point d'entrée du module analyse-intention (découvert par module-registry depuis modules/<nom>/backend).
 */

const routes = require('./routes');
const config = require('./config.json');

/**
 * Initialise le module
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  🎯 Initialisation module Analyse d\'intention...');

  const testCollection = db.getCollection('analyses');

  try {
    await testCollection.createIndex({ createdAt: 1 });
    console.log('  ✅ Index MongoDB créé');
  } catch (error) {
    // Index existe déjà
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
  routes: getRoutes,
  config
};
