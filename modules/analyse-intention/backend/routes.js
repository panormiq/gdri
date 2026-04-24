/**
 * Routes du module Analyse d'intention
 * Fichier : modules/analyse-intention/backend/routes.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const database = require(path.join(__dirname, '../../../backend/config/database'));
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const IntentionService = require('./services/IntentionService');
const iaModule = require(path.join(__dirname, '../../ia/backend'));

let intentionService = null;

function getIAClient() {
  return iaModule.getIAClient();
}

function getIntentionService() {
  if (!intentionService) {
    intentionService = new IntentionService(database);
    intentionService.setAIService(getIAClient());
  }
  return intentionService;
}

/**
 * POST /api/analyse - Analyser les intentions d'un ou plusieurs messages
 */
router.post('/', async (req, res) => {
  try {
    const { messages, customRules, entrepriseId } = req.body;
    const entityId = entrepriseId || req.body.entity_id;

    if (!messages) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre "messages" est requis'
      });
    }

    let basePrompt = null;
    let customIntentions = [];

    if (entityId) {
      try {
        const configCollection = database.getCollection('analyse_intention_configs');
        const config = await configCollection.findOne({ entrepriseId: entityId });

        if (config && config.config) {
          basePrompt = config.config.basePrompt || config.config.base_prompt || null;
          customIntentions = config.config.customIntentions || config.config.intentions || [];
        }
      } catch (configError) {
        console.warn('⚠️  Erreur lors du chargement de la configuration:', configError);
      }
    }

    const service = getIntentionService();
    const result = await service.analyzeIntentions(messages, basePrompt, customIntentions, customRules);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error?.message || 'Erreur lors de l\'analyse',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route /api/analyse:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/analyse - Test simple
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Module analyse-intention fonctionne',
    routes: ['/config', '/test', '/agent-config']
  });
});

/**
 * GET /api/analyse/config - Obtenir la configuration du module
 */
