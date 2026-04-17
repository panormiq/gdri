/**
 * Script de test pour l'envoi d'emails du Security Monitor
 * Fichier : backend/test-security-monitor-email.js
 * 
 * Ce script teste la fonctionnalité d'envoi d'email du Security Monitor
 * sans avoir besoin de détecter de vraies attaques.
 */

// ⚠️ IMPORTANT : Charger dotenv EN PREMIER
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const database = require('./config/database');
const mailModule = require(path.join(__dirname, '../modules/mail/backend'));

// Configuration (identique au Security Monitor)
const CONFIG = {
  alertEmail: process.env.SECURITY_ALERT_EMAIL || 'admin@gdri.fr'
};

/**
 * Test d'envoi d'email du Security Monitor
 */
async function testEmail() {
  console.log('🧪 Test d\'envoi d\'email du Security Monitor\n');
  
  // Vérifier les variables d'environnement
  console.log('📋 Vérification de la configuration...');
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Créez un fichier .env à la racine du projet avec:');
    console.error('   SMTP_HOST=smtp.gmail.com');
    console.error('   SMTP_PORT=587');
    console.error('   SMTP_SECURE=false');
    console.error('   SMTP_USER=votre-email@gmail.com');
    console.error('   SMTP_PASS=votre-mot-de-passe-app');
    console.error('   SMTP_FROM=security@gdri.fr');
    console.error('   SECURITY_ALERT_EMAIL=admin@gdri.fr');
    process.exit(1);
  }
  
  console.log('✅ Variables d\'environnement OK');
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`   SMTP_FROM: ${process.env.SMTP_FROM || '(non défini, utilisation de SMTP_USER)'}`);
  console.log(`   SECURITY_ALERT_EMAIL: ${CONFIG.alertEmail}`);
  
  // Avertir si SMTP_FROM est différent de SMTP_USER
  if (process.env.SMTP_FROM && process.env.SMTP_FROM !== process.env.SMTP_USER) {
    console.log(`\n⚠️  ATTENTION: SMTP_FROM (${process.env.SMTP_FROM}) est différent de SMTP_USER (${process.env.SMTP_USER})`);
    console.log(`   L'adresse d'envoi sera ${process.env.SMTP_USER} pour éviter les erreurs de permissions SMTP.`);
    console.log('   Pour utiliser SMTP_FROM, configurez les permissions dans votre serveur SMTP.\n');
  } else {
    console.log('');
  }
  
  try {
    // Connecter à MongoDB
    console.log('🔌 Connexion à MongoDB...');
    await database.connect();
    console.log('✅ MongoDB connecté\n');
    
    // Initialiser le service Mail (comme le fait le Security Monitor)
    console.log('📧 Initialisation du service Mail...');
    const mail = mailModule.getMailService();
    await mail.init();
    
    // Configurer le module pour les alertes de sécurité (identique au Security Monitor)
    mail.initModule({
      module_name: 'security-monitor',
      collection_name: 'security_alerts',
      smtp_profiles: {
        alerts: {
          smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: {
            name: 'GDRI Security Monitor',
            // Utiliser SMTP_USER par défaut pour éviter les erreurs de permissions SMTP
            // (Gmail/Office365 ne permet pas d'envoyer depuis une autre adresse que celle d'authentification)
            email: process.env.SMTP_USER || process.env.SMTP_FROM || 'security@gdri.fr'
          }
        }
      },
      routing_rules: [
        {
          condition: { priority: 'high', type: 'security_alert' },
          use_profile: 'alerts',
          default_to: CONFIG.alertEmail
        }
      ]
    });
    console.log('✅ Service Mail initialisé\n');
    
    // Créer une attaque de test
    const testAttacks = [
      {
        timestamp: new Date(),
        ip: '192.168.1.100',
        method: 'GET',
        uri: '/.env',
        userAgent: 'Mozilla/5.0 (Test Bot)',
        attackType: 'sensitive_file_access',
        severity: 'medium',
        logLine: '192.168.1.100 - - [01/Jan/2024:12:00:00 +0100] "GET /.env HTTP/1.1" 403 1234'
      },
      {
        timestamp: new Date(),
        ip: '10.0.0.50',
        method: 'GET',
        uri: '/index.php?page=union+select+*+from+users',
        userAgent: 'sqlmap/1.0',
        attackType: 'sql_injection',
        severity: 'high',
        logLine: '10.0.0.50 - - [01/Jan/2024:12:01:00 +0100] "GET /index.php?page=union+select+*+from+users HTTP/1.1" 403 1234'
      }
    ];
    
    // Grouper les attaques par type (comme le fait le Security Monitor)
    const attacksByType = {};
    const attacksByIP = {};
    
    testAttacks.forEach(attack => {
      if (!attacksByType[attack.attackType]) {
        attacksByType[attack.attackType] = [];
      }
      attacksByType[attack.attackType].push(attack);
      
      if (!attacksByIP[attack.ip]) {
        attacksByIP[attack.ip] = [];
      }
      attacksByIP[attack.ip].push(attack);
    });
    
    // Générer le rapport HTML (identique au Security Monitor)
    let reportHTML = '<h2>🧪 TEST - Alerte de Sécurité - Attaques Détectées</h2>';
    reportHTML += '<p style="color: orange; font-weight: bold;">⚠️ Ceci est un email de TEST</p>';
    reportHTML += `<p><strong>Nombre total d'attaques:</strong> ${testAttacks.length}</p>`;
    reportHTML += `<p><strong>Période:</strong> ${testAttacks[0].timestamp.toLocaleString('fr-FR')} - ${testAttacks[testAttacks.length - 1].timestamp.toLocaleString('fr-FR')}</p>`;
    
    reportHTML += '<h3>📊 Répartition par type d\'attaque:</h3><ul>';
    Object.keys(attacksByType).forEach(type => {
      reportHTML += `<li><strong>${type}:</strong> ${attacksByType[type].length} attaque(s)</li>`;
    });
    reportHTML += '</ul>';
    
    reportHTML += '<h3>🌐 Adresses IP suspectes:</h3><ul>';
    Object.keys(attacksByIP).forEach(ip => {
      reportHTML += `<li><strong>${ip}:</strong> ${attacksByIP[ip].length} attaque(s)</li>`;
    });
    reportHTML += '</ul>';
    
    reportHTML += '<h3>🔍 Détails des attaques:</h3><table border="1" cellpadding="5" style="border-collapse: collapse;">';
    reportHTML += '<tr><th>Heure</th><th>IP</th><th>Type</th><th>URI</th><th>User-Agent</th></tr>';
    testAttacks.forEach(attack => {
      reportHTML += `<tr>
        <td>${attack.timestamp.toLocaleString('fr-FR')}</td>
        <td>${attack.ip}</td>
        <td>${attack.attackType}</td>
        <td>${attack.uri.substring(0, 50)}</td>
        <td>${attack.userAgent.substring(0, 50)}</td>
      </tr>`;
    });
    reportHTML += '</table>';
    
    // Générer le rapport texte (pour les clients email qui ne supportent pas HTML)
    let reportText = '🧪 TEST - Alerte de Sécurité - Attaques Détectées\n';
    reportText += '⚠️ Ceci est un email de TEST\n\n';
    reportText += `Nombre total d'attaques: ${testAttacks.length}\n`;
    reportText += `Période: ${testAttacks[0].timestamp.toLocaleString('fr-FR')} - ${testAttacks[testAttacks.length - 1].timestamp.toLocaleString('fr-FR')}\n\n`;
    
    reportText += '📊 Répartition par type d\'attaque:\n';
    Object.keys(attacksByType).forEach(type => {
      reportText += `  - ${type}: ${attacksByType[type].length} attaque(s)\n`;
    });
    reportText += '\n';
    
    reportText += '🌐 Adresses IP suspectes:\n';
    Object.keys(attacksByIP).forEach(ip => {
      reportText += `  - ${ip}: ${attacksByIP[ip].length} attaque(s)\n`;
    });
    reportText += '\n';
    
    reportText += '🔍 Détails des attaques:\n';
    testAttacks.forEach(attack => {
      reportText += `  - [${attack.timestamp.toLocaleString('fr-FR')}] ${attack.ip} - ${attack.attackType} - ${attack.uri.substring(0, 50)}\n`;
    });
    
    // Envoyer l'email de test
    console.log('📤 Envoi de l\'email de test...');
    console.log(`   Destinataire: ${CONFIG.alertEmail}`);
    
    const result = await mail.send({
      to: CONFIG.alertEmail,
      subject: '🧪 TEST - Alerte Sécurité - 2 attaque(s) détectée(s)',
      body: reportText,
      body_html: reportHTML,
      context: {
        priority: 'high',
        type: 'security_alert'
      },
      module_name: 'security-monitor'
    });
    
    console.log('\n✅ Email envoyé avec succès !');
    console.log(`   Message ID: ${result.messageId || 'N/A'}`);
    console.log(`   Status: ${result.status || 'sent'}`);
    
    if (result.error) {
      console.warn(`   ⚠️  Avertissement: ${result.error}`);
    }
    
    console.log('\n📬 Vérifiez votre boîte mail (et les spams) pour confirmer la réception.');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:');
    console.error(error);
    
    if (error.code === 'EAUTH') {
      console.error('\n💡 Erreur d\'authentification SMTP:');
      console.error('   - Vérifiez vos identifiants SMTP_USER et SMTP_PASS');
      console.error('   - Pour Gmail, utilisez un "Mot de passe d\'application"');
      console.error('   - Activez la validation en 2 étapes sur votre compte Gmail');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Erreur de connexion SMTP:');
      console.error('   - Vérifiez SMTP_HOST et SMTP_PORT');
      console.error('   - Vérifiez votre connexion internet');
      console.error('   - Vérifiez que le serveur SMTP est accessible');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Timeout de connexion SMTP:');
      console.error('   - Le serveur SMTP ne répond pas');
      console.error('   - Vérifiez SMTP_HOST et SMTP_PORT');
    }
    
    process.exit(1);
  } finally {
    // Fermer la connexion MongoDB
    try {
      await database.close();
      console.log('\n🔌 Connexion MongoDB fermée');
    } catch (error) {
      // Ignorer les erreurs de fermeture
    }
  }
}

// Exécuter le test
testEmail().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
