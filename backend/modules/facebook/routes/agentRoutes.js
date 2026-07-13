/**
 * Routes agent Facebook (config IA, tests dataset, suggestions).
 * Fichier : backend/modules/facebook/routes/agentRoutes.js
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const database = require('../../../config/database');
const { authenticateJWT } = require('../../../config/jwt');
const { FacebookAgentConfigService } = require('../services/FacebookAgentConfigService');
const FacebookIntentionService = require('../services/FacebookIntentionService');
const FacebookDatasetTestService = require('../services/FacebookDatasetTestService');
const PromptService = require(path.join(__dirname, '../../../../modules/prompt/backend/services/PromptService'));

let intentionService = null;
let datasetTestService = null;
let agentConfigService = null;

function getIntentionService() {
  if (!intentionService) {
    intentionService = new FacebookIntentionService();
  }
  return intentionService;
}

function getAgentConfigService() {
  if (!agentConfigService) {
    agentConfigService = new FacebookAgentConfigService(database);
  }
  return agentConfigService;
}

function getDatasetTestService() {
  if (!datasetTestService) {
    datasetTestService = new FacebookDatasetTestService(getIntentionService(), database);
  }
  return datasetTestService;
}

/**
 * GET /api/facebook/agent-config
 */
router.get('/agent-config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const pageId = req.query.pageId ? String(req.query.pageId) : null;
    const data = await getAgentConfigService().getAgentConfigForApi(entrepriseId, pageId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /facebook/agent-config:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/agent-config
 */
router.post('/agent-config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const userId = req.user.user_id;

    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis. Veuillez d\'abord créer/associer une entreprise à votre compte.'
      });
    }

    await getAgentConfigService().saveAgentConfig(entrepriseId, userId, req.body);
    res.json({ success: true, message: 'Configuration sauvegardée avec succès' });
  } catch (error) {
    console.error('Erreur POST /facebook/agent-config:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/facebook/agent/test — test connexion IA
 */
router.get('/agent/test', authenticateJWT, async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/facebook/test-dataset
 */
router.get('/test-dataset', authenticateJWT, (req, res) => {
  try {
    const info = getDatasetTestService().getDatasetInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/test-dataset
 */
router.post('/test-dataset', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const { offset = 0, limit = 1, pageId = null, random = false, excludeIds = [] } = req.body || {};
    const result = await getDatasetTestService().analyzeBatch({
      offset,
      limit,
      entrepriseId,
      pageId: pageId != null && pageId !== '' ? String(pageId) : null,
      random: Boolean(random),
      excludeIds: Array.isArray(excludeIds) ? excludeIds : []
    });
    res.json(result);
  } catch (error) {
    console.error('Erreur POST /facebook/test-dataset:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/suggest-reply
 */
router.post('/suggest-reply', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
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

    const promptService = entrepriseId
      ? await PromptService.forEntity(entrepriseId)
      : PromptService.global();
    const result = await promptService.generate(prompt, { temperature: 0.6, max_tokens: 400 });

    if (!result.success || !result.raw) {
      return res.status(500).json({
        success: false,
        message: result.error?.message || 'L\'IA n\'a pas pu générer de suggestion'
      });
    }

    const raw = result.raw.trim();
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
    console.error('Erreur POST /facebook/suggest-reply:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
