/**
 * FICHIER : backend/modules/agent-documentaire-v2/index.js
 * RÔLE : Point d'entrée Agent Documentaire V2.
 */

const TemplateService = require('./services/TemplateService');
const routes = require('./routes');
const { setTemplateService, getTemplateService } = require('./service-container');

let templateServiceInstance = null;

async function init(app, db) {
  console.log('  📐 Initialisation Agent Documentaire V2...');
  if (!templateServiceInstance) {
    templateServiceInstance = new TemplateService(db);
    await templateServiceInstance.init();
    setTemplateService(templateServiceInstance);
  }
  console.log('  ✅ Agent Documentaire V2 prêt');
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes,
  getTemplateService
};
