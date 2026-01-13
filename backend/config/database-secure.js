/**
 * Configuration MongoDB sécurisée avec utilisateurs spécifiques par base
 * Fichier : backend/config/database-secure.js
 * 
 * ALTERNATIVE SÉCURISÉE : Utiliser des utilisateurs spécifiques par base
 * 
 * IMPORTANT : Ce fichier est une PROPOSITION. À adapter selon votre architecture.
 */

const { MongoClient } = require('mongodb');

class SecureDatabase {
  constructor() {
    this.client = null;
    this.db = null;
    // Cache des connexions par entreprise
    this.entrepriseConnections = new Map();
    // Configuration des utilisateurs par base (à charger depuis un fichier de config sécurisé)
    this.usersByDatabase = new Map();
  }

  /**
   * Établit la connexion à MongoDB (base principale)
   */
  async connect() {
    if (!this.client) {
      try {
        const uri = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
        this.client = new MongoClient(uri);
        await this.client.connect();
        this.db = this.client.db('GDR-INNOVATION');
        console.log('✅ MongoDB connecté avec succès (base principale)');
      } catch (error) {
        console.error('❌ Erreur de connexion MongoDB :', error.message);
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Retourne la base de données d'une entreprise avec un utilisateur spécifique
   * 
   * APPROCHE SÉCURISÉE :
   * - Chaque base d'entreprise a son propre utilisateur MongoDB
   * - Les credentials sont stockés de manière sécurisée (variables d'environnement, vault, etc.)
   * - L'utilisateur n'a accès qu'à sa propre base
   */
  async getEntrepriseDb(entrepriseId) {
    const dbName = `GDR-ENTREPRISE-${entrepriseId}`;
    
    // Vérifier le cache
    if (this.entrepriseConnections.has(dbName)) {
      return this.entrepriseConnections.get(dbName);
    }

    try {
      // OPTION 1 : Utiliser un utilisateur spécifique par base (RECOMMANDÉ)
      // Les credentials doivent être chargés depuis une source sécurisée
      const appUser = process.env[`MONGO_USER_${entrepriseId}`] || `gdri_app_${entrepriseId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const appPassword = process.env[`MONGO_PASSWORD_${entrepriseId}`] || null;
      
      if (appPassword) {
        // Se connecter avec l'utilisateur spécifique
        const uri = `mongodb://${appUser}:${appPassword}@localhost:27017/${dbName}?authSource=${dbName}`;
        const entrepriseClient = new MongoClient(uri);
        await entrepriseClient.connect();
        const entrepriseDb = entrepriseClient.db(dbName);
        
        this.entrepriseConnections.set(dbName, entrepriseDb);
        console.log(`✅ Connexion sécurisée à ${dbName} avec utilisateur dédié`);
        return entrepriseDb;
      }
      
      // OPTION 2 : Fallback - utiliser gdri_admin (moins sécurisé mais fonctionne)
      // Nécessite que gdri_admin ait les permissions pour cette base spécifique
      if (!this.client) {
        await this.connect();
      }
      
      const entrepriseDb = this.client.db(dbName);
      
      // Vérifier l'accès
      await entrepriseDb.listCollections().toArray();
      
      this.entrepriseConnections.set(dbName, entrepriseDb);
      console.log(`✅ Connexion à ${dbName} avec gdri_admin`);
      return entrepriseDb;
      
    } catch (error) {
      console.error(`❌ Erreur d'accès à la base ${dbName}:`, error.message);
      throw new Error(`Impossible d'accéder à la base ${dbName}. Vérifiez les permissions MongoDB.`);
    }
  }

  /**
   * Retourne la base de données principale
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Ferme toutes les connexions
   */
  async close() {
    // Fermer la connexion principale
    if (this.client) {
      await this.client.close();
      this.db = null;
      this.client = null;
    }
    
    // Fermer toutes les connexions aux bases d'entreprises
    for (const [dbName, db] of this.entrepriseConnections) {
      // Note: MongoDB Client ferme automatiquement toutes les connexions
    }
    this.entrepriseConnections.clear();
    
    console.log('🔌 Toutes les connexions MongoDB fermées');
  }
}

// Export de l'instance singleton
module.exports = new SecureDatabase();
