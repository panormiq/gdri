/**
 * Module Analyse d'intention
 * Fichier : backend/modules/analyse-intention/index.js
 * 
 * Fonction : Point d'entrée du module analyse-intention
 */

const routes = require('./routes');
const config = require('./config.json');

/**
 * Initialise le module
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  🎯 Initialisation module Analyse d\'intention...');
  
  // Vérifier la connexion à la base de données
  const testCollection = db.getCollection('analyses');
  
  // Créer des index si nécessaire
  try {
    await testCollection.createIndex({ createdAt: 1 });
    console.log('  ✅ Index MongoDB créé');
  } catch (error) {
    // Index existe déjà, pas d'erreur
  }
}

/**
 * Retourne les routes du module
 * @returns {Express.Router} Routeur Express
 */
function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes,
  config
};

