/**
 * Configuration de la connexion MongoDB pour Node.js
 * Fichier : backend/config/database.js
 * 
 * Classe : Database - Singleton pour la connexion MongoDB
 */

const { MongoClient } = require('mongodb');
const { resolveMongoConfig } = require('./mongo-env');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.mongoConfig = resolveMongoConfig();
    // Cache des connexions par entreprise (une connexion par base)
    this.entrepriseConnections = new Map();
    // Cache des clients MongoDB par entreprise (pour pouvoir les fermer)
    this.entrepriseClients = new Map();
  }

  /**
   * Établit la connexion à MongoDB
   * @returns {Promise<MongoDB.Database>} L'instance de la base de données
   */
  async connect() {
    if (!this.client) {
      try {
        this.mongoConfig = resolveMongoConfig();
        const { uri, database } = this.mongoConfig;

        this.client = new MongoClient(uri);
        await this.client.connect();
        this.db = this.client.db(database);

        console.log(`✅ MongoDB connecté avec succès (${database})`);
      } catch (error) {
        console.error('❌ Erreur de connexion MongoDB :', error.message);
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Retourne la base de données principale
   * @returns {MongoDB.Database} La base de données
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
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
   * Retourne la base de données d'une entreprise spécifique
   * Utilise l'utilisateur MongoDB spécifique à l'entreprise (sécurisé)
   * 
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<MongoDB.Database>} La base de données de l'entreprise
   */
  async getEntrepriseDb(entrepriseId) {
    const prefix = (this.mongoConfig && this.mongoConfig.entreprisePrefix) || 'GDR-ENTREPRISE-';
    const dbName = `${prefix}${entrepriseId}`;
    const username = `entreprise_${entrepriseId}`;
    
    // Vérifier si on a déjà une connexion pour cette entreprise
    if (this.entrepriseConnections && this.entrepriseConnections.has(dbName)) {
      return this.entrepriseConnections.get(dbName);
    }
    
    // Initialiser le cache si nécessaire
    if (!this.entrepriseConnections) {
      this.entrepriseConnections = new Map();
    }
    
    try {
      // Récupérer les credentials de l'entreprise
      const EntrepriseDatabaseService = require('../services/EntrepriseDatabaseService');
      const credentials = await EntrepriseDatabaseService.getCredentials(entrepriseId);
      
      // Encoder le username et password pour l'URL (caractères spéciaux comme & doivent être encodés)
      const encodedUsername = encodeURIComponent(credentials.username);
      const encodedPassword = encodeURIComponent(credentials.password);
      
      // Se connecter avec l'utilisateur spécifique à l'entreprise
      const uri = `mongodb://${encodedUsername}:${encodedPassword}@localhost:27017/${dbName}?authSource=${dbName}`;
      const entrepriseClient = new MongoClient(uri);
      await entrepriseClient.connect();
      const entrepriseDb = entrepriseClient.db(dbName);
      
      // Vérifier l'accès
      await entrepriseDb.listCollections().toArray();
      
      // Mettre en cache la connexion ET le client (pour pouvoir fermer plus tard)
      this.entrepriseConnections.set(dbName, entrepriseDb);
      this.entrepriseClients.set(dbName, entrepriseClient);
      
      console.log(`✅ Connexion sécurisée à ${dbName} avec utilisateur dédié ${credentials.username}`);
      
      return entrepriseDb;
      
    } catch (error) {
      console.error(`❌ Erreur d'accès à la base ${dbName}:`, error.message);
      
      // Si les credentials n'existent pas, la base n'a peut-être pas été créée
      if (error.message && error.message.includes('Credentials non trouvés')) {
        throw new Error(`La base de données pour l'entreprise ${entrepriseId} n'a pas été initialisée. Veuillez créer l'entreprise d'abord.`);
      }
      
      // Si l'erreur est liée à l'authentification, essayer avec gdri_admin (fallback temporaire)
      if (error.code === 18 || error.codeName === 'AuthenticationFailed') {
        console.warn(`⚠️  Authentification échouée avec utilisateur dédié, tentative avec gdri_admin (fallback)...`);
        
        try {
          if (!this.client) {
            await this.connect();
          }
          const entrepriseDb = this.client.db(dbName);
          await entrepriseDb.listCollections().toArray();
          
          this.entrepriseConnections.set(dbName, entrepriseDb);
          console.log(`✅ Connexion avec gdri_admin (fallback) réussi pour ${dbName}`);
          
          return entrepriseDb;
        } catch (fallbackError) {
          throw new Error(`Impossible d'accéder à la base ${dbName}. Vérifiez que l'entreprise a été créée correctement.`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Retourne une collection MongoDB d'une entreprise spécifique
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} collectionName - Nom de la collection
   * @returns {Promise<MongoDB.Collection>} La collection demandée
   */
  async getEntrepriseCollection(entrepriseId, collectionName) {
    const entrepriseDb = await this.getEntrepriseDb(entrepriseId);
    return entrepriseDb.collection(collectionName);
  }

  /**
   * @deprecated Utiliser getEntrepriseDb() à la place
   * Retourne la base de données d'une entité spécifique (compatibilité)
   * @param {string} entityId - ID de l'entité
   * @returns {Promise<MongoDB.Database>} La base de données de l'entité
   */
  async getEntityDatabase(entityId) {
    return this.getEntrepriseDb(entityId);
  }

  /**
   * @deprecated Utiliser getEntrepriseCollection() à la place
   * Retourne une collection MongoDB d'une entité spécifique (compatibilité)
   * @param {string} entityId - ID de l'entité
   * @param {string} collectionName - Nom de la collection
   * @returns {Promise<MongoDB.Collection>} La collection demandée
   */
  async getEntityCollection(entityId, collectionName) {
    return this.getEntrepriseCollection(entityId, collectionName);
  }

  /**
   * Ferme la connexion à MongoDB
   */
  async close() {
    // Fermer toutes les connexions aux bases d'entreprises
    if (this.entrepriseClients) {
      for (const [dbName, client] of this.entrepriseClients) {
        try {
          await client.close();
          console.log(`🔌 Connexion fermée pour ${dbName}`);
        } catch (error) {
          console.error(`❌ Erreur lors de la fermeture de ${dbName}:`, error);
        }
      }
      this.entrepriseClients.clear();
    }
    
    if (this.entrepriseConnections) {
      this.entrepriseConnections.clear();
    }
    
    // Fermer la connexion principale
    if (this.client) {
      await this.client.close();
      this.db = null;
      this.client = null;
      console.log('🔌 Connexion MongoDB principale fermée');
    }
  }
}

// Export de l'instance singleton
module.exports = new Database();

