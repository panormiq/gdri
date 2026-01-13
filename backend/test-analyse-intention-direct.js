/**
 * Test direct de l'analyse d'intention IA
 * Envoie un commentaire directement à l'API d'analyse sans passer par le webhook Facebook
 * 
 * Usage: node backend/test-analyse-intention-direct.js
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
const API_ENDPOINT = '/api/analyse';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
const MONGODB_DB = 'GDR-INNOVATION';

// Commentaire de test
const commentaireTest = {
  message: `Bonjour, j'ai reçu mon produit hier mais il est défectueux. 
  
La fonction principale ne fonctionne pas correctement et j'aimerais un remboursement ou un échange.

Pouvez-vous me contacter rapidement pour résoudre ce problème ?`,
  author: {
    name: 'Client Test',
    id: 'test_123'
  },
  created_time: new Date().toISOString()
};

/**
 * Envoie le commentaire directement à l'API d'analyse
 */
function sendToAnalysisAPI() {
  return new Promise((resolve, reject) => {
    const payload = {
      messages: [commentaireTest]
    };
    
    const postData = JSON.stringify(payload);

    console.log('📤 Envoi du commentaire à l\'API d\'analyse...');
    console.log('');
    console.log('💬 COMMENTAIRE DE TEST:');
    console.log('═'.repeat(70));
    console.log(`Auteur: ${commentaireTest.author.name}`);
    console.log(`Date: ${commentaireTest.created_time}`);
    console.log('');
    console.log('Message:');
    console.log('─'.repeat(70));
    console.log(commentaireTest.message);
    console.log('─'.repeat(70));
    console.log('');

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: API_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 300000 // 5 minutes
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
          console.log('✅ Analyse terminée avec succès !');
          console.log('');
          console.log('📥 Réponse de l\'API:');
          console.log('─'.repeat(70));
          try {
            const response = JSON.parse(data);
            console.log(JSON.stringify(response, null, 2));
            
            // Vérifier que l'analyse a été sauvegardée dans MongoDB
            console.log('');
            console.log('⏳ Vérification dans MongoDB...');
            await verifyAnalysisInMongoDB(commentaireTest.message);
            
            resolve(response);
          } catch (e) {
            console.log(data);
            resolve(data);
          }
          console.log('─'.repeat(70));
        } else {
          console.error(`❌ Erreur HTTP ${res.statusCode}`);
          console.error('Réponse:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
      console.log('⚠️  Aucune analyse trouvée dans MongoDB dans les 2 dernières minutes.');
      console.log('   Cela peut signifier que l\'analyse n\'a pas été sauvegardée.');
      console.log('');
      return false;
    }
  } catch (error) {
    console.error('⚠️  Erreur lors de la vérification MongoDB:', error.message);
    return false;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Fonction principale
async function main() {
  console.log('🧪 === TEST DIRECT ANALYSE D\'INTENTION IA ===');
  console.log('');
  console.log('📋 Ce script:');
  console.log('   1. Envoie un commentaire directement à l\'API /api/analyse');
  console.log('   2. Obtient la réponse de l\'IA (Ollama)');
  console.log('   3. Vérifie que l\'analyse est sauvegardée dans MongoDB');
  console.log('');
  console.log('⏳ Cette opération peut prendre 30-60 secondes...');
  console.log('');
  console.log('🔍 Points à vérifier:');
  console.log('   - Backend Node.js démarré sur le port 3000');
  console.log('   - MongoDB accessible');
  console.log('   - Ollama accessible (http://localhost:11434)');
  console.log('');

  try {
    await sendToAnalysisAPI();
    console.log('');
    console.log('🎉 Test terminé !');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Test échoué:', error.message);
    process.exit(1);
  }
}

// Lancer le test
main();


