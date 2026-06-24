/**
 * Service de traitement des webhooks Facebook
 * Fichier : backend/modules/facebook/services/WebhookService.js
 */

const IntentionService = require('../../analyse-intention/services/IntentionService');
const AIService = require('../../analyse-intention/services/AIService');
const crypto = require('crypto');
let mailModule;
try {
  // Ancien emplacement (backend/modules/mail)
  mailModule = require('../../mail');
} catch (error) {
  // Emplacement actuel (modules/mail/backend)
  mailModule = require('../../../../modules/mail/backend');
}

class WebhookService {
  constructor(database) {
    this.database = database;
    this.initialized = false;
    this.intentionService = null;
    this.aiService = null;
  }

  getDefaultIntentionsPreset() {
    return [
      { name: 'commercial', category: 'commercial', label: 'Commercial', description: 'Demandes de produits, prix, devis, informations commerciales' },
      { name: 'sav', category: 'sav', label: 'SAV', description: 'Problèmes techniques, bugs, dysfonctionnements' },
      { name: 'technique', category: 'technique', label: 'Technique', description: 'Questions d\'utilisation, configuration, installation' },
      { name: 'critique', category: 'critique', label: 'Critique', description: 'Signalements d\'erreurs, corrections d\'informations' },
      { name: 'positif', category: 'positif', label: 'Positif', description: 'Commentaires positifs, remerciements' },
      { name: 'spam', category: 'spam', label: 'Spam', description: 'Messages publicitaires, indésirables' },
      { name: 'generic', category: 'generic', label: 'Général', description: 'Intentions génériques non spécialisées' }
    ];
  }

  /**
   * Initialise le service
   */
  async init() {
    if (this.initialized) return;
    
    // Initialiser le service AI avec appel direct à Ollama (plus de backendIA)
    this.aiService = new AIService({
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral:latest'
    });
    
    this.intentionService = new IntentionService(this.database);
    this.intentionService.setAIService(this.aiService);
    
    this.initialized = true;
  }

