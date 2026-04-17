/**
 * Test du format "sample" que Facebook envoie pour les tests
 * Usage: node backend/test-webhook-facebook-sample.js
 */

const http = require('http');

// Structure que Facebook envoie pour les tests
const webhookData = {
  "sample": {
    "field": "feed"
  },
  "sub_field_options": null
};

const postData = JSON.stringify(webhookData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/facebook/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Hub-Signature': 'sha256=test_signature'
  },
  timeout: 10000
};

console.log('🧪 TEST WEBHOOK FORMAT "SAMPLE" (comme Facebook)');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('📦 Données envoyées:', JSON.stringify(webhookData, null, 2));
console.log('\n📤 Envoi du webhook...\n');

const req = http.request(options, (res) => {
  console.log(`✅ Status: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Réponse:', data);
    console.log('\n✅ Test terminé !');
    console.log('💡 Vérifiez la console du serveur GDRI pour voir les logs.');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Erreur: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.error('💡 Le serveur Node.js n\'est pas démarré');
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
