/**
 * Configuration de la connexion MongoDB pour Node.js
 * Fichier : backend/config/database.js
 * 
 * Classe : Database - Singleton pour la connexion MongoDB
 */

const { MongoClient } = require('mongodb');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
  }

  /**
   * Établit la connexion à MongoDB
   * @returns {Promise<MongoDB.Database>} L'instance de la base de données
   */
  async connect() {
    if (!this.client) {
      try {
        // Configuration MongoDB (identique à PHP)
        const uri = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
        
        this.client = new MongoClient(uri);
        await this.client.connect();
        this.db = this.client.db('GDR-INNOVATION');
        
        console.log('✅ MongoDB connecté avec succès');
      } catch (error) {
        console.error('❌ Erreur de connexion MongoDB :', error.message);
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Retourne une collection MongoDB de la base principale
   * @param {string} name - Nom de la collection
   * @returns {MongoDB.Collection} La collection demandée
   */
  getCollection(name) {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection(name);
  }

  /**
   * Retourne la base de données d'une entité spécifique
   * @param {string} entityId - ID de l'entité
   * @returns {Promise<MongoDB.Database>} La base de données de l'entité
   */
  async getEntityDatabase(entityId) {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
    
    // Nom de la base de données pour l'entité
    const dbName = `GDR-ENTITY-${entityId}`;
    return this.client.db(dbName);
  }

  /**
   * Retourne une collection MongoDB d'une entité spécifique
   * @param {string} entityId - ID de l'entité
   * @param {string} collectionName - Nom de la collection
   * @returns {Promise<MongoDB.Collection>} La collection demandée
   */
  async getEntityCollection(entityId, collectionName) {
    const entityDb = await this.getEntityDatabase(entityId);
    return entityDb.collection(collectionName);
  }

  /**
   * Ferme la connexion à MongoDB
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.db = null;
      this.client = null;
      console.log('🔌 Connexion MongoDB fermée');
    }
  }
}

// Export de l'instance singleton
module.exports = new Database();

