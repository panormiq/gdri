/**
 * Module Facebook - Récupération et analyse via webhooks
 * Fichier : backend/modules/facebook/index.js
 * 
 * Fonction : Point d'entrée du module Facebook
 */

const routes = require('./routes');

/**
 * Initialise le module Facebook (appelé par le système de modules)
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  📱 Initialisation module Facebook...');
  
  // Créer des index sur les collections
  try {
    const webhooksCollection = db.getCollection('facebook_webhooks');
    await webhooksCollection.createIndex({ 'entry.id': 1, time: -1 });
    await webhooksCollection.createIndex({ entity_id: 1, time: -1 });
    console.log('  ✅ Index MongoDB créé pour facebook_webhooks');
  } catch (error) {
    // Index existe déjà, pas d'erreur
  }
  
  console.log('  ✅ Module Facebook prêt');
}

/**
 * Retourne les routes du module Facebook
 * @returns {Express.Router} Routeur Express avec routes API
 */
function getRoutes() {
  return require('./routes');
}

module.exports = {
  init,
  routes: getRoutes
};

