/**
 * Script de test pour la vidéo de démonstration - Permission business_management
 * 
 * Démontre l'utilisation de business_management pour :
 * - Recevoir des webhooks en temps réel (commentaires, mentions)
 * - Analyser automatiquement les intentions
 * - Router les messages vers les bons services
 * 
 * Usage: node backend/test-webhook-business-management.js
 */

const http = require('http');
const { MongoClient } = require('mongodb');
const database = require('./config/database');
const WebhookService = require('./modules/facebook/services/WebhookService');

// Configuration
const BACKEND_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/facebook/webhook';
const MONGODB_URI = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
const ENTITY_ID = process.env.TEST_ENTITY_ID || process.env.ENTITY_ID || null;
let cachedEntityId = ENTITY_ID || null;

// Message de test pour démontrer business_management
const messageTest = {
  message: `Bonjour, je suis intéressé par vos bateaux pour une location en Méditerranée.
  
J'aimerais connaître les disponibilités pour le mois de juillet et les tarifs.
  
Également, j'ai une question technique concernant la navigation en autonomie.`,
  author: {
    name: 'Marie Dubois',
    id: '987654321098765'
  },
  created_time: new Date().toISOString(),
  like_count: 2,
  replies: []
};

// Structure du webhook Facebook pour un commentaire (business_management)
const webhookFacebook = {
  object: 'page',
  entry: [
    {
      id: '123456789', // Page ID
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          value: {
            from: {
              id: messageTest.author.id,
              name: messageTest.author.name
            },
            item: 'comment',
            comment_id: 'comment_' + Date.now(),
            post_id: 'post_123456789',
            verb: 'add',
            created_time: Math.floor(Date.now() / 1000),
            message: messageTest.message
          },
          field: 'feed'
        }
      ]
    }
  ]
};

let webhookServiceInstance = null;

async function getWebhookServiceInstance() {
  if (!webhookServiceInstance) {
    try {
      await database.connect();
    } catch (error) {
      console.error('❌ Erreur connexion base Mongo (backend):', error.message);
      throw error;
    }

    webhookServiceInstance = new WebhookService(database);
    await webhookServiceInstance.init();
  }
  return webhookServiceInstance;
}

async function resolveEntityId() {
  if (cachedEntityId) {
    return cachedEntityId;
  }

  try {
    const db = await database.connect();
    const entitiesCollection = db.collection('entities');
    const entity = await entitiesCollection.findOne({ name: 'GDR-Innovation' });

    if (entity) {
      cachedEntityId = entity._id.toString();
      console.log(`🆔 Entité GDR-Innovation détectée: ${cachedEntityId}`);
      return cachedEntityId;
    }

    console.log('⚠️  Entité "GDR-Innovation" introuvable dans MongoDB');
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de l\'ID de l\'entité GDRI:', error.message || error);
    return null;
  }
}

