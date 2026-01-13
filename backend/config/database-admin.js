/**
 * Configuration MongoDB - Super Admin (ENCAPSULÉ)
 * Fichier : backend/config/database-admin.js
 * 
 * ⚠️ ATTENTION : Ce module est UNIQUEMENT utilisé pour les opérations d'administration
 * (création d'entreprises, bases de données, utilisateurs MongoDB)
 * 
 * ❌ NE PAS utiliser pour les opérations normales de l'application
 */

const { MongoClient } = require('mongodb');

class DatabaseAdmin {
  constructor() {
    this.client = null;
    this.db = null;
  }

  /**
   * Établit la connexion MongoDB avec le super admin
   * Les credentials doivent être dans les variables d'environnement
   */
  async connect() {
    if (!this.client) {
      try {
        // ⚠️ Les credentials du super admin doivent être dans les variables d'environnement
        const adminUser = process.env.MONGO_ADMIN_USER || 'gdri_admin_setup';
        const adminPassword = process.env.MONGO_ADMIN_PASSWORD || 'CHANGER_EN_PRODUCTION';
        
        // Log pour debug (sans afficher le mot de passe complet)
        console.log(`🔐 Tentative de connexion MongoDB Admin avec utilisateur: ${adminUser}`);
        console.log(`🔐 Mot de passe configuré: ${adminPassword ? 'Oui (' + adminPassword.length + ' caractères)' : 'NON'}`);
        
        // Encoder les credentials pour l'URL (gère les caractères spéciaux comme apostrophes)
        const encodedUser = encodeURIComponent(adminUser);
        const encodedPassword = encodeURIComponent(adminPassword);
        
        // Se connecter en tant qu'admin avec permissions globales
        const uri = `mongodb://${encodedUser}:${encodedPassword}@localhost:27017/admin?authSource=admin`;
        
        this.client = new MongoClient(uri);
        await this.client.connect();
        this.db = this.client.db('admin');
        
        console.log('✅ MongoDB Admin connecté avec succès (SUPER ADMIN)');
        console.log('⚠️  Ce module est uniquement pour les opérations d\'administration');
      } catch (error) {
        console.error('❌ Erreur de connexion MongoDB Admin :', error.message);
        console.error('❌ Code d\'erreur:', error.code);
        console.error('❌ Vérifiez que:');
        console.error('   1. L\'utilisateur MongoDB existe (gdri_admin_setup)');
        console.error('   2. Le fichier .env contient MONGO_ADMIN_USER et MONGO_ADMIN_PASSWORD');
        console.error('   3. Le mot de passe correspond à celui dans MongoDB');
        console.error('   4. Le backend a été redémarré après modification du .env');
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Retourne le client MongoDB admin pour les opérations administratives
   */
  async getAdminClient() {
    if (!this.client) {
      await this.connect();
    }
    return this.client;
  }

  /**
   * Ferme la connexion admin
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.db = null;
      this.client = null;
      console.log('🔌 Connexion MongoDB Admin fermée');
    }
  }
}

// Export de l'instance singleton
module.exports = new DatabaseAdmin();
