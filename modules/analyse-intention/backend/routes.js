/**
 * Routes du module Analyse d'intention (générique).
 * Les routes Facebook (agent-config, suggest-reply, test-dataset) sont dans /api/facebook/*.
 * Fichier : modules/analyse-intention/backend/routes.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const database = require(path.join(__dirname, '../../../backend/config/database'));
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const IntentionService = require('./services/IntentionService');
const iaModule = require(path.join(__dirname, '../../ia/backend'));
const PromptService = require(path.join(__dirname, '../../prompt/backend/services/PromptService'));
const facebookAgentRoutes = require(path.join(__dirname, '../../../backend/modules/facebook/routes/agentRoutes'));

let intentionService = null;

function getIAClient() {
  return iaModule.getIAClient();
}

function getIntentionService() {
  if (!intentionService) {
    intentionService = new IntentionService(database);
    intentionService.setPromptServiceFactory(async (entityId) => {
      if (entityId) {
        return PromptService.forEntity(entityId);
      }
      return PromptService.global();
    });
  }
  return intentionService;
}

/** Routes Facebook déléguées (agent-config, suggest-reply) — tests : /api/facebook/test-dataset uniquement */
router.use((req, res, next) => {
  const deprecated = [
    '/agent-config',
    '/suggest-reply'
  ];
  const pathOnly = req.path.split('?')[0];
  if (deprecated.some((p) => pathOnly === p || pathOnly.startsWith(p + '/'))) {
    res.set('X-Deprecated-Route', 'Use /api/facebook' + pathOnly);
    return facebookAgentRoutes(req, res, next);
  }
  return next();
});

/**
 * POST /api/analyse - Analyser les intentions (usage générique)
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
        const { FacebookAgentConfigService } = require(path.join(
          __dirname,
          '../../../backend/modules/facebook/services/FacebookAgentConfigService'
        ));
        const fbConfig = new FacebookAgentConfigService(database);
        const config = await fbConfig.loadConfig(entityId);
        if (config) {
          basePrompt = config.basePrompt || config.base_prompt || null;
          customIntentions = config.customIntentions || config.intentions || [];
        }
      } catch (configError) {
        console.warn('⚠️  Erreur lors du chargement de la configuration:', configError);
      }
    }

    const service = getIntentionService();
    const result = await service.analyzeIntentions(messages, basePrompt, customIntentions, customRules, {
      entityId
    });

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

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Module analyse-intention (générique). Config Facebook : /api/facebook/agent-config',
    routes: ['/config', '/test']
  });
});

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

/** @deprecated Utiliser GET /api/facebook/agent/test */
router.get('/test', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const promptService = entrepriseId
      ? await PromptService.forEntity(entrepriseId)
      : PromptService.global();
    const testResult = await promptService.testConnection();
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

module.exports = router;
