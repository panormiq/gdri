/**
 * Script de test pour vérifier que les POST passent bien via Apache
 * Usage: node backend/test-apache-post.js
 */

const https = require('https');

const WEBHOOK_URL = 'https://www.gdr-innovation.fr/api/facebook/webhook';
const TEST_DATA = {
  object: 'page',
  entry: [{
    id: 'test_page_id',
    time: Math.floor(Date.now() / 1000),
    messaging: [{
      sender: { id: 'test_user_id' },
      recipient: { id: 'test_page_id' },
      timestamp: Math.floor(Date.now() / 1000),
      message: {
        mid: 'test_message_id',
        text: 'Test message from script'
      }
    }]
  }]
};

console.log('🧪 Test POST vers webhook Facebook via Apache');
console.log('═══════════════════════════════════════════════\n');
console.log('URL:', WEBHOOK_URL);
console.log('Data:', JSON.stringify(TEST_DATA, null, 2));
console.log('\n');

const postData = JSON.stringify(TEST_DATA);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'GDRI-Test-Script/1.0'
  }
};

const url = new URL(WEBHOOK_URL);
options.hostname = url.hostname;
options.path = url.pathname;
options.port = url.port || 443;

console.log('📤 Envoi de la requête POST...\n');

const req = https.request(options, (res) => {
  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📥 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📥 Réponse reçue:');
    console.log(data);
    
    if (res.statusCode === 200) {
      console.log('\n✅ SUCCÈS : Le POST a bien été transmis par Apache !');
    } else {
      console.log(`\n⚠️  Réponse ${res.statusCode} : Vérifiez les logs du serveur`);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ ERREUR:', error.message);
  console.error('\n💡 Vérifiez que :');
  console.error('   1. Apache est démarré');
  console.error('   2. Le reverse proxy est configuré');
  console.error('   3. Le serveur Node.js est démarré sur le port 3000');
});

req.write(postData);
req.end();
