/**
 * Module Agent Documentaire
 * Fichier : backend/modules/agent-documentaire/index.js
 * 
 * Fonction : Point d'entrée du module Agent Documentaire
 * - Extraction Word → JSON
 * - Génération JSON → HTML
 * - Gestion des documents techniques
 */

const DocumentService = require('./services/DocumentService');
const TemplateService = require('./services/TemplateService');
const ModelService = require('./services/ModelService');
const routes = require('./routes');
const config = require('./config.json');
const {
  setDocumentService,
  getDocumentService: getServiceFromContainer,
  setTemplateService,
  getTemplateService: getTemplateServiceFromContainer,
  setModelService,
  getModelService: getModelServiceFromContainer,
} = require('./service-container');

// Instances singleton des services
let documentServiceInstance = null;
let templateServiceInstance = null;
let modelServiceInstance = null;

/**
 * Initialise le module Agent Documentaire (appelé par le système de modules)
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  📄 Initialisation module Agent Documentaire...');
  
  // Créer l'instance singleton DocumentService
  if (!documentServiceInstance) {
    documentServiceInstance = new DocumentService(db);
    await documentServiceInstance.init();
    setDocumentService(documentServiceInstance);
  }
  
  // Créer l'instance singleton TemplateService
  if (!templateServiceInstance) {
    templateServiceInstance = new TemplateService(db);
    await templateServiceInstance.init();
    setTemplateService(templateServiceInstance);
  }
  
  // Créer l'instance singleton ModelService
  if (!modelServiceInstance) {
    modelServiceInstance = new ModelService(db);
    await modelServiceInstance.init();
    setModelService(modelServiceInstance);
  }
  
  // Créer index sur la collection documents
  try {
    const documentsCollection = db.getCollection('documents');
    await documentsCollection.createIndex({ entity_id: 1, 'metadata.createdAt': -1 });
    await documentsCollection.createIndex({ entity_id: 1, title: 1 });
    console.log('  ✅ Index MongoDB créé pour collection documents');
  } catch (error) {
    // Index existe déjà, pas d'erreur
  }
  
  console.log('  ✅ Module Agent Documentaire prêt');
}

/**
 * Retourne l'instance du service Document (pour utilisation par d'autres modules)
 * @returns {DocumentService} Instance du service Document
 */
function getDocumentService() {
  return getServiceFromContainer();
}

/**
 * Retourne l'instance du service Template (pour utilisation par d'autres modules)
 * @returns {TemplateService} Instance du service Template
 */
function getTemplateService() {
  return getTemplateServiceFromContainer();
}

/**
 * Retourne l'instance du service Model (pour utilisation par d'autres modules)
 * @returns {ModelService} Instance du service Model
 */
function getModelService() {
  return getModelServiceFromContainer();
}

/**
 * Retourne les routes du module Agent Documentaire
 * @returns {Express.Router} Routeur Express avec routes API
 */
function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes,
  // Export des services pour utilisation par d'autres modules
  getDocumentService,
  getTemplateService,
  getModelService,
  // Alias pour facilité d'utilisation
  service: getDocumentService,
  config
};

