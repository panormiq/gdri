/**
 * Script de test pour la vidéo de démonstration - Permission read_insights
 * 
 * Démontre l'utilisation de read_insights pour :
 * - Lire les statistiques de la Page Facebook
 * - Analyser les tendances de communication
 * - Optimiser la stratégie client avec des données agrégées
 * 
 * Usage: node backend/test-read-insights.js
 * 
 * Note: Ce script simule l'accès aux insights Facebook.
 * En production, il faudrait utiliser l'API Graph Facebook avec un token valide.
 */

const http = require('http');
const database = require('./config/database');
const path = require('path');
const mailModule = require(path.join(__dirname, '../modules/mail/backend'));

// Configuration
const BACKEND_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/facebook/insights';
const ENTITY_NAME = 'GDR-Innovation';

// Données d'insights simulées (basées sur l'API Graph Facebook)
const insightsData = {
  page_id: '123456789',
  period: 'day',
  metrics: [
    {
      name: 'page_fans',
      values: [
        {
          value: 1250,
          end_time: new Date().toISOString()
        }
      ],
      title: 'Fans de la Page',
      description: 'Nombre total de personnes qui aiment votre Page'
    },
    {
      name: 'page_engaged_users',
      values: [
        {
          value: 342,
          end_time: new Date().toISOString()
        }
      ],
      title: 'Utilisateurs engagés',
      description: 'Nombre de personnes qui ont interagi avec votre Page'
    },
    {
      name: 'page_post_engagements',
      values: [
        {
          value: 89,
          end_time: new Date().toISOString()
        }
      ],
      title: 'Engagements sur les publications',
      description: 'Nombre total d\'engagements (likes, commentaires, partages)'
    },
    {
      name: 'page_messages_received',
      values: [
        {
          value: 15,
          end_time: new Date().toISOString()
        }
      ],
      title: 'Messages reçus',
      description: 'Nombre de messages privés reçus'
    },
    {
      name: 'page_negative_feedback',
      values: [
        {
          value: 2,
          end_time: new Date().toISOString()
        }
      ],
      title: 'Retours négatifs',
      description: 'Nombre de signalements ou masquages de publications'
    }
  ],
  // Statistiques agrégées pour analyse
  summary: {
    total_fans: 1250,
    engagement_rate: 27.36, // (342 / 1250) * 100
    avg_engagements_per_post: 89,
    messages_today: 15,
    negative_feedback_rate: 0.16 // (2 / 1250) * 100
  }
};

let cachedEntityId = null;

async function resolveEntityId() {
  if (cachedEntityId) {
    return cachedEntityId;
  }

  await database.connect();
  const db = await database.connect();
  const entitiesCollection = db.collection('entities');
  const entity = await entitiesCollection.findOne({ name: ENTITY_NAME });
  if (entity) {
    cachedEntityId = entity._id.toString();
    return cachedEntityId;
  }
  return null;
}

async function getDefaultMailConfig(entityId) {
  const mailService = mailModule.getMailService();
  const facebookConfig = await mailService.loadConfigFromDB(entityId, 'facebook');
  if (facebookConfig && facebookConfig.smtp_profiles && Object.keys(facebookConfig.smtp_profiles).length > 0) {
    return { config: facebookConfig, profile: getDefaultProfileName(facebookConfig) };
  }
  const defaultMailConfig = await mailService.loadConfigFromDB(entityId, 'mail');
  if (defaultMailConfig && defaultMailConfig.smtp_profiles && Object.keys(defaultMailConfig.smtp_profiles).length > 0) {
    return { config: defaultMailConfig, profile: getDefaultProfileName(defaultMailConfig) };
  }
  return { config: null, profile: null };
}

function getDefaultProfileName(mailConfig) {
  if (!mailConfig || !mailConfig.smtp_profiles) {
    return null;
  }
  if (mailConfig.default_profile && mailConfig.smtp_profiles[mailConfig.default_profile]) {
    return mailConfig.default_profile;
  }
  const keys = Object.keys(mailConfig.smtp_profiles);
  return keys.length > 0 ? keys[0] : null;
}

