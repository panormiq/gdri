/**
 * Script interactif pour tester les webhooks Facebook
 * Usage: node backend/test-webhook-demo.js
 */

const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function sendWebhook(type, message) {
  const webhookData = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Math.floor(Date.now() / 1000),
      messaging: [{
        sender: { id: '987654321' },
        recipient: { id: '123456789' },
        timestamp: Math.floor(Date.now() / 1000),
        message: {
          mid: 'mid_' + Date.now(),
          text: message || (type === 'commentaire' ? 'Bonjour, j\'ai un problème.' : '@GDRInnovation Bonjour')
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
    }
  };

  const req = http.request(options, (res) => {
    console.log(`\n✅ Status: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Réponse:', data);
      askQuestion();
    });
  });

  req.on('error', (e) => {
    console.error(`\n❌ Erreur: ${e.message}`);
    askQuestion();
  });

  req.write(postData);
  req.end();
}

function askQuestion() {
  rl.question('\n📝 Choisissez un type de webhook (1: Commentaire, 2: Mention, 3: Message personnalisé, q: Quitter): ', (answer) => {
    if (answer === 'q') {
      rl.close();
      return;
    }

    if (answer === '1') {
      sendWebhook('commentaire');
    } else if (answer === '2') {
      sendWebhook('mention');
    } else if (answer === '3') {
      rl.question('Entrez votre message: ', (message) => {
        sendWebhook('custom', message);
      });
    } else {
      console.log('❌ Choix invalide');
      askQuestion();
    }
  });
}

console.log('🧪 Test interactif de webhooks Facebook');
console.log('=====================================\n');
askQuestion();

