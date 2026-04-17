/**
 * Routes API pour le module Mail
 * Fichier : backend/modules/mail/routes.js
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticateJWT } = require('../../../backend/config/jwt');
const database = require('../../../backend/config/database');
const mailModule = require('./index');
const mail = mailModule.getMailService();

const PROVIDERS_COLLECTION = 'mail_providers';

/** Middleware : réservé à ADMIN_GDRI */
function requireAdminGdri(req, res, next) {
  if (req.user && req.user.role === 'ADMIN_GDRI') return next();
  return res.status(403).json({ success: false, message: 'Réservé à l\'administrateur GDRI' });
}

/**
 * Résout la config IMAP : soit config.imap_config, soit premier compte avec profil_imap_id (nouveau format)
 * @param {Object} config - config du module
 * @returns {Object|null} { host, port, secure, user, password, mailbox }
 */
function resolveImapConfig(config) {
  if (!config) return null;
  if (config.imap_config && typeof config.imap_config === 'object') {
    return config.imap_config;
  }
  if (Array.isArray(config.profils_imap) && Array.isArray(config.comptes)) {
    const byId = (arr) => (arr || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const imapById = byId(config.profils_imap);
    const compte = config.comptes.find((c) => c.profil_imap_id);
    if (!compte || !imapById[compte.profil_imap_id]) return null;
    const profil = imapById[compte.profil_imap_id];
    return {
      host: profil.host,
      port: parseInt(profil.port, 10) || 993,
      secure: profil.secure !== false,
      user: compte.email,
      password: compte.password || '',
      mailbox: compte.imap_mailbox || 'INBOX'
    };
  }
  return null;
}

/**
 * Charge les presets depuis la base GDRI (collection mail_providers)
 * Si la collection est vide, importe une fois depuis le fichier JSON puis retourne la liste
 */
async function getPresetsFromDb() {
  const col = database.getCollection(PROVIDERS_COLLECTION);
  const list = await col.find({}).sort({ name: 1 }).toArray();
  if (list.length > 0) {
    return list.map((doc) => ({
      id: doc.id,
      name: doc.name,
      imap: doc.imap || {},
      smtp: doc.smtp || {}
    }));
  }
  const presetsPath = path.join(__dirname, 'data', 'mail-provider-presets.json');
  if (fs.existsSync(presetsPath)) {
    const raw = fs.readFileSync(presetsPath, 'utf8');
    const presets = JSON.parse(raw);
    if (Array.isArray(presets) && presets.length > 0) {
      await col.insertMany(presets.map((p) => ({
        id: p.id,
        name: p.name,
        imap: p.imap || {},
        smtp: p.smtp || {},
        created_at: new Date(),
        updated_at: new Date()
      })));
      return presets;
    }
  }
  return [];
}

/**
 * GET /api/mail/presets
 * Liste des fournisseurs mail (depuis la base GDRI)
 */
router.get('/presets', authenticateJWT, async (req, res) => {
  try {
    const presets = await getPresetsFromDb();
    res.json({ success: true, presets });
  } catch (error) {
    console.error('Erreur chargement presets mail:', error);
    res.status(500).json({ success: false, message: 'Erreur chargement presets' });
  }
});

/**
 * GET /api/mail/admin/providers
 * Liste des fournisseurs mail (back-office, ADMIN_GDRI)
 */
router.get('/admin/providers', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const presets = await getPresetsFromDb();
    const col = database.getCollection(PROVIDERS_COLLECTION);
    const full = await col.find({}).sort({ name: 1 }).toArray();
    res.json({ success: true, providers: full });
  } catch (error) {
    console.error('Erreur list admin providers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/mail/admin/providers
 * Créer un fournisseur mail (ADMIN_GDRI)
 */
router.post('/admin/providers', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const { id, name, imap, smtp } = req.body || {};
    if (!id || !name || !imap || !smtp) {
      return res.status(400).json({ success: false, message: 'id, name, imap et smtp requis' });
    }
    const col = database.getCollection(PROVIDERS_COLLECTION);
    const existing = await col.findOne({ id: String(id).trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Un fournisseur avec cet id existe déjà' });
    }
    const doc = {
      id: String(id).trim(),
      name: String(name).trim(),
      imap: {
        host: String(imap.host || '').trim(),
        port: parseInt(imap.port, 10) || 993,
        secure: imap.secure === true
      },
      smtp: {
        host: String(smtp.host || '').trim(),
        port: parseInt(smtp.port, 10) || 587,
        secure: smtp.secure === true
      },
      created_at: new Date(),
      updated_at: new Date()
    };
    await col.insertOne(doc);
    res.status(201).json({ success: true, provider: doc });
  } catch (error) {
    console.error('Erreur create provider:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/mail/admin/providers/:id
 * Modifier un fournisseur mail (ADMIN_GDRI)
 */
router.put('/admin/providers/:id', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imap, smtp } = req.body || {};
    const col = database.getCollection(PROVIDERS_COLLECTION);
    const update = {
      updated_at: new Date()
    };
    if (name !== undefined) update.name = String(name).trim();
    if (imap) {
      update.imap = {
        host: String(imap.host || '').trim(),
        port: parseInt(imap.port, 10) || 993,
        secure: imap.secure === true
      };
    }
    if (smtp) {
      update.smtp = {
        host: String(smtp.host || '').trim(),
        port: parseInt(smtp.port, 10) || 587,
        secure: smtp.secure === true
      };
    }
    const result = await col.findOneAndUpdate(
      { id },
      { $set: update },
      { returnDocument: 'after' }
    );
    const updated = result && (result.value || result);
    if (!updated || !updated.id) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }
    res.json({ success: true, provider: updated });
  } catch (error) {
    console.error('Erreur update provider:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/mail/admin/providers/:id
 * Supprimer un fournisseur mail (ADMIN_GDRI)
 */
router.delete('/admin/providers/:id', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const { id } = req.params;
    const col = database.getCollection(PROVIDERS_COLLECTION);
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete provider:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/mail/config/:moduleName
 * Récupère la configuration Mail d'une entité pour un module
 */
router.get('/config/:moduleName', authenticateJWT, async (req, res) => {
  try {
    const { moduleName } = req.params;
    const { role } = req.user;
    const entityId = req.user.currentEntrepriseId || req.user.entrepriseId || req.user.entity_id || null;

    // ADMIN_GDRI peut avoir entity_id null, utiliser une valeur par défaut ou une logique spéciale
    // Pour l'instant, on considère que ADMIN_GDRI peut aussi configurer sa propre entité
    // Si entity_id est null, on retourne null (pas de config)
    if (!entityId) {
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
      entity_id: entityId
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
    const { user_id } = req.user;
    const entityId = req.user.currentEntrepriseId || req.user.entrepriseId || req.user.entity_id || null;
    const { config } = req.body;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'entity_id requis. Veuillez d\'abord créer/associer une entité à votre compte.'
      });
    }

    // Accepter ancien format (smtp_profiles) ou nouveau (profils_smtp + comptes)
    const hasOldSmtp =
      config &&
      config.smtp_profiles &&
      typeof config.smtp_profiles === 'object' &&
      Object.keys(config.smtp_profiles).length > 0;
    const hasNewFormat =
      config &&
      Array.isArray(config.profils_smtp) &&
      Array.isArray(config.comptes) &&
      config.comptes.length > 0;
    const hasSmtp = hasOldSmtp || hasNewFormat;

    let hasImap =
      config &&
      config.imap_config &&
      typeof config.imap_config === 'object';
    if (!hasImap && hasOldSmtp) {
      const firstWithImap = Object.values(config.smtp_profiles).find((p) => p && p.imap);
      if (firstWithImap) {
        config.imap_config = firstWithImap.imap;
        hasImap = true;
      }
    }
    if (!hasImap && hasNewFormat && Array.isArray(config.profils_imap) && config.profils_imap.length > 0) {
      hasImap = config.comptes.some((c) => c.profil_imap_id);
    }

    if (!hasSmtp && !hasImap) {
      return res.status(400).json({
        success: false,
        message: 'Configuration Mail requise : profils SMTP + comptes, ou au moins un profil IMAP utilisé par un compte'
      });
    }

    const configCollection = database.getCollection('mail_configs');

    // Sauvegarder/mettre à jour la config
    await configCollection.updateOne(
      {
        module_name: moduleName,
        entity_id: entityId
      },
      {
        $set: {
          module_name: moduleName,
          entity_id: entityId,
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
    const entityId = req.user.currentEntrepriseId || req.user.entrepriseId || req.user.entity_id || null;
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
      entity_id: entityId
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
      entity_id: entityId
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
    const entityId = req.user.currentEntrepriseId || req.user.entrepriseId || req.user.entity_id || null;
    const { module_name = 'mail' } = req.query;

    // TEMPORAIRE : Charger la config depuis la base principale
    const configCollection = database.getCollection('mail_configs');
    const savedConfig = await configCollection.findOne({
      module_name: module_name,
      entity_id: entityId
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
 * GET /api/mail/test/imap
 * Vérifie la connexion IMAP de l'entité (utilise config.imap_config)
 */
router.get('/test/imap', authenticateJWT, async (req, res) => {
  try {
    const entityId = req.user.currentEntrepriseId || req.user.entrepriseId || req.user.entity_id || null;
    const { module_name = 'mail' } = req.query;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'entity_id requis'
      });
    }

    // TEMPORAIRE : Charger la config depuis la base principale
    const configCollection = database.getCollection('mail_configs');
    const savedConfig = await configCollection.findOne({
      module_name: module_name,
      entity_id: entityId
    });

    const imapConfig = resolveImapConfig(savedConfig?.config);
    if (!imapConfig) {
      return res.status(404).json({
        success: false,
        message: 'Configuration IMAP non trouvée pour ce module / cette entité'
      });
    }

    const imapService = mail.getImapService();
    const result = await imapService.testConnection(imapConfig);

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Erreur vérification IMAP:', error);
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
    const entityId = req.user.currentEntrepriseId || req.user.entrepriseId || req.user.entity_id || null;
    const { module_name = 'mail', status, from_date, to_date, limit = 50 } = req.query;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'entity_id requis'
      });
    }

    // TEMPORAIRE : Utiliser la base principale avec préfixe entity_id
    let collectionName = `emails_${entityId}`;
    if (module_name !== 'mail') {
      collectionName = `emails_${entityId}_${module_name}`;
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

