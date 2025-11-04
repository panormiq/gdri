/**
 * Module Mail - Service générique d'envoi et réception d'emails
 * Fichier : backend/modules/mail/index.js
 * 
 * Fonction : Point d'entrée du module Mail
 * - Peut fonctionner en mode standalone (collection par défaut)
 * - Peut être configuré par module (collection dédiée)
 */

const MailService = require('./services/MailService');
const database = require('../../config/database');

// Instance singleton du service Mail
let mailServiceInstance = null;

/**
 * Initialise le module Mail (appelé par le système de modules)
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  📧 Initialisation module Mail...');
  
  // Créer l'instance singleton
  if (!mailServiceInstance) {
    mailServiceInstance = new MailService(db);
    await mailServiceInstance.init();
  }
  
  // Créer index sur la collection par défaut
  try {
    const defaultCollection = db.getCollection('emails');
    await defaultCollection.createIndex({ module_name: 1, entity_id: 1 });
    await defaultCollection.createIndex({ status: 1, sent_at: -1 });
    console.log('  ✅ Index MongoDB créé pour collection emails');
  } catch (error) {
    // Index existe déjà, pas d'erreur
  }
  
  console.log('  ✅ Module Mail prêt (mode standalone disponible)');
}

/**
 * Retourne l'instance du service Mail (pour utilisation par d'autres modules)
 * @returns {MailService} Instance du service Mail
 */
function getMailService() {
  if (!mailServiceInstance) {
    // Initialiser si pas encore fait
    mailServiceInstance = new MailService(database);
  }
  return mailServiceInstance;
}

/**
 * Retourne les routes du module Mail
 * @returns {Express.Router} Routeur Express avec routes API
 */
function getRoutes() {
  return require('./routes');
}

module.exports = {
  init,
  routes: getRoutes,
  // Export du service pour utilisation par d'autres modules
  getMailService,
  // Alias pour facilité d'utilisation
  service: getMailService
};

