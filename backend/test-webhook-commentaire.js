/**
 * Script de test pour simuler un webhook Facebook - Commentaire
 * Usage: node backend/test-webhook-commentaire.js
 */

const http = require('http');

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
        text: 'Bonjour, j\'ai un problème avec mon produit.'
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
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('Réponse:', data); });
});

req.on('error', (e) => {
  console.error(`Erreur: ${e.message}`);
});

req.write(postData);
req.end();

