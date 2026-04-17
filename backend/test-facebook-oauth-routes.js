/**
 * Script de test pour vérifier que les routes OAuth Facebook sont bien chargées
 */

const https = require('https');

const API_BASE_URL = 'https://www.gdr-innovation.fr/api';
// Ou en local : const API_BASE_URL = 'http://localhost:3000/api';

console.log('🔍 Test des routes OAuth Facebook...\n');

// Test 1: Vérifier que la route existe (sans auth, devrait retourner 401)
console.log('1️⃣ Test GET /api/facebook/oauth/login (sans auth - devrait retourner 401)...');
testRoute('GET', '/facebook/oauth/login', null, (statusCode, data) => {
  if (statusCode === 401) {
    console.log('   ✅ Route trouvée (401 = authentification requise, c\'est normal)');
  } else if (statusCode === 404) {
    console.log('   ❌ Route NON trouvée (404) - Le serveur doit être redémarré !');
  } else {
    console.log(`   ⚠️  Statut inattendu: ${statusCode}`);
  }
  console.log('');
  
  // Test 2: Vérifier la route callback
  console.log('2️⃣ Test GET /api/facebook/oauth/callback (sans paramètres)...');
  testRoute('GET', '/facebook/oauth/callback', null, (statusCode, data) => {
    if (statusCode === 302 || statusCode === 200 || statusCode === 400) {
      console.log('   ✅ Route trouvée');
    } else if (statusCode === 404) {
      console.log('   ❌ Route NON trouvée (404) - Le serveur doit être redémarré !');
    } else {
      console.log(`   ⚠️  Statut: ${statusCode}`);
    }
    console.log('');
    
    // Test 3: Vérifier la route pages
    console.log('3️⃣ Test GET /api/facebook/oauth/pages (sans auth)...');
    testRoute('GET', '/facebook/oauth/pages', null, (statusCode, data) => {
      if (statusCode === 401 || statusCode === 400) {
        console.log('   ✅ Route trouvée');
      } else if (statusCode === 404) {
        console.log('   ❌ Route NON trouvée (404) - Le serveur doit être redémarré !');
      } else {
        console.log(`   ⚠️  Statut: ${statusCode}`);
      }
      console.log('\n✅ Tests terminés');
      console.log('\n💡 Si vous voyez des 404, redémarrez le serveur backend :');
      console.log('   1. Arrêtez le serveur (Ctrl+C)');
      console.log('   2. Relancez-le : node backend/server.js');
    });
  });
});
});

function testRoute(method, path, body, callback) {
  const url = new URL(`${API_BASE_URL}${path}`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      callback(res.statusCode, data);
    });
  });
  
  req.on('error', (error) => {
    console.error(`   ❌ Erreur: ${error.message}`);
    callback(null, null);
  });
  
  if (body) {
    req.write(JSON.stringify(body));
  }
  
  req.end();
}
