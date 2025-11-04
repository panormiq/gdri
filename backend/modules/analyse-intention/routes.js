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
    aiService = new AIService({
      backendIAUrl: process.env.BACKENDIA_URL || 'http://localhost:8000',
      appToken: process.env.BACKENDIA_APP_TOKEN || 'dev-token-123456789-quick-access'
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
    const { messages, customRules } = req.body;

    if (!messages) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre "messages" est requis'
      });
    }

    const service = getIntentionService();
    const result = await service.analyzeIntentions(messages, customRules);

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
    // TODO: Récupérer depuis MongoDB
    res.json({
      success: true,
      data: {
        basePrompt: '',
        defaultEmail: '',
        customIntentions: [],
        smtpSettings: {}
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
 * POST /api/analyse/agent-config - Sauvegarder la configuration de l'agent IA
 */
router.post('/agent-config', authenticateJWT, async (req, res) => {
  try {
    const { basePrompt, defaultEmail, customIntentions, smtpSettings } = req.body;

    // TODO: Sauvegarder dans MongoDB
    res.json({
      success: true,
      message: 'Configuration sauvegardée'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