  /**
   * Traite un webhook Facebook et sauvegarde les événements
   * @param {Object} webhookData - Données du webhook
   * @returns {Promise<Object>} Résultat du traitement
   */
  async processWebhook(webhookData) {
    try {
      // Structure webhook Facebook :
      // { object: 'page', entry: [{ id, time, messaging, changes, ... }] }

      if (!webhookData.entry || !Array.isArray(webhookData.entry)) {
        return { success: false, error: 'Format webhook invalide' };
      }

      let totalEvents = 0;

      // Traiter chaque entry
      for (const entry of webhookData.entry) {
        // Une même page Facebook peut être utilisée par plusieurs entreprises :
        // on duplique le traitement pour chaque entreprise liée au pageId.
        const entityIds = await this.resolveEntrepriseIdsForPage(entry.id);
        const effectiveEntityIds = entityIds.length > 0 ? entityIds : [null];

        // Sauvegarder l'entry complète pour chaque entreprise concernée
        for (const entityId of effectiveEntityIds) {
          await this.saveWebhook(entry, entityId);
        }

        // Compter les événements
        const eventCount = this.countEvents(entry);
        totalEvents += eventCount;

        // Traiter les événements si nécessaire pour chaque entreprise liée
        if (eventCount > 0) {
          for (const entityId of effectiveEntityIds) {
            await this.processEntryEvents(entry, entityId);
          }
        }
      }

      return {
        success: true,
        entryCount: webhookData.entry.length,
        eventsCount: totalEvents
      };

    } catch (error) {
      console.error('Erreur processWebhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sauvegarde un webhook dans la base de données
   * @param {Object} entry - Entry du webhook
   * @param {string} entityId - ID de l'entité
   */
  async saveWebhook(entry, entityId) {
    try {
      // TEMPORAIRE : Utiliser la base principale
      const collection = this.database.getCollection('facebook_webhooks');

      const webhookDoc = {
        entry_id: entry.id,
        entity_id: entityId,
        time: new Date(entry.time * 1000), // Facebook envoie en timestamp Unix
        entry: entry, // Sauvegarder l'entry complète
        received_at: new Date()
      };

      await collection.insertOne(webhookDoc);

    } catch (error) {
      console.error('Erreur sauvegarde webhook:', error);
    }
  }

  /**
   * Détermine l'entité à partir du pageId Facebook
   * @param {string} pageId - ID de la page Facebook
   * @returns {Promise<string|null>} ID de l'entité ou null
   */
  async getEntityIdFromPageId(pageId) {
    try {
      // TEMPORAIRE : Utiliser la base principale
      const collection = this.database.getCollection('facebook_accounts');

      const account = await collection.findOne({ 
        pageId: pageId,
        isActive: true
      });

      return account ? account.entity_id : null;

    } catch (error) {
      console.error('Erreur getEntityIdFromPageId:', error);
      return null;
    }
  }

  /**
   * Résout l'entreprise (entrepriseId) à partir du pageId Facebook.
   * Priorité : facebook_configs (OAuth) puis facebook_accounts (legacy).
   * @param {string} pageId
   * @returns {Promise<string|null>}
   */
  async resolveEntrepriseIdForPage(pageId) {
    const ids = await this.resolveEntrepriseIdsForPage(pageId);
    return ids.length > 0 ? ids[0] : null;
  }

  /**
   * Résout toutes les entreprises liées à une page Facebook.
   * Permet de traiter un webhook pour plusieurs entreprises clientes partageant le même pageId.
   * @param {string} pageId
   * @returns {Promise<string[]>}
   */
  async resolveEntrepriseIdsForPage(pageId) {
    try {
      const pid = pageId != null ? String(pageId) : '';
      if (!pid) return [];
      const configs = this.database.getCollection('facebook_configs');
      const rows = await configs.find({
        $or: [{ pageId: pid }, { pageId: String(Number(pid)) }]
      }).toArray();
      const ids = (rows || [])
        .map((row) => (row && row.entrepriseId != null ? String(row.entrepriseId) : null))
        .filter(Boolean);
      if (ids.length > 0) {
        return Array.from(new Set(ids));
      }
    } catch (e) {
      console.warn('resolveEntrepriseIdsForPage facebook_configs:', e.message);
    }
    const legacyId = await this.getEntityIdFromPageId(pageId);
    return legacyId ? [String(legacyId)] : [];
  }

  /**
   * Charge la configuration Agent IA (analyse_intention_configs) pour une page ou le défaut entreprise.
   * Aligné sur /api/analyse/agent-config (entrepriseId + pageId optionnel).
   * @param {string} entrepriseId
   * @param {string|null} facebookPageId
   * @returns {Promise<Object|null>} config (objet interne) ou null
   */
  async loadAnalyseIntentionConfig(entrepriseId, facebookPageId = null) {
    try {
      if (!entrepriseId) return null;
      const coll = this.database.getCollection('analyse_intention_configs');
      const eid = String(entrepriseId);
      const pid = facebookPageId != null && facebookPageId !== '' ? String(facebookPageId) : null;

      let doc = null;
      if (pid) {
        doc = await coll.findOne({ entrepriseId: eid, pageId: pid });
      }
      if (!doc) {
        doc = await coll.findOne({
          entrepriseId: eid,
          $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
        });
      }
      if (!doc) {
        doc = await coll.findOne({ entity_id: eid });
      }
      if (doc && doc.config) {
        return doc.config;
      }
      // Fallback métier: toujours proposer 7 intentions par défaut.
      return {
        customIntentions: this.getDefaultIntentionsPreset()
      };
    } catch (error) {
      console.error('Erreur loadAnalyseIntentionConfig:', error);
      return {
        customIntentions: this.getDefaultIntentionsPreset()
      };
    }
  }

  /**
   * Compte le nombre d'événements dans une entry
   * @param {Object} entry - Entry du webhook
   * @returns {number} Nombre d'événements
   */
  countEvents(entry) {
    let count = 0;
    
    if (entry.messaging) count += entry.messaging.length;
    if (entry.changes) count += entry.changes.length;
    
    return count;
  }

  /**
   * Traite les événements d'une entry
   * @param {Object} entry - Entry du webhook
   * @param {string} entityId - ID de l'entité
   */
  async processEntryEvents(entry, entityId) {
    try {
      console.log(`  🔍 processEntryEvents appelé pour entry.id=${entry.id}, entityId=${entityId || 'null'}`);
      
      // Extraire les messages des événements
      const extractedMessages = this.extractMessagesFromEntry(entry);
      const facebookPageId = entry.id != null ? String(entry.id) : null;
      const messages = await this.filterAlreadyAnalyzedMessages(entityId, facebookPageId, extractedMessages);
      
      console.log(`  📋 Messages extraits: ${messages.length}`);
      if (messages.length > 0) {
        messages.forEach((msg, idx) => {
          console.log(`    ${idx + 1}. Type: ${msg.type}, Auteur: ${msg.author?.name || 'N/A'}, Message: ${(msg.message || '').substring(0, 50)}...`);
        });
      }
      
      if (messages.length === 0) {
        console.log('  ℹ️  Aucun message à traiter dans cette entry');
        console.log(`  💡 Entry contient: messaging=${!!entry.messaging}, changes=${!!entry.changes}`);
        return;
      }
      
      console.log(`  📨 ${messages.length} message(s) à analyser`);
      
      // Analyser les intentions via Ollama (appel direct)
      if (!this.intentionService) {
        console.error('  ❌ ERREUR: intentionService n\'est pas initialisé !');
        console.error('  💡 Vérifiez que WebhookService.init() a été appelé.');
        return;
      }
      
      if (!this.aiService) {
        console.error('  ❌ ERREUR: aiService n\'est pas initialisé !');
        console.error('  💡 Vérifiez que WebhookService.init() a été appelé.');
        return;
      }
      
      console.log('  🤖 Analyse d\'intention en cours...');
      console.log(`  📤 Envoi à Ollama (${this.aiService?.ollamaUrl || 'N/A'})...`);
      console.log(`  🤖 Modèle: ${this.aiService?.model || 'N/A'}`);

        // Configuration Agent IA : par page Facebook si enregistrée, sinon défaut entreprise
        let basePrompt = null;
        let customIntentions = [];

        if (entityId) {
          const cfg = await this.loadAnalyseIntentionConfig(entityId, facebookPageId);
          basePrompt = cfg && (cfg.basePrompt || cfg.base_prompt) ? (cfg.basePrompt || cfg.base_prompt) : null;
          customIntentions = cfg
            ? this.intentionService.buildActiveIntentionsFromConfig(cfg)
            : this.getDefaultIntentionsPreset();
          console.log(
            `  📋 Configuration agent IA (${facebookPageId ? `page ${facebookPageId}` : 'défaut entreprise'}): ` +
            `${customIntentions.length} intention(s) configurée(s)`
          );
        } else {
          console.log('  ⚠️ Entité introuvable pour cette page : traitement ignoré.');
          return;
        }

        const startTime = Date.now();

        const analysisResult = await this.intentionService.analyzeIntentions(messages, basePrompt, customIntentions);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (analysisResult.success) {
          console.log(`  ✅ Analyse terminée en ${duration}s`);
          console.log(`  📊 Résultats: ${JSON.stringify(analysisResult.data, null, 2).substring(0, 200)}...`);

          const cfgFull = entityId ? await this.loadAnalyseIntentionConfig(entityId, facebookPageId) : null;
          const sendNow = this.shouldSendEmailImmediately(analysisResult.data, cfgFull);
          await this.persistAnalyzedMessagesFromBatch(
            entityId,
            facebookPageId,
            messages,
            analysisResult.data,
            !sendNow,
            cfgFull
          );

          if (sendNow) {
            const immediateBatch = this.buildImmediateEmailBatch(analysisResult.data, messages, cfgFull);
            if (immediateBatch.originalMessages.length > 0 && immediateBatch.analysisData.analyses.length > 0) {
              await this.sendAnalysisEmail(immediateBatch.analysisData, immediateBatch.originalMessages, entityId, facebookPageId);
            } else {
              console.log('  📭 Aucun message réellement "immediate" dans ce lot, envoi immédiat ignoré.');
            }
          } else {
            console.log('  📭 Rapport différé : envoi au prochain créneau quotidien (sync Graph + file d’attente).');
          }
        } else {
          console.error('  ❌ Erreur lors de l\'analyse:', analysisResult.error);
          console.error(`  ⏱️  Durée avant erreur: ${duration}s`);
        }
      
    } catch (error) {
      console.error('  ❌ Erreur processEntryEvents:', error);
    }
  }
  
  /**
   * Extrait les messages d'une entry de webhook
   * @param {Object} entry - Entry du webhook
   * @returns {Array} Tableau de messages formatés
   */
  extractMessagesFromEntry(entry) {
    const messages = [];
    const pageId = entry && entry.id != null ? String(entry.id) : '';
    
    // Traiter les changements (commentaires, mentions)
    if (entry.changes) {
      entry.changes.forEach(change => {
        if (change.value && change.value.message) {
          const authorId = change.value.from && change.value.from.id != null ? String(change.value.from.id) : '';
          if (this.isOwnPageAuthor(authorId, pageId)) {
            return;
          }
          messages.push({
            message: change.value.message,
            author: {
              name: change.value.from?.name || 'Utilisateur Facebook',
              id: change.value.from?.id || 'unknown'
            },
            created_time: new Date(change.value.created_time * 1000).toISOString(),
            type: change.field || 'unknown',
            post_id: change.value.post_id,
            comment_id: change.value.comment_id
          });
        }
      });
    }
    
    // Traiter les messages directs
    if (entry.messaging) {
      entry.messaging.forEach(msg => {
        if (msg.message && msg.message.text) {
          const authorId = msg.sender && msg.sender.id != null ? String(msg.sender.id) : '';
          if (this.isOwnPageAuthor(authorId, pageId)) {
            return;
          }
          messages.push({
            message: msg.message.text,
            author: {
              name: 'Utilisateur Facebook',
              id: msg.sender?.id || 'unknown'
            },
            created_time: new Date(msg.timestamp * 1000).toISOString(),
            type: 'message',
            mid: msg.message.mid,
            sender_psid: msg.sender?.id || null
          });
        }
      });
    }
    
    return messages;
  }

  isOwnPageAuthor(authorId, pageId) {
    return Boolean(authorId && pageId && String(authorId) === String(pageId));
  }

  async filterAlreadyAnalyzedMessages(entityId, pageId, messages) {
    if (!entityId || !pageId || !Array.isArray(messages) || messages.length === 0) {
      return Array.isArray(messages) ? messages : [];
    }

    const coll = this.database.getCollection('facebook_analyzed_messages');
    const messageWithKeys = messages.map((msg) => ({
      msg,
      dedupKey: this.buildMessageDedupKey(msg)
    }));
    const keys = messageWithKeys.map((row) => row.dedupKey).filter(Boolean);
    if (keys.length === 0) return messages;

    const existing = await coll.find({
      entityId: String(entityId),
      pageId: String(pageId),
      dedup_key: { $in: keys }
    }).project({ dedup_key: 1 }).toArray();

    const existingKeys = new Set((existing || []).map((row) => row && row.dedup_key).filter(Boolean));
    const filtered = messageWithKeys
      .filter((row) => !existingKeys.has(row.dedupKey))
      .map((row) => row.msg);

    if (filtered.length !== messages.length) {
      console.log(`  🛡️ Doublons ignorés: ${messages.length - filtered.length}/${messages.length}`);
    }
    return filtered;
  }
  
  /**
   * Envoie un email avec les résultats de l'analyse
   * @param {Object} analysisData - Données de l'analyse
   * @param {Array} originalMessages - Messages originaux
   * @param {string} entityId - ID de l'entité (entrepriseId)
   * @param {string|null} facebookPageId - ID page Facebook (config par page)
   */
  async sendAnalysisEmail(analysisData, originalMessages, entityId, facebookPageId = null, options = {}) {
    try {
      console.log('  📧 Préparation de l\'envoi d\'email...');
      console.log(`  🔍 Entity ID: ${entityId || 'NON DÉFINI'}`);
      if (facebookPageId) {
        console.log(`  📄 Page Facebook (config): ${facebookPageId}`);
      }

      // Charger la configuration de l'agent Facebook (même logique que l'analyse)
      const config = await this.loadFacebookAgentConfig(entityId, facebookPageId);
      const defaultFallbackEmails = this.getDefaultFallbackEmails(config);
      
      if (!config) {
        console.log('  ⚠️  Pas de configuration trouvée dans MongoDB pour cette entité');
        console.log(`  💡 Vérifiez que la configuration est sauvegardée pour entity_id: ${entityId}`);
        return;
      }
      
      console.log('  ✅ Configuration chargée');
      console.log(`  📧 Emails par défaut: ${defaultFallbackEmails.length > 0 ? defaultFallbackEmails.join(', ') : 'NON DÉFINI'}`);
      console.log(`  📋 Intentions configurées: ${config.customIntentions?.length || 0}`);
      
      if (defaultFallbackEmails.length === 0) {
        console.log('  ⚠️  Pas d\'email par défaut configuré, email non envoyé');
        console.log('  💡 Configurez au moins un email par défaut dans la page de configuration de l\'agent Facebook');
        return;
      }
      
      // Déterminer les destinataires selon les intentions détectées
      let recipients = Array.isArray(options.forcedRecipients) && options.forcedRecipients.length > 0
        ? options.forcedRecipients
            .map((email) => String(email || '').trim())
            .filter(Boolean)
            .map((email) => ({ email, intentions: ['manuel'], urgent: false }))
        : this.getRecipientsFromAnalysis(analysisData, config);
      
      console.log(`  📬 Destinataires trouvés: ${recipients.length}`);
      recipients.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.email} (${r.intentions.join(', ')})${r.urgent ? ' ⚠️ URGENT' : ''}`);
      });
      
      if (recipients.length === 0) {
        console.log('  ⚠️  Aucun destinataire spécifique trouvé, fallback sur l\'email par défaut');
        const defaultIntentions = this.getAllIntentionsFromAnalysis(analysisData);
        recipients = defaultFallbackEmails.map((email) => ({
          email,
          intentions: defaultIntentions.length > 0 ? defaultIntentions : ['global'],
          urgent: false
        }));
      }
      
      // Préparer des liens d'action sécurisés (usage unique, durée limitée)
      const actionLinksByIndex = await this.buildEmailActionLinks(originalMessages, entityId, facebookPageId);
      const pageContext = await this.resolveFacebookPageContext(entityId, facebookPageId);

      // Préparer le contenu de l'email
      const emailContent = this.formatAnalysisEmail(analysisData, originalMessages, actionLinksByIndex, {
        pageLabel: pageContext.pageLabel
      });
      
      // Récupérer le service Mail
      const mail = mailModule.getMailService();
      console.log('  📧 Service Mail récupéré');
      
      // Charger la configuration Mail pour cette entité
      console.log('  🔍 Chargement de la configuration SMTP...');
      const mailConfig = await mail.loadConfigFromDB(entityId, 'facebook');
      let smtpProfileName = null;
      const hasUsableMailConfig = (cfg) => {
        if (!cfg || typeof cfg !== 'object') return false;
        const hasLegacy = cfg.smtp_profiles && Object.keys(cfg.smtp_profiles).length > 0;
        const hasNewFormat =
          Array.isArray(cfg.profils_smtp) &&
          cfg.profils_smtp.length > 0 &&
          Array.isArray(cfg.comptes) &&
          cfg.comptes.some((c) => c && c.profil_smtp_id && c.email);
        return Boolean(hasLegacy || hasNewFormat);
      };
      
      if (!hasUsableMailConfig(mailConfig)) {
        console.log('  ⚠️  Pas de configuration SMTP trouvée pour le module Facebook');
        console.log('  💡 Configurez un profil SMTP dans la page de configuration Mail');
        console.log('  💡 Ou utilisez la configuration par défaut du module Mail');
        
        // Essayer avec la config par défaut du module Mail
        const defaultMailConfig = await mail.loadConfigFromDB(entityId, 'mail');
        if (hasUsableMailConfig(defaultMailConfig)) {
          console.log('  ✅ Configuration Mail par défaut trouvée, utilisation de celle-ci');
          smtpProfileName = this.getDefaultSmtpProfileName(defaultMailConfig);
          mail.initModule({
            module_name: 'facebook',
            ...defaultMailConfig
          });
        } else {
          // Fallback supplémentaire : config mail globale (sans entity_id) utilisée comme défaut GDRI.
          try {
            const globalMailDoc = await this.database.getCollection('mail_configs').findOne({
              module_name: 'mail',
              $or: [
                { entity_id: null },
                { entity_id: '' },
                { entity_id: { $exists: false } }
              ]
            });
            const globalMailConfig = globalMailDoc && globalMailDoc.config ? globalMailDoc.config : null;
            if (hasUsableMailConfig(globalMailConfig)) {
              console.log('  ✅ Configuration SMTP globale GDRI trouvée, utilisation en fallback');
              smtpProfileName = this.getDefaultSmtpProfileName(globalMailConfig);
              mail.initModule({
                module_name: 'facebook',
                ...globalMailConfig
              });
            }
          } catch (globalErr) {
            console.warn('  ⚠️ Impossible de charger la configuration SMTP globale:', globalErr.message);
          }

          // Dernier fallback : profil SMTP d'environnement (gdri_app) si disponible côté module Mail.
          if (!smtpProfileName && typeof mail.hasFallbackProfile === 'function' && mail.hasFallbackProfile()) {
            console.log('  ⚠️  Aucune config DB trouvée, fallback vers profil SMTP d’environnement (gdri_app)');
            smtpProfileName = 'gdri_app';
            mail.initModule({ module_name: 'facebook' });
          } else if (!smtpProfileName) {
            console.log('  ❌ Aucune configuration SMTP disponible, email non envoyé');
            return { success: false, reason: 'smtp_config_missing' };
          }
        }
      } else {
        console.log('  ✅ Configuration SMTP trouvée');
        smtpProfileName = this.getDefaultSmtpProfileName(mailConfig);
        mail.initModule({
          module_name: 'facebook',
          ...mailConfig
        });
      }
      
      if (!smtpProfileName) {
        console.log('  ⚠️  Aucun profil SMTP sélectionné, tentative avec le premier profil disponible');
        const effectiveConfig = hasUsableMailConfig(mailConfig)
          ? mailConfig
          : await mail.loadConfigFromDB(entityId, 'mail');
        smtpProfileName = this.getDefaultSmtpProfileName(effectiveConfig);
        if (!smtpProfileName && typeof mail.hasFallbackProfile === 'function' && mail.hasFallbackProfile()) {
          smtpProfileName = 'gdri_app';
        }
      }
      
      if (!smtpProfileName) {
        console.log('  ❌ Impossible de déterminer un profil SMTP, email non envoyé');
        return { success: false, reason: 'smtp_profile_missing' };
      }
      console.log(`  ✉️  Profil SMTP utilisé: ${smtpProfileName}`);
      
      // Envoyer l'email à chaque destinataire
      for (const recipient of recipients) {
        console.log(`  📤 Envoi de l'email à ${recipient.email}...`);
        
        const emailResult = await mail.send({
          to: recipient.email,
          subject: `📊 Analyse d'intention Facebook${pageContext.subjectSuffix} - ${recipient.intentions.join(', ')}`,
          body: emailContent.text,
          body_html: emailContent.html,
          module_name: 'facebook',
          entity_id: entityId,
          profile: smtpProfileName,
          context: {
            priority: recipient.urgent ? 'high' : 'medium',
            category: recipient.intentions[0] || 'generic'
          }
        });
        
        if (emailResult.success) {
          console.log(`  ✅ Email envoyé avec succès à ${recipient.email}`);
          console.log(`     Email ID: ${emailResult.email_id || 'N/A'}`);
        } else {
          console.error(`  ❌ Erreur envoi email à ${recipient.email}:`, emailResult.error);
        }
      }
      return { success: true, recipientsCount: recipients.length };
      
    } catch (error) {
      console.error('  ❌ Erreur sendAnalysisEmail:', error);
      return { success: false, reason: error.message };
    }
  }

  getFrontendBaseUrl() {
    return String(process.env.FRONTEND_BASE_URL || 'https://www.gdr-innovation.fr').replace(/\/+$/, '');
  }

  async createEmailActionToken(payload, ttlMinutes = 60 * 24 * 3) {
    const coll = this.database.getCollection('facebook_email_action_tokens');
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Math.max(5, Number(ttlMinutes || 0)) * 60 * 1000);
    await coll.insertOne({
      token,
      payload: payload || {},
      used: false,
      created_at: now,
      expires_at: expiresAt
    });
    return token;
  }

