/**
 * Routes API pour le module Mail
 * Fichier : backend/modules/mail/routes.js
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../config/jwt');
const database = require('../../config/database');
const mailModule = require('./index');
const mail = mailModule.getMailService();

/**
 * GET /api/mail/config/:moduleName
 * Récupère la configuration Mail d'une entité pour un module
 */
router.get('/config/:moduleName', authenticateJWT, async (req, res) => {
  try {
    const { moduleName } = req.params;
    const { entity_id, role } = req.user;

    // ADMIN_GDRI peut avoir entity_id null, utiliser une valeur par défaut ou une logique spéciale
    // Pour l'instant, on considère que ADMIN_GDRI peut aussi configurer sa propre entité
    // Si entity_id est null, on retourne null (pas de config)
    if (!entity_id) {
      // Pour ADMIN_GDRI sans entity_id, on retourne null (pas encore configuré)
      // En production, on pourrait permettre à ADMIN_GDRI de voir toutes les configs
      return res.json({
        success: true,
        config: null,
        message: 'Aucune configuration trouvée. Veuillez d\'abord créer/associer une entité.'
      });
    }

    // TEMPORAIRE : Utiliser la base principale au lieu des bases d'entités
    // TODO : Revenir aux bases d'entités quand les permissions MongoDB seront configurées
    const configCollection = database.getCollection('mail_configs');

    const config = await configCollection.findOne({
      module_name: moduleName,
      entity_id: entity_id
    });

    if (!config) {
      return res.json({
        success: true,
        config: null,
        message: 'Configuration non trouvée'
      });
    }

    res.json({
      success: true,
      config: config.config || null
    });

  } catch (error) {
    console.error('Erreur récupération config Mail:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/mail/config/:moduleName
 * Sauvegarde la configuration Mail d'une entité pour un module
 */
router.post('/config/:moduleName', authenticateJWT, async (req, res) => {
  try {
    const { moduleName } = req.params;
    const { entity_id, user_id } = req.user;
    const { config } = req.body;

    if (!entity_id) {
      return res.status(400).json({
        success: false,
        message: 'entity_id requis. Veuillez d\'abord créer/associer une entité à votre compte.'
      });
    }

    if (!config || !config.smtp_profiles || Object.keys(config.smtp_profiles).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Configuration SMTP requise'
      });
    }

    // TEMPORAIRE : Utiliser la base principale
    const configCollection = database.getCollection('mail_configs');

    // Sauvegarder/mettre à jour la config
    await configCollection.updateOne(
      {
        module_name: moduleName,
        entity_id: entity_id
      },
      {
        $set: {
          module_name: moduleName,
          entity_id: entity_id,
          config: config,
          updated_at: new Date(),
          updated_by: user_id
        }
      },
      { upsert: true }
    );

    // Initialiser le service Mail avec cette config
    mail.initModule({
      module_name: moduleName,
      ...config
    });

    res.json({
      success: true,
      message: 'Configuration sauvegardée avec succès'
    });

  } catch (error) {
    console.error('Erreur sauvegarde config Mail:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/mail/test/send
 * Envoie un email de test
 */
router.post('/test/send', authenticateJWT, async (req, res) => {
  try {
    const { entity_id } = req.user;
    const { to, subject, body, body_html, profile, module_name = 'mail' } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'to, subject et body sont requis'
      });
    }

    // TEMPORAIRE : Charger la config depuis la base principale
    const configCollection = database.getCollection('mail_configs');
    const savedConfig = await configCollection.findOne({
      module_name: module_name,
      entity_id: entity_id
    });

    if (savedConfig && savedConfig.config) {
      mail.initModule({
        module_name: module_name,
        ...savedConfig.config
      });
    }

    // Envoyer l'email
    const result = await mail.send({
      to,
      subject,
      body,
      body_html,
      profile,
      module_name,
      entity_id
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Email envoyé avec succès',
        email_id: result.email_id
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Erreur lors de l\'envoi',
        email_id: result.email_id
      });
    }

  } catch (error) {
    console.error('Erreur envoi email test:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/mail/test/verify/:profile
 * Vérifie la connexion SMTP d'un profil
 */
router.get('/test/verify/:profile', authenticateJWT, async (req, res) => {
  try {
    const { profile } = req.params;
    const { entity_id } = req.user;
    const { module_name = 'mail' } = req.query;

    // TEMPORAIRE : Charger la config depuis la base principale
    const configCollection = database.getCollection('mail_configs');
    const savedConfig = await configCollection.findOne({
      module_name: module_name,
      entity_id: entity_id
    });

    if (!savedConfig || !savedConfig.config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration non trouvée'
      });
    }

    // Initialiser le service
    mail.initModule({
      module_name: module_name,
      ...savedConfig.config
    });

    // Vérifier la connexion
    const smtpManager = mail.getSMTPManager();
    const isValid = await smtpManager.verifyConnection(profile);

    res.json({
      success: isValid,
      message: isValid ? 'Connexion SMTP OK' : 'Connexion SMTP échouée'
    });

  } catch (error) {
    console.error('Erreur vérification SMTP:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/mail/emails
 * Récupère l'historique des emails d'une entité
 */
router.get('/emails', authenticateJWT, async (req, res) => {
  try {
    const { entity_id } = req.user;
    const { module_name = 'mail', status, from_date, to_date, limit = 50 } = req.query;

    if (!entity_id) {
      return res.status(400).json({
        success: false,
        message: 'entity_id requis'
      });
    }

    // TEMPORAIRE : Utiliser la base principale avec préfixe entity_id
    let collectionName = `emails_${entity_id}`;
    if (module_name !== 'mail') {
      collectionName = `emails_${entity_id}_${module_name}`;
    }

    const emailsCollection = database.getCollection(collectionName);

    // Construire la requête
    const query = {};
    if (module_name) query.module_name = module_name;
    if (status) query.status = status;
    if (from_date || to_date) {
      query.sent_at = {};
      if (from_date) query.sent_at.$gte = new Date(from_date);
      if (to_date) query.sent_at.$lte = new Date(to_date);
    }

    // Récupérer les emails
    const emails = await emailsCollection
      .find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      emails: emails,
      total: emails.length
    });

  } catch (error) {
    console.error('Erreur récupération emails:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;

