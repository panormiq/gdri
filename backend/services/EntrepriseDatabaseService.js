/**
 * Service de gestion des bases de données d'entreprises
 * Fichier : backend/services/EntrepriseDatabaseService.js
 * 
 * Gère la création sécurisée des bases de données et utilisateurs MongoDB pour chaque entreprise
 */

const databaseAdmin = require('../config/database-admin');
const database = require('../config/database');
const crypto = require('crypto');

class EntrepriseDatabaseService {
  /**
   * Crée une base de données et un utilisateur MongoDB pour une entreprise
   * 
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<{dbName: string, username: string, password: string}>}
   */
  static async createEntrepriseDatabase(entrepriseId) {
    try {
      console.log(`🏗️  Création de la base de données pour l'entreprise ${entrepriseId}...`);
      
      // Nom de la base de données
      const dbName = `GDR-ENTREPRISE-${entrepriseId}`;
      
      // Nom de l'utilisateur MongoDB (basé sur l'ID de l'entreprise)
      const username = `entreprise_${entrepriseId}`;
      
      // Générer un mot de passe aléatoire sécurisé
      const password = this.generateSecurePassword();
      
      // Obtenir le client admin
      const adminClient = await databaseAdmin.getAdminClient();
      const adminDb = adminClient.db('admin');
      
      // Obtenir la base de données de l'entreprise
      const entrepriseDb = adminClient.db(dbName);
      
      // 1. Créer les collections initiales (cela crée automatiquement la base)
      console.log(`📦 Création des collections dans ${dbName}...`);
      
      const collections = ['collections', 'templates', 'documents', 'users', '_init'];
      for (const collectionName of collections) {
        try {
          await entrepriseDb.createCollection(collectionName);
          console.log(`  ✅ Collection ${collectionName} créée`);
          
          // Créer un index sur userId pour la collection users
          if (collectionName === 'users') {
            await entrepriseDb.collection('users').createIndex({ userId: 1 }, { unique: true });
            console.log(`  ✅ Index créé sur users.userId`);
          }
        } catch (error) {
          // La collection existe déjà, ce n'est pas grave
          if (error.code !== 48) { // NamespaceExists
            throw error;
          }
        }
      }
      
      // 2. Créer l'utilisateur MongoDB spécifique pour cette entreprise
      console.log(`👤 Création de l'utilisateur MongoDB ${username}...`);
      
      try {
        // Utiliser la commande createUser sur la base de l'entreprise
        await entrepriseDb.command({
          createUser: username,
          pwd: password,
          roles: [
            { role: 'readWrite', db: dbName },
            { role: 'dbAdmin', db: dbName }
          ]
        });
        console.log(`  ✅ Utilisateur ${username} créé avec succès`);
      } catch (error) {
        // Si l'utilisateur existe déjà, le supprimer et le recréer
        if (error.code === 51003 || error.codeName === 'UserAlreadyExists') {
          console.log(`  ⚠️  Utilisateur ${username} existe déjà, suppression...`);
          try {
            await entrepriseDb.command({ dropUser: username });
          } catch (dropError) {
            // Ignorer si l'utilisateur n'existe pas
            if (dropError.code !== 11 && dropError.codeName !== 'UserNotFound') {
              console.warn(`  ⚠️  Erreur lors de la suppression:`, dropError.message);
            }
          }
          await entrepriseDb.command({
            createUser: username,
            pwd: password,
            roles: [
              { role: 'readWrite', db: dbName },
              { role: 'dbAdmin', db: dbName }
            ]
          });
          console.log(`  ✅ Utilisateur ${username} recréé avec succès`);
        } else {
          console.error(`  ❌ Erreur lors de la création de l'utilisateur:`, error);
          throw error;
        }
      }
      
      // 3. Stocker les credentials de manière sécurisée
      await this.storeCredentials(entrepriseId, username, password);
      
      console.log(`✅ Base de données ${dbName} créée avec succès`);
      console.log(`🔐 Credentials stockés de manière sécurisée`);
      
      return {
        dbName,
        username,
        password // À ne PAS retourner dans la réponse API, uniquement pour logging initial
      };
      
    } catch (error) {
      console.error(`❌ Erreur lors de la création de la base pour ${entrepriseId}:`, error);
      throw new Error(`Impossible de créer la base de données pour l'entreprise ${entrepriseId}: ${error.message}`);
    }
  }

