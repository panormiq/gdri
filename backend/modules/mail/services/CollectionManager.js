/**
 * Gestionnaire de collections - Gère les collections par défaut ou dédiées
 * Fichier : backend/modules/mail/services/CollectionManager.js
 */

class CollectionManager {
  constructor(database) {
    this.database = database;
    this.defaultCollectionName = 'emails';
  }

  /**
   * Retourne la collection à utiliser pour un module donné
   * @param {string} moduleName - Nom du module (optionnel, 'mail' si standalone)
   * @param {string} customCollectionName - Nom de collection personnalisé (optionnel)
   * @returns {Promise<MongoDB.Collection>} La collection à utiliser
   */
  async getCollection(moduleName = 'mail', customCollectionName = null) {
    let collectionName;
    
    if (customCollectionName) {
      // Collection personnalisée spécifiée
      collectionName = customCollectionName;
    } else if (moduleName === 'mail') {
      // Mode standalone : collection par défaut
      collectionName = this.defaultCollectionName;
    } else {
      // Mode configuré : collection dédiée au module
      collectionName = `emails_${moduleName}`;
    }
    
    // Retourner la collection de la base principale
    return this.database.getCollection(collectionName);
  }

  /**
   * Retourne la collection pour une entité spécifique
   * @param {string} entityId - ID de l'entité
   * @param {string} moduleName - Nom du module
   * @param {string} customCollectionName - Nom de collection personnalisé
   * @returns {Promise<MongoDB.Collection>} La collection de l'entité
   */
  async getEntityCollection(entityId, moduleName = 'mail', customCollectionName = null) {
    let collectionName;
    
    if (customCollectionName) {
      collectionName = customCollectionName;
    } else if (moduleName === 'mail') {
      collectionName = this.defaultCollectionName;
    } else {
      collectionName = `emails_${moduleName}`;
    }
    
    return this.database.getEntityCollection(entityId, collectionName);
  }
}

module.exports = CollectionManager;

