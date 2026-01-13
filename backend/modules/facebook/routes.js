/**
 * Routes API pour le module Facebook
 * Fichier : backend/modules/facebook/routes.js
 */

const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const WebhookService = require('./services/WebhookService');

// Service singleton
let webhookService = null;

/**
 * GET /api/facebook/webhook
 * Vérification webhook Facebook (requis pour valider le webhook)
 */
router.get('/webhook', (req, res) => {
  // Facebook envoie ces paramètres pour vérifier le webhook
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Vérifier le token (doit correspondre à votre configuration Facebook)
  const VERIFY_TOKEN = 'gdri_facebook_webhook_token_2024'; // À mettre dans config

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook Facebook vérifié avec succès');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Échec de vérification du webhook');
    res.sendStatus(403);
  }
});

/**
 * POST /api/facebook/webhook
 * Reçoit les événements Facebook
 */
router.post('/webhook', async (req, res) => {
  try {
    // Répondre immédiatement à Facebook (obligatoire)
    res.status(200).send('EVENT_RECEIVED');

    // Traiter l'événement en arrière-plan
    processWebhookEvent(req.body);
  } catch (error) {
    console.error('❌ Erreur réception webhook:', error);
    // Mais on a déjà répondu à Facebook, donc pas de res.status ici
  }
});

/**
 * Traite un événement webhook Facebook
 * @param {Object} webhookData - Données du webhook
 */
async function processWebhookEvent(webhookData) {
  try {
    console.log('\n📨 ===== WEBHOOK FACEBOOK RECU =====');
    
    if (!webhookService) {
      console.log('  🔧 Initialisation du WebhookService...');
      webhookService = new WebhookService(database);
      await webhookService.init();
      console.log('  ✅ WebhookService initialisé');
    }

    // En mode développement, afficher dans la console
    if (process.env.NODE_ENV === 'development') {
      console.log('  📦 Données reçues:');
      console.log(JSON.stringify(webhookData, null, 2));
    }

    // Traiter et sauvegarder
    console.log('  🔄 Traitement du webhook...');
    const result = await webhookService.processWebhook(webhookData);

    if (result.success) {
      console.log(`  ✅ Webhook traité: ${result.entryCount} entry(s), ${result.eventsCount} event(s)`);
    } else {
      console.error(`  ❌ Erreur traitement webhook: ${result.error}`);
    }
    
    console.log('=====================================\n');
  } catch (error) {
    console.error('❌ Erreur processWebhookEvent:', error);
    console.error('Stack:', error.stack);
  }
}

module.exports = router;