  async buildEmailActionLinks(originalMessages, entityId, facebookPageId) {
    const map = {};
    if (!Array.isArray(originalMessages)) return map;
    const base = this.getFrontendBaseUrl();

    for (let i = 0; i < originalMessages.length; i++) {
      const m = originalMessages[i] || {};
      if (!m.message_id) continue;
      const commonPayload = {
        entityId: entityId != null ? String(entityId) : null,
        pageId: facebookPageId != null ? String(facebookPageId) : null,
        messageId: String(m.message_id)
      };
      const replyToken = await this.createEmailActionToken({ ...commonPayload, action: 'reply_with_ai' });
      const correctToken = await this.createEmailActionToken({ ...commonPayload, action: 'correct_analysis' });
      map[i] = {
        replyUrl: `${base}/frontend/pages/modules/facebook-email-action.php?token=${encodeURIComponent(replyToken)}&action=reply`,
        correctUrl: `${base}/frontend/pages/modules/facebook-email-action.php?token=${encodeURIComponent(correctToken)}&action=correct`
      };
    }
    return map;
  }
  
  /**
   * Charge la configuration de l'agent Facebook (prompt, emails, intentions)
   * @param {string} entityId - entrepriseId
   * @param {string|null} facebookPageId - page Facebook pour config dédiée
   * @returns {Promise<Object|null>} Configuration ou null
   */
  async loadFacebookAgentConfig(entityId, facebookPageId = null) {
    return this.loadAnalyseIntentionConfig(entityId, facebookPageId);
  }