// Fonction pour envoyer le webhook
function sendWebhook() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(webhookFacebook);

    console.log('🎬 === DÉMONSTRATION BUSINESS_MANAGEMENT ===');
    console.log('');
    console.log('📋 Ce test démontre l\'utilisation de business_management pour :');
    console.log('   1. Recevoir des webhooks en temps réel');
    console.log('   2. Analyser automatiquement les intentions');
    console.log('   3. Router les messages vers les bons services');
    console.log('');
    console.log('═'.repeat(70));
    console.log('💬 WEBHOOK RECU (via business_management)');
    console.log('═'.repeat(70));
    console.log(`📱 Page ID: ${webhookFacebook.entry[0].id}`);
    console.log(`👤 Auteur: ${messageTest.author.name} (${messageTest.author.id})`);
    console.log(`📅 Date: ${messageTest.created_time}`);
    console.log('');

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/facebook/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 300000 // 5 minutes pour l'analyse IA
    };

    const req = http.request(options, (res) => {
      let data = '';

      console.log(`📡 Réponse du serveur: ${res.statusCode} ${res.statusMessage}`);
      console.log('');

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', async () => {
        if (res.statusCode === 200) {
          console.log('✅ Webhook reçu par le backend !');
          console.log('');
          console.log('⚠️  IMPORTANT: Le backend répond immédiatement à Facebook (200 OK)');
          console.log('   puis traite le webhook en arrière-plan.');
          console.log('');
          console.log('🔍 ATTENTE DES RÉSULTATS DE L\'ANALYSE...');
          console.log('   ⏳ L\'analyse d\'intention peut prendre 2-5 minutes');
          console.log('   📊 Vérification dans MongoDB toutes les 5 secondes...');
          console.log('');
          
          // Attendre les résultats réels
          try {
            const results = await waitForAnalysisResults(messageTest.message);
            resolve({ webhookResponse: data, analysisResults: results });
          } catch (error) {
            console.error('  ❌ Erreur lors de l\'attente des résultats:', error.message);
            resolve({ webhookResponse: data, analysisResults: null });
          }
        } else {
          console.error(`❌ Erreur HTTP ${res.statusCode}`);
          console.error('Réponse:', data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Erreur de connexion: ${e.message}`);
      console.error('');
      console.error('💡 Vérifiez que:');
      console.error('   - Le backend Node.js est démarré');
      console.error('   - Le backend écoute sur le port 3000');
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('❌ Timeout: L\'analyse IA prend trop de temps');
      reject(new Error('Request timeout'));
    });

    req.setTimeout(300000);
    req.write(postData);
    req.end();
  });
}

/**
 * Attend les résultats de l'analyse en vérifiant MongoDB
 * @param {string} messageText - Texte du message à rechercher
 * @returns {Promise<Object>} Résultats de l'analyse
 */
async function waitForAnalysisResults(messageText) {
  const client = new MongoClient(MONGODB_URI);
  let maxAttempts = 60; // 5 minutes max (60 * 5 secondes)
  let attempts = 0;
  
  try {
    await client.connect();
    const db = client.db('GDR-INNOVATION');
    const collection = db.collection('intentions_analyses');
    
    console.log('  🔍 Connexion à MongoDB établie');
    console.log('  📊 Recherche de l\'analyse en cours...');
    console.log('');
    
    while (attempts < maxAttempts) {
      // Chercher une analyse récente (dernières 10 minutes) contenant ce message
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const analysis = await collection.findOne({
        'messages.message': { $regex: messageText.substring(0, 50), $options: 'i' },
        createdAt: { $gte: tenMinutesAgo }
      }, {
        sort: { createdAt: -1 }
      });
      
      if (analysis) {
        console.log('  ✅ Analyse trouvée dans MongoDB !');
        console.log('');
        return analysis;
      }
      
      attempts++;
      if (attempts % 6 === 0) { // Afficher toutes les 30 secondes
        console.log(`  ⏳ Attente... (${attempts * 5}s écoulées, max 5 minutes)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes
    }
    
    throw new Error('Timeout: L\'analyse n\'a pas été trouvée dans MongoDB après 5 minutes');
    
  } finally {
    await client.close();
  }
}

/**
 * Affiche le document d'analyse tel qu'enregistré en base
 * @param {Object} analysisDoc - Document complet depuis MongoDB
 */
function displayStoredAnalysis(analysisDoc) {
  console.log('═'.repeat(70));
  console.log('📊 ANALYSE ENREGISTRÉE DANS MONGODB');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`🆔 Analyse ID      : ${analysisDoc._id}`);
  console.log(`📅 Date d'enregistrement : ${analysisDoc.createdAt}`);
  console.log(`🤖 Modèle IA       : ${analysisDoc.model || 'N/A'}`);
  console.log(`⏱️  Temps de traitement : ${analysisDoc.processingTime ? `${analysisDoc.processingTime}s` : 'N/A'}`);
  console.log('');

  if (analysisDoc.messages && analysisDoc.messages.length > 0) {
    console.log('💬 Messages analysés :');
    analysisDoc.messages.forEach((msg, index) => {
      console.log(`  ${index + 1}. Auteur : ${msg.author?.name || 'Inconnu'} (${msg.author?.id || 'N/A'})`);
      console.log(`     Date   : ${msg.created_time || 'N/A'}`);
      console.log(`     Type   : ${msg.type || 'N/A'}`);
      console.log('     Texte  :');
      console.log(`       ${msg.message}`);
      console.log('');
    });
  }

  console.log('📄 Réponse IA enregistrée :');
  console.log(JSON.stringify(analysisDoc.analysis, null, 2));
  console.log('');
  console.log('═'.repeat(70));
}

/**
 * Envoie un email de rapport en réutilisant le WebhookService
 * @param {Object} analysisDoc - Document complet depuis MongoDB
 * @returns {Promise<boolean>} true si l'email a été envoyé
 */
async function sendEmailReport(analysisDoc) {
  if (!analysisDoc) {
    console.log('⚠️  Aucun document d\'analyse à envoyer par email');
    return false;
  }

  const entityId = await resolveEntityId();
  if (!entityId) {
    console.log('⚠️  Impossible de déterminer l\'ID de l\'entité GDRI. Rapport email non envoyé.');
    return false;
  }

  try {
    const service = await getWebhookServiceInstance();
    console.log('📧 Envoi du rapport email via WebhookService...');
    await service.sendAnalysisEmail(
      analysisDoc.analysis,
      analysisDoc.messages || [],
      entityId
    );
    console.log('✅ Rapport email envoyé (consultez les logs du service Mail).');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du rapport email:', error.message || error);
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('');
  console.log('🧪 TEST WEBHOOK - PERMISSION BUSINESS_MANAGEMENT');
  console.log('═'.repeat(70));
  console.log('');
  console.log('📖 CONTEXTE:');
  console.log('   L\'autorisation business_management permet à notre application de:');
  console.log('   • Recevoir les webhooks en temps réel de Facebook');
  console.log('   • Accéder aux messages et commentaires de notre Page');
  console.log('   • Gérer automatiquement les interactions avec nos clients');
  console.log('');
  console.log('🎯 OBJECTIF DE CE TEST:');
  console.log('   Démontrer comment business_management améliore notre service client');
  console.log('   en permettant une réactivité accrue et un routing intelligent.');
  console.log('');

  try {
    const result = await sendWebhook();
    
    if (result.analysisResults) {
      console.log('');
      displayStoredAnalysis(result.analysisResults);
      console.log('');

      const emailSent = await sendEmailReport(result.analysisResults);
      if (!emailSent) {
        console.log('⚠️  Rapport email non envoyé. Consultez les messages ci-dessus pour les détails.');
      }
      console.log('');
    } else {
      console.log('');
      console.log('⚠️  Les résultats de l\'analyse n\'ont pas pu être récupérés');
      console.log('   Vérifiez les logs du backend pour plus d\'informations');
      console.log('');
    }
    
    console.log('═'.repeat(70));
    console.log('✅ TEST TERMINÉ');
    console.log('═'.repeat(70));
    console.log('');
    console.log('💡 Ce test est prêt pour la vidéo de démonstration Facebook.');
    console.log('   Il montre l\'utilisation concrète de business_management.');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Test échoué:', error.message);
    process.exit(1);
  }
}

// Lancer le test
main();

