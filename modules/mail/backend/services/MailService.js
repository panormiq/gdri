/**
 * Service Mail principal - Service générique d'envoi d'emails
 * Fichier : backend/modules/mail/services/MailService.js
 */

const CollectionManager = require('./CollectionManager');
const SMTPManager = require('./SMTPManager');
const RoutingEngine = require('./RoutingEngine');
const ImapService = require('./ImapService');

class MailService {
  constructor(database) {
    this.database = database;
    this.collectionManager = new CollectionManager(database);
    this.smtpManager = new SMTPManager();
    this.routingEngine = new RoutingEngine();
    this.imapService = new ImapService(database);
    
    // Configuration par module
    this.moduleConfigs = new Map(); // Map<moduleName, config>
    this.initialized = false;
  }

  /**
   * Initialise le service Mail
   */
  async init() {
    if (this.initialized) return;

    // Profil de repli pour les entités sans SMTP configuré : app@gdr-innovation.fr (variables d'environnement)
    this.registerFallbackFromEnv();

    this.initialized = true;
  }

  /**
   * Enregistre le profil SMTP de repli "gdri_app" (app@gdr-innovation.fr) depuis les variables d'environnement.
   * Utilisé pour les profils lambda lorsqu'aucun SMTP n'est configuré pour l'entité.
   */
  registerFallbackFromEnv() {
    const host = process.env.SMTP_HOST || process.env.GDRI_APP_SMTP_HOST;
    const user = process.env.SMTP_USER || process.env.GDRI_APP_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.GDRI_APP_SMTP_PASS;
    if (!host || !user || !pass) {
      return;
    }
    const profileKey = 'gdri_app';
    if (this.smtpManager.getProfileKeys().includes(profileKey)) {
      return;
    }
    try {
      this.smtpManager.registerProfile(profileKey, {
        smtp: {
          host: host,
          port: parseInt(process.env.SMTP_PORT || process.env.GDRI_APP_SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true' || process.env.GDRI_APP_SMTP_SECURE === 'true',
          auth: { user, pass }
        },
        from: {
          name: process.env.GDRI_APP_SMTP_FROM_NAME || 'GDRI',
          email: process.env.GDRI_APP_SMTP_FROM_EMAIL || 'app@gdr-innovation.fr'
        }
      });
      console.log('  📧 Profil SMTP de repli enregistré: gdri_app (app@gdr-innovation.fr)');
    } catch (err) {
      console.warn('  ⚠️ Impossible d\'enregistrer le profil de repli gdri_app:', err.message);
    }
  }

  /**
   * Indique si le profil de repli (gdri_app) est disponible pour les envois sans config SMTP.
   * @returns {boolean}
   */
  hasFallbackProfile() {
    return this.smtpManager.getProfileKeys().includes('gdri_app');
  }

  /**
   * Retourne le service IMAP (réception d'emails)
   * @returns {ImapService}
   */
  getImapService() {
    return this.imapService;
  }

  /**
   * Construit smtp_profiles (format interne) à partir de profils_smtp + comptes (nouveau format)
   * @param {Array} profilsSmtp - [{ id, name?, host, port, secure }]
   * @param {Array} comptes - [{ id, email, password?, profil_smtp_id, from_name?, type?, user_id? }]
   * @returns {Object} { [compteId]: { smtp: {...}, from: {...} } }
   */
  buildSmtpProfilesFromComptes(profilsSmtp, comptes) {
    const byId = (arr) => (arr || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const smtpById = byId(profilsSmtp);
    const out = {};
    for (const c of comptes || []) {
      if (!c.profil_smtp_id || !c.email) continue;
      const profil = smtpById[c.profil_smtp_id];
      if (!profil) continue;
      const key = c.id || c.email;
      out[key] = {
        smtp: {
          host: profil.host,
          port: parseInt(profil.port, 10) || 587,
          secure: profil.secure === true,
          auth: { user: c.email, pass: c.password || '' }
        },
        from: {
          name: c.from_name || '',
          email: c.email
        }
      };
    }
    return out;
  }

  /**
   * Initialise la configuration Mail pour un module spécifique
   * @param {Object} config - Configuration du module
   * @param {string} config.module_name - Nom du module
   * @param {string} config.collection_name - Nom de collection personnalisé (optionnel)
   * @param {Object} config.smtp_profiles - (ancien) Profils SMTP { profileName: { smtp: {...}, from: {...} } }
   * @param {Array} config.profils_smtp - (nouveau) [{ id, host, port, secure }]
   * @param {Array} config.comptes - (nouveau) [{ id, email, password, profil_smtp_id, from_name? }]
   * @param {Array} config.routing_rules - Règles de routing (optionnel)
   */
  initModule(config) {
    if (!config.module_name) {
      throw new Error('module_name est requis dans la configuration');
    }

    const moduleName = config.module_name;

    if (config.profils_smtp && config.comptes && config.comptes.length > 0) {
      const built = this.buildSmtpProfilesFromComptes(config.profils_smtp, config.comptes);
      if (Object.keys(built).length > 0) {
        this.smtpManager.registerProfiles(built);
      }
    }
    if (config.smtp_profiles && Object.keys(config.smtp_profiles).length > 0) {
      this.smtpManager.registerProfiles(config.smtp_profiles);
    }

    // Configurer le routing
    if (config.routing_rules) {
      this.routingEngine.setRules(config.routing_rules);
    }

    // Stocker la config du module
    this.moduleConfigs.set(moduleName, {
      collection_name: config.collection_name || null,
      routing_rules: config.routing_rules || []
    });

    // Créer un routing engine spécifique pour ce module
    const moduleRouting = new RoutingEngine();
    if (config.routing_rules) {
      moduleRouting.setRules(config.routing_rules);
    }
    this.moduleConfigs.get(moduleName).routingEngine = moduleRouting;
  }

  /**
   * Charge la configuration depuis MongoDB pour un module et une entité
   * @param {string} entityId - ID de l'entité
   * @param {string} moduleName - Nom du module
   * @returns {Promise<Object|null>} Configuration ou null
   */
  async loadConfigFromDB(entityId, moduleName) {
    try {
      // TEMPORAIRE : Utiliser la base principale au lieu des bases d'entités
      const configCollection = this.database.getCollection('mail_configs');
      
      const configDoc = await configCollection.findOne({
        module_name: moduleName,
        entity_id: entityId
      });

      if (configDoc && configDoc.config) {
        return configDoc.config;
      }
      return null;
    } catch (error) {
      console.error('Erreur chargement config depuis DB:', error);
      return null;
    }
  }

  /**
   * Envoie un email
   * @param {Object} options - Options d'envoi
   * @param {string} options.to - Destinataire
   * @param {string|Array} [options.cc] - Copie (optionnel)
   * @param {string} options.subject - Sujet
   * @param {string} options.body - Corps texte
   * @param {string} options.body_html - Corps HTML (optionnel)
   * @param {Array} options.attachments - Pièces jointes (optionnel)
   * @param {string} options.profile - Profil SMTP à utiliser (optionnel, routing auto sinon)
   * @param {Object} options.context - Contexte pour routing (optionnel)
   * @param {string} options.module_name - Nom du module émetteur (optionnel, 'mail' si standalone)
   * @param {string} options.entity_id - ID de l'entité (optionnel)
   * @param {string} options.collection_name - Nom de collection personnalisé (optionnel)
   * @returns {Promise<Object>} { success: Boolean, email_id: String, error: String }
   */
  async send(options) {
    // Si entity_id fourni, charger la config depuis MongoDB
    if (options.entity_id && options.module_name) {
      const savedConfig = await this.loadConfigFromDB(options.entity_id, options.module_name);
      if (savedConfig) {
        // Initialiser le module avec la config sauvegardée
        this.initModule({
          module_name: options.module_name,
          ...savedConfig
        });
      }
    }
    const {
      to,
      cc = null,
      subject,
      body,
      body_html = null,
      attachments = [],
      profile = null,
      context = {},
      module_name = 'mail',
      entity_id = null,
      collection_name = null
    } = options;

    // Validation
    if (!to || !subject || !body) {
      throw new Error('to, subject et body sont requis');
    }

    // Déterminer profil SMTP et destinataire via routing
    const moduleConfig = this.moduleConfigs.get(module_name);
    let routingEngine = this.routingEngine;
    
    if (moduleConfig && moduleConfig.routingEngine) {
      routingEngine = moduleConfig.routingEngine;
    }

    const routing = routingEngine.route({ context, profile, to });
    if (!routing.profile) {
      routing.profile = this.smtpManager.getPreferredProfile(['gdri_app', 'gdri', 'client']);
    }

    if (!routing.profile) {
      throw new Error(`Aucun profil SMTP disponible. Fournissez 'profile' ou configurez le routing.`);
    }

    // Récupérer la config from du profil
    const from = this.smtpManager.getFrom(routing.profile);
    const transporter = this.smtpManager.getTransporter(routing.profile);

    // Créer le document email à sauvegarder
    const emailDoc = {
      module_name,
      entity_id: entity_id || null,
      profile_used: routing.profile,
      to: routing.to || to,
      cc: cc || null,
      from: {
        name: from.name,
        email: from.email
      },
      subject,
      body,
      body_html: body_html || null,
      attachments: attachments.length > 0 ? attachments.map(a => ({
        filename: a.filename || a.path,
        path: a.path || null
      })) : [],
      status: 'pending',
      sent_at: null,
      error: null,
      context,
      created_at: new Date()
    };

    try {
      // Envoyer l'email via SMTP
      const mailOptions = {
        from: `${from.name} <${from.email}>`,
        to: routing.to || to,
        subject,
        text: body,
        html: body_html || null,
        attachments: attachments.map(a => ({
          filename: a.filename || a.path,
          path: a.path || null
        }))
      };
      if (cc) mailOptions.cc = cc;

      const info = await transporter.sendMail(mailOptions);

      // Mettre à jour le document avec succès
      emailDoc.status = 'sent';
      emailDoc.sent_at = new Date();
      emailDoc.message_id = info.messageId;

      // TEMPORAIRE : Sauvegarder dans la base principale avec préfixe entity_id
      let collection;
      if (entity_id) {
        const baseCollectionName = collection_name || (moduleConfig ? moduleConfig.collection_name : null);
        const finalCollectionName = baseCollectionName || `emails_${entity_id}${module_name !== 'mail' ? `_${module_name}` : ''}`;
        collection = this.database.getCollection(finalCollectionName);
      } else {
        collection = await this.collectionManager.getCollection(
          module_name,
          collection_name || (moduleConfig ? moduleConfig.collection_name : null)
        );
      }

      const result = await collection.insertOne(emailDoc);
      emailDoc._id = result.insertedId;

      return {
        success: true,
        email_id: result.insertedId.toString(),
        message_id: info.messageId
      };

    } catch (error) {
      // Mettre à jour le document avec erreur
      emailDoc.status = 'failed';
      emailDoc.error = error.message;

      // TEMPORAIRE : Sauvegarder quand même pour traçabilité
      try {
        let collection;
        if (entity_id) {
          const baseCollectionName = collection_name || (moduleConfig ? moduleConfig.collection_name : null);
          const finalCollectionName = baseCollectionName || `emails_${entity_id}${module_name !== 'mail' ? `_${module_name}` : ''}`;
          collection = this.database.getCollection(finalCollectionName);
        } else {
          collection = await this.collectionManager.getCollection(
            module_name,
            collection_name || (moduleConfig ? moduleConfig.collection_name : null)
          );
        }
        const result = await collection.insertOne(emailDoc);
        emailDoc._id = result.insertedId;
      } catch (saveError) {
        console.error('Erreur lors de la sauvegarde de l\'email échoué:', saveError);
      }

      return {
        success: false,
        email_id: emailDoc._id ? emailDoc._id.toString() : null,
        error: error.message
      };
    }
  }

  /**
   * Récupère les emails d'une entité
   * @param {string} entity_id - ID de l'entité
   * @param {Object} filters - Filtres (optionnel)
   * @param {string} filters.module_name - Nom du module
   * @param {string} filters.status - Statut de l'email
   * @param {Date} filters.from_date - Date de début
   * @param {Date} filters.to_date - Date de fin
   * @returns {Promise<Array>} Liste des emails
   */
  async getEmails(entity_id, filters = {}) {
    const {
      module_name = null,
      status = null,
      from_date = null,
      to_date = null
    } = filters;

    const collection = await this.collectionManager.getEntityCollection(
      entity_id,
      module_name || 'mail',
      null
    );

    const query = {};
    
    if (module_name) query.module_name = module_name;
    if (status) query.status = status;
    if (from_date || to_date) {
      query.sent_at = {};
      if (from_date) query.sent_at.$gte = from_date;
      if (to_date) query.sent_at.$lte = to_date;
    }

    return collection.find(query).sort({ sent_at: -1 }).toArray();
  }

  /**
   * Retourne le gestionnaire SMTP (pour utilisation avancée)
   * @returns {SMTPManager}
   */
  getSMTPManager() {
    return this.smtpManager;
  }
}

module.exports = MailService;

