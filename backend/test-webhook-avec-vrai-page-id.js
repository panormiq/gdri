/**
 * Script de test avec le vrai Page ID Facebook
 * Usage: node backend/test-webhook-avec-vrai-page-id.js
 */

const http = require('http');

const PAGE_ID = '205855939507920'; // Votre vrai Page ID

const webhookData = {
  object: 'page',
  entry: [{
    id: PAGE_ID,
    time: Math.floor(Date.now() / 1000),
    changes: [{
      field: 'feed',
      value: {
        from: {
          id: '987654321',
          name: 'Utilisateur Test'
        },
        item: 'comment',
        comment_id: 'comment_test_' + Date.now(),
        post_id: 'post_test_' + Date.now(),
        verb: 'add',
        created_time: Math.floor(Date.now() / 1000),
        message: 'TEST_MESSAGE - Ceci est un test de webhook avec le vrai Page ID'
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
    'Content-Length': Buffer.byteLength(postData),
    'X-Hub-Signature': 'sha256=test_signature' // Simuler la signature Facebook
  },
  timeout: 10000
};

console.log('🧪 TEST WEBHOOK AVEC VRAI PAGE ID');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`📱 Page ID: ${PAGE_ID}`);
console.log('📤 Envoi du webhook de test...\n');

const req = http.request(options, (res) => {
  console.log(`✅ Status: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Réponse:', data);
    console.log('\n✅ Test terminé !');
    console.log('💡 Vérifiez la console du serveur GDRI pour voir les logs du webhook.');
    console.log('💡 Vérifiez MongoDB collection "facebook_webhooks" pour voir le webhook sauvegardé.');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Erreur: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.error('💡 Le serveur Node.js n\'est pas démarré ou n\'écoute pas sur le port 3000');
    console.error('💡 Démarrez le serveur avec: node backend/server.js');
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