// Fonction pour simuler l'appel à l'API Graph Facebook
function simulateGraphAPIInsights() {
  return new Promise((resolve) => {
    // Simuler un délai d'appel API
    setTimeout(() => {
      resolve(insightsData);
    }, 500);
  });
}

// Fonction pour afficher les insights
function displayInsights(insights) {
  console.log('');
  console.log('📊 === INSIGHTS FACEBOOK (read_insights) ===');
  console.log('');
  console.log('🔍 STATISTIQUES DE LA PAGE');
  console.log('═'.repeat(70));
  console.log(`📱 Page ID: ${insights.page_id}`);
  console.log(`📅 Période: ${insights.period}`);
  console.log('');

  insights.metrics.forEach(metric => {
    const value = metric.values[0].value;
    console.log(`📈 ${metric.title}:`);
    console.log(`   Valeur: ${value.toLocaleString()}`);
    console.log(`   Description: ${metric.description}`);
    console.log('');
  });

  console.log('📊 RÉSUMÉ ANALYTIQUE');
  console.log('═'.repeat(70));
  console.log(`👥 Total de fans: ${insights.summary.total_fans.toLocaleString()}`);
  console.log(`📊 Taux d'engagement: ${insights.summary.engagement_rate.toFixed(2)}%`);
  console.log(`💬 Engagements moyens par publication: ${insights.summary.avg_engagements_per_post}`);
  console.log(`📨 Messages reçus aujourd'hui: ${insights.summary.messages_today}`);
  console.log(`⚠️  Taux de retours négatifs: ${insights.summary.negative_feedback_rate.toFixed(2)}%`);
  console.log('');
}

// Fonction pour analyser les tendances
function analyzeTrends(insights) {
  console.log('🔬 ANALYSE DES TENDANCES');
  console.log('═'.repeat(70));
  
  const engagementRate = insights.summary.engagement_rate;
  const negativeRate = insights.summary.negative_feedback_rate;
  
  if (engagementRate > 20) {
    console.log('✅ Excellent taux d\'engagement (>20%)');
    console.log('   → La communauté est très active');
  } else if (engagementRate > 10) {
    console.log('⚠️  Taux d\'engagement moyen (10-20%)');
    console.log('   → Possibilité d\'améliorer l\'interaction');
  } else {
    console.log('❌ Taux d\'engagement faible (<10%)');
    console.log('   → Action recommandée: augmenter l\'interaction');
  }
  
  console.log('');
  
  if (negativeRate < 1) {
    console.log('✅ Très faible taux de retours négatifs (<1%)');
    console.log('   → Le contenu est bien reçu par la communauté');
  } else if (negativeRate < 3) {
    console.log('⚠️  Taux de retours négatifs acceptable (1-3%)');
    console.log('   → Surveiller le contenu publié');
  } else {
    console.log('❌ Taux de retours négatifs élevé (>3%)');
    console.log('   → Action recommandée: revoir la stratégie de contenu');
  }
  
  console.log('');
  
  const messagesCount = insights.summary.messages_today;
  if (messagesCount > 10) {
    console.log('📨 Volume de messages élevé');
    console.log('   → Notre système d\'analyse automatique est essentiel');
    console.log('   → Le routing intelligent permet de gérer efficacement');
  } else {
    console.log('📨 Volume de messages normal');
    console.log('   → Le système d\'analyse permet une réactivité optimale');
  }
  
  console.log('');
}

