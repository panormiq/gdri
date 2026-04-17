/**
 * Script de test pour le service de polling Facebook
 * 
 * Usage: node backend/test-facebook-pull.js
 * 
 * Prérequis:
 * - FACEBOOK_PAGE_ACCESS_TOKEN dans les variables d'environnement ou .env
 * - FACEBOOK_PAGE_ID dans les variables d'environnement ou .env (défaut: 205855939507920)
 */

const http = require('http');
require('dotenv').config();

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '205855939507920';
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

console.log('\n🧪 TEST PULL FACEBOOK');
console.log('═══════════════════════════════════════════════════════════\n');

// Vérifier la configuration
if (!PAGE_ACCESS_TOKEN) {
  console.error('❌ FACEBOOK_PAGE_ACCESS_TOKEN manquant !');
  console.error('\n💡 Définissez-le dans votre fichier .env ou via:');
  console.error('   $env:FACEBOOK_PAGE_ACCESS_TOKEN="VOTRE_TOKEN"');
  process.exit(1);
}

console.log(`📱 Page ID: ${PAGE_ID}`);
console.log(`🔑 Token: ${PAGE_ACCESS_TOKEN.substring(0, 20)}...`);
console.log('\n📤 Envoi de la requête de pull...\n');

// Préparer la requête
const postData = JSON.stringify({
  pageId: PAGE_ID,
  accessToken: PAGE_ACCESS_TOKEN,
  // Optionnel: spécifier une date de début
  // sinceDate: '2026-01-01T00:00:00Z'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/facebook/pull',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 10000
};

const req = http.request(options, (res) => {
  console.log(`✅ Status: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📥 Réponse:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        console.log('\n✅ Pull démarré avec succès !');
        console.log('💡 Vérifiez la console du serveur GDRI pour voir le résultat du pull.');
        console.log('💡 Les messages et commentaires seront traités et analysés automatiquement.');
      } else {
        console.error('\n❌ Erreur:', response.error);
      }
    } catch (error) {
      console.error('\n❌ Erreur parsing réponse:', error);
      console.error('Réponse brute:', data);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Erreur: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.error('💡 Le serveur Node.js n\'est pas démarré');
    console.error('💡 Démarrez-le avec: npm start ou node backend/server.js');
  }
  process.exit(1);
});

req.on('timeout', () => {
  console.error('\n❌ Timeout - Le serveur ne répond pas');
  req.destroy();
  process.exit(1);
});

req.write(postData);
req.end();