  async resolveFacebookPageContext(entityId, facebookPageId = null) {
    const pageId = facebookPageId != null && facebookPageId !== '' ? String(facebookPageId) : '';
    if (!pageId) {
      return { pageId: null, pageLabel: null, subjectSuffix: '' };
    }

    try {
      const config = await this.database.getCollection('facebook_configs').findOne({
        entrepriseId: String(entityId),
        pageId: pageId
      });
      const pageName = config && config.pageName ? String(config.pageName).trim() : '';
      const fallbackLabel = `Page ${pageId}`;
      const pageLabel = pageName || fallbackLabel;
      return {
        pageId,
        pageLabel,
        subjectSuffix: ` - ${pageLabel}`
      };
    } catch (error) {
      console.warn('resolveFacebookPageContext:', error.message);
      return {
        pageId,
        pageLabel: `Page ${pageId}`,
        subjectSuffix: ` - Page ${pageId}`
      };
    }
  }
  
  /**
   * Détermine les destinataires selon les intentions détectées
   * @param {Object} analysisData - Données de l'analyse
   * @param {Object} config - Configuration de l'agent
   * @returns {Array} Liste des destinataires avec leurs intentions
   */
  getRecipientsFromAnalysis(analysisData, config) {
    const recipients = new Map();
    
    // Parcourir les analyses
    if (analysisData.analyses && Array.isArray(analysisData.analyses)) {
      analysisData.analyses.forEach(analysis => {
        const intentionsList = this.normalizeIntentions(analysis);

        intentionsList.forEach(intention => {
          const intentionName = intention.category || intention.name;
          const intentionEmails = this.getEmailsForIntention(intentionName, config);
          const urgent = intention.urgent || false;

          intentionEmails.forEach((email) => {
            if (!email || !intentionName) return;

            if (!recipients.has(email)) {
              recipients.set(email, {
                email,
                intentions: [],
                urgent
              });
            }

            const recipient = recipients.get(email);
            if (!recipient.intentions.includes(intentionName)) {
              recipient.intentions.push(intentionName);
            }

            if (urgent) {
              recipient.urgent = true;
            }
          });
        });
      });
    }
    
    return Array.from(recipients.values());
  }
  
  /**
   * Récupère les emails pour une intention donnée
   * @param {string} intentionName - Nom de l'intention
   * @param {Object} config - Configuration de l'agent
   * @returns {string[]} Emails sans doublons
   */
  getEmailsForIntention(intentionName, config) {
    // Chercher dans les intentions personnalisées
    if (config.customIntentions && Array.isArray(config.customIntentions)) {
      const intention = config.customIntentions.find(i => 
        (i.name || i.category) === intentionName
      );
      
      if (intention) {
        const intentionEmails = Array.isArray(intention.emails)
          ? intention.emails
          : (intention.email ? [intention.email] : []);
        const normalized = intentionEmails
          .map((email) => String(email || '').trim())
          .filter(Boolean);
        if (normalized.length > 0) {
          return Array.from(new Set(normalized));
        }
      }
    }
    
    // Sinon, utiliser l'email par défaut
    return this.getDefaultFallbackEmails(config);
  }

