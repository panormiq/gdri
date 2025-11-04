/**
 * Gestionnaire SMTP - Gère plusieurs connexions SMTP par profil
 * Fichier : backend/modules/mail/services/SMTPManager.js
 */

const nodemailer = require('nodemailer');

class SMTPManager {
  constructor() {
    this.transporters = new Map(); // Map<profileKey, transporter>
    this.configs = new Map(); // Map<profileKey, config>
  }

  /**
   * Enregistre un profil SMTP
   * @param {string} profileKey - Clé unique du profil (ex: 'alerts', 'reports')
   * @param {Object} config - Configuration SMTP
   * @param {Object} config.smtp - Configuration nodemailer
   * @param {Object} config.from - { name: String, email: String }
   */
  registerProfile(profileKey, config) {
    if (!config.smtp || !config.from) {
      throw new Error(`Configuration SMTP incomplète pour le profil ${profileKey}`);
    }

    // Créer le transporter nodemailer
    const transporter = nodemailer.createTransport(config.smtp);
    
    // Stocker le transporter et la config
    this.transporters.set(profileKey, transporter);
    this.configs.set(profileKey, config);
  }

  /**
   * Enregistre plusieurs profils SMTP d'un coup
   * @param {Object} profiles - Object avec clés = noms de profils, valeurs = configs
   */
  registerProfiles(profiles) {
    for (const [profileKey, config] of Object.entries(profiles)) {
      this.registerProfile(profileKey, config);
    }
  }

  /**
   * Retourne le transporter pour un profil donné
   * @param {string} profileKey - Clé du profil
   * @returns {Object} Transporter nodemailer
   */
  getTransporter(profileKey) {
    const transporter = this.transporters.get(profileKey);
    if (!transporter) {
      throw new Error(`Profil SMTP "${profileKey}" non trouvé`);
    }
    return transporter;
  }

  /**
   * Retourne la configuration from pour un profil
   * @param {string} profileKey - Clé du profil
   * @returns {Object} { name: String, email: String }
   */
  getFrom(profileKey) {
    const config = this.configs.get(profileKey);
    if (!config) {
      throw new Error(`Profil SMTP "${profileKey}" non trouvé`);
    }
    return config.from;
  }

  /**
   * Vérifie la connexion d'un profil SMTP
   * @param {string} profileKey - Clé du profil
   * @returns {Promise<boolean>} True si connexion OK
   */
  async verifyConnection(profileKey) {
    try {
      const transporter = this.getTransporter(profileKey);
      await transporter.verify();
      return true;
    } catch (error) {
      console.error(`Erreur vérification SMTP pour ${profileKey}:`, error.message);
      return false;
    }
  }

  /**
   * Supprime un profil SMTP
   * @param {string} profileKey - Clé du profil
   */
  removeProfile(profileKey) {
    const transporter = this.transporters.get(profileKey);
    if (transporter) {
      transporter.close();
    }
    this.transporters.delete(profileKey);
    this.configs.delete(profileKey);
  }
}

module.exports = SMTPManager;

