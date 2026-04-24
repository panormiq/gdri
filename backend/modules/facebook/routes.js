/**
 * Routes API pour le module Facebook
 * Fichier : backend/modules/facebook/routes.js
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const { URL } = require('url');
const FB = require('fb');
const database = require('../../config/database');
const WebhookService = require('./services/WebhookService');
const PollingService = require('./services/PollingService');
const WebhookSubscriptionService = require('./services/WebhookSubscriptionService');
const IntentionService = require('../analyse-intention/services/IntentionService');
const AIService = require('../analyse-intention/services/AIService');
const { authenticateJWT } = require('../../config/jwt');
let mailModule;
try {
  mailModule = require('../mail');
} catch (error) {
  mailModule = require('../../../modules/mail/backend');
}

// Configuration OAuth Facebook
const FACEBOOK_API_VERSION = 'v24.0';
const DEFAULT_REDIRECT_URI = 'https://www.gdr-innovation.fr/api/facebook/oauth/callback';

// Fonction pour récupérer la configuration Facebook depuis la base de données ou les variables d'environnement
async function getFacebookAppConfig() {
  try {
    // Vérifier si la base de données est connectée (vérifier si getDb() ne lance pas d'erreur)
    try {
      database.getDb(); // Vérifie si connecté
      const appConfigCollection = database.getCollection('facebook_app_config');
      const config = await appConfigCollection.findOne({ type: 'app_credentials' });
      
      if (config && config.appId && config.appSecret) {
        return {
          appId: config.appId,
          appSecret: config.appSecret,
          redirectUri: config.redirectUri || process.env.FACEBOOK_REDIRECT_URI || DEFAULT_REDIRECT_URI
        };
      }
    } catch (dbError) {
      // Base non connectée, utiliser les variables d'environnement
    }
  } catch (error) {
    // Si erreur DB, continuer avec les variables d'environnement
    console.error('Erreur récupération config Facebook depuis DB:', error.message);
  }
  
  // Fallback vers variables d'environnement
  return {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || DEFAULT_REDIRECT_URI
  };
}

// Fonction pour configurer le SDK Facebook
async function configureFacebookSDK() {
  const config = await getFacebookAppConfig();
  FB.options({
    version: FACEBOOK_API_VERSION,
    appId: config.appId,
    appSecret: config.appSecret
  });
  return config;
}

// Service singleton
let webhookService = null;
let pollingService = null;

// L'initialisation du SDK se fera à la première utilisation (lazy loading)

function extractStoredAnalysis(doc) {
  if (!doc || typeof doc !== 'object') return null;

  const parseIfJsonString = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  const directCandidates = [
    doc.analysis_details,
    doc.analysis,
    doc.raw_analysis,
    doc.ai_analysis,
    doc.analysis_result,
    doc.analysisData,
    doc.result,
    doc.analyse
  ];

  for (const candidate of directCandidates) {
    if (candidate && typeof candidate === 'object') return candidate;
    const parsed = parseIfJsonString(candidate);
    if (parsed) return parsed;
  }

  for (const key of Object.keys(doc)) {
    const value = doc[key];
    if (value && typeof value === 'object' && Array.isArray(value.analyses)) {
      return value;
    }
    const parsed = parseIfJsonString(value);
    if (parsed && Array.isArray(parsed.analyses)) {
      return parsed;
    }
  }

  return null;
}

/**
 * GET /api/facebook/webhook
 * Vérification webhook Facebook (requis pour valider le webhook)
 */
router.get('/webhook', (req, res) => {
  // Logs très visibles pour déboguer
  console.log('\n🔔🔔🔔 ===== WEBHOOK GET (VERIFICATION) RECU =====');
  console.log('  ⏰ Timestamp:', new Date().toISOString());
  console.log('  📥 URL complète:', req.url);
  console.log('  📥 Query params:', JSON.stringify(req.query, null, 2));
  console.log('  📥 Headers:', JSON.stringify(req.headers, null, 2));
  
  // Facebook envoie ces paramètres pour vérifier le webhook
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('  🔍 Paramètres extraits:');
  console.log('    - mode:', mode);
  console.log('    - token:', token ? `${token.substring(0, 10)}...` : 'MANQUANT');
  console.log('    - challenge:', challenge ? `${challenge.substring(0, 20)}...` : 'MANQUANT');

  // Vérifier le token (doit correspondre à votre configuration Facebook)
  const VERIFY_TOKEN = 'gdri_facebook_webhook_token_2024'; // À mettre dans config
  console.log('  🔑 Token attendu:', VERIFY_TOKEN);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('  ✅✅✅ Webhook Facebook vérifié avec succès');
    console.log('  📤 Envoi du challenge:', challenge);
    res.status(200).send(challenge);
    console.log('  ✅ Réponse 200 envoyée');
  } else {
    console.log('  ❌❌❌ Échec de vérification du webhook');
    console.log('    - mode === "subscribe":', mode === 'subscribe');
    console.log('    - token correspond:', token === VERIFY_TOKEN);
    res.sendStatus(403);
    console.log('  ❌ Réponse 403 envoyée');
  }
  console.log('==========================================\n');
});

/**
 * POST /api/facebook/webhook
 * Reçoit les événements Facebook
 */
