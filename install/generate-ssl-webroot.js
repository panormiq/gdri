/**
 * Script de génération de certificat SSL Let's Encrypt
 * Mode WEBROOT - Utilise Apache pour servir les challenges
 */

const acme = require('acme-client');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const domains = [
    'www.gdr-innovation.fr',
    'gdr-innovation.fr',
    'www.gdri.fr',
    'gdri.fr'
];

const email = 'abaratte@gdr-innovation.fr';
const webroot = path.join(__dirname, '..'); // Racine du site
const certDir = path.join(__dirname, '..', 'ssl-certs');

async function generateCertificate() {
    try {
        console.log('🔐 Génération du certificat SSL pour:', domains.join(', '));
        console.log('📧 Email:', email);
        console.log('📁 Webroot:', webroot);
        console.log('');

        // Créer le dossier pour les certificats
        await fs.mkdir(certDir, { recursive: true });

        // Créer le dossier pour les challenges
        const challengeDir = path.join(webroot, '.well-known', 'acme-challenge');
        await fs.mkdir(challengeDir, { recursive: true });

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
                
                // Écrire le fichier de challenge
                const challengeFile = path.join(challengeDir, httpChallenge.token);
                await fs.writeFile(challengeFile, keyAuthorization);
                
                console.log(`  ✓ Challenge créé pour: ${authz.identifier.value}`);
                console.log(`    Token: ${httpChallenge.token}`);
                console.log(`    Fichier: ${challengeFile}`);
                
                // Vérifier que le fichier est accessible
                await client.verifyChallenge(authz, httpChallenge);
                
                // Valider le challenge
                await client.completeChallenge(httpChallenge);
                console.log(`  ✅ Challenge complété pour: ${authz.identifier.value}`);
            }
        }

        // Attendre la validation
        console.log('⏳ Attente de la validation par Let\'s Encrypt...');
        console.log('   (Cela peut prendre 30-60 secondes...)');
        await client.waitForValidStatus(order);

        // Finaliser l'ordre
        console.log('✅ Validation réussie ! Finalisation...');
        await client.finalizeOrder(order, certCsr);
        const cert = await client.getCertificate(order);

        // Sauvegarder les fichiers
        console.log('💾 Sauvegarde des certificats...');
        
        await fs.writeFile(path.join(certDir, 'privkey.pem'), certKey);
        await fs.writeFile(path.join(certDir, 'fullchain.pem'), cert);
        
        // Séparer le cert et la chain
        const certParts = cert.split(/(?=-----BEGIN CERTIFICATE-----)/g).filter(p => p.trim());
        await fs.writeFile(path.join(certDir, 'cert.pem'), certParts[0]);
        if (certParts.length > 1) {
            await fs.writeFile(path.join(certDir, 'chain.pem'), certParts.slice(1).join(''));
        }

        // Nettoyer les fichiers de challenge
        console.log('🧹 Nettoyage des fichiers de challenge...');
        for (const authz of authorizations) {
            const httpChallenge = authz.challenges.find(c => c.type === 'http-01');
            if (httpChallenge) {
                try {
                    await fs.unlink(path.join(challengeDir, httpChallenge.token));
                } catch (e) {
                    // Ignore si déjà supprimé
                }
            }
        }

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
        console.log('');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        if (error.response && error.response.body) {
            console.error('Détails:', JSON.stringify(error.response.body, null, 2));
        }
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Lancer la génération
generateCertificate();



