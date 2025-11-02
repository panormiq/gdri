/**
 * Script de génération de certificat SSL Let's Encrypt
 * Utilise acme-client pour Node.js
 */

const acme = require('acme-client');
const fs = require('fs').promises;
const http = require('http');
const path = require('path');

// Configuration
const domains = [
    'www.gdr-innovation.fr',
    'gdr-innovation.fr',
    'www.gdri.fr',
    'gdri.fr'
];

const email = 'abaratte@gdr-innovation.fr';
const certDir = path.join(__dirname, '..', 'ssl-certs');

// Serveur HTTP pour les challenges
let challengeServer;
const challenges = {};

async function startChallengeServer() {
    return new Promise((resolve) => {
        challengeServer = http.createServer((req, res) => {
            const token = req.url.replace('/.well-known/acme-challenge/', '');
            const keyAuthorization = challenges[token];
            
            if (keyAuthorization) {
                console.log(`✅ Challenge validé pour token: ${token.substring(0, 10)}...`);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(keyAuthorization);
            } else {
                console.log(`❌ Challenge non trouvé pour token: ${token}`);
                res.writeHead(404);
                res.end('Not found');
            }
        });

        challengeServer.listen(80, () => {
            console.log('🌐 Serveur de challenge HTTP démarré sur le port 80');
            resolve();
        });
    });
}

async function generateCertificate() {
    try {
        console.log('🔐 Génération du certificat SSL pour:', domains.join(', '));
        console.log('📧 Email:', email);
        console.log('');

        // Créer le dossier pour les certificats
        await fs.mkdir(certDir, { recursive: true });

        // Démarrer le serveur de challenge
        await startChallengeServer();

        // Créer le client ACME
        console.log('📡 Connexion à Let\'s Encrypt...');
        const client = new acme.Client({
            directoryUrl: acme.directory.letsencrypt.production,
            accountKey: await acme.crypto.createPrivateKey()
        });

        // Créer un compte
        console.log('👤 Création du compte Let\'s Encrypt...');
        await client.createAccount({
            termsOfServiceAgreed: true,
            contact: [`mailto:${email}`]
        });

        // Créer la clé privée du certificat
        console.log('🔑 Génération de la clé privée...');
        const [certKey, certCsr] = await acme.crypto.createCsr({
            commonName: domains[0],
            altNames: domains.slice(1)
        });

        // Créer l'ordre
        console.log('📝 Création de l\'ordre de certificat...');
        const order = await client.createOrder({
            identifiers: domains.map(domain => ({ type: 'dns', value: domain }))
        });

        // Gérer les challenges
        console.log('🎯 Traitement des challenges...');
        const authorizations = await client.getAuthorizations(order);

        for (const authz of authorizations) {
            const httpChallenge = authz.challenges.find(c => c.type === 'http-01');
            
            if (httpChallenge) {
                const keyAuthorization = await client.getChallengeKeyAuthorization(httpChallenge);
                challenges[httpChallenge.token] = keyAuthorization;
                
                console.log(`  ✓ Challenge préparé pour: ${authz.identifier.value}`);
                
                // Valider le challenge
                await client.verifyChallenge(authz, httpChallenge);
                await client.completeChallenge(httpChallenge);
            }
        }

        // Attendre la validation
        console.log('⏳ Attente de la validation par Let\'s Encrypt...');
        await client.waitForValidStatus(order);

        // Finaliser l'ordre
        console.log('✅ Validation réussie ! Finalisation...');
        await client.finalizeOrder(order, certCsr);
        const cert = await client.getCertificate(order);

        // Sauvegarder les fichiers
        console.log('💾 Sauvegarde des certificats...');
        
        await fs.writeFile(path.join(certDir, 'privkey.pem'), certKey);
        await fs.writeFile(path.join(certDir, 'fullchain.pem'), cert);
        await fs.writeFile(path.join(certDir, 'cert.pem'), cert.split('\n\n')[0] + '\n');
        await fs.writeFile(path.join(certDir, 'chain.pem'), cert.split('\n\n').slice(1).join('\n\n'));

        console.log('');
        console.log('🎉 Certificat SSL généré avec succès !');
        console.log('');
        console.log('📁 Fichiers créés dans:', certDir);
        console.log('  - privkey.pem (clé privée)');
        console.log('  - fullchain.pem (certificat complet)');
        console.log('  - cert.pem (certificat seul)');
        console.log('  - chain.pem (chaîne de certificats)');
        console.log('');
        console.log('⚠️  Prochaine étape: Configurer Apache pour utiliser ces certificats');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        if (error.response) {
            console.error('Détails:', error.response.body);
        }
        process.exit(1);
    } finally {
        if (challengeServer) {
            challengeServer.close();
            console.log('🛑 Serveur de challenge arrêté');
        }
    }
}

// Lancer la génération
generateCertificate();



