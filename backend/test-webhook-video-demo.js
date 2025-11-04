/**
 * Script de test pour la vidéo de démonstration Facebook
 * Simule un webhook Facebook avec un commentaire réel de John Willay
 * et déclenche l'analyse d'intention via l'IA
 * 
 * Usage: node backend/test-webhook-video-demo.js
 */

const http = require('http');

// Configuration
const BACKEND_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/facebook/webhook';

// Le commentaire réel de John Willay
const commentaireReel = {
  message: `Attention à votre communication. Les dates ne sont pas les bonnes.

Quels modèles présenterez vous sur le Grand Pavois?

Je suis à la recherche d'un bateau polyvalent pour naviguer sur la côte méditerranéenne Espagnole.

Merci pour votre retour.`,
  author: {
    name: 'John Willay',
    id: '123456789012345'
  },
  created_time: new Date().toISOString(),
  like_count: 0,
  replies: []
};

// Structure du webhook Facebook pour un commentaire
const webhookFacebook = {
  object: 'page',
  entry: [
    {
      id: '123456789',
      time: Math.floor(Date.now() / 1000),
      messaging: [
        {
          sender: {
            id: commentaireReel.author.id
          },
          recipient: {
            id: '987654321'
          },
          timestamp: Math.floor(Date.now() / 1000),
          message: {
            mid: 'mid_' + Date.now(),
            text: commentaireReel.message
          }
        }
      ]
    }
  ]
};

// Fonction pour envoyer le webhook
function sendWebhook() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(webhookFacebook);

    console.log('📤 Envoi du webhook Facebook...');
    console.log('');
    console.log('💬 COMMENTAIRE COMPLET REÇU:');
    console.log('═'.repeat(70));
    console.log(`Auteur: ${commentaireReel.author.name}`);
    console.log(`Date: ${commentaireReel.created_time}`);
    console.log('');
    console.log('Message complet:');
    console.log('─'.repeat(70));
    console.log(commentaireReel.message);
    console.log('─'.repeat(70));
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
      timeout: 300000 // 5 minutes (300 secondes) pour l'analyse IA
    };

    const req = http.request(options, (res) => {
      let data = '';

      console.log(`📡 Status: ${res.statusCode}`);
      console.log('');

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Webhook reçu avec succès !');
          console.log('');
          console.log('📥 Réponse du serveur:');
          console.log('─'.repeat(70));
          try {
            const response = JSON.parse(data);
            console.log(JSON.stringify(response, null, 2));
          } catch (e) {
            console.log(data);
          }
          console.log('─'.repeat(70));
          resolve(data);
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
      console.error('   - Le backend Node.js est démarré (node backend/server.js)');
      console.error('   - Le backend écoute sur le port 3000');
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('❌ Timeout: La requête a pris trop de temps (> 5 minutes)');
      reject(new Error('Request timeout - L\'analyse IA prend trop de temps'));
    });

    req.setTimeout(300000); // 5 minutes

    req.write(postData);
    req.end();
  });
}

// Fonction principale
async function main() {
  console.log('🧪 === TEST WEBHOOK FACEBOOK POUR VIDÉO DÉMONSTRATION ===');
  console.log('');
  console.log('📋 Ce script simule:');
  console.log('   1. La réception d\'un webhook Facebook');
  console.log('   2. L\'analyse d\'intention via l\'IA');
  console.log('   3. Le traitement complet du commentaire');
  console.log('');
  console.log('⏳ Cette opération peut prendre plusieurs minutes...');
  console.log('');

  try {
    await sendWebhook();
    console.log('');
    console.log('🎉 Test terminé avec succès !');
    console.log('');
    console.log('💡 Ce test est prêt pour la vidéo de démonstration Facebook.');
  } catch (error) {
    console.error('');
    console.error('❌ Test échoué:', error.message);
    process.exit(1);
  }
}

// Lancer le test
main();

