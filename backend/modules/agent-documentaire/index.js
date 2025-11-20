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
const routes = require('./routes');
const config = require('./config.json');
const {
  setDocumentService,
  getDocumentService: getServiceFromContainer,
} = require('./service-container');

// Instance singleton du service Document
let documentServiceInstance = null;

/**
 * Initialise le module Agent Documentaire (appelé par le système de modules)
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  📄 Initialisation module Agent Documentaire...');
  
  // Créer l'instance singleton
  if (!documentServiceInstance) {
    documentServiceInstance = new DocumentService(db);
    await documentServiceInstance.init();
    setDocumentService(documentServiceInstance);
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
 * Retourne les routes du module Agent Documentaire
 * @returns {Express.Router} Routeur Express avec routes API
 */
function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes,
  // Export du service pour utilisation par d'autres modules
  getDocumentService,
  // Alias pour facilité d'utilisation
  service: getDocumentService,
  config
};

