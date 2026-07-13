/**
 * FICHIER : backend/modules/agent-documentaire-v2/service-container.js
 */

let templateServiceInstance = null;

function setTemplateService(service) {
  templateServiceInstance = service;
}

function getTemplateService() {
  if (!templateServiceInstance) {
    throw new Error('TemplateService V2 non initialisé');
  }
  return templateServiceInstance;
}

module.exports = { setTemplateService, getTemplateService };
