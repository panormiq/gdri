/**
 * Routes du module Analyse d'intention
 * Fichier : backend/modules/analyse-intention/routes.js
 */

const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const { authenticateJWT } = require('../../config/jwt');
const IntentionService = require('./services/IntentionService');
const AIService = require('./services/AIService');

// Service singleton
let intentionService = null;
let aiService = null;

function getAIService() {
  if (!aiService) {
    // Appel direct à Ollama (plus de backendIA)
    aiService = new AIService({
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral:latest'
    });
  }
  return aiService;
}

function getIntentionService() {
  if (!intentionService) {
    intentionService = new IntentionService(database);
    intentionService.setAIService(getAIService()); // Auto-configure AI service
  }
  return intentionService;
}

/**
 * POST /api/analyse - Analyser les intentions d'un ou plusieurs messages
 */
router.post('/', async (req, res) => {
  try {
    const { messages, customRules, entrepriseId } = req.body;
    // Compatibilité: accepter aussi entity_id pour transition
    const entityId = entrepriseId || req.body.entity_id;

    if (!messages) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre "messages" est requis'
      });
    }

    // Charger la configuration si entrepriseId est fourni
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
        // Continuer sans la config personnalisée
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
 * GET /api/analyse - Test simple pour vérifier que les routes sont chargées
 */
router.get('/', (req, res) => {
  console.log('✅ Route /api/analyse/ testée - Module fonctionne !');
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
    const aiService = getAIService();

    res.json({
      success: true,
      data: {
        categories: ['commercial', 'sav', 'technique', 'critique', 'positif', 'spam', 'generic'],
        defaultPriorities: service.getDefaultPriorityMapping(),
        backendIA: {
          url: aiService.backendIAUrl,
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
 * GET /api/analyse/test - Tester la connexion au backendIA
 */
router.get('/test', async (req, res) => {
  try {
    const aiService = getAIService();
    const testResult = await aiService.testConnection();
    
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
    console.log('📥 GET /api/analyse/agent-config - Requête reçue');
    console.log('👤 User:', req.user ? { entrepriseId: req.user.entrepriseId, role: req.user.role } : 'Non authentifié');
    
    const entrepriseId = req.user.entrepriseId;

    if (!entrepriseId) {
      return res.json({
        success: true,
        data: {
          basePrompt: '',
          defaultEmail: '',
          customIntentions: [],
          defaultIntentionsEnabled: {},
          smtp_profiles: {}
        }
      });
    }

    // Récupérer depuis MongoDB
    const configCollection = database.getCollection('analyse_intention_configs');
    
    const config = await configCollection.findOne({
      entrepriseId: entrepriseId
    });

    if (!config || !config.config) {
      // Pas de configuration sauvegardée, retourner des valeurs vides
      return res.json({
        success: true,
        data: {
          basePrompt: '',
          defaultEmail: '',
          customIntentions: [],
          defaultIntentionsEnabled: {},
          smtp_profiles: {}
        }
      });
    }

    // Retourner la configuration sauvegardée
    res.json({
      success: true,
      data: {
        basePrompt: config.config.basePrompt || config.config.base_prompt || '',
        defaultEmail: config.config.defaultEmail || config.config.default_email || '',
        customIntentions: config.config.customIntentions || config.config.intentions || [],
        defaultIntentionsEnabled: config.config.defaultIntentionsEnabled || {},
        smtp_profiles: config.config.smtp_profiles || config.config.smtpSettings || {}
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
    // Accepter les deux formats (snake_case et camelCase)
    const basePrompt = req.body.basePrompt || req.body.base_prompt || '';
    const defaultEmail = req.body.defaultEmail || req.body.default_email || '';
    const customIntentions = req.body.customIntentions || req.body.intentions || [];
    const defaultIntentionsEnabled = req.body.defaultIntentionsEnabled || {};
    const smtp_profiles = req.body.smtp_profiles || req.body.smtpSettings || {};

    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis. Veuillez d\'abord créer/associer une entreprise à votre compte.'
      });
    }

    // Sauvegarder dans MongoDB
    const configCollection = database.getCollection('analyse_intention_configs');

    const configToSave = {
      basePrompt: basePrompt,
      defaultEmail: defaultEmail,
      customIntentions: customIntentions,
      defaultIntentionsEnabled: defaultIntentionsEnabled,
      smtp_profiles: smtp_profiles
    };

    // Sauvegarder/mettre à jour la config
    await configCollection.updateOne(
      {
        entrepriseId: entrepriseId
      },
      {
        $set: {
          entrepriseId: entrepriseId,
          config: configToSave,
          updated_at: new Date(),
          updated_by: user_id
        }
      },
      { upsert: true }
    );

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

module.exports = router;
