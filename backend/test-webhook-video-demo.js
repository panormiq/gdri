/**
 * Script de test pour la vidéo de démonstration Facebook
 * Simule un webhook Facebook avec un commentaire réel de John Willay
 * et déclenche l'analyse d'intention via l'IA
 * 
 * Usage: node backend/test-webhook-video-demo.js
 * 
 * Prérequis :
 * - Backend Node.js démarré (node backend/server.js)
 * - MongoDB accessible
 * - Ollama accessible sur http://localhost:11434 (ou configuré via OLLAMA_URL)
 */

const http = require('http');
const { MongoClient } = require('mongodb');

// Configuration
const BACKEND_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/facebook/webhook';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
const MONGODB_DB = 'GDR-INNOVATION';

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

      res.on('end', async () => {
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
          console.log('');
          console.log('⏳ Attente du traitement (analyse IA en cours)...');
          console.log('   Le traitement est asynchrone, l\'analyse peut prendre 30-60 secondes...');
          console.log('   Vérification dans 15 secondes, puis toutes les 10 secondes jusqu\'à 60 secondes...');
          console.log('');
          
          // Attendre 15 secondes initialement, puis vérifier toutes les 10 secondes
          let found = false;
          let attempts = 0;
          const maxAttempts = 6; // 15s + 5 * 10s = 65 secondes max
          
          for (let i = 0; i < maxAttempts; i++) {
            const waitTime = i === 0 ? 15000 : 10000;
            console.log(`   ⏱️  Attente ${waitTime / 1000}s... (tentative ${i + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            console.log(`   🔍 Vérification MongoDB (tentative ${i + 1})...`);
            found = await verifyAnalysisInMongoDB(commentaireReel.message);
            
            if (found) {
              console.log('');
              console.log('   ✅ Analyse trouvée !');
              break;
            }
            
            if (i < maxAttempts - 1) {
              console.log('   ⏳ Analyse pas encore visible, nouvelle tentative...');
              console.log('');
            }
          }
          
          if (!found) {
            console.log('');
            console.log('⚠️  Analyse non trouvée après 65 secondes d\'attente.');
            console.log('   Cela peut signifier que l\'analyse est encore en cours ou qu\'il y a eu une erreur.');
            console.log('   Vérifiez les logs du serveur backend pour plus de détails.');
          }
          
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

/**
 * Vérifie que l'analyse IA a bien été sauvegardée dans MongoDB
 * @param {string} messageText - Le texte du message pour le trouver dans l'analyse
 */
async function verifyAnalysisInMongoDB(messageText) {
  let client = null;
  try {
    console.log('🔍 Vérification de l\'analyse dans MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DB);
    const collection = db.collection('intentions_analyses');
    
    // Chercher une analyse récente (dernières 2 minutes) contenant ce message
    const recentTime = new Date(Date.now() - 120000);
    const analysis = await collection.findOne({
      'messages.message': { $regex: messageText.substring(0, 50), $options: 'i' },
      createdAt: { $gte: recentTime }
    }, { sort: { createdAt: -1 } });
    
    if (analysis) {
      console.log('✅ Analyse IA trouvée dans MongoDB !');
      console.log('');
      console.log('📊 Détails de l\'analyse:');
      console.log('─'.repeat(70));
      console.log(`   - Date: ${analysis.createdAt}`);
      console.log(`   - Modèle: ${analysis.model || 'N/A'}`);
      console.log(`   - Temps de traitement: ${analysis.processingTime || 'N/A'}s`);
      console.log(`   - Messages analysés: ${analysis.messages?.length || 0}`);
      
      if (analysis.analysis) {
        const analyses = analysis.analysis.analyses || [];
        if (analyses.length > 0) {
          console.log(`   - Intentions détectées: ${analyses.length} analyse(s)`);
          analyses.forEach((a, idx) => {
            const intentions = a.intentions || a.intentionsDetaillees || [];
            if (intentions.length > 0) {
              const intentionNames = intentions.map(i => i.category || i.name || i).join(', ');
              console.log(`     ${idx + 1}. ${intentionNames}`);
            }
          });
        }
      }
      console.log('─'.repeat(70));
      console.log('');
      return true;
    } else {
      console.log('⚠️  Aucune analyse trouvée dans MongoDB dans les 30 dernières secondes.');
      console.log('');
      console.log('💡 Cela peut signifier:');
      console.log('   - L\'analyse IA est encore en cours (attendez un peu plus)');
      console.log('   - Ollama n\'est pas accessible ou configuré');
      console.log('   - Il y a eu une erreur lors de l\'analyse');
      console.log('');
      console.log('🔍 Vérifiez les logs du serveur backend pour plus de détails.');
      console.log('');
      return false;
    }
  } catch (error) {
    console.error('⚠️  Erreur lors de la vérification MongoDB:', error.message);
    console.log('💡 L\'analyse IA peut quand même avoir fonctionné, vérifiez les logs du serveur.');
    return false;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Fonction principale
async function main() {
  console.log('🧪 === TEST WEBHOOK FACEBOOK POUR VIDÉO DÉMONSTRATION ===');
  console.log('');
  console.log('📋 Ce script simule:');
  console.log('   1. La réception d\'un webhook Facebook');
  console.log('   2. L\'analyse d\'intention via l\'IA (Ollama)');
  console.log('   3. Le traitement complet du commentaire');
  console.log('   4. Vérification que l\'analyse est sauvegardée dans MongoDB');
  console.log('');
  console.log('⏳ Cette opération peut prendre plusieurs minutes...');
  console.log('');
  console.log('🔍 Points à vérifier:');
  console.log('   - Backend Node.js démarré sur le port 3000');
  console.log('   - MongoDB accessible');
  console.log('   - Ollama accessible (http://localhost:11434)');
  console.log('');

  try {
    await sendWebhook();
    console.log('');
    console.log('🎉 Test terminé !');
    console.log('');
    console.log('💡 Vérifiez les logs du serveur backend pour voir:');
    console.log('   - Si l\'analyse IA a été appelée');
    console.log('   - Si l\'email a été envoyé');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Test échoué:', error.message);
    process.exit(1);
  }
}

// Lancer le test
main();

