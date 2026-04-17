/**
 * Script de test simple pour envoyer un webhook via HTTP
 * Usage: node backend/test-webhook-curl.js
 */

const http = require('http');

const webhookData = {
  object: 'page',
  entry: [{
    id: '205855939507920', // Page ID réel
    time: Math.floor(Date.now() / 1000),
    messaging: [{
      sender: { id: '987654321' },
      recipient: { id: '205855939507920' },
      timestamp: Math.floor(Date.now() / 1000),
      message: {
        mid: 'mid_test_' + Date.now(),
        text: 'TEST_MESSAGE'
      }
    }]
  }]
};

const postData = JSON.stringify(webhookData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/facebook/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 5000
};

console.log('📤 Envoi du webhook de test...');
console.log('📦 Données:', JSON.stringify(webhookData, null, 2));

const req = http.request(options, (res) => {
  console.log(`\n✅ Status: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Réponse:', data);
    console.log('\n✅ Test terminé !');
    console.log('💡 Vérifiez la console du serveur GDRI pour voir les logs du webhook.');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Erreur: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.error('💡 Le serveur Node.js n\'est pas démarré ou n\'écoute pas sur le port 3000');
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