router.get('/config', (req, res) => {
  try {
    const service = getIntentionService();
    const client = getIAClient();

    res.json({
      success: true,
      data: {
        categories: ['commercial', 'sav', 'technique', 'critique', 'positif', 'spam', 'generic'],
        defaultPriorities: service.getDefaultPriorityMapping(),
        backendIA: {
          url: client.serverUrl || client.ollamaUrl,
          configured: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/analyse/test - Tester la connexion Ollama
 */
router.get('/test', async (req, res) => {
  try {
    const client = getIAClient();
    const testResult = await client.testConnection();

    if (testResult.success) {
      res.json(testResult);
    } else {
      res.status(503).json(testResult);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/analyse/agent-config - Obtenir la configuration de l'agent IA
 */
router.get('/agent-config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const pageId = req.query.pageId ? String(req.query.pageId) : null;

    if (!entrepriseId) {
      return res.json({
        success: true,
        data: {
          basePrompt: '',
          defaultEmail: '',
          customIntentions: [],
          defaultIntentionsEnabled: {},
          smtp_profiles: {},
          pageId: null,
          reportFrequency: {}
        }
      });
    }

    const configCollection = database.getCollection('analyse_intention_configs');
    let config = null;
    if (pageId) {
      config = await configCollection.findOne({
        entrepriseId: entrepriseId,
        pageId: pageId
      });
    }
    if (!config) {
      config = await configCollection.findOne({
        entrepriseId: entrepriseId,
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }

    if (!config || !config.config) {
      return res.json({
        success: true,
        data: {
          basePrompt: '',
          defaultEmail: '',
          customIntentions: [],
          defaultIntentionsEnabled: {},
          smtp_profiles: {},
          pageId: pageId || null,
          reportFrequency: {}
        }
      });
    }

    const rf = config.config.reportFrequency || {};
    res.json({
      success: true,
      data: {
        basePrompt: config.config.basePrompt || config.config.base_prompt || '',
        defaultEmail: config.config.defaultEmail || config.config.default_email || '',
        customIntentions: config.config.customIntentions || config.config.intentions || [],
        defaultIntentionsEnabled: config.config.defaultIntentionsEnabled || {},
        smtp_profiles: config.config.smtp_profiles || config.config.smtpSettings || {},
        pageId: config.pageId || null,
        reportFrequency: {
          urgentSchedule: rf.urgentSchedule,
          urgentSendEmail: rf.urgentSendEmail !== false,
          replyDailyHour: rf.replyDailyHour || '09:00',
          replyWeekDay: rf.replyWeekDay != null && rf.replyWeekDay !== '' ? String(rf.replyWeekDay) : '1',
          replyWeeklyHour: rf.replyWeeklyHour || '09:00',
          replyMonthlyAnchor: rf.replyMonthlyAnchor === 'last' ? 'last' : 'first',
          replyMonthlyHour: rf.replyMonthlyHour || '09:00',
          interactionFrequency: rf.interactionFrequency || 'daily',
          interactionSendEmail: rf.interactionSendEmail === true,
          skipReportIfNoNewMessages: rf.skipReportIfNoNewMessages === true
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération config analyse-intention:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyse/agent-config - Sauvegarder la configuration de l'agent IA
 */
router.post('/agent-config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const user_id = req.user.user_id;
    const pageId = req.body.pageId != null && req.body.pageId !== '' ? String(req.body.pageId) : null;
    const basePrompt = req.body.basePrompt || req.body.base_prompt || '';
    const defaultEmail = req.body.defaultEmail || req.body.default_email || '';
    const customIntentions = req.body.customIntentions || req.body.intentions || [];
    const defaultIntentionsEnabled = req.body.defaultIntentionsEnabled || {};
    const smtp_profiles = req.body.smtp_profiles || req.body.smtpSettings || {};
    const reportFrequency = req.body.reportFrequency || {};
    const rf = reportFrequency;

    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis. Veuillez d\'abord créer/associer une entreprise à votre compte.'
      });
    }

    const configCollection = database.getCollection('analyse_intention_configs');
    const configToSave = {
      basePrompt: basePrompt,
      defaultEmail: defaultEmail,
      customIntentions: customIntentions,
      defaultIntentionsEnabled: defaultIntentionsEnabled,
      smtp_profiles: smtp_profiles,
      reportFrequency: {
        urgentSchedule: rf.urgentSchedule,
        urgentSendEmail: rf.urgentSendEmail !== false,
        replyDailyHour: rf.replyDailyHour || '09:00',
        replyWeekDay: rf.replyWeekDay != null && rf.replyWeekDay !== '' ? String(rf.replyWeekDay) : '1',
        replyWeeklyHour: rf.replyWeeklyHour || '09:00',
        replyMonthlyAnchor: rf.replyMonthlyAnchor === 'last' ? 'last' : 'first',
        replyMonthlyHour: rf.replyMonthlyHour || '09:00',
        interactionFrequency: rf.interactionFrequency || 'daily',
        interactionSendEmail: rf.interactionSendEmail === true,
        skipReportIfNoNewMessages: rf.skipReportIfNoNewMessages === true
      }
    };

    let filter = { entrepriseId: entrepriseId };
    if (pageId) {
      filter.pageId = pageId;
    } else {
      filter.$or = [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }];
    }
    const setPayload = {
      entrepriseId: entrepriseId,
      pageId: pageId != null ? pageId : null,
      config: configToSave,
      updated_at: new Date(),
      updated_by: user_id
    };
    await configCollection.updateOne(filter, { $set: setPayload }, { upsert: true });

    res.json({
      success: true,
      message: 'Configuration sauvegardée avec succès'
    });
  } catch (error) {
    console.error('Erreur sauvegarde config analyse-intention:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyse/suggest-reply
 */
router.post('/suggest-reply', authenticateJWT, async (req, res) => {
  try {
    const { message, intentions = [] } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre "message" est requis'
      });
    }
    const intentLabel = intentions.length ? ` (intentions détectées: ${intentions.join(', ')})` : '';
    const prompt = `Tu es un assistant qui propose des réponses courtes et professionnelles pour une page Facebook / service client.

Message reçu du client :
"""
${message.trim()}
"""${intentLabel}

Propose exactement 2 réponses possibles, courtes et adaptées. Réponds UNIQUEMENT avec le format suivant, sans autre texte avant ou après :
Réponse A : [ta première proposition]
Réponse B : [ta deuxième proposition]`;

    const ai = getIAClient();
    const result = await ai.sendAnalysisPrompt(prompt, { temperature: 0.6, max_tokens: 400 });
    if (!result.success || !result.data || !result.data.response) {
      return res.status(500).json({
        success: false,
        message: result.error?.message || 'L\'IA n\'a pas pu générer de suggestion'
      });
    }
    const raw = (result.data.response || '').trim();
    const suggestions = [];
    const aMatch = raw.match(/R[eé]ponse\s*A\s*[:\-]\s*([\s\S]*?)(?=R[eé]ponse\s*B|$)/i);
    const bMatch = raw.match(/R[eé]ponse\s*B\s*[:\-]\s*([\s\S]*?)$/im);
    if (aMatch) suggestions.push(aMatch[1].trim().replace(/\n+/g, ' '));
    if (bMatch) suggestions.push(bMatch[1].trim().replace(/\n+/g, ' '));
    if (suggestions.length === 0) {
      const oneLine = raw.split('\n')[0].trim();
      if (oneLine) suggestions.push(oneLine);
    }
    res.json({
      success: true,
      suggestions: suggestions.length ? suggestions : ['']
    });
  } catch (error) {
    console.error('Erreur suggest-reply:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
