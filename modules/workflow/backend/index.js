/**
 * Module Workflow
 * Fichier : backend/modules/workflow/index.js
 */

const routes = require('./routes');

/**
 * Initialise le module
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  🎯 Initialisation module Workflow...');
  // Pas d'index global ici : les workflows sont stockés par entreprise.
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
