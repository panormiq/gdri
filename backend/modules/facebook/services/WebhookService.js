/**
 * Service de traitement des webhooks Facebook
 * Fichier : backend/modules/facebook/services/WebhookService.js
 */

const IntentionService = require('../../analyse-intention/services/IntentionService');
const AIService = require('../../analyse-intention/services/AIService');
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
        // Déterminer l'entité à partir du pageId
        const entityId = await this.getEntityIdFromPageId(entry.id);

        // Sauvegarder l'entry complète
        await this.saveWebhook(entry, entityId);

        // Compter les événements
        const eventCount = this.countEvents(entry);
        totalEvents += eventCount;

        // Traiter les événements si nécessaire
        if (eventCount > 0) {
          await this.processEntryEvents(entry, entityId);
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
      const messages = this.extractMessagesFromEntry(entry);
      
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
        
        // Charger la configuration si entityId est disponible
        let basePrompt = null;
        let customIntentions = [];
        
        if (entityId) {
          try {
            const configCollection = this.database.getCollection('analyse_intention_configs');
            const config = await configCollection.findOne({ entity_id: entityId });
            
            if (config && config.config) {
              basePrompt = config.config.basePrompt || config.config.base_prompt || null;
              customIntentions = config.config.customIntentions || config.config.intentions || [];
              console.log(`  📋 Configuration chargée: ${customIntentions.length} intention(s) configurée(s)`);
            }
          } catch (configError) {
            console.warn('  ⚠️  Erreur lors du chargement de la configuration:', configError);
            // Continuer sans la config personnalisée
          }
        }
        
        const startTime = Date.now();
        
        const analysisResult = await this.intentionService.analyzeIntentions(messages, basePrompt, customIntentions);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (analysisResult.success) {
          console.log(`  ✅ Analyse terminée en ${duration}s`);
          console.log(`  📊 Résultats: ${JSON.stringify(analysisResult.data, null, 2).substring(0, 200)}...`);
          
          // Envoyer un email avec les résultats
          await this.sendAnalysisEmail(analysisResult.data, messages, entityId);
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
    
    // Traiter les changements (commentaires, mentions)
    if (entry.changes) {
      entry.changes.forEach(change => {
        if (change.value && change.value.message) {
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
          messages.push({
            message: msg.message.text,
            author: {
              name: 'Utilisateur Facebook',
              id: msg.sender?.id || 'unknown'
            },
            created_time: new Date(msg.timestamp * 1000).toISOString(),
            type: 'message',
            mid: msg.message.mid
          });
        }
      });
    }
    
    return messages;
  }
  
  /**
   * Envoie un email avec les résultats de l'analyse
   * @param {Object} analysisData - Données de l'analyse
   * @param {Array} originalMessages - Messages originaux
   * @param {string} entityId - ID de l'entité
   */
  async sendAnalysisEmail(analysisData, originalMessages, entityId) {
    try {
      console.log('  📧 Préparation de l\'envoi d\'email...');
      console.log(`  🔍 Entity ID: ${entityId || 'NON DÉFINI'}`);
      
      // Charger la configuration de l'agent Facebook
      const config = await this.loadFacebookAgentConfig(entityId);
      
      if (!config) {
        console.log('  ⚠️  Pas de configuration trouvée dans MongoDB pour cette entité');
        console.log(`  💡 Vérifiez que la configuration est sauvegardée pour entity_id: ${entityId}`);
        return;
      }
      
      console.log('  ✅ Configuration chargée');
      console.log(`  📧 Email par défaut: ${config.defaultEmail || 'NON DÉFINI'}`);
      console.log(`  📋 Intentions configurées: ${config.customIntentions?.length || 0}`);
      
      if (!config.defaultEmail) {
        console.log('  ⚠️  Pas d\'email par défaut configuré, email non envoyé');
        console.log('  💡 Configurez un email par défaut dans la page de configuration de l\'agent Facebook');
        return;
      }
      
      // Déterminer les destinataires selon les intentions détectées
      let recipients = this.getRecipientsFromAnalysis(analysisData, config);
      
      console.log(`  📬 Destinataires trouvés: ${recipients.length}`);
      recipients.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.email} (${r.intentions.join(', ')})${r.urgent ? ' ⚠️ URGENT' : ''}`);
      });
      
      if (recipients.length === 0) {
        console.log('  ⚠️  Aucun destinataire spécifique trouvé, fallback sur l\'email par défaut');
        const defaultIntentions = this.getAllIntentionsFromAnalysis(analysisData);
        recipients = [{
          email: config.defaultEmail,
          intentions: defaultIntentions.length > 0 ? defaultIntentions : ['global'],
          urgent: false
        }];
      }
      
      // Préparer le contenu de l'email
      const emailContent = this.formatAnalysisEmail(analysisData, originalMessages);
      
      // Récupérer le service Mail
      const mail = mailModule.getMailService();
      console.log('  📧 Service Mail récupéré');
      
      // Charger la configuration Mail pour cette entité
      console.log('  🔍 Chargement de la configuration SMTP...');
      const mailConfig = await mail.loadConfigFromDB(entityId, 'facebook');
      let smtpProfileName = null;
      
      if (!mailConfig || !mailConfig.smtp_profiles || Object.keys(mailConfig.smtp_profiles).length === 0) {
        console.log('  ⚠️  Pas de configuration SMTP trouvée pour le module Facebook');
        console.log('  💡 Configurez un profil SMTP dans la page de configuration Mail');
        console.log('  💡 Ou utilisez la configuration par défaut du module Mail');
        
        // Essayer avec la config par défaut du module Mail
        const defaultMailConfig = await mail.loadConfigFromDB(entityId, 'mail');
        if (defaultMailConfig && defaultMailConfig.smtp_profiles) {
          console.log('  ✅ Configuration Mail par défaut trouvée, utilisation de celle-ci');
          smtpProfileName = this.getDefaultSmtpProfileName(defaultMailConfig);
          mail.initModule({
            module_name: 'facebook',
            ...defaultMailConfig
          });
        } else {
          console.log('  ❌ Aucune configuration SMTP disponible, email non envoyé');
          return;
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
        const effectiveConfig = mailConfig && mailConfig.smtp_profiles && Object.keys(mailConfig.smtp_profiles).length > 0
          ? mailConfig
          : await mail.loadConfigFromDB(entityId, 'mail');
        smtpProfileName = this.getDefaultSmtpProfileName(effectiveConfig);
      }
      
      if (!smtpProfileName) {
        console.log('  ❌ Impossible de déterminer un profil SMTP, email non envoyé');
        return;
      }
      console.log(`  ✉️  Profil SMTP utilisé: ${smtpProfileName}`);
      
      // Envoyer l'email à chaque destinataire
      for (const recipient of recipients) {
        console.log(`  📤 Envoi de l'email à ${recipient.email}...`);
        
        const emailResult = await mail.send({
          to: recipient.email,
          subject: `📊 Analyse d'intention Facebook - ${recipient.intentions.join(', ')}`,
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
      
    } catch (error) {
      console.error('  ❌ Erreur sendAnalysisEmail:', error);
    }
  }
  
  /**
   * Charge la configuration de l'agent Facebook
   * @param {string} entityId - ID de l'entité
   * @returns {Promise<Object|null>} Configuration ou null
   */
  async loadFacebookAgentConfig(entityId) {
    try {
      if (!entityId) return null;
      
      const configCollection = this.database.getCollection('analyse_intention_configs');
      const config = await configCollection.findOne({ entity_id: entityId });
      
      if (config && config.config) {
        return config.config;
      }
      
      return null;
    } catch (error) {
      console.error('Erreur loadFacebookAgentConfig:', error);
      return null;
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
          const email = this.getEmailForIntention(intentionName, config);
          const urgent = intention.urgent || false;

          if (email && intentionName) {
            if (!recipients.has(email)) {
              recipients.set(email, {
                email: email,
                intentions: [],
                urgent: urgent
              });
            }

            const recipient = recipients.get(email);
            if (!recipient.intentions.includes(intentionName)) {
              recipient.intentions.push(intentionName);
            }

            if (urgent) {
              recipient.urgent = true;
            }
          }
        });
      });
    }
    
    return Array.from(recipients.values());
  }
  
  /**
   * Récupère l'email pour une intention donnée
   * @param {string} intentionName - Nom de l'intention
   * @param {Object} config - Configuration de l'agent
   * @returns {string|null} Email ou null
   */
  getEmailForIntention(intentionName, config) {
    // Chercher dans les intentions personnalisées
    if (config.customIntentions && Array.isArray(config.customIntentions)) {
      const intention = config.customIntentions.find(i => 
        (i.name || i.category) === intentionName
      );
      
      if (intention && intention.email) {
        return intention.email;
      }
    }
    
    // Sinon, utiliser l'email par défaut
    return config.defaultEmail || null;
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
   * Formate le contenu de l'email avec les résultats de l'analyse
   * @param {Object} analysisData - Données de l'analyse
   * @param {Array} originalMessages - Messages originaux
   * @returns {Object} { text, html }
   */
  formatAnalysisEmail(analysisData, originalMessages) {
    const now = new Date().toLocaleString('fr-FR');
    let text = '📊 ANALYSE D\'INTENTION FACEBOOK\n';
    text += '════════════════════════════════════\n';
    text += `Date d\'analyse : ${now}\n\n`;

    let html = '<div style="font-family:Helvetica,Arial,sans-serif;color:#1f2933;">\n';
    html += '<h2 style="color:#0d6efd;margin-bottom:4px;">📊 Analyse d\'intention Facebook</h2>\n';
    html += `<p style="margin-top:0;color:#6c757d;">Date d\'analyse : ${now}</p>\n`;

    // Résumé global (intentions principales, résumé)
    const primaryIntentions = analysisData.intentions_principales || analysisData.primary_intentions || [];
    const globalSummary = analysisData.resume_global || analysisData.summary || null;
    const responseRequired = analysisData.reponse_requise || analysisData.reponse || analysisData.response_required || 
      (analysisData.analyses && analysisData.analyses.some(a => a.etape1_generique?.reponse_requise || a.reponse_requise));

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

    // Messages originaux
    text += '💬 MESSAGES REÇUS\n';
    text += '────────────────────────────\n';
    html += '<section style="margin-bottom:24px;">\n';
    html += '<h3 style="color:#0d6efd;margin-bottom:8px;">💬 Messages reçus</h3>\n';

    originalMessages.forEach((msg, index) => {
      const messageDate = msg.created_time ? new Date(msg.created_time).toLocaleString('fr-FR') : 'N/A';
      text += `\n${index + 1}. ${msg.author?.name || 'Utilisateur'} (${messageDate})\n`;
      text += `${msg.message}\n`;

      html += '<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;">\n';
      html += `<p style="margin:0 0 6px 0;font-weight:600;">${index + 1}. ${msg.author?.name || 'Utilisateur'} <span style="color:#6c757d;font-weight:400;">(${messageDate})</span></p>\n`;
      html += `<p style="margin:0;white-space:pre-line;">${(msg.message || '').trim()}</p>\n`;
      html += '</div>\n';
    });

    if (originalMessages.length === 0) {
      text += 'Aucun message reçu.\n';
      html += '<p style="color:#6c757d;">Aucun message reçu.</p>\n';
    }

    text += '\n';
    html += '</section>\n';

    // Résultats détaillés
    text += '🤖 ANALYSE DÉTAILLÉE\n';
    text += '────────────────────────────\n';
    html += '<section style="margin-bottom:24px;">\n';
    html += '<h3 style="color:#0d6efd;margin-bottom:8px;">🤖 Résultats de l\'analyse</h3>\n';

    if (analysisData.analyses && Array.isArray(analysisData.analyses) && analysisData.analyses.length > 0) {
      analysisData.analyses.forEach((analysis, index) => {
        text += `\nAnalyse ${index + 1}\n`;
        text += '------------------------------\n';

        html += '<div style="padding:16px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:16px;">\n';
        html += `<p style="margin:0 0 10px 0;font-weight:600;color:#0d6efd;">Analyse ${index + 1}</p>\n`;

        const rawIntentions = this.normalizeIntentions(analysis);

        if (rawIntentions.length > 0) {
          rawIntentions.forEach((intention, idx) => {
            const category = intention.category || intention.name || intention.label || 'Intention non définie';
            const certaintyValue = intention.certainty ?? intention.score ?? intention.confidence;
            const certainty = certaintyValue != null ? `${certaintyValue}%` : 'N/A';
            const urgent = intention.urgent || intention.priority === 'urgent' || intention.priorite === 'urgent';
            const urgentBadge = urgent ? ' (URGENT)' : '';
            const reason = intention.raison || intention.reason || intention.justification || intention.explanation || null;
            const priorityLabel = intention.priority || intention.priorite || null;

            text += `• ${category}${urgentBadge} — ${certainty}\n`;
            if (priorityLabel && !urgent) {
              text += `  Priorité : ${priorityLabel}\n`;
            }
            if (reason) {
              text += `  Justification : ${reason}\n`;
            }

            html += '<div style="background:#f8f9fb;border-left:4px solid ' + (urgent ? '#d9534f' : '#0d6efd') + ';padding:12px;border-radius:8px;margin-bottom:12px;">\n';
            html += `<p style="margin:0;font-weight:600;color:${urgent ? '#d9534f' : '#0d6efd'};">${category}${urgent ? ' <span style="color:#d9534f;">URGENT</span>' : ''}</p>\n`;
            html += `<p style="margin:2px 0;color:#6c757d;">Confiance : <strong>${certainty}</strong>${priorityLabel && !urgent ? ` · Priorité : ${priorityLabel}` : ''}</p>\n`;
            if (reason) {
              html += `<p style="margin:2px 0;white-space:pre-line;">${reason}</p>\n`;
            }
            html += '</div>\n';
          });
        } else {
          text += '• Aucune intention détectée.\n';
          html += '<p style="margin:0;color:#6c757d;">Aucune intention détectée.</p>\n';
        }

        if (analysis.resume || analysis.summary) {
          text += `Résumé : ${analysis.resume || analysis.summary}\n`;
          html += `<p style="margin:8px 0 0 0;"><strong>Résumé :</strong> ${analysis.resume || analysis.summary}</p>\n`;
        }

        html += '</div>\n';
      });
    } else {
      text += 'Pas de résultat disponible.\n';
      html += '<p style="color:#6c757d;">Pas de résultat disponible.</p>\n';
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

  /**
   * Détermine le nom du profil SMTP par défaut à utiliser
   * @param {Object} mailConfig - Configuration de Mail
   * @returns {string|null} Nom du profil ou null
   */
  getDefaultSmtpProfileName(mailConfig) {
    if (mailConfig && mailConfig.smtp_profiles && Object.keys(mailConfig.smtp_profiles).length > 0) {
      return Object.keys(mailConfig.smtp_profiles)[0];
    }
    return null;
  }
}

module.exports = WebhookService;

