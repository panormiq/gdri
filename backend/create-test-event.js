/**
 * Script simple pour créer un événement réel sur Facebook
 * Cela déclenchera un webhook "feed" vers votre serveur
 * 
 * Usage: node backend/create-test-event.js
 * 
 * Prérequis:
 * - PAGE_ACCESS_TOKEN (token d'accès de la page)
 * - PAGE_ID (ID de votre page Facebook)
 */

const https = require('https');

// Configuration - À remplir
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || 'VOTRE_PAGE_ACCESS_TOKEN';
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '205855939507920';

console.log('\n🎬 CRÉATION D\'UN ÉVÉNEMENT RÉEL POUR DÉMONSTRATION');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Crée un post de test sur la page Facebook
 * Cela déclenchera un webhook "feed" vers votre serveur
 */
function createTestPost() {
  return new Promise((resolve, reject) => {
    const message = `🧪 Test webhook GDRI - ${new Date().toLocaleString('fr-FR')}\n\nCe post a été créé pour tester le webhook Facebook. Il devrait déclencher un événement "feed" vers le serveur GDRI.`;
    
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
    console.log(`💬 Message: ${message.substring(0, 60)}...\n`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 && response.id) {
            console.log('✅ Post créé avec succès !');
            console.log(`🆔 Post ID: ${response.id}`);
            console.log(`🔗 URL: https://www.facebook.com/${response.id}`);
            console.log('\n⏳ Le webhook devrait arriver dans quelques secondes...');
            console.log('💡 Vérifiez la console du serveur GDRI pour voir le webhook arriver.');
            console.log('\n✅ Script terminé. Le webhook sera traité automatiquement.\n');
            resolve(response.id);
          } else {
            console.error(`❌ Erreur: ${res.statusCode}`);
            console.error('Réponse:', data);
            reject(new Error(`Erreur ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          console.error('❌ Erreur parsing réponse:', e.message);
          console.error('Réponse brute:', data);
          reject(e);
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

// Vérifier la configuration
if (PAGE_ACCESS_TOKEN === 'VOTRE_PAGE_ACCESS_TOKEN' || !PAGE_ACCESS_TOKEN) {
  console.error('❌ Erreur: PAGE_ACCESS_TOKEN non configuré');
  console.error('\n💡 Pour utiliser ce script:');
  console.error('   1. Obtenez un Page Access Token depuis Facebook Developer');
  console.error('   2. Définissez la variable d\'environnement:');
  console.error('      $env:FACEBOOK_PAGE_ACCESS_TOKEN="VOTRE_TOKEN"');
  console.error('   3. Relancez le script:');
  console.error('      node backend/create-test-event.js\n');
  process.exit(1);
}

// Exécuter
createTestPost()
  .then(() => {
    console.log('🎉 Événement créé avec succès !');
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n💡 Vérifiez que:');
    console.error('   - Le Page Access Token est valide');
    console.error('   - Le Page ID est correct');
    console.error('   - La page a les permissions nécessaires (pages_manage_posts)');
    process.exit(1);
  });
