/**
 * Test rapide du pull Facebook avec le token fourni
 */

const http = require('http');

const PAGE_ID = '205855939507920';
const PAGE_ACCESS_TOKEN = 'EAAK1paGqmBwBQ0MUKhZAfqNFCGr6rkNjUrWt0Xk51WQuLjhu2ZCGLj1HThDaVXmt2yE9xoT7sXJDptSZCZCgy9TXj2MopNmWT9iU8MNQtkGDWyRJ44XKGA4tuYYbUVNEejuXRgpoBvDuHtOxrTbQSGhrOH9y4G3qhjAQo2XlH8EIceiYt7AppjRV792ZBqZCl62HhDrR70AuP45GeWsTNFlZCFemVkd3C3VPgLkapYZD';

console.log('\n🧪 TEST PULL FACEBOOK');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`📱 Page ID: ${PAGE_ID}`);
console.log(`🔑 Token: ${PAGE_ACCESS_TOKEN.substring(0, 20)}...`);
console.log('\n📤 Envoi de la requête de pull...\n');

const postData = JSON.stringify({
  pageId: PAGE_ID,
  accessToken: PAGE_ACCESS_TOKEN,
  // Pull depuis le 01/02/2026
  sinceDate: '2026-02-01T00:00:00Z'
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
  timeout: 30000
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