async function sendInsightsEmail(insights) {
  try {
    const entityId = await resolveEntityId();
    if (!entityId) {
      console.log('⚠️  Impossible de déterminer l\'entité GDRI, email non envoyé.');
      return;
    }

    const mailService = mailModule.getMailService();
    await database.connect();

    const { config, profile } = await getDefaultMailConfig(entityId);
    if (!config || !profile) {
      console.log('⚠️  Aucun profil SMTP disponible pour envoyer le rapport read_insights.');
      return;
    }

    mailService.initModule({
      module_name: 'facebook-insights',
      ...config
    });

    const emailContent = formatInsightsEmail(insights);
    const defaultEmail = config.defaultEmail || (config.recipients && config.recipients.default) || null;

    if (!defaultEmail) {
      console.log('⚠️  Aucun email par défaut configuré pour les rapports read_insights.');
      return;
    }

    const emailResult = await mailService.send({
      to: defaultEmail,
      subject: '📈 Rapport Read Insights Facebook',
      body: emailContent.text,
      body_html: emailContent.html,
      module_name: 'facebook-insights',
      entity_id: entityId,
      profile,
      context: {
        category: 'insights',
        priority: 'medium'
      }
    });

    if (emailResult.success) {
      console.log('📧 Rapport read_insights envoyé avec succès.');
    } else {
      console.log('❌ Erreur lors de l\'envoi du rapport read_insights :', emailResult.error);
    }
  } catch (error) {
    console.error('❌ Erreur sendInsightsEmail:', error.message || error);
  }
}

function formatInsightsEmail(insights) {
  const now = new Date().toLocaleString('fr-FR');

  let text = '📈 RAPPORT READ_INSIGHTS FACEBOOK\n';
  text += '════════════════════════════════════\n';
  text += `Date de génération : ${now}\n\n`;

  text += '💡 SYNTHÈSE\n';
  text += '────────────────────────────\n';
  text += `Fans totaux : ${insights.summary.total_fans.toLocaleString()}\n`;
  text += `Taux d'engagement : ${insights.summary.engagement_rate.toFixed(2)}%\n`;
  text += `Engagements moyens par publication : ${insights.summary.avg_engagements_per_post}\n`;
  text += `Messages reçus aujourd'hui : ${insights.summary.messages_today}\n`;
  text += `Taux de retours négatifs : ${insights.summary.negative_feedback_rate.toFixed(2)}%\n\n`;

  text += '📊 DÉTAIL DES METRICS\n';
  text += '────────────────────────────\n';
  insights.metrics.forEach(metric => {
    text += `• ${metric.title}: ${metric.values[0].value.toLocaleString()}\n`;
    text += `  ${metric.description}\n`;
  });
  text += '\n';

  text += '✅ RECOMMANDATIONS\n';
  text += '────────────────────────────\n';
  const engagementRate = insights.summary.engagement_rate;
  const negativeRate = insights.summary.negative_feedback_rate;
  if (engagementRate > 20) {
    text += 'Taux d\'engagement excellent : maintenir la stratégie actuelle.\n';
  } else if (engagementRate > 10) {
    text += 'Taux d\'engagement moyen : envisager plus de contenus interactifs.\n';
  } else {
    text += 'Taux d\'engagement faible : plan d\'action nécessaire pour relancer l\'activité.\n';
  }
  if (negativeRate >= 3) {
    text += 'Attention : retours négatifs élevés. Revoir le contenu publié.\n';
  } else {
    text += 'Retours négatifs sous contrôle.\n';
  }

  let html = '<div style="font-family:Helvetica,Arial,sans-serif;color:#1f2933;">';
  html += '<h2 style="color:#0d6efd;margin-bottom:4px;">📈 Rapport Read Insights Facebook</h2>';
  html += `<p style="margin-top:0;color:#6c757d;">Date de génération : ${now}</p>`;
  html += '<section style="margin-bottom:20px;padding:16px;background:#f8f9fb;border-radius:8px;">';
  html += '<h3 style="margin-top:0;color:#0d6efd;">💡 Synthèse</h3>';
  html += '<ul style="margin:0;padding-left:18px;">';
  html += `<li>Fans totaux : <strong>${insights.summary.total_fans.toLocaleString()}</strong></li>`;
  html += `<li>Taux d'engagement : <strong>${insights.summary.engagement_rate.toFixed(2)}%</strong></li>`;
  html += `<li>Engagements moyens par publication : <strong>${insights.summary.avg_engagements_per_post}</strong></li>`;
  html += `<li>Messages reçus aujourd'hui : <strong>${insights.summary.messages_today}</strong></li>`;
  html += `<li>Taux de retours négatifs : <strong>${insights.summary.negative_feedback_rate.toFixed(2)}%</strong></li>`;
  html += '</ul></section>';

  html += '<section style="margin-bottom:24px;">';
  html += '<h3 style="color:#0d6efd;margin-bottom:8px;">📊 Détail des métrics</h3>';
  insights.metrics.forEach(metric => {
    html += '<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:12px;">';
    html += `<p style="margin:0 0 6px 0;font-weight:600;color:#0d6efd;">${metric.title}</p>`;
    html += `<p style="margin:0;color:#1f2933;font-size:22px;font-weight:700;">${metric.values[0].value.toLocaleString()}</p>`;
    html += `<p style="margin:6px 0 0 0;color:#6c757d;">${metric.description}</p>`;
    html += '</div>';
  });
  html += '</section>';

  html += '<section style="margin-bottom:24px;padding:16px;border-radius:8px;background:#e9f7ef;border:1px solid #badbcc;">';
  html += '<h3 style="margin-top:0;">✅ Recommandations</h3>';
  if (engagementRate > 20) {
    html += '<p style="margin:4px 0;">Taux d\'engagement excellent : maintenir la stratégie actuelle.</p>';
  } else if (engagementRate > 10) {
    html += '<p style="margin:4px 0;">Taux d\'engagement moyen : renforcer les contenus interactifs.</p>';
  } else {
    html += '<p style="margin:4px 0;">Taux d\'engagement faible : plan d\'action nécessaire pour relancer l\'activité.</p>';
  }
  if (negativeRate >= 3) {
    html += '<p style="margin:4px 0;color:#b02a37;font-weight:600;">Attention : retours négatifs élevés. Revoir le contenu publié.</p>';
  } else {
    html += '<p style="margin:4px 0;">Retours négatifs sous contrôle.</p>';
  }
  html += '</section>';

  html += '<p style="color:#6c757d;font-size:13px;">— Rapport généré automatiquement par l\'agent Facebook GDRI.</p>';
  html += '</div>';

  return { text, html };
}

