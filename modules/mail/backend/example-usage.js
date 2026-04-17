/**
 * Exemple d'utilisation du module Mail
 * Fichier : backend/modules/mail/example-usage.js
 * 
 * Ce fichier montre comment utiliser le module Mail dans un autre module
 */

const mailModule = require('./index');
const mail = mailModule.getMailService();

/**
 * Exemple 1 : Configuration d'un module
 */
async function example1_configureModule() {
  mail.initModule({
    module_name: 'analyse-intention',
    collection_name: 'emails_analyse', // Optionnel
    smtp_profiles: {
      alerts: {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'alerts@analyse.gdri.fr',
            pass: process.env.ANALYSE_ALERTS_SMTP_PASS
          }
        },
        from: {
          name: 'Agent Analyse - Alerts',
          email: 'alerts@analyse.gdri.fr'
        }
      },
      notifications: {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'notifications@analyse.gdri.fr',
            pass: process.env.ANALYSE_NOTIF_SMTP_PASS
          }
        },
        from: {
          name: 'Agent Analyse - Notifications',
          email: 'notifications@analyse.gdri.fr'
        }
      }
    },
    routing_rules: [
      {
        condition: { priority: 'high', category: 'alert' },
        use_profile: 'alerts',
        default_to: 'admin@entite.fr'
      },
      {
        condition: { type: 'notification' },
        use_profile: 'notifications',
        default_to: 'user@entite.fr'
      }
    ]
  });

  console.log('✅ Module configuré');
}

/**
 * Exemple 2 : Envoi avec routing automatique
 */
async function example2_sendWithRouting() {
  const result = await mail.send({
    to: 'user@example.com',
    subject: 'Alerte importante',
    body: 'Une alerte de priorité haute a été détectée.',
    context: {
      priority: 'high',
      category: 'alert'
    },
    module_name: 'analyse-intention',
    entity_id: '1234567890abcdef12345678'
  });

  console.log('Résultat:', result);
  // Routing automatique → utilise profil 'alerts'
  // Si pas de 'to' fourni, utilise default_to de la règle
}

/**
 * Exemple 3 : Envoi avec profil explicite
 */
async function example3_sendWithExplicitProfile() {
  const result = await mail.send({
    to: 'admin@example.com',
    subject: 'Rapport quotidien',
    body: 'Voir le rapport en pièce jointe.',
    profile: 'notifications', // Force l'utilisation de ce profil
    module_name: 'analyse-intention',
    entity_id: '1234567890abcdef12345678'
  });

  console.log('Résultat:', result);
}

/**
 * Exemple 4 : Envoi avec HTML et pièces jointes
 */
async function example4_sendWithHTML() {
  const result = await mail.send({
    to: 'user@example.com',
    subject: 'Rapport HTML',
    body: 'Version texte du rapport',
    body_html: `
      <h1>Rapport HTML</h1>
      <p>Ceci est la version HTML du message.</p>
      <ul>
        <li>Point 1</li>
        <li>Point 2</li>
      </ul>
    `,
    attachments: [
      { filename: 'rapport.pdf', path: '/chemin/vers/rapport.pdf' }
    ],
    profile: 'notifications',
    module_name: 'analyse-intention',
    entity_id: '1234567890abcdef12345678'
  });

  console.log('Résultat:', result);
}

/**
 * Exemple 5 : Récupération des emails
 */
async function example5_getEmails() {
  const emails = await mail.getEmails('1234567890abcdef12345678', {
    module_name: 'analyse-intention',
    status: 'sent',
    from_date: new Date('2024-01-01'),
    to_date: new Date('2024-12-31')
  });

  console.log(`${emails.length} emails trouvés`);
  emails.forEach(email => {
    console.log(`- ${email.subject} (${email.status}) envoyé le ${email.sent_at}`);
  });
}

// Exécuter les exemples (décommenter pour tester)
/*
(async () => {
  try {
    await example1_configureModule();
    // await example2_sendWithRouting();
    // await example3_sendWithExplicitProfile();
    // await example4_sendWithHTML();
    // await example5_getEmails();
  } catch (error) {
    console.error('Erreur:', error);
  }
})();
*/

module.exports = {
  example1_configureModule,
  example2_sendWithRouting,
  example3_sendWithExplicitProfile,
  example4_sendWithHTML,
  example5_getEmails
};

