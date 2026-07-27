/**
 * FICHIER : modules/banque/backend/index.js
 * RÔLE : Point d'entrée module Banque.
 */

const routes = require('./routes');

async function init() {
  console.log('  🏦 Initialisation module Banque...');
}

function getRoutes() {
  return routes;
}

module.exports = { init, routes: getRoutes };
