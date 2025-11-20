/**
 * Service Container - Agent Documentaire
 * Permet de partager l'instance du DocumentService
 * sans créer de dépendances circulaires.
 */

let documentServiceInstance = null;

function setDocumentService(service) {
  documentServiceInstance = service;
}

function getDocumentService() {
  if (!documentServiceInstance) {
    throw new Error('DocumentService non initialisé');
  }
  return documentServiceInstance;
}

module.exports = {
  setDocumentService,
  getDocumentService,
};