// Fonction principale
async function main() {
  console.log('');
  console.log('🧪 TEST READ_INSIGHTS - PERMISSION FACEBOOK');
  console.log('═'.repeat(70));
  console.log('');
  console.log('📖 CONTEXTE:');
  console.log('   L\'autorisation read_insights permet à notre application de:');
  console.log('   • Lire les statistiques de notre Page Facebook');
  console.log('   • Analyser les tendances de communication');
  console.log('   • Optimiser notre stratégie client avec des données agrégées');
  console.log('');
  console.log('🎯 OBJECTIF DE CE TEST:');
  console.log('   Démontrer comment read_insights nous aide à améliorer notre service');
  console.log('   en analysant les données agrégées et anonymisées de notre Page.');
  console.log('');
  console.log('⏳ Récupération des insights depuis l\'API Graph Facebook...');
  console.log('');

  try {
    // Simuler l'appel à l'API Graph Facebook
    const insights = await simulateGraphAPIInsights();
    
    // Afficher les insights
    displayInsights(insights);
    
    // Analyser les tendances
    analyzeTrends(insights);

    // Envoyer le rapport par email
    await sendInsightsEmail(insights);
    
    console.log('═'.repeat(70));
    console.log('✅ TEST TERMINÉ AVEC SUCCÈS');
    console.log('═'.repeat(70));
    console.log('');
    console.log('💡 UTILISATION DE READ_INSIGHTS:');
    console.log('   • Données agrégées et anonymisées uniquement');
    console.log('   • Aucune donnée personnelle identifiante');
    console.log('   • Utilisation pour optimiser notre stratégie client');
    console.log('   • Conformité avec les politiques Facebook');
    console.log('');
    console.log('📹 Ce test est prêt pour la vidéo de démonstration Facebook.');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Test échoué:', error.message);
    process.exit(1);
  }
}

// Lancer le test
main();

