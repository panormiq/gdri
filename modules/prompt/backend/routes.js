/**
 * Routes API du module Prompt (information + santé).
 * Fichier : modules/prompt/backend/routes.js
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const PromptService = require('./services/PromptService');

const MODULE_INFO = {
  id: 'prompt',
  displayName: 'Module Prompt',
  role: 'infrastructure',
  userConfigurable: false,
  description: 'Couche technique qui envoie des prompts aux LLM via le module IA. Les modules métier (Facebook, analyse-intention, UGAP…) l\'utilisent en interne.',
  capabilities: ['generate', 'generateJson', 'parseJsonFromResponse', 'testConnection'],
  consumedBy: ['facebook', 'analyse-intention', 'chat', 'ugap']
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: MODULE_INFO,
    routes: ['/health', '/about']
  });
});

router.get('/about', (req, res) => {
  res.json({ success: true, data: MODULE_INFO });
});

router.get('/health', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user && req.user.entrepriseId ? String(req.user.entrepriseId) : null;
    const promptService = entrepriseId
      ? await PromptService.forEntity(entrepriseId)
      : PromptService.global();
    const test = await promptService.testConnection();
    res.status(test.success ? 200 : 503).json({
      success: Boolean(test.success),
      message: test.message || (test.success ? 'OK' : 'Indisponible'),
      module: 'prompt',
      iaDependency: 'ia'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error.message,
      module: 'prompt'
    });
  }
});

module.exports = router;
