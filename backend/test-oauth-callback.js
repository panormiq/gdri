/**
 * Test du callback OAuth Facebook
 * Teste si la route callback est accessible
 */

const https = require('https');

const options = {
  hostname: 'www.gdr-innovation.fr',
  path: '/api/facebook/oauth/callback?code=test&state=test',
  method: 'GET',
  headers: {
    'User-Agent': 'Test-OAuth-Callback'
  }
};

console.log('🧪 Test du callback OAuth Facebook...');
console.log(`📡 URL: https://${options.hostname}${options.path}\n`);

const req = https.request(options, (res) => {
  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📥 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`\n📦 Response Body (premiers 500 caractères):`);
    console.log(data.substring(0, 500));
    
    if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 301) {
      console.log('\n✅ Le callback fonctionne ! (redirection normale)');
    } else if (res.statusCode === 403) {
      console.log('\n❌ Forbidden - Apache bloque la requête');
    } else {
      console.log(`\n⚠️  Status ${res.statusCode} - Vérifiez les logs`);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Erreur: ${e.message}`);
});

req.end();
