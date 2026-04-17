/**
 * Script pour tester les webhooks Facebook via l'API Graph
 * 
 * Ce script utilise l'API Graph Facebook pour créer un événement réel
 * (commentaire de test) qui déclenchera un webhook.
 * 
 * Usage: node backend/test-webhook-via-graph-api.js
 * 
 * Prérequis:
 * - APP_ID et APP_SECRET dans les variables d'environnement ou .env
 * - PAGE_ACCESS_TOKEN (token d'accès de la page)
 * - PAGE_ID (ID de votre page Facebook)
 */

const https = require('https');
const http = require('http');

// Configuration - À remplir avec vos valeurs
const APP_ID = process.env.FACEBOOK_APP_ID || 'VOTRE_APP_ID';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'VOTRE_APP_SECRET';
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || 'VOTRE_PAGE_ACCESS_TOKEN';
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '205855939507920'; // Page ID par défaut
const POST_ID = process.env.FACEBOOK_POST_ID || null; // ID d'un post existant pour commenter

console.log('\n🧪 TEST WEBHOOK VIA API GRAPH FACEBOOK');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Crée un commentaire de test sur un post via l'API Graph
 * Cela déclenchera un webhook "feed" vers votre serveur
 */
function createTestComment() {
  return new Promise((resolve, reject) => {
    // Si aucun POST_ID n'est fourni, on doit d'abord créer un post
    if (!POST_ID) {
      console.log('⚠️  Aucun POST_ID fourni. Création d\'un post de test...');
      createTestPost()
        .then(postId => {
          console.log(`✅ Post créé: ${postId}`);
          commentOnPost(postId)
            .then(resolve)
            .catch(reject);
        })
        .catch(reject);
    } else {
      commentOnPost(POST_ID)
        .then(resolve)
        .catch(reject);
    }
  });
}

/**
 * Crée un post de test sur la page
 */
function createTestPost() {
  return new Promise((resolve, reject) => {
    const message = `🧪 Post de test pour webhook - ${new Date().toISOString()}`;
    
    const postData = JSON.stringify({
      message: message
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v24.0/${PAGE_ID}/feed?access_token=${PAGE_ACCESS_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`📤 Création d'un post de test sur la page ${PAGE_ID}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log('✅ Post créé avec succès');
          resolve(response.id);
        } else {
          console.error(`❌ Erreur création post: ${res.statusCode}`);
          console.error('Réponse:', data);
          reject(new Error(`Erreur ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Erreur requête: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Crée un commentaire sur un post
 */
function commentOnPost(postId) {
  return new Promise((resolve, reject) => {
    const message = `🧪 Commentaire de test pour webhook - ${new Date().toISOString()}\n\nCe commentaire devrait déclencher un webhook "feed" vers votre serveur.`;

    const postData = JSON.stringify({
      message: message
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v24.0/${postId}/comments?access_token=${PAGE_ACCESS_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`📤 Création d'un commentaire de test sur le post ${postId}...`);
    console.log(`💬 Message: ${message.substring(0, 50)}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log('✅ Commentaire créé avec succès');
          console.log(`🆔 Comment ID: ${response.id}`);
          console.log('\n⏳ Attente du webhook...');
          console.log('💡 Vérifiez la console du serveur GDRI pour voir le webhook arriver.');
          resolve(response.id);
        } else {
          console.error(`❌ Erreur création commentaire: ${res.statusCode}`);
          console.error('Réponse:', data);
          reject(new Error(`Erreur ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Erreur requête: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Vérifie la configuration
 */
function checkConfig() {
  const missing = [];
  
  if (APP_ID === 'VOTRE_APP_ID' || !APP_ID) {
    missing.push('FACEBOOK_APP_ID');
  }
  
  if (APP_SECRET === 'VOTRE_APP_SECRET' || !APP_SECRET) {
    missing.push('FACEBOOK_APP_SECRET');
  }
  
  if (PAGE_ACCESS_TOKEN === 'VOTRE_PAGE_ACCESS_TOKEN' || !PAGE_ACCESS_TOKEN) {
    missing.push('FACEBOOK_PAGE_ACCESS_TOKEN');
  }
  
  if (PAGE_ID === 'VOTRE_PAGE_ID' || !PAGE_ID) {
    missing.push('FACEBOOK_PAGE_ID');
  }
  
  if (missing.length > 0) {
    console.error('❌ Configuration manquante:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Définissez ces variables dans votre fichier .env ou comme variables d\'environnement.');
    console.error('\n📋 Exemple .env:');
    console.error('   FACEBOOK_APP_ID=votre_app_id');
    console.error('   FACEBOOK_APP_SECRET=votre_app_secret');
    console.error('   FACEBOOK_PAGE_ACCESS_TOKEN=votre_page_access_token');
    console.error('   FACEBOOK_PAGE_ID=votre_page_id');
    console.error('\n💡 Pour obtenir un PAGE_ACCESS_TOKEN:');
    console.error('   1. Allez dans Facebook Developer → Votre App');
    console.error('   2. Outils → Graph API Explorer');
    console.error('   3. Sélectionnez votre Page');
    console.error('   4. Générez un token avec les permissions: pages_manage_posts, pages_read_engagement');
    return false;
  }
  
  return true;
}

// Exécution
async function main() {
  console.log('🔍 Vérification de la configuration...\n');
  
  if (!checkConfig()) {
    process.exit(1);
  }
  
  console.log('✅ Configuration OK\n');
  console.log(`📱 App ID: ${APP_ID}`);
  console.log(`📄 Page ID: ${PAGE_ID}`);
  console.log(`📝 Post ID: ${POST_ID || 'Aucun (sera créé)'}\n`);
  
  try {
    await createTestComment();
    console.log('\n✅ Test terminé !');
    console.log('💡 Vérifiez la console du serveur GDRI pour voir le webhook.');
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