  /**
   * Génère un mot de passe sécurisé aléatoire
   * @returns {string} Mot de passe de 32 caractères
   */
  static generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const passwordLength = 32;
    let password = '';
    
    for (let i = 0; i < passwordLength; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      password += chars.charAt(randomIndex);
    }
    
    return password;
  }

  /**
   * Stocke les credentials de manière sécurisée dans MongoDB
   * Les credentials sont chiffrés et stockés dans une collection sécurisée
   * 
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} username - Nom d'utilisateur MongoDB
   * @param {string} password - Mot de passe MongoDB
   */
  static async storeCredentials(entrepriseId, username, password) {
    try {
      const db = await database.connect();
      const credentialsCollection = db.collection('entreprise_credentials');
      
      // Chiffrer le mot de passe (simple chiffrement pour l'exemple, utiliser un vrai chiffrement en production)
      const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || 'CHANGER_EN_PRODUCTION_32_CHARS';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
      let encryptedPassword = cipher.update(password, 'utf8', 'hex');
      encryptedPassword += cipher.final('hex');
      
      // Stocker les credentials chiffrés
      await credentialsCollection.updateOne(
        { entrepriseId },
        {
          $set: {
            entrepriseId,
            username,
            encryptedPassword,
            iv: iv.toString('hex'),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      
      console.log(`✅ Credentials stockés pour l'entreprise ${entrepriseId}`);
    } catch (error) {
      console.error(`❌ Erreur lors du stockage des credentials:`, error);
      // Ne pas bloquer si le stockage échoue, mais logger l'erreur
    }
  }

  /**
   * Récupère les credentials d'une entreprise de manière sécurisée
   * 
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<{username: string, password: string}>}
   */
  static async getCredentials(entrepriseId) {
    try {
      const db = await database.connect();
      const credentialsCollection = db.collection('entreprise_credentials');
      
      const credentials = await credentialsCollection.findOne({ entrepriseId });
      
      if (!credentials) {
        throw new Error(`Credentials non trouvés pour l'entreprise ${entrepriseId}`);
      }
      
      // Déchiffrer le mot de passe
      const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || 'CHANGER_EN_PRODUCTION_32_CHARS';
      const iv = Buffer.from(credentials.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
      let decryptedPassword = decipher.update(credentials.encryptedPassword, 'hex', 'utf8');
      decryptedPassword += decipher.final('utf8');
      
      return {
        username: credentials.username,
        password: decryptedPassword
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des credentials:`, error);
      throw error;
    }
  }

  /**
   * Supprime une base de données d'entreprise et son utilisateur
   * 
   * @param {string} entrepriseId - ID de l'entreprise
   */
  static async deleteEntrepriseDatabase(entrepriseId) {
    try {
      console.log(`🗑️  Suppression de la base de données pour l'entreprise ${entrepriseId}...`);
      
      const dbName = `GDR-ENTREPRISE-${entrepriseId}`;
      const username = `entreprise_${entrepriseId}`;
      
      const adminClient = await databaseAdmin.getAdminClient();
      const entrepriseDb = adminClient.db(dbName);
      const adminDb = adminClient.db('admin');
      
      // 1. Supprimer l'utilisateur
      try {
        await entrepriseDb.command({ dropUser: username });
        console.log(`  ✅ Utilisateur ${username} supprimé`);
      } catch (error) {
        // L'utilisateur n'existe pas, ce n'est pas grave
        if (error.code !== 11 && error.codeName !== 'UserNotFound') {
          console.warn(`  ⚠️  Erreur lors de la suppression de l'utilisateur:`, error.message);
        }
      }
      
      // 2. Supprimer la base de données
      await adminClient.db(dbName).dropDatabase();
      console.log(`  ✅ Base ${dbName} supprimée`);
      
      // 3. Supprimer les credentials stockés
      const db = await database.connect();
      const credentialsCollection = db.collection('entreprise_credentials');
      await credentialsCollection.deleteOne({ entrepriseId });
      console.log(`  ✅ Credentials supprimés`);
      
      console.log(`✅ Base de données ${dbName} supprimée avec succès`);
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de la base:`, error);
      throw error;
    }
  }
}

module.exports = EntrepriseDatabaseService;
