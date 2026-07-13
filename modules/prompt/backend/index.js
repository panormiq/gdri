/**
 * Module Prompt — service partagé d'appels IA structurés.
 * Fichier : modules/prompt/backend/index.js
 */

const routes = require('./routes');

async function init() {
  console.log('  ✍️  Module Prompt prêt (service partagé, pas de config utilisateur)');
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes,
  PromptService: require('./services/PromptService')
};