router.post('/webhook', async (req, res) => {
  try {
    // Log immédiat de la réception - AVANT tout traitement
    console.log('\n🔔🔔🔔 ===== WEBHOOK POST RECU =====');
    console.log('  ⏰ Timestamp:', new Date().toISOString());
    console.log('  📥 Method:', req.method);
    console.log('  📥 URL:', req.url);
    console.log('  📥 IP:', req.ip || req.connection.remoteAddress);
    console.log('  📥 Content-Type:', req.headers['content-type']);
    console.log('  📥 Content-Length:', req.headers['content-length']);
    console.log('  📥 User-Agent:', req.headers['user-agent']);
    console.log('  📥 X-Hub-Signature:', req.headers['x-hub-signature'] || 'MANQUANT');
    console.log('  📥 X-Hub-Signature-256:', req.headers['x-hub-signature-256'] || 'MANQUANT');
    
    // Vérifier si le body est parsé
    const bodyIsEmpty = !req.body || Object.keys(req.body).length === 0;
    const bodyIsString = typeof req.body === 'string';
    
    console.log('  📦 Body parsé:', bodyIsEmpty ? 'VIDE' : bodyIsString ? 'STRING' : 'OBJET');
    
    if (bodyIsEmpty && req.headers['content-length'] && parseInt(req.headers['content-length']) > 0) {
      console.log('  ⚠️  ATTENTION: Body vide mais Content-Length > 0 - Le body n\'a peut-être pas été parsé !');
      console.log('  💡 Vérifiez que express.json() est bien configuré');
    }
    
    // Afficher le body brut si disponible
    if (req.body) {
      console.log('  📦 Body reçu (type:', typeof req.body, '):');
      if (typeof req.body === 'string') {
        console.log('    (String):', req.body.substring(0, 500));
      } else {
        console.log(JSON.stringify(req.body, null, 2));
      }
    } else {
      console.log('  ⚠️  Body est null ou undefined');
    }
    
    // Répondre immédiatement à Facebook (obligatoire)
    res.status(200).send('EVENT_RECEIVED');
    console.log('  ✅ Réponse 200 envoyée à Facebook');

    // Traiter l'événement en arrière-plan seulement si le body existe
    if (req.body && !bodyIsEmpty) {
      processWebhookEvent(req.body);
    } else {
      console.log('  ⚠️  Body vide - Pas de traitement d\'événement');
      console.log('  💡 Facebook peut envoyer des POST vides pour tester la connexion');
    }
  } catch (error) {
    console.error('❌ Erreur réception webhook:', error);
    console.error('Stack:', error.stack);
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
    console.log('  📦 Type de données:', typeof webhookData);
    console.log('  📦 Clés disponibles:', webhookData ? Object.keys(webhookData) : 'null');
    
    // TOUJOURS afficher les données reçues pour déboguer
    console.log('  📦 Données complètes reçues:');
    console.log(JSON.stringify(webhookData, null, 2));
    
    if (!webhookService) {
      console.log('  🔧 Initialisation du WebhookService...');
      webhookService = new WebhookService(database);
      await webhookService.init();
      console.log('  ✅ WebhookService initialisé');
    }

    // Traiter et sauvegarder
    console.log('  🔄 Traitement du webhook...');
    const result = await webhookService.processWebhook(webhookData);

    if (result.success) {
      console.log(`  ✅ Webhook traité: ${result.entryCount} entry(s), ${result.eventsCount} event(s)`);
      // Enregistrer la dernière interaction et détecter un éventuel rattrapage (serveur down, etc.)
      if (webhookData.entry && Array.isArray(webhookData.entry)) {
        for (const entry of webhookData.entry) {
          const catchUp = await webhookService.recordWebhookReceived(entry.id, entry.time, entry);
          if (catchUp && catchUp.shouldCatchUp && catchUp.pageAccessToken) {
            if (!pollingService) {
              pollingService = new PollingService(database);
              await pollingService.init();
            }
            pollingService
              .pullMessages(catchUp.pageId, catchUp.pageAccessToken, catchUp.sinceDate || null)
              .then(() => webhookService.markWebhookCatchupCompleted(catchUp.pageId, entry.time))
              .catch((err) => {
                console.warn('⚠️ Rattrapage webhook échoué:', err && err.message ? err.message : err);
              });
          }
        }
      }
    } else {
      console.error(`  ❌ Erreur traitement webhook: ${result.error}`);
    }
    
    console.log('=====================================\n');
  } catch (error) {
    console.error('❌ Erreur processWebhookEvent:', error);
    console.error('Stack:', error.stack);
  }
}

/**
 * POST /api/facebook/pull
 * Déclenche un pull des messages et commentaires Facebook
 * 
 * Body (optionnel):
 * {
 *   "pageId": "205855939507920",
 *   "accessToken": "VOTRE_TOKEN",
 *   "sinceDate": "2026-01-01T00:00:00Z" // Optionnel, sinon utilise la dernière date de pull
 * }
 */
router.post('/pull', async (req, res) => {
  try {
    console.log('\n🔄 ===== DÉCLENCHEMENT PULL FACEBOOK =====');
    console.log('  ⏰ Timestamp:', new Date().toISOString());
    
    // Récupérer les paramètres
    const pageId = req.body.pageId || process.env.FACEBOOK_PAGE_ID || '205855939507920';
    const accessToken = req.body.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    let sinceDate = null;
    
    if (req.body.sinceDate) {
      sinceDate = new Date(req.body.sinceDate);
    }
    
    // Vérifier que le token est fourni
    if (!accessToken) {
      console.error('  ❌ FACEBOOK_PAGE_ACCESS_TOKEN manquant');
      return res.status(400).json({
        success: false,
        error: 'FACEBOOK_PAGE_ACCESS_TOKEN requis. Fournissez-le dans le body ou dans les variables d\'environnement.'
      });
    }
    
    console.log(`  📱 Page ID: ${pageId}`);
    console.log(`  🔑 Token: ${accessToken.substring(0, 20)}...`);
    if (sinceDate) {
      console.log(`  📅 Date spécifiée: ${sinceDate.toISOString()}`);
    }
    
    // Initialiser le service de polling
    if (!pollingService) {
      console.log('  🔧 Initialisation du PollingService...');
      pollingService = new PollingService(database);
      await pollingService.init();
      console.log('  ✅ PollingService initialisé');
    }
    
    // Lancer le pull en arrière-plan
    const pullPromise = pollingService.pullMessages(pageId, accessToken, sinceDate);
    
    // Répondre immédiatement
    res.status(202).json({
      success: true,
      message: 'Pull démarré en arrière-plan',
      pageId: pageId
    });
    
    // Attendre la fin du pull et logger le résultat
    pullPromise
      .then(result => {
        if (result.success) {
          console.log(`\n✅ Pull terminé avec succès:`);
          console.log(`  📊 ${result.postsCount} post(s)`);
          console.log(`  💬 ${result.messagesCount} message(s)`);
          console.log(`  💬 ${result.commentsCount} commentaire(s)`);
        } else {
          console.error(`\n❌ Pull échoué: ${result.error}`);
        }
      })
      .catch(error => {
        console.error(`\n❌ Erreur lors du pull:`, error);
      });
      
  } catch (error) {
    console.error('❌ Erreur déclenchement pull:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/:pageId/posts
 * Récupère les posts d'une page (utilise pages_manage_posts pour la révision Facebook)
 */
router.get('/pages/:pageId/posts', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    // Récupérer la configuration de la page
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ 
      entrepriseId: entrepriseId,
      pageId: pageId
    });
    
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Page non connectée ou token manquant'
      });
    }
    
    // Appel API qui utilise pages_manage_posts
    // Récupérer les posts de la page (nécessite pages_manage_posts)
    const postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/posts?` +
      `access_token=${config.pageAccessToken}&` +
      `fields=id,message,created_time,updated_time&` +
      `limit=10`;
    
    console.log(`📄 Récupération des posts de la page ${pageId} (utilise pages_manage_posts)...`);
    const response = await httpsRequest(postsUrl);
    
    if (response.error) {
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de la récupération des posts'
      });
    }
    
    res.json({
      success: true,
      pageId: pageId,
      posts: response.data || [],
      count: response.data ? response.data.length : 0
    });
    
  } catch (error) {
    console.error('Erreur récupération posts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/:pageId/top-posts
 * Posts les plus interactifs (tri par nombre de commentaires). Query: since (ISO date) optionnel.
 */
router.get('/pages/:pageId/top-posts', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    const sinceParam = req.query.since;
    const sinceTimestamp = sinceParam ? Math.floor(new Date(sinceParam).getTime() / 1000) : null;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ entrepriseId, pageId });
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({ success: false, message: 'Page non connectée ou token manquant' });
    }
    let postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/posts?access_token=${encodeURIComponent(config.pageAccessToken)}&fields=id,message,created_time,comments.summary(true)&limit=50`;
    if (sinceTimestamp) postsUrl += `&since=${sinceTimestamp}`;
    const postsRes = await httpsRequest(postsUrl).catch(() => ({}));
    if (!postsRes || !postsRes.data || !Array.isArray(postsRes.data)) {
      return res.json({ success: true, pageId, topPosts: [] });
    }
    const withCount = postsRes.data.map(p => ({
      id: p.id,
      message: (p.message || '').slice(0, 300),
      created_time: p.created_time,
      comments_count: (p.comments && p.comments.summary && p.comments.summary.total_count) || 0
    }));
    withCount.sort((a, b) => (b.comments_count - a.comments_count));
    const topPosts = withCount.slice(0, 10);
    return res.json({ success: true, pageId, topPosts });
  } catch (error) {
    console.error('Erreur GET /pages/:pageId/top-posts:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/pages/:pageId/posts
 * Publie un post sur une page Facebook (utilise pages_manage_posts pour la révision Facebook).
 * Avec image : utilise l'endpoint /photos ; sans image : utilise /feed.
 *
 * Body:
 * {
 *   "message": "Texte du post",
 *   "image_url": "https://..." (optionnel, URL publique de l'image)
 * }
 */
router.post('/pages/:pageId/posts', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const { message, image_url: imageUrl } = req.body || {};
    const entrepriseId = req.user.entrepriseId;

    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }

    const hasImage = typeof imageUrl === 'string' && imageUrl.trim().length > 0;
    const messageTrimmed = (message || '').trim();

    if (!hasImage && !messageTrimmed) {
      return res.status(400).json({
        success: false,
        message: 'Le message est requis (ou une image avec message optionnel)'
      });
    }

    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({
      entrepriseId: entrepriseId,
      pageId: pageId
    });

    if (!config || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Page non connectée ou token manquant'
      });
    }

    let response;

    if (hasImage) {
      // Publication avec image : endpoint /photos (même permission pages_manage_posts)
      const photosUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/photos`;
      const photoData = {
        url: imageUrl.trim(),
        access_token: config.pageAccessToken
      };
      if (messageTrimmed) photoData.message = messageTrimmed;
      console.log(`📷 Publication d'un post avec image sur la page ${pageId} (pages_manage_posts)...`);
      response = await httpsPostRequest(photosUrl, photoData);
    } else {
      // Publication texte seul : endpoint /feed
      const feedUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/feed`;
      const postData = {
        message: messageTrimmed,
        access_token: config.pageAccessToken
      };
      console.log(`📝 Publication d'un post sur la page ${pageId} (utilise pages_manage_posts)...`);
      response = await httpsPostRequest(feedUrl, postData);
    }

    if (response.error) {
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de la publication du post'
      });
    }

    res.json({
      success: true,
      pageId: pageId,
      postId: response.id || response.post_id,
      message: 'Post publié avec succès'
    });

  } catch (error) {
    console.error('Erreur publication post:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/:pageId/conversations
 * Récupère les conversations d'une page (utilise pages_messaging pour la révision Facebook)
 */
router.get('/pages/:pageId/conversations', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    // Récupérer la configuration de la page
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ 
      entrepriseId: entrepriseId,
      pageId: pageId
    });
    
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Page non connectée ou token manquant'
      });
    }
    
    // Appel API qui utilise pages_messaging
    // Récupérer les conversations de la page (nécessite pages_messaging)
    const conversationsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/conversations?` +
      `access_token=${config.pageAccessToken}&` +
      `fields=id,updated_time&` +
      `limit=10`;
    
    console.log(`💬 Récupération des conversations de la page ${pageId} (utilise pages_messaging)...`);
    const response = await httpsRequest(conversationsUrl);
    
    if (response.error) {
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de la récupération des conversations'
      });
    }
    
    res.json({
      success: true,
      pageId: pageId,
      conversations: response.data || [],
      count: response.data ? response.data.length : 0
    });
    
  } catch (error) {
    console.error('Erreur récupération conversations:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/:pageId/latest-message
 * Récupère le dernier message privé reçu sur la page (utilise pages_messaging)
 */
router.get('/pages/:pageId/latest-message', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({
      entrepriseId: entrepriseId,
      pageId: pageId
    });
    
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Page non connectée ou token manquant'
      });
    }
    
    // Récupérer la dernière conversation avec son dernier message et les participants
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/conversations?` +
      `access_token=${encodeURIComponent(config.pageAccessToken)}&` +
      `fields=messages.limit(1){id,message,from,created_time},participants&` +
      `limit=1`;
    
    console.log(`💬 Récupération du dernier message pour la page ${pageId} (pages_messaging)...`);
    let response;
    try {
      response = await httpsRequest(url);
    } catch (apiError) {
      const msg = apiError.message || '';
      const isPermissionOrRole = /pages_messaging|appropriate role on the Page/i.test(msg);
      if (isPermissionOrRole) {
        console.warn(`⚠️ pages_messaging pour la page ${pageId}:`, msg);
        return res.json({
          success: true,
          pageId,
          hasMessage: false,
          lastMessage: null,
          permissionRequired: true,
          permissionMessage: 'Permission pages_messaging manquante ou rôle insuffisant sur la Page. Vérifiez que le compte connecté est Admin/Éditeur de la page et que l\'app a demandé pages_messaging (révision Facebook si en production).'
        });
      }
      throw apiError;
    }
    
    if (response.error) {
      const msg = response.error.message || '';
      const isPermissionOrRole = /pages_messaging|appropriate role on the Page/i.test(msg);
      if (isPermissionOrRole) {
        console.warn(`⚠️ pages_messaging pour la page ${pageId}:`, msg);
        return res.json({
          success: true,
          pageId,
          hasMessage: false,
          lastMessage: null,
          permissionRequired: true,
          permissionMessage: 'Permission pages_messaging manquante ou rôle insuffisant sur la Page. Vérifiez que le compte connecté est Admin/Éditeur de la page et que l\'app a demandé pages_messaging (révision Facebook si en production).'
        });
      }
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de la récupération du dernier message'
      });
    }
    
    const conversations = response.data || [];
    if (!conversations.length) {
      return res.json({
        success: true,
        pageId,
        hasMessage: false,
        lastMessage: null
      });
    }
    
    const conv = conversations[0];
    const messages = conv.messages && conv.messages.data ? conv.messages.data : [];
    const msg = messages.length ? messages[0] : null;
    const participants = conv.participants && conv.participants.data ? conv.participants.data : [];
    
    if (!msg) {
      return res.json({
        success: true,
        pageId,
        hasMessage: false,
        lastMessage: null
      });
    }
    
    // Trouver le participant qui n'est pas la page elle-même (l'utilisateur)
    let userParticipant = null;
    if (participants.length) {
      userParticipant = participants.find(p => p.id !== pageId) || participants[0];
    }
    
    res.json({
      success: true,
      pageId,
      hasMessage: true,
      lastMessage: {
        conversationId: conv.id,
        messageId: msg.id,
        text: msg.message,
        from: msg.from || null,
        created_time: msg.created_time,
        participant: userParticipant
      }
    });
  } catch (error) {
    const msg = error.message || '';
    const isPermissionOrRole = /pages_messaging|appropriate role on the Page/i.test(msg);
    if (isPermissionOrRole) {
      console.warn(`⚠️ pages_messaging pour la page ${req.params.pageId}:`, msg);
      return res.json({
        success: true,
        pageId: req.params.pageId,
        hasMessage: false,
        lastMessage: null,
        permissionRequired: true,
        permissionMessage: 'Permission pages_messaging manquante ou rôle insuffisant sur la Page. Vérifiez que le compte connecté est Admin/Éditeur de la page et que l\'app a demandé pages_messaging (révision Facebook si en production).'
      });
    }
    console.error('Erreur récupération dernier message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/:pageId/messages/analyzed
 * Liste des messages analysés. Filtres: status=a_repondre|a_ne_pas_repondre|repondu, intention=...
 * Query: status (a_repondre | a_ne_pas_repondre | repondu), intention=SAV|Commercial|...
 */
router.get('/pages/:pageId/messages/analyzed', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    const status = req.query.status || 'a_repondre';
    const intention = req.query.intention || '';
    const urgentOnly = req.query.urgent_only === '1' || req.query.urgent_only === 'true';
    const messageId = req.query.messageId ? String(req.query.messageId).trim() : '';

    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ entrepriseId, pageId });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Page non trouvée' });
    }
    const coll = database.getCollection('facebook_analyzed_messages');
    const { ObjectId } = require('mongodb');

    // Un seul message (ex. après « Repasser par l'IA ») : pas de filtres d'onglet,
    // sinon la requête peut exclure le message (priorité/intention) ou être ambiguë avec $and + _id.
    let filter;
    if (messageId) {
      if (!ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, message: 'messageId invalide' });
      }
      filter = {
        pageId: String(pageId),
        entityId: String(entrepriseId),
        _id: new ObjectId(messageId)
      };
    } else {
      filter = { pageId: String(pageId), entityId: String(entrepriseId) };
      if (status === 'repondu') {
        filter.replied_at = { $exists: true, $ne: null };
      } else if (status === 'a_ne_pas_repondre') {
        filter.$and = [
          { $nor: [{ replied_at: { $exists: true, $ne: null } }] },
          { reponse_requise: false }
        ];
      } else {
        // a_repondre ou ancien param (ex. immediate) : non répondu + réponse requise
        filter.$and = [
          { $nor: [{ replied_at: { $exists: true, $ne: null } }] },
          { $or: [{ reponse_requise: { $ne: false } }, { reponse_requise: { $exists: false } }] }
        ];
        if (urgentOnly) {
          filter.$and.push({ reportPriority: 'immediate' });
        }
      }
      if (intention && intention.trim()) {
        const safe = intention.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter['intentions.name'] = new RegExp('^' + safe + '$', 'i');
      }
    }
    const list = await coll.find(filter).sort({ analyzed_at: -1 }).limit(200).toArray();

    const items = list.map(doc => ({
      id: doc._id.toString(),
      message: doc.message,
      author: doc.author,
      created_time: doc.created_time,
      type: doc.type,
      post_id: doc.post_id,
      comment_id: doc.comment_id,
      intentions: doc.intentions || [],
      reportPriority: doc.reportPriority,
      reponse_requise: doc.reponse_requise,
      analysis_details: extractStoredAnalysis(doc),
      replied_at: doc.replied_at ? (doc.replied_at instanceof Date ? doc.replied_at.toISOString() : doc.replied_at) : null,
      replied_message: doc.replied_message || null,
      sender_psid: doc.sender_psid,
      analyzed_at: doc.analyzed_at
    }));
    return res.json({ success: true, pageId, messages: items });
  } catch (error) {
    console.error('Erreur GET /pages/:pageId/messages/analyzed:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/facebook/pages/:pageId/messages/analyzed/:messageId/replied
 * Marque un message comme déjà répondu. Body optionnel: { message: "texte de la réponse" }
 */
router.patch('/pages/:pageId/messages/analyzed/:messageId/replied', authenticateJWT, async (req, res) => {
  try {
    const { pageId, messageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    const replyMessage = req.body && typeof req.body.message === 'string' ? req.body.message.trim() : null;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const { ObjectId } = require('mongodb');
    const coll = database.getCollection('facebook_analyzed_messages');
    const update = { replied_at: new Date() };
    if (replyMessage) update.replied_message = replyMessage;
    const result = await coll.updateOne(
      {
        _id: new ObjectId(messageId),
        pageId: String(pageId),
        entityId: String(entrepriseId)
      },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }
    return res.json({ success: true, pageId, messageId });
  } catch (error) {
    console.error('Erreur PATCH replied:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/pages/:pageId/messages/analyzed/:messageId/rerun-analysis
 * Relance l'analyse IA pour un message et met à jour la classification sauvegardée.
 */
router.post('/pages/:pageId/messages/analyzed/:messageId/rerun-analysis', authenticateJWT, async (req, res) => {
  try {
    const { pageId, messageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }

    const { ObjectId } = require('mongodb');
    const analyzedCollection = database.getCollection('facebook_analyzed_messages');
    const agentConfigCollection = database.getCollection('analyse_intention_configs');

    const analyzedMessage = await analyzedCollection.findOne({
      _id: new ObjectId(messageId),
      pageId: String(pageId),
      entityId: String(entrepriseId)
    });
    if (!analyzedMessage) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    let aiConfig = await agentConfigCollection.findOne({
      entrepriseId: String(entrepriseId),
      pageId: String(pageId)
    });
    if (!aiConfig) {
      aiConfig = await agentConfigCollection.findOne({
        entrepriseId: String(entrepriseId),
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }
    if (!aiConfig) {
      aiConfig = await agentConfigCollection.findOne({ entity_id: String(entrepriseId) });
    }

    const aiService = new AIService({
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral:latest'
    });
    const intentionService = new IntentionService(database);
    intentionService.setAIService(aiService);

    const basePrompt = aiConfig && aiConfig.config
      ? (aiConfig.config.basePrompt || aiConfig.config.base_prompt || null)
      : null;
    const customIntentions = aiConfig && aiConfig.config
      ? (aiConfig.config.customIntentions || aiConfig.config.intentions || [])
      : [];

    const rerunMessages = [{
      message: analyzedMessage.message || '',
      author: analyzedMessage.author || {},
      created_time: analyzedMessage.created_time || new Date().toISOString(),
      type: analyzedMessage.type || 'message',
      post_id: analyzedMessage.post_id || null,
      comment_id: analyzedMessage.comment_id || null
    }];

    const rerunResult = await intentionService.analyzeIntentions(rerunMessages, basePrompt, customIntentions);
    if (!rerunResult || !rerunResult.success || !rerunResult.data) {
      return res.status(500).json({
        success: false,
        message: rerunResult && rerunResult.error ? rerunResult.error : 'Erreur relance analyse IA'
      });
    }

    const analysisData = rerunResult.data;
    const firstAnalysis = Array.isArray(analysisData.analyses) && analysisData.analyses.length > 0
      ? analysisData.analyses[0]
      : {};
    const intentions = Array.isArray(firstAnalysis.intentions) ? firstAnalysis.intentions : [];
    const hasUrgent = intentions.some((it) => it && (it.urgent === true || it.priority === 'urgent' || it.priorite === 'urgent'));
    const firstPriority = intentions.find((it) => it && (it.priority || it.priorite));
    const reportPriority = hasUrgent
      ? 'immediate'
      : (firstPriority ? String(firstPriority.priority || firstPriority.priorite || 'daily') : 'daily');
    const reponseRequise = typeof firstAnalysis.reponse_requise === 'boolean'
      ? firstAnalysis.reponse_requise
      : (typeof analysisData.reponse_requise === 'boolean' ? analysisData.reponse_requise : true);

    const now = new Date();
    await analyzedCollection.updateOne(
      { _id: new ObjectId(messageId), pageId: String(pageId), entityId: String(entrepriseId) },
      {
        $set: {
          analysis_details: analysisData,
          intentions: intentions,
          reportPriority: reportPriority,
          reponse_requise: reponseRequise,
          analyzed_at: now,
          updated_at: now
        },
        $inc: { rerun_count: 1 }
      }
    );

    return res.json({
      success: true,
      message: 'Analyse relancée avec succès',
      data: {
        analysis_details: analysisData,
        intentions,
        reportPriority,
        reponse_requise: reponseRequise,
        analyzed_at: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Erreur POST rerun-analysis:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/pages/:pageId/messages/analyzed/:messageId/email
 * Envoie un message analysé par email (destinataire de config Facebook ou email explicite).
 * Body optionnel: { to: "destinataire@exemple.com" }
 */
router.post('/pages/:pageId/messages/analyzed/:messageId/email', authenticateJWT, async (req, res) => {
  try {
    const { pageId, messageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    const toOverride = req.body && typeof req.body.to === 'string' ? req.body.to.trim() : '';

    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }

    const { ObjectId } = require('mongodb');
    const analyzedCollection = database.getCollection('facebook_analyzed_messages');
    const configCollection = database.getCollection('facebook_configs');
    const agentConfigCollection = database.getCollection('analyse_intention_configs');

    const analyzedMessage = await analyzedCollection.findOne({
      _id: new ObjectId(messageId),
      pageId: String(pageId),
      entityId: String(entrepriseId)
    });

    if (!analyzedMessage) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    const pageConfig = await configCollection.findOne({
      entrepriseId: String(entrepriseId),
      pageId: String(pageId)
    });

    if (!pageConfig) {
      return res.status(404).json({ success: false, message: 'Configuration de page introuvable' });
    }

    // La config de l'agent est stockée dans analyse_intention_configs avec entrepriseId
    // et peut être spécifique à une page (pageId) ou globale (sans pageId).
    let aiConfig = await agentConfigCollection.findOne({
      entrepriseId: String(entrepriseId),
      pageId: String(pageId)
    });
    if (!aiConfig) {
      aiConfig = await agentConfigCollection.findOne({
        entrepriseId: String(entrepriseId),
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }
    // Compat ascendante: anciens documents pouvaient utiliser entity_id
    if (!aiConfig) {
      aiConfig = await agentConfigCollection.findOne({ entity_id: String(entrepriseId) });
    }

    const defaultEmail = aiConfig && aiConfig.config
      ? String(aiConfig.config.defaultEmail || aiConfig.config.default_email || '').trim()
      : '';
    const targetEmail = toOverride || defaultEmail;

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'Aucun destinataire email configuré. Configurez un email par défaut dans l’agent Facebook.'
      });
    }

    const authorName = analyzedMessage.author && analyzedMessage.author.name ? analyzedMessage.author.name : 'Anonyme';
    const createdAt = analyzedMessage.created_time ? new Date(analyzedMessage.created_time) : new Date();
    const storedAnalysis = extractStoredAnalysis(analyzedMessage);

    // Relancer l'analyse d'intention au moment de l'envoi afin de vérifier
    // si les corrections de classification sont bien prises en compte.
    let rerunAnalysis = null;
    try {
      const aiService = new AIService({
        ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'mistral:latest'
      });
      const intentionService = new IntentionService(database);
      intentionService.setAIService(aiService);

      const rerunMessages = [{
        message: analyzedMessage.message || '',
        author: analyzedMessage.author || {},
        created_time: analyzedMessage.created_time || new Date().toISOString(),
        type: analyzedMessage.type || 'message',
        post_id: analyzedMessage.post_id || null,
        comment_id: analyzedMessage.comment_id || null
      }];

      const basePrompt = aiConfig && aiConfig.config
        ? (aiConfig.config.basePrompt || aiConfig.config.base_prompt || null)
        : null;
      const customIntentions = aiConfig && aiConfig.config
        ? (aiConfig.config.customIntentions || aiConfig.config.intentions || [])
        : [];

      const rerunResult = await intentionService.analyzeIntentions(rerunMessages, basePrompt, customIntentions);
      if (rerunResult && rerunResult.success) {
        rerunAnalysis = rerunResult.data || null;
      }
    } catch (rerunError) {
      console.warn('⚠️ Impossible de relancer l’analyse pour envoi mail:', rerunError.message);
    }

    const subject = `📊 Analyse d'intention Facebook - ${pageConfig.pageName || pageId}`;
    const storedAnalysisText = storedAnalysis
      ? JSON.stringify(storedAnalysis, null, 2)
      : 'Aucune analyse initiale enregistrée';
    const rerunAnalysisText = rerunAnalysis
      ? JSON.stringify(rerunAnalysis, null, 2)
      : 'Relance de l’analyse indisponible';
    const baseMessages = [{
      message: analyzedMessage.message || '',
      author: analyzedMessage.author || { name: authorName },
      created_time: analyzedMessage.created_time || createdAt.toISOString(),
      type: analyzedMessage.type || 'message',
      post_id: analyzedMessage.post_id || null,
      comment_id: analyzedMessage.comment_id || null
    }];
    const analysisForTemplate = rerunAnalysis || storedAnalysis || {
      analyses: [{
        message: analyzedMessage.message || '',
        intentions: Array.isArray(analyzedMessage.intentions) ? analyzedMessage.intentions : [],
        reponse_requise: typeof analyzedMessage.reponse_requise === 'boolean' ? analyzedMessage.reponse_requise : null,
        resume: 'Analyse indisponible'
      }]
    };
    const formatter = new WebhookService(database);
    const formatted = formatter.formatAnalysisEmail(analysisForTemplate, baseMessages);

    const comparisonText = [
      '',
      '════════ COMPARAISON ANALYSE ════════',
      'Analyse initiale (stockée):',
      storedAnalysisText,
      '',
      'Analyse relancée (au moment de l’envoi):',
      rerunAnalysisText
    ].join('\n');

    const comparisonHtml = `
      <section style="margin-top:24px;">
        <h3 style="color:#0d6efd;margin-bottom:8px;">🔁 Comparaison analyse</h3>
        <p style="margin:6px 0 4px 0;"><strong>Analyse initiale (stockée) :</strong></p>
        <pre style="margin:0;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:10px;white-space:pre-wrap;">${storedAnalysisText.replace(/</g, '&lt;')}</pre>
        <p style="margin:12px 0 4px 0;"><strong>Analyse relancée (au moment de l’envoi) :</strong></p>
        <pre style="margin:0;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:10px;white-space:pre-wrap;">${rerunAnalysisText.replace(/</g, '&lt;')}</pre>
      </section>
    `;

    const textBody = `${formatted.text}\n${comparisonText}`;
    const htmlBody = `${formatted.html}${comparisonHtml}`;

    const mail = mailModule.getMailService();
    const mailConfigFacebook = await mail.loadConfigFromDB(String(entrepriseId), 'facebook');
    const mailConfigDefault = await mail.loadConfigFromDB(String(entrepriseId), 'mail');
    const effectiveMailConfig =
      mailConfigFacebook && mailConfigFacebook.smtp_profiles && Object.keys(mailConfigFacebook.smtp_profiles).length > 0
        ? mailConfigFacebook
        : mailConfigDefault;

    if (!effectiveMailConfig || !effectiveMailConfig.smtp_profiles || Object.keys(effectiveMailConfig.smtp_profiles).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune configuration SMTP disponible' });
    }

    const smtpProfile = effectiveMailConfig.default_profile && effectiveMailConfig.smtp_profiles[effectiveMailConfig.default_profile]
      ? effectiveMailConfig.default_profile
      : Object.keys(effectiveMailConfig.smtp_profiles)[0];

    mail.initModule({
      module_name: 'facebook',
      ...effectiveMailConfig
    });

    const sendResult = await mail.send({
      to: targetEmail,
      subject,
      body: textBody,
      body_html: htmlBody,
      module_name: 'facebook',
      entity_id: String(entrepriseId),
      profile: smtpProfile
    });

    if (!sendResult || !sendResult.success) {
      return res.status(500).json({
        success: false,
        message: sendResult && sendResult.error ? sendResult.error : 'Erreur lors de l’envoi de l’email'
      });
    }

    return res.json({
      success: true,
      messageId,
      pageId,
      to: targetEmail
    });
  } catch (error) {
    console.error('Erreur POST analyzed message email:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/pages/:pageId/messages/reply
 * Envoie une réponse à un message privé (utilise pages_messaging)
 * Body:
 * {
 *   "conversationId": "...",
 *   "recipientId": "PSID",
 *   "message": "Texte de la réponse"
 * }
 */
router.post('/pages/:pageId/messages/reply', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const { conversationId, recipientId, message } = req.body;
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le message de réponse est requis'
      });
    }
    
    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'recipientId requis pour envoyer un message'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({
      entrepriseId: entrepriseId,
      pageId: pageId
    });
    
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Page non connectée ou token manquant'
      });
    }
    
    // Utiliser l'API Messenger Send via /me/messages
    const sendUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/messages?` +
      `access_token=${encodeURIComponent(config.pageAccessToken)}`;
    
    const postData = {
      recipient: JSON.stringify({ id: recipientId }),
      message: JSON.stringify({ text: message.trim() })
    };
    
    console.log(`💬 Envoi d'une réponse à ${recipientId} sur la page ${pageId} (pages_messaging)...`);
    const response = await httpsPostRequest(sendUrl, postData);
    
    if (response.error) {
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de l\'envoi de la réponse'
      });
    }
    
    res.json({
      success: true,
      pageId,
      conversationId: conversationId || null,
      recipientId,
      facebookResponse: response
    });
  } catch (error) {
    console.error('Erreur envoi réponse message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/facebook/pages/:pageId/posts/:postId/comments
 * Publie un commentaire sur un post (nouveau commentaire sur le post).
 * Body: { message: string }
 */
router.post('/pages/:pageId/posts/:postId/comments', authenticateJWT, async (req, res) => {
  try {
    const { pageId, postId } = req.params;
    const { message } = req.body || {};
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Le message du commentaire est requis' });
    }
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ entrepriseId, pageId });
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({ success: false, message: 'Page non connectée ou token manquant' });
    }
    const commentUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${postId}/comments`;
    const response = await httpsPostRequest(commentUrl, {
      message: message.trim(),
      access_token: config.pageAccessToken
    });
    if (response.error) {
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de la publication du commentaire'
      });
    }
    res.json({
      success: true,
      pageId,
      postId,
      commentId: response.id || null
    });
  } catch (error) {
    console.error('Erreur publication commentaire:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/pages/:pageId/comments/:commentId/replies
 * Répondre à un commentaire existant (réponse dans le fil, sous le commentaire).
 * Body: { message: string }
 */
router.post('/pages/:pageId/comments/:commentId/replies', authenticateJWT, async (req, res) => {
  try {
    const { pageId, commentId } = req.params;
    const { message } = req.body || {};
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    if (!commentId) {
      return res.status(400).json({ success: false, message: 'commentId requis' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Le message de la réponse est requis' });
    }
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ entrepriseId, pageId });
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({ success: false, message: 'Page non connectée ou token manquant' });
    }
    const replyUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${commentId}/comments`;
    const response = await httpsPostRequest(replyUrl, {
      message: message.trim(),
      access_token: config.pageAccessToken
    });
    if (response.error) {
      return res.status(500).json({
        success: false,
        message: response.error.message || 'Erreur lors de la réponse au commentaire'
      });
    }
    res.json({
      success: true,
      pageId,
      commentId,
      replyId: response.id || null
    });
  } catch (error) {
    console.error('Erreur réponse au commentaire:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/facebook/pages/:pageId/subscriptions
 * Récupère les webhooks déjà souscrits pour une page
 */
router.get('/pages/:pageId/subscriptions', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    // Récupérer la configuration de la page
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ 
      entrepriseId: entrepriseId,
      pageId: pageId
    });
    
    if (!config || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Page non connectée ou token manquant'
      });
    }
    
    // Récupérer les webhooks souscrits depuis Facebook
    const subscriptionService = new WebhookSubscriptionService();
    try {
      const subscriptions = await subscriptionService.getSubscriptions(pageId, config.pageAccessToken);
      
      // Extraire les subscribed_fields depuis la réponse Facebook
      let subscribedFields = [];
      if (subscriptions.data && Array.isArray(subscriptions.data)) {
        // Chercher l'app de notre application
        const appConfig = await getFacebookAppConfig();
        const ourApp = subscriptions.data.find(app => app.id === appConfig.appId);
        if (ourApp && ourApp.subscribed_fields) {
          subscribedFields = ourApp.subscribed_fields;
        }
      }
      
      res.json({
        success: true,
        pageId: pageId,
        subscribedFields: subscribedFields,
        allSubscriptions: subscriptions
      });
    } catch (error) {
      console.error('Erreur récupération subscriptions:', error);
      // En cas d'erreur, retourner les webhooks stockés en base
      res.json({
        success: true,
        pageId: pageId,
        subscribedFields: config.webhooks_subscribed || [],
        fromDatabase: true,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Erreur récupération subscriptions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/config
 * Récupère la configuration Facebook de l'entreprise
 */
router.get('/config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    
    // Récupérer toutes les pages connectées pour cette entreprise
    // Support de plusieurs pages : chercher toutes les configs avec cet entrepriseId
    const configs = await configCollection.find({ entrepriseId: entrepriseId }).toArray();
    
    if (!configs || configs.length === 0) {
      return res.json({
        success: true,
        data: null,
        pages: []
      });
    }
    
    // Si une seule page (compatibilité avec l'ancien format)
    if (configs.length === 1) {
      const config = configs[0];
      return res.json({
        success: true,
        data: {
          pageId: config.pageId || '',
          pageAccessToken: config.pageAccessToken || '',
          pageName: config.pageName || ''
        },
        pages: [{
          pageId: config.pageId || '',
          pageName: config.pageName || '',
          pageAccessToken: config.pageAccessToken || '',
          webhooks_subscribed: config.webhooks_subscribed || [],
          tokenStatus: config.tokenStatus || 'active',
          userTokenExpiresAt: config.userTokenExpiresAt || null,
          tokenLastError: config.tokenLastError || null
        }]
      });
    }
    
    // Plusieurs pages
    const pages = configs.map(config => ({
      pageId: config.pageId || '',
      pageName: config.pageName || '',
      pageAccessToken: config.pageAccessToken || '',
      webhooks_subscribed: config.webhooks_subscribed || [],
      tokenStatus: config.tokenStatus || 'active',
      userTokenExpiresAt: config.userTokenExpiresAt || null,
      tokenLastError: config.tokenLastError || null
    }));
    
    res.json({
      success: true,
      data: pages[0], // Page principale (première)
      pages: pages
    });
  } catch (error) {
    console.error('Erreur récupération config Facebook:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/facebook/pages/validate-permissions
 * Déclenche manuellement les appels API pour valider pages_manage_posts et pages_messaging
 * Utile pour les pages déjà connectées avant l'ajout de cette fonctionnalité
 */
router.post('/pages/validate-permissions', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const { pageId } = req.body; // Optionnel : valider une page spécifique
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    
    // Récupérer les pages à valider
    let configs;
    if (pageId) {
      const config = await configCollection.findOne({ 
        entrepriseId: entrepriseId,
        pageId: pageId 
      });
      configs = config ? [config] : [];
    } else {
      // Valider toutes les pages de l'entreprise
      configs = await configCollection.find({ entrepriseId: entrepriseId }).toArray();
    }
    
    if (configs.length === 0) {
      return res.status(400).json({
        success: false,
        message: pageId ? `Page ${pageId} non trouvée` : 'Aucune page connectée'
      });
    }
    
    const results = [];
    
    for (const config of configs) {
      const pageId = config.pageId;
      const pageAccessToken = config.pageAccessToken;
      
      if (!pageAccessToken) {
        results.push({
          pageId: pageId,
          pageName: config.pageName,
          success: false,
          error: 'Token d\'accès manquant'
        });
        continue;
      }
      
      const pageResult = {
        pageId: pageId,
        pageName: config.pageName,
        pages_manage_posts: { success: false },
        pages_messaging: { success: false }
      };
      
      // Appel API pages_manage_posts
      // IMPORTANT: Utiliser GET /{page-id}/posts avec le Page Access Token
      try {
        const postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/posts?` +
          `access_token=${encodeURIComponent(pageAccessToken)}&` +
          `fields=id,message,created_time&` +
          `limit=1`;
        
        console.log(`\n📄 ===== APPEL API pages_manage_posts =====`);
        console.log(`   Page ID: ${pageId}`);
        console.log(`   URL: ${postsUrl.replace(pageAccessToken, 'TOKEN_MASQUE')}`);
        console.log(`   Méthode: GET`);
        console.log(`   Permission requise: pages_manage_posts`);
        
        const postsResponse = await httpsRequest(postsUrl);
        
        console.log(`   ✅ Réponse reçue:`, JSON.stringify(postsResponse, null, 2).substring(0, 500));
        console.log(`✅ Appel API pages_manage_posts réussi pour ${pageId}`);
        console.log(`==========================================\n`);
        
        pageResult.pages_manage_posts = { 
          success: true, 
          message: 'Appel API réussi',
          response: postsResponse
        };
      } catch (apiError) {
        console.error(`\n❌ ===== ERREUR APPEL API pages_manage_posts =====`);
        console.error(`   Page ID: ${pageId}`);
        console.error(`   Erreur:`, apiError.message);
        console.error(`==========================================\n`);
        pageResult.pages_manage_posts = { success: false, error: apiError.message };
      }
      
      // Appel API pages_messaging
      // IMPORTANT: Utiliser GET /{page-id}/conversations avec le Page Access Token
      try {
        const conversationsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/conversations?` +
          `access_token=${encodeURIComponent(pageAccessToken)}&` +
          `fields=id,updated_time&` +
          `limit=1`;
        
        console.log(`\n💬 ===== APPEL API pages_messaging =====`);
        console.log(`   Page ID: ${pageId}`);
        console.log(`   URL: ${conversationsUrl.replace(pageAccessToken, 'TOKEN_MASQUE')}`);
        console.log(`   Méthode: GET`);
        console.log(`   Permission requise: pages_messaging`);
        
        const conversationsResponse = await httpsRequest(conversationsUrl);
        
        console.log(`   ✅ Réponse reçue:`, JSON.stringify(conversationsResponse, null, 2).substring(0, 500));
        console.log(`✅ Appel API pages_messaging réussi pour ${pageId}`);
        console.log(`==========================================\n`);
        
        pageResult.pages_messaging = { 
          success: true, 
          message: 'Appel API réussi',
          response: conversationsResponse
        };
      } catch (apiError) {
        console.warn(`⚠️  Appel API pages_messaging échoué pour ${pageId}:`, apiError.message);
        pageResult.pages_messaging = { success: false, error: apiError.message };
      }
      
      pageResult.success = pageResult.pages_manage_posts.success && pageResult.pages_messaging.success;
      results.push(pageResult);
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: successCount > 0,
      message: `${successCount}/${results.length} page(s) validée(s) avec succès`,
      results: results
    });
    
  } catch (error) {
    console.error('Erreur validation permissions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/debug
 * Route de diagnostic : liste toutes les pages enregistrées dans la base de données
 */
router.get('/pages/debug', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    const allConfigs = await configCollection.find({ entrepriseId: entrepriseId }).toArray();
    
    res.json({
      success: true,
      entrepriseId: entrepriseId,
      totalPages: allConfigs.length,
      pages: allConfigs.map(config => ({
        pageId: config.pageId,
        pageName: config.pageName,
        hasAccessToken: !!config.pageAccessToken,
        hasUserToken: !!config.userAccessToken,
        webhooks: config.webhooks_subscribed || [],
        updated_at: config.updated_at,
        created_at: config.created_at
      }))
    });
  } catch (error) {
    console.error('Erreur debug pages:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/summary
 * Résumé par page connectée : likes, nombre de commentaires (récent), dernière interaction.
 * Query: since (ISO date) optionnel pour filtrer les posts depuis une date.
 */
router.get('/pages/summary', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const sinceParam = req.query.since; // ISO date ou vide
    const sinceTimestamp = sinceParam ? Math.floor(new Date(sinceParam).getTime() / 1000) : null;
    const configCollection = database.getCollection('facebook_configs');
    const configs = await configCollection.find({ entrepriseId }).toArray();
    const summaries = [];
    for (const config of configs) {
      const pageId = config.pageId;
      const token = config.pageAccessToken;
      const pageName = config.pageName || `Page ${pageId}`;
      const item = {
        pageId,
        pageName,
        fan_count: null,
        postsCount: 0,
        commentsCount: 0,
        reactionsCount: 0,
        totalInteractions: 0,
        avgCommentsPerPost: null,
        avgReactionsPerPost: null,
        lastInteractionAt: config.lastInteractionAt ? new Date(config.lastInteractionAt).toISOString() : null,
        topPosts: []
      };
      if (!token) {
        summaries.push(item);
        continue;
      }
      try {
        const pageUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}?access_token=${encodeURIComponent(token)}&fields=fan_count,name`;
        const pageRes = await httpsRequest(pageUrl).catch(() => ({}));
        if (pageRes && !pageRes.error && pageRes.fan_count != null) {
          item.fan_count = pageRes.fan_count;
          if (pageRes.name) item.pageName = pageRes.name;
        }
      } catch (_) { /* ignore */ }
      try {
        const postFields = 'id,message,created_time,comments.summary(true),reactions.summary(true)';
        let postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/posts?access_token=${encodeURIComponent(token)}&fields=${postFields}&limit=25`;
        if (sinceTimestamp) postsUrl += `&since=${sinceTimestamp}`;
        const postsRes = await httpsRequest(postsUrl).catch(() => ({}));
        if (postsRes && postsRes.data && Array.isArray(postsRes.data)) {
          let totalComments = 0;
          let totalReactions = 0;
          let lastDate = item.lastInteractionAt ? new Date(item.lastInteractionAt) : null;
          const withCount = [];
          for (const post of postsRes.data) {
            const count = (post.comments && post.comments.summary && post.comments.summary.total_count) || 0;
            const reactions = (post.reactions && post.reactions.summary && (post.reactions.summary.total_count != null ? post.reactions.summary.total_count : post.reactions.summary.like_count)) || 0;
            totalComments += count;
            totalReactions += reactions;
            if (post.created_time) {
              const d = new Date(post.created_time);
              if (!lastDate || d > lastDate) lastDate = d;
            }
            withCount.push({ id: post.id, message: (post.message || '').slice(0, 200), created_time: post.created_time, comments_count: count, reactions_count: reactions });
          }
          item.commentsCount = totalComments;
          item.reactionsCount = totalReactions;
          item.postsCount = postsRes.data.length;
          item.totalInteractions = totalComments + totalReactions;
          item.avgCommentsPerPost = postsRes.data.length ? Math.round((totalComments / postsRes.data.length) * 10) / 10 : null;
          if (lastDate) item.lastInteractionAt = lastDate.toISOString();
          item.avgReactionsPerPost = postsRes.data.length ? Math.round((totalReactions / postsRes.data.length) * 10) / 10 : null;
          item.topPosts = withCount.sort((a, b) => ((b.comments_count + b.reactions_count) - (a.comments_count + a.reactions_count))).slice(0, 5);
        } else {
          item.postsCount = 0;
          item.commentsCount = 0;
          item.reactionsCount = 0;
          item.totalInteractions = 0;
          item.topPosts = [];
        }
      } catch (_) {
        item.postsCount = 0;
        item.commentsCount = 0;
        item.reactionsCount = 0;
        item.totalInteractions = 0;
        item.topPosts = [];
      }
      summaries.push(item);
    }
    return res.json({ success: true, pages: summaries });
  } catch (error) {
    console.error('Erreur GET /pages/summary:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/facebook/pages/:pageId/summary
 * Résumé détaillé pour une seule page : stats, évolution vs période précédente.
 * Query: since (ISO date) optionnel, periodDays (nombre, défaut 30) pour l'évolution.
 */
router.get('/pages/:pageId/summary', authenticateJWT, async (req, res) => {
  try {
    const { pageId } = req.params;
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const sinceParam = req.query.since;
    const periodDays = Math.max(1, parseInt(req.query.periodDays || '30', 10) || 30);
    const sinceDate = sinceParam ? new Date(sinceParam) : null;
    const sinceTimestamp = sinceDate ? Math.floor(sinceDate.getTime() / 1000) : null;
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ entrepriseId, pageId });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Page non trouvée' });
    }
    const token = config.pageAccessToken;
    const pageName = config.pageName || `Page ${pageId}`;
    const item = {
      pageId,
      pageName,
      fan_count: null,
      postsCount: 0,
      commentsCount: 0,
      reactionsCount: 0,
      totalInteractions: 0,
      avgCommentsPerPost: null,
      avgReactionsPerPost: null,
      lastInteractionAt: config.lastInteractionAt ? new Date(config.lastInteractionAt).toISOString() : null,
      topPosts: [],
      period: { since: sinceParam, days: periodDays },
      previous: null,
      evolution: null
    };
    if (!token) {
      return res.json({ success: true, page: item });
    }
    try {
      const pageUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}?access_token=${encodeURIComponent(token)}&fields=fan_count,name`;
      const pageRes = await httpsRequest(pageUrl).catch(() => ({}));
      if (pageRes && !pageRes.error && pageRes.fan_count != null) {
        item.fan_count = pageRes.fan_count;
        if (pageRes.name) item.pageName = pageRes.name;
      }
    } catch (_) { /* ignore */ }

    const now = new Date();
    const sinceForFetch = sinceDate || new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const prevStart = new Date(sinceForFetch.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const sinceForFetchTs = Math.floor(sinceForFetch.getTime() / 1000);
    const prevStartTs = Math.floor(prevStart.getTime() / 1000);

    try {
      const fields = 'id,message,created_time,comments.summary(true),reactions.summary(true)';
      let postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/posts?access_token=${encodeURIComponent(token)}&fields=${fields}&limit=100`;
      postsUrl += `&since=${prevStartTs}`;
      const postsRes = await httpsRequest(postsUrl).catch(() => ({}));
      if (!postsRes || !postsRes.data || !Array.isArray(postsRes.data)) {
        return res.json({ success: true, page: item });
      }
      const allPosts = postsRes.data.map(p => {
        const comments = (p.comments && p.comments.summary && p.comments.summary.total_count) || 0;
        const reactions = (p.reactions && p.reactions.summary && p.reactions.summary.total_count) != null
          ? p.reactions.summary.total_count
          : (p.reactions && p.reactions.summary && p.reactions.summary.like_count) != null ? p.reactions.summary.like_count : 0;
        return {
          id: p.id,
          message: (p.message || '').slice(0, 200),
          created_time: p.created_time,
          comments_count: comments,
          reactions_count: reactions,
          created_at: new Date(p.created_time)
        };
      });

      const currentPosts = allPosts.filter(p => p.created_at >= sinceForFetch);
      const previousPosts = allPosts.filter(p => p.created_at < sinceForFetch);

      const sum = (arr, key) => arr.reduce((a, p) => a + (p[key] || 0), 0);
      const currentPostsCount = currentPosts.length;
      const currentComments = sum(currentPosts, 'comments_count');
      const currentReactions = sum(currentPosts, 'reactions_count');
      const previousPostsCount = previousPosts.length;
      const previousComments = sum(previousPosts, 'comments_count');
      const previousReactions = sum(previousPosts, 'reactions_count');

      item.postsCount = currentPostsCount;
      item.commentsCount = currentComments;
      item.reactionsCount = currentReactions;
      item.totalInteractions = currentComments + currentReactions;
      item.avgCommentsPerPost = currentPostsCount > 0 ? Math.round((currentComments / currentPostsCount) * 10) / 10 : null;
      item.avgReactionsPerPost = currentPostsCount > 0 ? Math.round((currentReactions / currentPostsCount) * 10) / 10 : null;

      const lastPost = currentPosts.length ? currentPosts.reduce((a, b) => a.created_at > b.created_at ? a : b) : null;
      if (lastPost && (!item.lastInteractionAt || new Date(lastPost.created_time) > new Date(item.lastInteractionAt))) {
        item.lastInteractionAt = new Date(lastPost.created_time).toISOString();
      }

      item.topPosts = [...currentPosts]
        .sort((a, b) => (b.comments_count + b.reactions_count) - (a.comments_count + a.reactions_count))
        .slice(0, 5)
        .map(p => ({ id: p.id, message: p.message, created_time: p.created_time, comments_count: p.comments_count, reactions_count: p.reactions_count }));

      item.previous = {
        postsCount: previousPostsCount,
        commentsCount: previousComments,
        reactionsCount: previousReactions,
        totalInteractions: previousComments + previousReactions
      };

      const pct = (curr, prev) => (prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100));
      item.evolution = {
        postsPercent: pct(currentPostsCount, previousPostsCount),
        commentsPercent: pct(currentComments, previousComments),
        reactionsPercent: pct(currentReactions, previousReactions),
        interactionsPercent: pct(currentComments + currentReactions, previousComments + previousReactions)
      };
    } catch (_) { /* ignore */ }
    return res.json({ success: true, page: item });
  } catch (error) {
    console.error('Erreur GET /pages/:pageId/summary:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/facebook/pages/pull
 * Déclenche un pull (récupération posts/commentaires) pour toutes les pages connectées de l'entreprise. Authentifié.
 */
router.post('/pages/pull', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const configCollection = database.getCollection('facebook_configs');
    const configs = await configCollection.find({ entrepriseId, pageAccessToken: { $exists: true, $ne: null } }).toArray();
    if (configs.length === 0) {
      return res.json({ success: true, message: 'Aucune page connectée', triggered: 0 });
    }
    if (!pollingService) {
      pollingService = new PollingService(database);
      await pollingService.init();
    }
    let triggered = 0;
    for (const config of configs) {
      try {
        pollingService.pullMessages(config.pageId, config.pageAccessToken).catch(() => {});
        triggered++;
      } catch (_) { /* ignore */ }
    }
    return res.status(202).json({
      success: true,
      message: `Pull démarré pour ${triggered} page(s)`,
      triggered
    });
  } catch (error) {
    console.error('Erreur POST /pages/pull:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/facebook/pages/refresh
 * Récupère les nouvelles pages disponibles sans refaire OAuth (utilise le token stocké)
 */
router.get('/pages/refresh', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    // Récupérer un userAccessToken depuis une configuration existante
    const configCollection = database.getCollection('facebook_configs');
    const existingConfig = await configCollection.findOne({ 
      entrepriseId: entrepriseId,
      userAccessToken: { $exists: true, $ne: null }
    });
    
    if (!existingConfig || !existingConfig.userAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Aucun token utilisateur trouvé. Veuillez vous connecter avec Facebook d\'abord.'
      });
    }
    
    // Rafraîchir proactivement le token utilisateur s'il est proche d'expirer
    if (existingConfig.userTokenExpiresAt) {
      const exp = new Date(existingConfig.userTokenExpiresAt);
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (exp.getTime() - Date.now() < oneDayMs) {
        const refreshed = await exchangeForLongLivedUserToken(existingConfig.userAccessToken);
        if (refreshed && refreshed.access_token) {
          const newExp = computeTokenExpiry(refreshed.expires_in);
          await configCollection.updateMany(
            { entrepriseId: entrepriseId, userAccessToken: { $exists: true, $ne: null } },
            {
              $set: {
                userAccessToken: refreshed.access_token,
                userTokenType: 'long_lived',
                userTokenExpiresAt: newExp || null,
                tokenStatus: 'active',
                updated_at: new Date()
              }
            }
          );
          existingConfig.userAccessToken = refreshed.access_token;
        }
      }
    }

    // Récupérer toutes les pages de l'utilisateur
    let pagesResponse;
    try {
      pagesResponse = await getUserPages(existingConfig.userAccessToken);
    } catch (error) {
      console.error('❌ Erreur récupération pages:', error);
      if (isTokenInvalidError(error)) {
        await configCollection.updateMany(
          { entrepriseId: entrepriseId, userAccessToken: { $exists: true, $ne: null } },
          {
            $set: {
              tokenStatus: 'reauth_required',
              tokenLastError: String(error.message || 'token_invalid'),
              tokenLastErrorAt: new Date(),
              updated_at: new Date()
            }
          }
        );
      }
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des pages. Le token a peut-être expiré, veuillez vous reconnecter.'
      });
    }
    
    // La réponse Facebook peut être directement un objet avec data ou un tableau
    let pages = [];
    if (Array.isArray(pagesResponse)) {
      pages = pagesResponse;
    } else if (pagesResponse.data && Array.isArray(pagesResponse.data)) {
      pages = pagesResponse.data;
    } else if (pagesResponse.error) {
      console.error('❌ Erreur API Facebook:', pagesResponse.error);
      return res.status(500).json({
        success: false,
        message: pagesResponse.error.message || 'Erreur API Facebook'
      });
    }
    
    // Filtrer les pages déjà connectées
    const existingConfigs = await configCollection.find({ entrepriseId: entrepriseId }).toArray();
    const existingPageIds = new Set(existingConfigs.map(c => c.pageId));
    
    // Séparer les pages nouvelles et existantes
    const newPages = pages.filter(p => !existingPageIds.has(p.id));
    const existingPages = pages.filter(p => existingPageIds.has(p.id));
    
    res.json({
      success: true,
      allPages: pages.length,
      existingPages: existingPages.length,
      newPages: newPages.length,
      pages: newPages.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        tasks: p.tasks,
        access_token: p.access_token
      }))
    });
    
  } catch (error) {
    console.error('Erreur refresh pages:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/pages/token-health
 * Retourne l'état des tokens par page (active / reauth_required).
 */
router.get('/pages/token-health', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'entrepriseId requis' });
    }
    const configCollection = database.getCollection('facebook_configs');
    const pages = await configCollection
      .find({ entrepriseId: String(entrepriseId) })
      .project({ pageId: 1, pageName: 1, tokenStatus: 1, userTokenExpiresAt: 1, tokenLastError: 1, tokenLastErrorAt: 1 })
      .toArray();
    return res.json({
      success: true,
      pages: pages.map((p) => ({
        pageId: p.pageId || '',
        pageName: p.pageName || '',
        tokenStatus: p.tokenStatus || 'active',
        userTokenExpiresAt: p.userTokenExpiresAt || null,
        tokenLastError: p.tokenLastError || null,
        tokenLastErrorAt: p.tokenLastErrorAt || null
      }))
    });
  } catch (error) {
    console.error('Erreur GET /pages/token-health:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/facebook/config
 * Supprime la configuration Facebook de l'entreprise
 * @deprecated Utilisez DELETE /api/facebook/pages/:pageId pour supprimer une page spécifique
 */
router.delete('/config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const { pageId } = req.query; // Optionnel : supprimer une page spécifique
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    
    // Si pageId fourni, supprimer uniquement cette page
    // Sinon, supprimer toutes les pages de l'entreprise (comportement legacy)
    if (pageId) {
      await configCollection.deleteOne({ 
        entrepriseId: entrepriseId,
        pageId: pageId 
      });
      res.json({
        success: true,
        message: `Page Facebook ${pageId} supprimée avec succès`
      });
    } else {
      // Comportement legacy : supprimer toutes les pages (attention !)
      const result = await configCollection.deleteMany({ entrepriseId: entrepriseId });
      res.json({
        success: true,
        message: `${result.deletedCount} page(s) Facebook supprimée(s) avec succès`
      });
    }
  } catch (error) {
    console.error('Erreur suppression config Facebook:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/facebook/config
 * Sauvegarde la configuration Facebook de l'entreprise (route legacy - une seule page)
 * @deprecated Utilisez POST /api/facebook/pages/save pour gérer plusieurs pages
 */
router.post('/config', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const user_id = req.user.user_id;
    const { pageId, pageAccessToken } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    if (!pageId || !pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'pageId et pageAccessToken sont requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    
    // IMPORTANT: Inclure pageId dans le filtre pour éviter d'écraser d'autres pages
    await configCollection.updateOne(
      { 
        entrepriseId: entrepriseId,
        pageId: pageId  // Filtrer par pageId pour éviter d'écraser d'autres pages
      },
      {
        $set: {
          entrepriseId: entrepriseId,
          pageId: pageId,
          pageAccessToken: pageAccessToken,
          updated_at: new Date(),
          updated_by: user_id
        }
      },
      { upsert: true }
    );
    
    res.json({
      success: true,
      message: 'Configuration Facebook sauvegardée avec succès'
    });
  } catch (error) {
    console.error('Erreur sauvegarde config Facebook:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Fonction utilitaire pour faire des requêtes HTTPS GET
 */
function httpsRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Vérifier si c'est une erreur HTTP
          if (res.statusCode !== 200) {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          // Si ce n'est pas du JSON, vérifier le status code
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Erreur réseau: ${err.message}`));
    });
  });
}

/**
 * Fonction utilitaire pour faire des requêtes HTTPS POST
 */
function httpsPostRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = new URLSearchParams();
    
    // Convertir l'objet data en URLSearchParams
    Object.keys(data).forEach(key => {
      postData.append(key, data[key]);
    });
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData.toString())
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          // Vérifier si c'est une erreur HTTP
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}: ${responseData}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          // Si ce n'est pas du JSON, vérifier le status code
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          } else {
            resolve(responseData);
          }
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Erreur réseau: ${err.message}`));
    });
    
    req.write(postData.toString());
    req.end();
  });
}

/**
 * Échange le code OAuth contre un access token
 */
async function exchangeCodeForToken(code) {
  const appConfig = await getFacebookAppConfig();
  
  if (!appConfig.appId || !appConfig.appSecret) {
    throw new Error('Configuration Facebook manquante (App ID ou App Secret)');
  }
  
  // Utiliser directement l'API Graph Facebook (plus simple et fiable)
  const tokenUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token?` +
    `client_id=${appConfig.appId}&` +
    `client_secret=${appConfig.appSecret}&` +
    `redirect_uri=${encodeURIComponent(appConfig.redirectUri)}&` +
    `code=${code}`;
  
  console.log('🔄 Échange du code OAuth contre un token...');
  const response = await httpsRequest(tokenUrl);
  
  if (response.error) {
    throw new Error(response.error.message || 'Erreur lors de l\'échange du code');
  }
  
  return response;
}

/**
 * Échange un token utilisateur court terme contre un long-lived token.
 */
async function exchangeForLongLivedUserToken(shortLivedToken) {
  const appConfig = await getFacebookAppConfig();
  if (!appConfig.appId || !appConfig.appSecret || !shortLivedToken) {
    return null;
  }
  const tokenUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${appConfig.appId}&` +
    `client_secret=${appConfig.appSecret}&` +
    `fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
  try {
    const response = await httpsRequest(tokenUrl);
    if (response && response.access_token) {
      return response;
    }
  } catch (error) {
    console.warn('⚠️ Échange long-lived token échoué:', error.message);
  }
  return null;
}

function computeTokenExpiry(expiresInSeconds) {
  const n = Number(expiresInSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 1000);
}

function isTokenInvalidError(error) {
  const msg = String(error && error.message ? error.message : error || '').toLowerCase();
  return msg.includes('oauth') || msg.includes('access token') || msg.includes('error validating access token') || msg.includes('code 190');
}

/**
 * Récupère les pages Facebook de l'utilisateur
 */
async function getUserPages(accessToken) {
  // Utiliser directement l'API Graph Facebook
  const pagesUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/accounts?` +
    `access_token=${accessToken}&` +
    `fields=id,name,access_token,category,tasks`;
  
  console.log('📄 Récupération des pages Facebook...');
  const response = await httpsRequest(pagesUrl);
  
  if (response.error) {
    throw new Error(response.error.message || 'Erreur lors de la récupération des pages');
  }
  
  // La réponse de Facebook est directement un objet avec data
  return response;
}

/**
 * GET /api/facebook/oauth/reauth
 * Réactive une session PHP après retour OAuth sans accès DB côté PHP
 */
router.get('/oauth/reauth', async (req, res) => {
  try {
    const token = (req.query.token || '').toString().trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'token requis' });
    }

    const reauthCollection = database.getCollection('facebook_oauth_reauth');
    const reauthDoc = await reauthCollection.findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!reauthDoc) {
      return res.status(404).json({ success: false, message: 'Token de réauthentification invalide ou expiré' });
    }

    const usersCollection = database.getCollection('users');
    const userIdRaw = reauthDoc.userId ? String(reauthDoc.userId) : '';
    let user = null;
    if (userIdRaw) {
      user = await usersCollection.findOne({ _id: userIdRaw });
      if (!user) {
        const { ObjectId } = require('mongodb');
        if (ObjectId.isValid(userIdRaw)) {
          user = await usersCollection.findOne({ _id: new ObjectId(userIdRaw) });
        }
      }
    }

    if (!user) {
      await reauthCollection.deleteOne({ token });
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable pour ce token' });
    }

    await reauthCollection.deleteOne({ token });

    return res.json({
      success: true,
      data: {
        userId: String(user._id || ''),
        role: user.role || 'USER_ENTITY',
        email: user.email || '',
        entrepriseId: reauthDoc.entrepriseId ? String(reauthDoc.entrepriseId) : ''
      }
    });
  } catch (error) {
    console.error('Erreur route GET /api/facebook/oauth/reauth:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur interne serveur' });
  }
});

/**
 * GET /api/facebook/oauth/login
 * Redirige vers Facebook OAuth pour l'authentification
 */
router.get('/oauth/login', authenticateJWT, async (req, res) => {
  try {
    console.log('\n🔐 ===== OAUTH LOGIN FACEBOOK =====');
    console.log('  👤 Utilisateur GDRI authentifié:', req.user.email);
    console.log('  🏢 Entreprise:', req.user.entrepriseId);
    console.log('  📝 Note: L\'authentification JWT avec le compte GDRI est normale.');
    console.log('  🔄 L\'utilisateur sera maintenant redirigé vers Facebook pour se connecter avec son compte Facebook personnel.');
    
    const appConfig = await getFacebookAppConfig();
    
    if (!appConfig.appId) {
      console.error('  ❌ FACEBOOK_APP_ID non configuré');
      return res.status(500).json({
        success: false,
        message: 'FACEBOOK_APP_ID non configuré. Veuillez configurer les identifiants de l\'application Facebook dans les paramètres.'
      });
    }
    
    const entrepriseId = req.user.entrepriseId;
    if (!entrepriseId) {
      console.error('  ❌ entrepriseId manquant');
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    // Permissions nécessaires pour gérer les pages
    // Note: pages_messaging nécessite une révision d'app par Facebook
    // Si l'app n'est pas encore approuvée, cette permission sera ignorée par Facebook
    // Les utilisateurs finaux n'ont PAS besoin d'aller sur Facebook Developer
    // Une fois l'app approuvée, ils pourront autoriser cette permission via OAuth normalement
    const scopes = [
      'pages_show_list',      // Lister les pages
      'pages_read_engagement', // Lire les posts et commentaires
      'pages_manage_posts',    // Gérer les posts (nécessaire pour la révision Facebook)
      'pages_messaging'        // Messages privés (nécessite révision d'app - sera ignoré si non approuvé)
    ].join(',');
    
    // State pour sécuriser le callback (inclure l'entrepriseId)
    const state = Buffer.from(JSON.stringify({ 
      entrepriseId: entrepriseId,
      userId: req.user.user_id,
      timestamp: Date.now()
    })).toString('base64');
    
    // Sauvegarder le state temporairement
    const stateCollection = database.getCollection('facebook_oauth_states');
    stateCollection.insertOne({
      state: state,
      entrepriseId: entrepriseId,
      userId: req.user.user_id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }).catch(err => console.error('Erreur sauvegarde state:', err));
    
    // Générer l'URL OAuth Facebook
    const authUrl = `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth?` +
      `client_id=${appConfig.appId}&` +
      `redirect_uri=${encodeURIComponent(appConfig.redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${encodeURIComponent(state)}&` +
      `response_type=code`;
    
    console.log('  ✅ URL OAuth Facebook générée');
    console.log('  🔗 Redirection vers:', authUrl.substring(0, 100) + '...');
    console.log('  ⚠️  IMPORTANT: L\'utilisateur doit se connecter avec son COMPTE FACEBOOK PERSONNEL, pas avec son compte GDRI');
    console.log('==========================================\n');
    
    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('❌ Erreur OAuth login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de l\'URL OAuth: ' + error.message
    });
  }
});

/**
 * GET /api/facebook/oauth/callback
 * Reçoit le callback de Facebook OAuth
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`/frontend/pages/modules/facebook-config.php?error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state) {
      return res.redirect('/frontend/pages/modules/facebook-config.php?error=missing_params');
    }
    
    // Vérifier le state
    const stateCollection = database.getCollection('facebook_oauth_states');
    const stateDoc = await stateCollection.findOne({ state: state });
    
    if (!stateDoc) {
      return res.redirect('/frontend/pages/modules/facebook-config.php?error=invalid_state');
    }
    
    // Vérifier l'expiration
    if (new Date() > stateDoc.expiresAt) {
      await stateCollection.deleteOne({ state: state });
      return res.redirect('/frontend/pages/modules/facebook-config.php?error=expired_state');
    }
    
    const { entrepriseId, userId } = stateDoc;
    
    // Échanger le code contre un access token avec le SDK Facebook
    let tokenResponse;
    try {
      tokenResponse = await exchangeCodeForToken(code);
    } catch (error) {
      console.error('Erreur échange token:', error);
      return res.redirect(`/frontend/pages/modules/facebook-config.php?error=${encodeURIComponent(error.message || 'Erreur lors de l\'échange du code')}`);
    }
    
    if (tokenResponse.error) {
      console.error('Erreur échange token:', tokenResponse.error);
      return res.redirect(`/frontend/pages/modules/facebook-config.php?error=${encodeURIComponent(tokenResponse.error.message)}`);
    }
    
    let userAccessToken = tokenResponse.access_token;
    let userTokenExpiresAt = computeTokenExpiry(tokenResponse.expires_in);
    let userTokenType = 'short_lived';
    const longLived = await exchangeForLongLivedUserToken(userAccessToken);
    if (longLived && longLived.access_token) {
      userAccessToken = longLived.access_token;
      userTokenType = 'long_lived';
      userTokenExpiresAt = computeTokenExpiry(longLived.expires_in) || userTokenExpiresAt;
    }
    
    if (!userAccessToken) {
      console.error('❌ Pas de token dans la réponse:', tokenResponse);
      return res.redirect('/frontend/pages/modules/facebook-config.php?error=no_token_received');
    }
    
    console.log('✅ Token reçu, récupération des pages...');
    
    // Récupérer les pages de l'utilisateur
    let pagesResponse;
    try {
      pagesResponse = await getUserPages(userAccessToken);
    } catch (error) {
      console.error('❌ Erreur récupération pages:', error);
      return res.redirect(`/frontend/pages/modules/facebook-config.php?error=${encodeURIComponent(error.message || 'Erreur lors de la récupération des pages')}`);
    }
    
    // La réponse Facebook peut être directement un objet avec data ou un tableau
    let pages = [];
    if (Array.isArray(pagesResponse)) {
      pages = pagesResponse;
    } else if (pagesResponse.data && Array.isArray(pagesResponse.data)) {
      pages = pagesResponse.data;
    } else if (pagesResponse.error) {
      console.error('❌ Erreur API Facebook:', pagesResponse.error);
      return res.redirect(`/frontend/pages/modules/facebook-config.php?error=${encodeURIComponent(pagesResponse.error.message || 'Erreur API Facebook')}`);
    }
    
    console.log(`✅ ${pages.length} page(s) trouvée(s)`);
    
    if (pages.length === 0) {
      return res.redirect('/frontend/pages/modules/facebook-config.php?error=no_pages');
    }
    
    // Filtrer les pages déjà connectées pour cette entreprise
    const configCollection = database.getCollection('facebook_configs');
    const existingConfigs = await configCollection.find({ entrepriseId: entrepriseId }).toArray();
    const existingPageIds = new Set(existingConfigs.map(c => c.pageId));
    
    // Séparer les pages nouvelles et existantes
    const newPages = pages.filter(p => !existingPageIds.has(p.id));
    const existingPages = pages.filter(p => existingPageIds.has(p.id));
    
    console.log(`📊 Pages existantes: ${existingPages.length}, Nouvelles pages: ${newPages.length}`);
    
    // Si toutes les pages sont déjà connectées, informer l'utilisateur
    if (newPages.length === 0) {
      return res.redirect('/frontend/pages/modules/facebook-config.php?error=all_pages_already_connected');
    }
    
    // Si une seule nouvelle page, la sauvegarder automatiquement avec webhooks par défaut
    if (newPages.length === 1) {
      const page = newPages[0];
      const configCollection = database.getCollection('facebook_configs');
      
      await configCollection.updateOne(
        { 
          entrepriseId: entrepriseId,
          pageId: page.id
        },
        {
          $set: {
            entrepriseId: entrepriseId,
            pageId: page.id,
            pageAccessToken: page.access_token,
            pageName: page.name,
            userAccessToken: userAccessToken,
            userTokenType,
            userTokenExpiresAt: userTokenExpiresAt || null,
            tokenStatus: 'active',
            updated_at: new Date(),
            updated_by: userId
          }
        },
        { upsert: true }
      );
      
      // Faire un appel API avec pages_manage_posts pour satisfaire la révision Facebook
      // Cet appel valide l'utilisation de la permission pages_manage_posts
      try {
        const postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${page.id}/posts?` +
          `access_token=${page.access_token}&` +
          `fields=id,message,created_time&` +
          `limit=1`;
        
        console.log(`📄 Appel API pages_manage_posts pour ${page.id} (validation révision)...`);
        await httpsRequest(postsUrl);
        console.log(`✅ Appel API pages_manage_posts réussi pour ${page.id}`);
      } catch (apiError) {
        // Ne pas bloquer la sauvegarde si l'appel échoue
        console.warn(`⚠️  Appel API pages_manage_posts échoué pour ${page.id}:`, apiError.message);
      }
      
      // Faire un appel API avec pages_messaging pour satisfaire la révision Facebook
      // Cet appel valide l'utilisation de la permission pages_messaging
      try {
        const conversationsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${page.id}/conversations?` +
          `access_token=${page.access_token}&` +
          `fields=id,updated_time&` +
          `limit=1`;
        
        console.log(`💬 Appel API pages_messaging pour ${page.id} (validation révision)...`);
        await httpsRequest(conversationsUrl);
        console.log(`✅ Appel API pages_messaging réussi pour ${page.id}`);
      } catch (apiError) {
        // Ne pas bloquer la sauvegarde si l'appel échoue
        const errorMessage = apiError.message || '';
        const isPermissionError = errorMessage.includes('pages_messaging') || 
                                  errorMessage.includes('#200') ||
                                  errorMessage.includes('Requires permission');
        
        if (isPermissionError) {
          console.warn(`⚠️  Permission pages_messaging non disponible pour ${page.id}`);
          console.warn(`   📋 Cette permission nécessite une révision d'app par Facebook.`);
          console.warn(`   🔗 Guide: install/OBTENIR-PERMISSION-PAGES-MESSAGING.md`);
        } else {
          console.warn(`⚠️  Appel API pages_messaging échoué pour ${page.id}:`, apiError.message);
        }
      }
      
      // Nettoyer le state
      await stateCollection.deleteOne({ state: state });
      
      // Générer un token de réauthentification temporaire pour maintenir la session PHP
      const crypto = require('crypto');
      const reauthToken = crypto.randomBytes(32).toString('hex');
      const reauthCollection = database.getCollection('facebook_oauth_reauth');
      await reauthCollection.insertOne({
        token: reauthToken,
        userId: userId,
        entrepriseId: entrepriseId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      });
      
      return res.redirect(`/frontend/pages/modules/facebook-config.php?success=connected&pageId=${page.id}&reauth=${encodeURIComponent(reauthToken)}`);
    }
    
    // Si plusieurs nouvelles pages, sauvegarder temporairement pour que l'utilisateur configure les webhooks
    // Utiliser uniquement les nouvelles pages (pas celles déjà connectées)
    await stateCollection.updateOne(
      { state: state },
      {
        $set: {
          userAccessToken: userAccessToken,
          userTokenType,
          userTokenExpiresAt: userTokenExpiresAt || null,
          pages: newPages, // Seulement les nouvelles pages
          step: 'configure_pages'
        }
      }
    );
    
    // Générer un token de réauthentification temporaire pour maintenir la session PHP
    const crypto = require('crypto');
    const reauthToken = crypto.randomBytes(32).toString('hex');
    const reauthCollection = database.getCollection('facebook_oauth_reauth');
    await reauthCollection.insertOne({
      token: reauthToken,
      userId: userId,
      entrepriseId: entrepriseId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes pour configurer
    });
    
    // Rediriger vers la page de configuration avec toutes les pages en onglets
    return res.redirect(`/frontend/pages/modules/facebook-config.php?state=${encodeURIComponent(state)}&step=configure_pages&reauth=${encodeURIComponent(reauthToken)}`);
    
  } catch (error) {
    console.error('Erreur callback OAuth:', error);
    return res.redirect(`/frontend/pages/modules/facebook-config.php?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/facebook/oauth/select-page
 * Sélectionne une page après l'authentification OAuth
 */
router.post('/oauth/select-page', authenticateJWT, async (req, res) => {
  try {
    const { state, pageId } = req.body;
    const entrepriseId = req.user.entrepriseId;
    const userId = req.user.user_id;
    
    if (!state || !pageId) {
      return res.status(400).json({
        success: false,
        message: 'state et pageId requis'
      });
    }
    
    // Récupérer les données du state
    const stateCollection = database.getCollection('facebook_oauth_states');
    const stateDoc = await stateCollection.findOne({ state: state });
    
    if (!stateDoc || !stateDoc.pages) {
      return res.status(400).json({
        success: false,
        message: 'State invalide ou expiré'
      });
    }
    
    // Trouver la page sélectionnée
    const selectedPage = stateDoc.pages.find(p => p.id === pageId);
    
    if (!selectedPage) {
      return res.status(400).json({
        success: false,
        message: 'Page non trouvée'
      });
    }
    
    // Sauvegarder la configuration
    const configCollection = database.getCollection('facebook_configs');
    
    // Support de plusieurs pages : utiliser entrepriseId + pageId comme clé unique
    await configCollection.updateOne(
      { 
        entrepriseId: entrepriseId,
        pageId: selectedPage.id
      },
      {
        $set: {
          entrepriseId: entrepriseId,
          pageId: selectedPage.id,
          pageAccessToken: selectedPage.access_token,
          pageName: selectedPage.name,
          userAccessToken: stateDoc.userAccessToken,
          userTokenType: stateDoc.userTokenType || null,
          userTokenExpiresAt: stateDoc.userTokenExpiresAt || null,
          tokenStatus: 'active',
          updated_at: new Date(),
          updated_by: userId
        }
      },
      { upsert: true }
    );
    
    // Nettoyer le state
    await stateCollection.deleteOne({ state: state });
    
    res.json({
      success: true,
      message: 'Page sélectionnée et configuration sauvegardée',
      pageId: selectedPage.id,
      pageName: selectedPage.name
    });
    
  } catch (error) {
    console.error('Erreur sélection page:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/facebook/oauth/pages
 * Récupère les pages disponibles depuis le state OAuth
 */
router.get('/oauth/pages', authenticateJWT, async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        message: 'state requis'
      });
    }
    
    const stateCollection = database.getCollection('facebook_oauth_states');
    const stateDoc = await stateCollection.findOne({ state: state });
    
    if (!stateDoc || !stateDoc.pages) {
      return res.status(400).json({
        success: false,
        message: 'State invalide ou expiré'
      });
    }
    
    res.json({
      success: true,
      pages: stateDoc.pages.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        tasks: p.tasks
      }))
    });
    
  } catch (error) {
    console.error('Erreur récupération pages:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Fonction helper pour sauvegarder plusieurs pages avec leurs webhooks
 */
async function savePagesHandler(req, res) {
  try {
    const { state, pages, pagesData } = req.body; // pages: [{ pageId, webhooks: [...] }], pagesData: [{ id, name, access_token }]
    const entrepriseId = req.user.entrepriseId;
    const userId = req.user.user_id;
    
    if (!pages || !Array.isArray(pages)) {
      return res.status(400).json({
        success: false,
        message: 'pages (tableau) requis'
      });
    }
    
    let userAccessToken = null;
    let pagesFromState = [];
    let stateCollection = null;
    let oauthStateDoc = null;
    
    // Si state fourni, récupérer depuis OAuth state
    if (state) {
      stateCollection = database.getCollection('facebook_oauth_states');
      const stateDoc = await stateCollection.findOne({ state: state });
      
      if (!stateDoc || !stateDoc.pages) {
        return res.status(400).json({
          success: false,
          message: 'State invalide ou expiré'
        });
      }
      
      userAccessToken = stateDoc.userAccessToken;
      pagesFromState = stateDoc.pages;
      oauthStateDoc = stateDoc;
    } else if (pagesData && Array.isArray(pagesData)) {
      // Utiliser les données fournies directement (cas du refresh)
      pagesFromState = pagesData;
      // Récupérer le userAccessToken depuis une config existante
      const configCollection = database.getCollection('facebook_configs');
      const existingConfig = await configCollection.findOne({ 
        entrepriseId: entrepriseId,
        userAccessToken: { $exists: true, $ne: null }
      });
      if (existingConfig) {
        userAccessToken = existingConfig.userAccessToken;
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'state ou pagesData requis'
      });
    }
    
    const configCollection = database.getCollection('facebook_configs');
    const appConfig = await getFacebookAppConfig();
    const webhookUrl = appConfig.redirectUri.replace('/oauth/callback', '/webhook');
    const subscriptionService = new WebhookSubscriptionService();
    
    const results = [];
    
    // Sauvegarder chaque page sélectionnée
    for (const pageConfig of pages) {
      const pageId = pageConfig.pageId;
      const webhooks = pageConfig.webhooks || [];
      
      // Trouver la page dans le state ou dans pagesData
      const page = pagesFromState.find(p => p.id === pageId);
      if (!page) {
        results.push({
          pageId: pageId,
          success: false,
          error: 'Page non trouvée'
        });
        continue;
      }
      
      try {
        // Sauvegarder la configuration de la page
        await configCollection.updateOne(
          { 
            entrepriseId: entrepriseId,
            pageId: pageId
          },
          {
            $set: {
              entrepriseId: entrepriseId,
              pageId: pageId,
              pageAccessToken: page.access_token,
              pageName: page.name,
              userAccessToken: userAccessToken,
              userTokenType: oauthStateDoc && oauthStateDoc.userTokenType ? oauthStateDoc.userTokenType : null,
              userTokenExpiresAt: oauthStateDoc && oauthStateDoc.userTokenExpiresAt ? oauthStateDoc.userTokenExpiresAt : null,
              tokenStatus: 'active',
              webhooks_subscribed: webhooks,
              webhooks_updated_at: new Date(),
              updated_at: new Date(),
              updated_by: userId
            }
          },
          { upsert: true }
        );
        
        // Faire un appel API avec pages_manage_posts pour satisfaire la révision Facebook
        // Cet appel valide l'utilisation de la permission pages_manage_posts
        try {
          const postsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/posts?` +
            `access_token=${page.access_token}&` +
            `fields=id,message,created_time&` +
            `limit=1`;
          
          console.log(`📄 Appel API pages_manage_posts pour ${pageId} (validation révision)...`);
          await httpsRequest(postsUrl);
          console.log(`✅ Appel API pages_manage_posts réussi pour ${pageId}`);
        } catch (apiError) {
          // Ne pas bloquer la sauvegarde si l'appel échoue
          console.warn(`⚠️  Appel API pages_manage_posts échoué pour ${pageId}:`, apiError.message);
        }
        
      // Faire un appel API avec pages_messaging pour satisfaire la révision Facebook
      // Cet appel valide l'utilisation de la permission pages_messaging
      try {
        const conversationsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/conversations?` +
          `access_token=${page.access_token}&` +
          `fields=id,updated_time&` +
          `limit=1`;
        
        console.log(`💬 Appel API pages_messaging pour ${pageId} (validation révision)...`);
        await httpsRequest(conversationsUrl);
        console.log(`✅ Appel API pages_messaging réussi pour ${pageId}`);
      } catch (apiError) {
        // Ne pas bloquer la sauvegarde si l'appel échoue
        const errorMessage = apiError.message || '';
        const isPermissionError = errorMessage.includes('pages_messaging') || 
                                  errorMessage.includes('#200') ||
                                  errorMessage.includes('Requires permission');
        
        if (isPermissionError) {
          console.warn(`⚠️  Permission pages_messaging non disponible pour ${pageId}`);
          console.warn(`   📋 Cette permission nécessite une révision d'app par Facebook.`);
          console.warn(`   🔗 Guide: install/OBTENIR-PERMISSION-PAGES-MESSAGING.md`);
        } else {
          console.warn(`⚠️  Appel API pages_messaging échoué pour ${pageId}:`, apiError.message);
        }
      }
        
        // S'abonner aux webhooks si sélectionnés
        if (webhooks.length > 0) {
          try {
            const normalizedWebhooks = webhooks.map(w => w === 'mentions' ? 'mention' : w);
            await subscriptionService.subscribeToWebhooks(
              pageId,
              page.access_token,
              webhookUrl,
              normalizedWebhooks
            );
          } catch (subError) {
            console.warn(`⚠️  Erreur souscription webhooks pour ${pageId}:`, subError.message);
          }
        }
        
        results.push({
          pageId: pageId,
          pageName: page.name,
          success: true,
          webhooks: webhooks
        });
      } catch (error) {
        results.push({
          pageId: pageId,
          success: false,
          error: error.message
        });
      }
    }
    
    // Nettoyer le state si fourni
    if (state && stateCollection) {
      await stateCollection.deleteOne({ state: state });
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: successCount > 0,
      message: `${successCount} page(s) sauvegardée(s)`,
      results: results
    });
    
  } catch (error) {
    console.error('Erreur sauvegarde pages:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /api/facebook/oauth/save-pages
 * Sauvegarde plusieurs pages avec leurs webhooks sélectionnés (route de compatibilité)
 * @deprecated Utilisez /api/facebook/pages/save à la place
 */
router.post('/oauth/save-pages', authenticateJWT, savePagesHandler);

/**
 * POST /api/facebook/pages/save
 * Sauvegarde plusieurs pages avec leurs webhooks sélectionnés
 * Peut fonctionner avec ou sans state OAuth (pour le refresh)
 */
router.post('/pages/save', authenticateJWT, savePagesHandler);

/**
 * GET /api/facebook/app-config
 * Récupère la configuration de l'application Facebook (App ID, App Secret)
 * Seuls ADMIN_GDRI peuvent voir cette configuration
 */
router.get('/app-config', authenticateJWT, async (req, res) => {
  try {
    // Seuls ADMIN_GDRI peuvent voir la configuration de l'application
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent voir cette configuration.'
      });
    }
    
    const appConfigCollection = database.getCollection('facebook_app_config');
    const config = await appConfigCollection.findOne({ type: 'app_credentials' });
    
    if (!config) {
      return res.json({
        success: true,
        config: {
          appId: '',
          appSecret: '',
          redirectUri: DEFAULT_REDIRECT_URI
        },
        configured: false
      });
    }
    
    res.json({
      success: true,
      config: {
        appId: config.appId || '',
        appSecret: config.appSecret ? '***' + config.appSecret.slice(-4) : '', // Masquer le secret
        redirectUri: config.redirectUri || DEFAULT_REDIRECT_URI
      },
      configured: !!(config.appId && config.appSecret)
    });
  } catch (error) {
    console.error('Erreur récupération app config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/facebook/app-config
 * Sauvegarde la configuration de l'application Facebook (App ID, App Secret)
 * Seuls ADMIN_GDRI peuvent modifier cette configuration
 */
router.post('/app-config', authenticateJWT, async (req, res) => {
  try {
    // Seuls ADMIN_GDRI peuvent modifier la configuration de l'application
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent modifier cette configuration.'
      });
    }
    
    const { appId, appSecret, redirectUri } = req.body;
    
    if (!appId || !appSecret) {
      return res.status(400).json({
        success: false,
        message: 'App ID et App Secret sont requis'
      });
    }
    
    const appConfigCollection = database.getCollection('facebook_app_config');
    
    // Vérifier si une configuration existe déjà
    const existingConfig = await appConfigCollection.findOne({ type: 'app_credentials' });
    
    const configToSave = {
      type: 'app_credentials',
      appId: appId.trim(),
      appSecret: appSecret.trim(),
      redirectUri: redirectUri || DEFAULT_REDIRECT_URI,
      updated_at: new Date(),
      updated_by: req.user.user_id
    };
    
    if (existingConfig) {
      // Mettre à jour
      await appConfigCollection.updateOne(
        { type: 'app_credentials' },
        { $set: configToSave }
      );
    } else {
      // Créer
      configToSave.created_at = new Date();
      await appConfigCollection.insertOne(configToSave);
    }
    
    // Reconfigurer le SDK avec les nouveaux identifiants
    await configureFacebookSDK();
    
    res.json({
      success: true,
      message: 'Configuration de l\'application Facebook sauvegardée avec succès'
    });
  } catch (error) {
    console.error('Erreur sauvegarde app config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/facebook/webhooks/subscribe
 * S'abonne aux webhooks sélectionnés pour la page connectée
 */
router.post('/webhooks/subscribe', authenticateJWT, async (req, res) => {
  try {
    const { webhooks, pageId } = req.body;
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    if (!Array.isArray(webhooks)) {
      return res.status(400).json({
        success: false,
        message: 'webhooks doit être un tableau'
      });
    }
    
    // Récupérer la configuration Facebook de l'entreprise
    const configCollection = database.getCollection('facebook_configs');
    let config;
    
    // Si pageId spécifié, chercher cette page spécifique
    if (pageId) {
      config = await configCollection.findOne({ 
        entrepriseId: entrepriseId,
        pageId: pageId
      });
    } else {
      // Sinon, utiliser la page principale
      config = await configCollection.findOne({ entrepriseId: entrepriseId });
    }
    
    if (!config || !config.pageId || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Aucune page Facebook connectée. Veuillez d\'abord connecter une page.'
      });
    }
    
    // Vérifier que le pageId correspond
    if (pageId && config.pageId !== pageId) {
      return res.status(400).json({
        success: false,
        message: 'Page ID ne correspond pas à la configuration'
      });
    }
    
    // Récupérer l'URL du webhook
    const appConfig = await getFacebookAppConfig();
    const webhookUrl = appConfig.redirectUri.replace('/oauth/callback', '/webhook');
    
    // Normaliser les webhooks (mentions -> mention pour compatibilité avec l'API Facebook)
    const normalizedWebhooks = webhooks.map(w => w === 'mentions' ? 'mention' : w);
    
    // S'abonner aux webhooks sélectionnés
    const subscriptionService = new WebhookSubscriptionService();
    const subscriptionResult = await subscriptionService.subscribeToWebhooks(
      config.pageId,
      config.pageAccessToken,
      webhookUrl,
      normalizedWebhooks
    );
    
    // Sauvegarder les préférences de webhooks pour cette page spécifique
    await configCollection.updateOne(
      { 
        entrepriseId: entrepriseId,
        pageId: config.pageId
      },
      {
        $set: {
          webhooks_subscribed: normalizedWebhooks,
          webhooks_updated_at: new Date()
        }
      }
    );
    
    // Construire un message détaillé
    const successCount = subscriptionResult.results.filter(r => r.success).length;
    const failCount = subscriptionResult.results.filter(r => !r.success).length;
    
    let message = '';
    if (successCount === webhooks.length) {
      message = `Tous les webhooks ont été abonnés avec succès (${successCount}/${webhooks.length})`;
    } else if (successCount > 0) {
      message = `${successCount} webhook(s) abonné(s) avec succès, ${failCount} échec(s)`;
    } else {
      message = `Aucun webhook n'a pu être abonné`;
    }
    
    res.json({
      success: subscriptionResult.success,
      message: message,
      results: subscriptionResult.results,
      webhooks: normalizedWebhooks,
      successCount: successCount,
      failCount: failCount
    });
    
  } catch (error) {
    console.error('Erreur abonnement webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'abonnement aux webhooks: ' + error.message
    });
  }
});

/**
 * GET /api/facebook/webhooks/subscribed
 * Récupère les webhooks actuellement abonnés pour la page connectée
 */
router.get('/webhooks/subscribed', authenticateJWT, async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId requis'
      });
    }
    
    // Récupérer la configuration Facebook de l'entreprise
    const configCollection = database.getCollection('facebook_configs');
    const config = await configCollection.findOne({ entrepriseId: entrepriseId });
    
    if (!config) {
      return res.json({
        success: true,
        webhooks: []
      });
    }
    
    res.json({
      success: true,
      webhooks: config.webhooks_subscribed || []
    });
    
  } catch (error) {
    console.error('Erreur récupération webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des webhooks: ' + error.message
    });
  }
});

module.exports = router;

