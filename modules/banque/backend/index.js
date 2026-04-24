const routes = require('./routes');

async function init() {
  console.log('  🏦 Initialisation module Banque...');
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