  getDefaultFallbackEmails(config) {
    const fromList = Array.isArray(config && (config.defaultEmails || config.default_emails))
      ? (config.defaultEmails || config.default_emails)
      : [];
    const fromSingle = String(config && (config.defaultEmail || config.default_email) || '').trim();
    const merged = [...fromList, fromSingle]
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(merged));
  }

  /**
   * Détermine le profil SMTP par défaut à utiliser
   * @param {Object} mailConfig - Configuration SMTP du module/mail
   * @returns {string|null} Nom du profil à utiliser
   */
  getDefaultSmtpProfileName(mailConfig) {
    if (!mailConfig || !mailConfig.smtp_profiles) {
      return null;
    }

    // Si un profil par défaut est défini explicitement
    if (mailConfig.default_profile && mailConfig.smtp_profiles[mailConfig.default_profile]) {
      return mailConfig.default_profile;
    }

    // Sinon, prendre le premier profil disponible
    const profileKeys = Object.keys(mailConfig.smtp_profiles);
    return profileKeys.length > 0 ? profileKeys[0] : null;
  }

  /**
   * Récupère la liste de toutes les intentions détectées dans l'analyse
   * @param {Object} analysisData - Données de l'analyse
   * @returns {Array<string>} Liste unique des intentions
   */
  getAllIntentionsFromAnalysis(analysisData) {
    const intentions = new Set();

    if (analysisData.analyses && Array.isArray(analysisData.analyses)) {
      analysisData.analyses.forEach(analysis => {
        const normalised = this.normalizeIntentions(analysis);
        normalised.forEach(intention => {
          const intentionName = intention.category || intention.name;
          if (intentionName) {
            intentions.add(intentionName);
          }
        });
      });
    }

    return Array.from(intentions);
  }

  /**
   * Normalise la liste des intentions à partir de différentes structures possibles
   * @param {Object} analysis - Résultat d'analyse individuel
   * @returns {Array<Object>} Liste d'intentions normalisées
   */
  normalizeIntentions(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      return [];
    }

    const possibleArrayKeys = [
      'intentions',
      'intentions_detectees',
      'intentionsDetaillees',
      'intentions_detaillees',
      'intentions_probables',
      'intentions_analysees',
      'items',
      'liste',
      'values'
    ];

    const candidateArrays = [];
    const candidateObjects = [];

    const collectFromSource = (source) => {
      if (!source || typeof source !== 'object') return;

      possibleArrayKeys.forEach((key) => {
        const value = source[key];
        if (!value) return;

        if (Array.isArray(value) && value.length > 0) {
          candidateArrays.push(value);
        } else if (typeof value === 'object' && Object.keys(value).length > 0) {
          candidateObjects.push(value);
        }
      });
    };

    collectFromSource(analysis);
    collectFromSource(analysis.etape1_generique);
    collectFromSource(analysis.etape2_multi_intentions);
    collectFromSource(analysis.etape2);
    collectFromSource(analysis.etapes);
    collectFromSource(analysis.details);
    collectFromSource(analysis.resultats);
    collectFromSource(analysis.recapitulatif);

    let intentions = candidateArrays.find(arr => Array.isArray(arr) && arr.length > 0);

    if (!intentions) {
      const objectCandidate = candidateObjects.find(obj => obj && Object.keys(obj).length > 0);
      if (objectCandidate) {
        intentions = Object.keys(objectCandidate).map(key => {
          const value = objectCandidate[key];
          if (value && typeof value === 'object') {
            return {
              ...value,
              category: value.category || value.categorie || value.name || value.label || key
            };
          }
          return {
            category: key,
            certainty: value
          };
        });
      }
    }

    if (!intentions && analysis.intention) {
      const single = analysis.intention;
      intentions = [{ ...single }];
    }

    if (!intentions) {
      return [];
    }

    const flatten = (items) => {
      return items.reduce((acc, item) => {
        if (Array.isArray(item)) {
          acc.push(...flatten(item));
        } else if (item != null) {
          acc.push(item);
        }
        return acc;
      }, []);
    };

    const flattenedIntentions = flatten(intentions);

    return flattenedIntentions.map(rawIntention => {
      if (!rawIntention || typeof rawIntention !== 'object') {
        return {
          category: String(rawIntention),
          certainty: null,
          urgent: false,
          priority: null
        };
      }

      const intention = { ...rawIntention };

      const priority = intention.priority || intention.priorite || null;
      const certainty = intention.certainty ?? intention.score ?? intention.confidence ?? intention.niveau_certitude ?? intention.certitude ?? null;
      const reason = intention.raison || intention.reason || intention.justification || intention.explanation || null;

      intention.category = intention.category || intention.categorie || intention.name || intention.label || 'Intention';
      intention.certainty = certainty;
      intention.priority = priority;
      intention.urgent = Boolean(intention.urgent) || priority === 'urgent';

      if (reason) {
        intention.raison = intention.raison || reason;
        if (!intention.reason) {
          intention.reason = reason;
        }
      }

      return intention;
    });
  }

  /**
   * Priorité de rapport pour une intention (message normal vs urgent selon l’analyse).
   */
  resolveIntentionReportPriority(intentionName, isUrgent, config) {
    if (!config || !intentionName) return 'daily';
    const list = config.customIntentions || config.intentions || [];
    const normalize = (v) => String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const target = normalize(intentionName);
    const row = list.find((i) => {
      const candidates = [
        i && i.name,
        i && i.category,
        i && i.label,
        i && i.intention
      ];
      return candidates.some((c) => normalize(c) === target);
    });
    if (!row) return 'daily';
    const legacy = row.priority || 'daily';
    const pNormal = row.priorityNormal != null ? row.priorityNormal : legacy;
    const pUrgent = row.priorityUrgent != null ? row.priorityUrgent : legacy;
    return isUrgent ? pUrgent : pNormal;
  }

  hasFastResponseOverride(analysis) {
    try {
      return Boolean(
        analysis && (
          analysis.reponse_rapide_requise === true ||
          analysis.quick_response_required === true ||
          analysis.rapid_response_required === true ||
          analysis.response_required_quickly === true
        )
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * Envoi mail tout de suite si au moins une intention détectée est en priorité « immediate ».
   */
  shouldSendEmailImmediately(analysisData, config) {
    if (!analysisData || !Array.isArray(analysisData.analyses)) return false;
    if (!config) return false;
    let sawIntention = false;
    for (const analysis of analysisData.analyses) {
      if (this.hasFastResponseOverride(analysis)) {
        return true;
      }
      const intents = this.normalizeIntentions(analysis);
      for (const int of intents) {
        const name = int.category || int.name;
        if (!name) continue;
        sawIntention = true;
        const urgent = Boolean(int.urgent);
        const pr = this.resolveIntentionReportPriority(name, urgent, config || {});
        if (pr === 'immediate') return true;
      }
    }
    if (!sawIntention) return false;
    return false;
  }

  buildImmediateEmailBatch(analysisData, originalMessages, config) {
    const analyses = Array.isArray(analysisData && analysisData.analyses) ? analysisData.analyses : [];
    const messages = Array.isArray(originalMessages) ? originalMessages : [];
    const maxItems = Math.min(analyses.length, messages.length);
    const selectedAnalyses = [];
    const selectedMessages = [];

    for (let i = 0; i < maxItems; i++) {
      const analysis = analyses[i];
      const intentions = this.normalizeIntentions(analysis);
      let isImmediate = this.hasFastResponseOverride(analysis);

      for (const it of intentions) {
        if (isImmediate) break;
        const name = it && (it.category || it.name);
        if (!name) continue;
        const pr = this.resolveIntentionReportPriority(name, Boolean(it.urgent), config || {});
        if (pr === 'immediate') {
          isImmediate = true;
        }
      }

      if (isImmediate) {
        selectedAnalyses.push(analysis);
        selectedMessages.push(messages[i]);
      }
    }

    return {
      analysisData: {
        ...analysisData,
        analyses: selectedAnalyses,
        reponse_requise: selectedAnalyses.some((a) => this.getAnalysisResponseRecommendation(a, '').requiresResponse)
      },
      originalMessages: selectedMessages
    };
  }

  /**
   * Enregistre les messages analysés pour le résumé Facebook / rapports différés.
   * @param {boolean} deferredDaily - true si aucune intention « immediate » (rapport attendu au sync quotidien).
   */
  async persistAnalyzedMessagesFromBatch(entityId, pageId, originalMessages, analysisData, deferredDaily, config) {
    if (!entityId || !pageId || !analysisData || !Array.isArray(analysisData.analyses)) return;
    const coll = this.database.getCollection('facebook_analyzed_messages');
    const analyses = analysisData.analyses;
    const n = Math.min(analyses.length, (originalMessages || []).length);

    for (let i = 0; i < n; i++) {
      const analysis = analyses[i];
      const msg = originalMessages[i];
      const intentions = this.normalizeIntentions(analysis);
      let reportPriority = deferredDaily ? 'daily' : 'immediate';
      if (config && intentions.length > 0) {
        reportPriority = 'daily';
        if (this.hasFastResponseOverride(analysis)) {
          reportPriority = 'immediate';
        }
        for (const it of intentions) {
          if (reportPriority === 'immediate') break;
          const name = it.category || it.name;
          if (!name) continue;
          const pr = this.resolveIntentionReportPriority(name, Boolean(it.urgent), config);
          if (pr === 'immediate') {
            reportPriority = 'immediate';
            break;
          }
          reportPriority = pr;
        }
      }
      const reponseRequise =
        typeof analysis.reponse_requise === 'boolean'
          ? analysis.reponse_requise
          : typeof analysisData.reponse_requise === 'boolean'
            ? analysisData.reponse_requise
            : false;

      const doc = {
        entityId: String(entityId),
        pageId: String(pageId),
        message: msg.message || '',
        author: msg.author || {},
        created_time: msg.created_time || new Date().toISOString(),
        type: msg.type || 'unknown',
        post_id: msg.post_id || null,
        comment_id: msg.comment_id || null,
        mid: msg.mid || null,
        sender_psid: msg.sender_psid || null,
        dedup_key: this.buildMessageDedupKey(msg),
        analysis_details: { analyses: [analysis], reponse_requise: analysis.reponse_requise },
        intentions,
        reportPriority,
        reponse_requise: reponseRequise,
        analyzed_at: new Date(),
        deferred_daily_report: reportPriority !== 'immediate',
        daily_report_sent_at: null,
        report_sent_at: null,
        report_sent_frequency: null
      };

      const filter = {
        entityId: doc.entityId,
        pageId: doc.pageId,
        dedup_key: doc.dedup_key
      };

      await coll.updateOne(
        filter,
        {
          $set: doc,
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      );
    }
  }

  buildMessageDedupKey(msg = {}) {
    const messageType = String(msg.type || 'unknown');
    const createdTime = String(msg.created_time || '');
    const authorId = String((msg.author && msg.author.id) || msg.sender_psid || '');

    // Commentaires/feed : identifiant Facebook le plus fiable
    if (msg.comment_id) {
      return `comment:${String(msg.comment_id)}`;
    }

    // Messenger : mid est l'identifiant d'événement le plus robuste
    if (msg.mid) {
      return `mid:${String(msg.mid)}`;
    }

    // Fallback défensif si un provider n'envoie pas d'ID
    const textPreview = String(msg.message || '').trim().slice(0, 120);
    return `fallback:${messageType}:${authorId}:${createdTime}:${textPreview}`;
  }

  /**
   * Envoie les rapports en attente (priorités non immédiates) après le sync quotidien.
   */
  async sendDeferredDailyReports(entrepriseId, pageId) {
    return this.sendDeferredReportsForFrequency(entrepriseId, pageId, 'daily', false);
  }

  /**
   * Envoie les rapports différés pour une fréquence donnée.
   * @param {string} entrepriseId
   * @param {string} pageId
   * @param {'daily'|'weekly'|'monthly'} frequency
   * @param {boolean} sendIfNoMessages
   */
  async sendDeferredReportsForFrequency(entrepriseId, pageId, frequency = 'daily', sendIfNoMessages = false) {
    try {
      const coll = this.database.getCollection('facebook_analyzed_messages');
      const pending = await coll
        .find({
          entityId: String(entrepriseId),
          pageId: String(pageId),
          reportPriority: String(frequency),
          $or: [{ report_sent_at: null }, { report_sent_at: { $exists: false } }]
        })
        .sort({ analyzed_at: 1 })
        .limit(100)
        .toArray();

      if (pending.length === 0) {
        if (sendIfNoMessages) {
          console.log(`  📭 Aucun message différé (${frequency}) pour ${pageId} : envoi d'un rapport vide.`);
          const emptyData = {
            analyses: [],
            reponse_requise: false,
            resume_global: `Aucun message à traiter pour la période ${frequency}.`
          };
          await this.sendAnalysisEmail(emptyData, [], entrepriseId, pageId);
        } else {
          console.log(`  📭 Aucun rapport différé (${frequency}) à envoyer pour la page ${pageId}`);
        }
        return;
      }

      const analyses = [];
      const originalMessages = [];
      for (const p of pending) {
        const ad = p.analysis_details;
        const firstAnalysis = ad && Array.isArray(ad.analyses) && ad.analyses[0]
          ? ad.analyses[0]
          : null;
        const messageText = p && typeof p.message === 'string' ? p.message : '';
        const hasMessage = messageText.trim().length > 0;

        // On n'assemble que des paires cohérentes message+analyse.
        if (!firstAnalysis || !hasMessage) {
          continue;
        }

        analyses.push(firstAnalysis);
        originalMessages.push({
          message_id: p && p._id ? String(p._id) : null,
          message: messageText,
          author: p.author,
          created_time: p.created_time,
          type: p.type,
          post_id: p.post_id,
          comment_id: p.comment_id
        });
      }

      if (analyses.length === 0 || originalMessages.length === 0) {
        if (sendIfNoMessages) {
          console.log(`  📭 Aucune paire message/analyse exploitable (${frequency}) pour ${pageId} : envoi d'un rapport vide.`);
          const emptyData = {
            analyses: [],
            reponse_requise: false,
            resume_global: `Aucun message à traiter pour la période ${frequency}.`
          };
          await this.sendAnalysisEmail(emptyData, [], entrepriseId, pageId);
        } else {
          console.log(`  ⚠️ Aucun couple message/analyse exploitable (${frequency}) pour ${pageId}, envoi ignoré.`);
        }
        return;
      }

      const combinedData = {
        analyses,
        reponse_requise: analyses.some((a) => a.reponse_requise)
      };

      console.log(`  📧 Envoi du rapport ${frequency} groupé (${pending.length} message(s)) pour ${pageId}...`);
      await this.sendAnalysisEmail(combinedData, originalMessages, entrepriseId, pageId);

      const ids = pending.map((p) => p._id);
      await coll.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            daily_report_sent_at: new Date(),
            deferred_daily_report: false,
            report_sent_at: new Date(),
            report_sent_frequency: String(frequency)
          }
        }
      );
    } catch (e) {
      console.error(`  ❌ sendDeferredReportsForFrequency(${frequency}):`, e.message);
    }
  }
  
  /**
   * Formate le contenu de l'email avec les résultats de l'analyse
   * @param {Object} analysisData - Données de l'analyse
   * @param {Array} originalMessages - Messages originaux
   * @returns {Object} { text, html }
   */
  formatAnalysisEmail(analysisData, originalMessages, actionLinksByIndex = {}, options = {}) {
    const now = new Date().toLocaleString('fr-FR');
    const pageLabel = options && options.pageLabel ? String(options.pageLabel) : '';
    let text = '📊 ANALYSE D\'INTENTION FACEBOOK\n';
    text += '════════════════════════════════════\n';
    text += `Date d\'analyse : ${now}\n\n`;
    if (pageLabel) {
      text += `Page Facebook : ${pageLabel}\n\n`;
    }

    let html = '<div style="font-family:Helvetica,Arial,sans-serif;color:#1f2933;">\n';
    html += '<h2 style="color:#0d6efd;margin-bottom:4px;">📊 Analyse d\'intention Facebook</h2>\n';
    html += `<p style="margin-top:0;color:#6c757d;">Date d\'analyse : ${now}</p>\n`;
    if (pageLabel) {
      html += `<p style="margin-top:0;color:#6c757d;"><strong>Page Facebook :</strong> ${pageLabel}</p>\n`;
    }

    // Résumé global (intentions principales, résumé)
    const primaryIntentions = analysisData.intentions_principales || analysisData.primary_intentions || [];
    const globalSummary = analysisData.resume_global || analysisData.summary || null;
    const responseRequired = this.getGlobalResponseRequired(analysisData);

    if (primaryIntentions.length > 0 || globalSummary) {
      text += '🔎 RÉSUMÉ\n';
      text += '────────────────────────────\n';
      if (primaryIntentions.length > 0) {
        text += `Intention(s) principale(s) : ${primaryIntentions.join(', ')}\n`;
      }
      if (globalSummary) {
        text += `Résumé : ${globalSummary}\n`;
      }
      if (responseRequired != null) {
        text += `Réponse requise : ${responseRequired ? 'Oui' : 'Non'}\n`;
      }
      text += '\n';

      html += '<section style="margin-bottom:20px;padding:16px;background:#f8f9fb;border-radius:8px;">\n';
      html += '<h3 style="margin-top:0;color:#0d6efd;">🔎 Résumé</h3>\n';
      if (primaryIntentions.length > 0) {
        html += `<p style="margin:4px 0;"><strong>Intention(s) principale(s)</strong> : ${primaryIntentions.join(', ')}</p>\n`;
      }
      if (globalSummary) {
        html += `<p style="margin:4px 0;"><strong>Résumé</strong> : ${globalSummary}</p>\n`;
      }
      if (responseRequired != null) {
        html += `<p style="margin:4px 0;"><strong>Réponse requise</strong> : ${responseRequired ? '<span style="color:#d9534f;">Oui</span>' : 'Non'}</p>\n`;
      }
      html += '</section>\n';
    }

    // Vue principale : message puis analyse associée
    text += '💬 MESSAGE + ANALYSE\n';
    text += '────────────────────────────\n';
    html += '<section style="margin-bottom:24px;">\n';
    html += '<h3 style="color:#0d6efd;margin-bottom:8px;">💬 Message + analyse</h3>\n';

    const analyses = Array.isArray(analysisData.analyses) ? analysisData.analyses : [];
    const maxRows = Math.max(originalMessages.length, analyses.length);

    for (let index = 0; index < maxRows; index++) {
      const msg = originalMessages[index] || {};
      const analysis = analyses[index] || {};
      const messageDate = msg.created_time ? new Date(msg.created_time).toLocaleString('fr-FR') : 'N/A';
      const recommendation = this.getAnalysisResponseRecommendation(analysis, msg.message || '');
      const rawIntentions = this.normalizeIntentions(analysis);

      text += `\n${index + 1}. ${msg.author?.name || 'Utilisateur'} (${messageDate})\n`;
      text += `${(msg.message || '').trim() || '[Message indisponible]'}\n`;
      text += `Analyse ${index + 1}:\n`;
      if (rawIntentions.length === 0) {
        text += '• Aucune intention détectée.\n';
      } else {
        rawIntentions.forEach((intention) => {
          const category = intention.category || intention.name || intention.label || 'Intention non définie';
          const certaintyValue = intention.certainty ?? intention.score ?? intention.confidence;
          let certainty = 'N/A';
          if (certaintyValue != null && certaintyValue !== '') {
            const n = Number(certaintyValue);
            if (!Number.isNaN(n)) {
              certainty = `${n <= 1 ? Math.round(n * 100) : Math.round(n)}%`;
            }
          }
          const urgent = intention.urgent || intention.priority === 'urgent' || intention.priorite === 'urgent';
          const priorityLabel = intention.priority || intention.priorite || null;
          const reason = intention.raison || intention.reason || intention.justification || intention.explanation || null;
          text += `• ${category}${urgent ? ' (URGENT)' : ''} — ${certainty}${priorityLabel && !urgent ? ` · Priorité: ${priorityLabel}` : ''}\n`;
          if (reason) text += `  Justification : ${reason}\n`;
        });
      }
      if (analysis.resume || analysis.summary) {
        text += `Résumé : ${analysis.resume || analysis.summary}\n`;
      }
      text += `Recommandation : ${recommendation.requiresResponse ? 'Oui' : 'Non'} (${recommendation.reason})\n`;

      html += '<div style="padding:14px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:14px;">\n';
      html += `<p style="margin:0 0 6px 0;font-weight:600;">${index + 1}. ${msg.author?.name || 'Utilisateur'} <span style="color:#6c757d;font-weight:400;">(${messageDate})</span></p>\n`;
      html += `<p style="margin:0 0 10px 0;white-space:pre-line;">${(msg.message || '').trim() || '[Message indisponible]'}</p>\n`;
      html += `<p style="margin:0 0 8px 0;font-weight:600;color:#0d6efd;">Analyse ${index + 1}</p>\n`;

      if (rawIntentions.length === 0) {
        html += '<p style="margin:0;color:#6c757d;">Aucune intention détectée.</p>\n';
      } else {
        rawIntentions.forEach((intention) => {
          const category = intention.category || intention.name || intention.label || 'Intention non définie';
          const certaintyValue = intention.certainty ?? intention.score ?? intention.confidence;
          let certainty = 'N/A';
          if (certaintyValue != null && certaintyValue !== '') {
            const n = Number(certaintyValue);
            if (!Number.isNaN(n)) {
              certainty = `${n <= 1 ? Math.round(n * 100) : Math.round(n)}%`;
            }
          }
          const urgent = intention.urgent || intention.priority === 'urgent' || intention.priorite === 'urgent';
          const reason = intention.raison || intention.reason || intention.justification || intention.explanation || null;
          const priorityLabel = intention.priority || intention.priorite || null;
          html += '<div style="background:#f8f9fb;border-left:4px solid ' + (urgent ? '#d9534f' : '#0d6efd') + ';padding:10px;border-radius:8px;margin-bottom:8px;">\n';
          html += `<p style="margin:0;font-weight:600;color:${urgent ? '#d9534f' : '#0d6efd'};">${category}${urgent ? ' <span style="color:#d9534f;">URGENT</span>' : ''}</p>\n`;
          html += `<p style="margin:2px 0;color:#6c757d;">Confiance : <strong>${certainty}</strong>${priorityLabel && !urgent ? ` · Priorité : ${priorityLabel}` : ''}</p>\n`;
          if (reason) html += `<p style="margin:2px 0;white-space:pre-line;">${reason}</p>\n`;
          html += '</div>\n';
        });
      }

      if (analysis.resume || analysis.summary) {
        html += `<p style="margin:8px 0 0 0;"><strong>Résumé :</strong> ${analysis.resume || analysis.summary}</p>\n`;
      }
      html += `<p style="margin:8px 0 0 0;"><strong>Recommandation :</strong> ${recommendation.requiresResponse ? '<span style="color:#b02a37;">Oui</span>' : 'Non'} <span style="color:#6c757d;">(${recommendation.reason})</span></p>\n`;

      const actionLinks = actionLinksByIndex[index];
      if (actionLinks && (actionLinks.replyUrl || actionLinks.correctUrl)) {
        html += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">\n';
        if (actionLinks.replyUrl) {
          html += `<a href="${actionLinks.replyUrl}" style="background:#0d6efd;color:#fff;text-decoration:none;padding:7px 10px;border-radius:6px;font-size:13px;">Répondre avec l'IA</a>\n`;
        }
        if (actionLinks.correctUrl) {
          html += `<a href="${actionLinks.correctUrl}" style="background:#f8f9fa;color:#212529;text-decoration:none;padding:7px 10px;border-radius:6px;font-size:13px;border:1px solid #dee2e6;">Corriger l'analyse</a>\n`;
        }
        html += '</div>\n';
      }
      html += '</div>\n';
    }

    if (maxRows === 0) {
      text += 'Aucun message reçu.\n';
      html += '<p style="color:#6c757d;">Aucun message reçu.</p>\n';
    }

    text += '\n';
    html += '</section>\n';

    // Métadonnées
    if (analysisData.metadata) {
      text += 'ℹ️  MÉTADONNÉES\n';
      text += '────────────────────────────\n';
      Object.entries(analysisData.metadata).forEach(([key, value]) => {
        text += `${key} : ${value}\n`;
      });
      text += '\n';

      html += '<section style="margin-bottom:24px;">\n';
      html += '<h3 style="color:#0d6efd;margin-bottom:8px;">ℹ️  Métadonnées</h3>\n';
      html += '<ul style="padding-left:18px;margin:0;">\n';
      Object.entries(analysisData.metadata).forEach(([key, value]) => {
        html += `<li style="margin-bottom:4px;"><strong>${key}</strong> : ${value}</li>\n`;
      });
      html += '</ul>\n';
      html += '</section>\n';
    }

    // Recommandation de réponse
    const requiresResponse = responseRequired;
    const urgentIntention = analysisData.analyses && analysisData.analyses.some(a => {
      const normalized = this.normalizeIntentions(a);
      return normalized.some(intent => intent.urgent || intent.priority === 'urgent' || intent.priorite === 'urgent');
    });

    if (requiresResponse != null || urgentIntention) {
      text += '✅ RECOMMANDATION\n';
      text += '────────────────────────────\n';
      if (requiresResponse != null) {
        text += `Réponse recommandée : ${requiresResponse ? 'Oui, contacter le client rapidement.' : 'Non, simple suivi possible.'}\n`;
      }
      if (urgentIntention) {
        text += 'Attention : Urgence détectée, prioriser un traitement immédiat.\n';
      }
      text += '\n';

      html += '<section style="margin-bottom:24px;padding:16px;border-radius:8px;background:' + (urgentIntention ? '#fdecea' : '#e9f7ef') + ';border:1px solid ' + (urgentIntention ? '#f5c2c0' : '#badbcc') + ';">\n';
      html += '<h3 style="margin-top:0;">✅ Recommandation</h3>\n';
      if (requiresResponse != null) {
        html += `<p style="margin:4px 0;"><strong>Réponse recommandée :</strong> ${requiresResponse ? '<span style="color:#b02a37;">Oui, contactez le client rapidement.</span>' : 'Non, simple suivi possible.'}</p>\n`;
      }
      if (urgentIntention) {
        html += '<p style="margin:4px 0;color:#b02a37;font-weight:600;">Urgence détectée : prioriser un traitement immédiat.</p>\n';
      }
      html += '</section>\n';
    }

    // Clôture
    html += '<p style="color:#6c757d;font-size:13px;">— Rapport généré automatiquement par l\'agent Facebook GDRI.</p>\n';
    html += '</div>';

    return {
      text,
      html
    };
  }

  getGlobalResponseRequired(analysisData) {
    const directCandidates = [
      analysisData && analysisData.reponse_requise,
      analysisData && analysisData.reponse,
      analysisData && analysisData.response_required
    ];
    for (const value of directCandidates) {
      if (typeof value === 'boolean') return value;
    }
    if (!analysisData || !Array.isArray(analysisData.analyses)) return false;
    return analysisData.analyses.some((a) => this.getAnalysisResponseRecommendation(a, '').requiresResponse);
  }

  getAnalysisResponseRecommendation(analysis, messageText) {
    const normalizedIntentions = this.normalizeIntentions(analysis);
    const hasUrgent = normalizedIntentions.some((intent) => intent && (intent.urgent || intent.priority === 'urgent' || intent.priorite === 'urgent'));
    if (hasUrgent || this.hasFastResponseOverride(analysis)) {
      return { requiresResponse: true, reason: 'urgence detectee' };
    }

    const directCandidates = [
      analysis && analysis.reponse_requise,
      analysis && analysis.reponse,
      analysis && analysis.response_required,
      analysis && analysis.etape1_generique && analysis.etape1_generique.reponse_requise
    ];
    let directDecision = null;
    for (const value of directCandidates) {
      if (typeof value === 'boolean') {
        directDecision = value;
        break;
      }
    }

    const text = String(messageText || '').trim();
    const hasQuestion = /[?]|(^|\s)(est-ce|etes-vous|êtes-vous|avez-vous|pouvez-vous|bonjour[,\s]+etes-vous|ouvert|ouverte|disponible|prix|tarif|devis)(\s|$)/i.test(text);
    const positiveOnly = normalizedIntentions.length > 0 && normalizedIntentions.every((intent) => {
      const category = String((intent && (intent.category || intent.name || intent.label)) || '').toLowerCase();
      return ['positif', 'spam'].includes(category);
    });
    const isFallback = normalizedIntentions.some((intent) => {
      const reason = String((intent && (intent.raison || intent.reason || intent.justification || intent.explanation)) || '').toLowerCase();
      return reason.includes('classification de secours') || reason.includes('fallback');
    });

    if (hasQuestion) {
      return { requiresResponse: true, reason: 'question explicite dans le message' };
    }
    if (positiveOnly && !hasQuestion) {
      return { requiresResponse: false, reason: 'message positif sans demande explicite' };
    }
    if (isFallback && directDecision !== true) {
      return { requiresResponse: false, reason: 'analyse de secours, verification manuelle conseillee' };
    }
    if (typeof directDecision === 'boolean') {
      return {
        requiresResponse: directDecision,
        reason: directDecision ? 'decision IA: reponse requise' : 'decision IA: pas de reponse requise'
      };
    }
    return { requiresResponse: false, reason: 'aucune demande explicite detectee' };
  }

  /**
   * Enregistre la réception d'un webhook et indique si un rattrapage est recommandé.
   * @param {string} pageId - ID de la page Facebook
   * @param {number} entryTimestamp - Timestamp Unix fourni par Facebook (secondes)
   * @returns {Promise<Object>} Informations de rattrapage
   */
  async recordWebhookReceived(pageId, entryTimestamp, entryData = null) {
    try {
      if (!pageId) {
        return { shouldCatchUp: false };
      }

      const configCollection = this.database.getCollection('facebook_configs');
      const now = new Date();
      const webhookEventDate = Number(entryTimestamp)
        ? new Date(Number(entryTimestamp) * 1000)
        : now;

      const existingConfigs = await configCollection.find({
        $or: [{ pageId }, { pageId: String(pageId) }]
      }).toArray();

      const latestSeenMessageId = this.extractLatestEntryMessageId(entryData);
      const catchUpThresholdMs = 15 * 1000;
      const catchUps = [];

      for (const cfg of existingConfigs || []) {
        const lastCatchUpCompletedAt = cfg && cfg.lastWebhookCatchupCompletedAt
          ? new Date(cfg.lastWebhookCatchupCompletedAt)
          : null;
        const lastCatchUpRequestedAt = cfg && cfg.lastWebhookCatchupRequestedAt
          ? new Date(cfg.lastWebhookCatchupRequestedAt)
          : null;
        const shouldCatchUp = Boolean(
          !lastCatchUpRequestedAt ||
          webhookEventDate.getTime() - lastCatchUpRequestedAt.getTime() > catchUpThresholdMs
        );

        const updateResult = {
          $set: {
            lastWebhookSeenAt: webhookEventDate,
            updated_at: now
          }
        };
        if (latestSeenMessageId) {
          updateResult.$set.lastWebhookSeenMessageId = latestSeenMessageId;
        }
        if (
          !lastCatchUpCompletedAt ||
          webhookEventDate.getTime() > lastCatchUpCompletedAt.getTime()
        ) {
          updateResult.$set.lastInteractionAt = webhookEventDate;
        }
        if (shouldCatchUp) {
          updateResult.$set.lastWebhookCatchupRequestedAt = now;
        }

        await configCollection.updateOne({ _id: cfg._id }, updateResult);

        catchUps.push({
          shouldCatchUp,
          entrepriseId: cfg.entrepriseId != null ? String(cfg.entrepriseId) : null,
          pageId: cfg.pageId != null ? String(cfg.pageId) : String(pageId),
          pageAccessToken: cfg.pageAccessToken || null,
          sinceDate: lastCatchUpCompletedAt || null
        });
      }

      if (catchUps.length === 0) {
        return [];
      }
      return catchUps;
    } catch (error) {
      console.error('Erreur recordWebhookReceived:', error);
      return [];
    }
  }

  extractLatestEntryMessageId(entryData) {
    try {
      if (!entryData || !Array.isArray(entryData.messaging)) return null;
      let latest = null;
      for (const m of entryData.messaging) {
        const mid = m && m.message && m.message.mid ? String(m.message.mid) : '';
        if (mid) latest = mid;
      }
      return latest;
    } catch (_) {
      return null;
    }
  }

  /**
   * Marque le rattrapage webhook comme terminé (curseur fiable pour prochain backfill).
   */
  async markWebhookCatchupCompleted(pageId, entryTimestamp, entrepriseId = null) {
    try {
      if (!pageId) return;
      const configCollection = this.database.getCollection('facebook_configs');
      const doneAt = Number(entryTimestamp) ? new Date(Number(entryTimestamp) * 1000) : new Date();
      const filter = entrepriseId
        ? { entrepriseId: String(entrepriseId), $or: [{ pageId }, { pageId: String(pageId) }] }
        : { $or: [{ pageId }, { pageId: String(pageId) }] };
      await configCollection.updateOne(
        filter,
        {
          $set: {
            lastWebhookCatchupCompletedAt: doneAt,
            lastWebhookProcessedAt: doneAt,
            updated_at: new Date()
          }
        }
      );
    } catch (error) {
      console.error('Erreur markWebhookCatchupCompleted:', error);
    }
  }

  /**
   * Détermine le nom du profil SMTP par défaut à utiliser
   * @param {Object} mailConfig - Configuration de Mail
   * @returns {string|null} Nom du profil ou null
   */
  getDefaultSmtpProfileName(mailConfig) {
    if (!mailConfig || typeof mailConfig !== 'object') {
      return null;
    }

    // Ancien format
    if (mailConfig.smtp_profiles && Object.keys(mailConfig.smtp_profiles).length > 0) {
      if (mailConfig.default_profile && mailConfig.smtp_profiles[mailConfig.default_profile]) {
        return mailConfig.default_profile;
      }
      return Object.keys(mailConfig.smtp_profiles)[0];
    }

    // Nouveau format (profils_smtp + comptes)
    if (Array.isArray(mailConfig.comptes) && mailConfig.comptes.length > 0) {
      const account =
        mailConfig.comptes.find((c) => c && c.id) ||
        mailConfig.comptes.find((c) => c && c.email) ||
        null;
      if (account) {
        return account.id || account.email || null;
      }
    }

    return null;
  }
}

module.exports = WebhookService;

