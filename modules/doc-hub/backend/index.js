/**
 * Module Doc-Hub — GED par projet
 * Fichier : modules/doc-hub/backend/index.js
 */

const routes = require('./routes');
const config = require('./config.json');
const { prepareEntrepriseDb } = require('./dbSetup');

async function init(app, db) {
  console.log('  📁 Initialisation module Doc-Hub...');
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes,
  config,
  prepareEntrepriseDb
};
