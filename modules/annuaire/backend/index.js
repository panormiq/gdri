/**
 * FICHIER : modules/annuaire/backend/index.js
 * RÔLE : Point d'entrée module Annuaire.
 */

const routes = require('./routes');

async function init() {
  console.log('  📇 Initialisation module Annuaire...');
}

function getRoutes() {
  return routes;
}

module.exports = { init, routes: getRoutes };
