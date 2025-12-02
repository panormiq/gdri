/**
 * Service Container - Agent Documentaire
 * Permet de partager les instances des services
 * sans créer de dépendances circulaires.
 */

let documentServiceInstance = null;
let templateServiceInstance = null;
let modelServiceInstance = null;

function setDocumentService(service) {
  documentServiceInstance = service;
}

function getDocumentService() {
  if (!documentServiceInstance) {
    throw new Error('DocumentService non initialisé');
  }
  return documentServiceInstance;
}

function setTemplateService(service) {
  templateServiceInstance = service;
}

function getTemplateService() {
  if (!templateServiceInstance) {
    throw new Error('TemplateService non initialisé');
  }
  return templateServiceInstance;
}

function setModelService(service) {
  modelServiceInstance = service;
}

function getModelService() {
  if (!modelServiceInstance) {
    throw new Error('ModelService non initialisé');
  }
  return modelServiceInstance;
}

module.exports = {
  setDocumentService,
  getDocumentService,
  setTemplateService,
  getTemplateService,
  setModelService,
  getModelService,
};

