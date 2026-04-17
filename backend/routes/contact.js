/**
 * Routes API publiques pour le formulaire de contact
 * Fichier : backend/routes/contact.js
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const path = require('path');
const mailModule = require(path.join(__dirname, '../../modules/mail/backend'));
const mail = mailModule.getMailService();

/**
 * Fonction utilitaire pour récupérer l'ID de l'entité GDR-Innovation
 */
async function getGDRIEntityId() {
  try {
    const entitiesCollection = database.getCollection('entities');
    const entity = await entitiesCollection.findOne({ name: 'GDR-Innovation' });
    
    if (entity) {
      return entity._id.toString();
    }
    
    return null;
  } catch (error) {
    console.error('Erreur récupération entité GDRI:', error);
    return null;
  }
}

/**
 * POST /api/contact/send
 * Route publique pour envoyer un email depuis le formulaire de contact
 */
router.post('/send', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation des champs requis
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Les champs nom, email, sujet et message sont requis'
      });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
    }

    // Récupérer l'ID de l'entité GDR-Innovation
    const entityId = await getGDRIEntityId();
    
    if (!entityId) {
      console.error('❌ Entité GDR-Innovation introuvable');
      return res.status(500).json({
        success: false,
        message: 'Configuration serveur introuvable'
      });
    }

    // Charger la configuration SMTP depuis MongoDB
    const configCollection = database.getCollection('mail_configs');
    const savedConfig = await configCollection.findOne({
      module_name: 'mail',
      entity_id: entityId
    });

    if (!savedConfig || !savedConfig.config) {
      console.error('❌ Configuration SMTP introuvable pour l\'entité GDRI');
      return res.status(500).json({
        success: false,
        message: 'Configuration email introuvable'
      });
    }

    // Initialiser le service Mail avec la config
    mail.initModule({
      module_name: 'contact',
      ...savedConfig.config
    });

    // Trouver le profil SMTP pour app@gdr-innovation.fr
    let smtpProfile = null;
    if (savedConfig.config.smtp_profiles) {
      // Chercher le profil qui utilise app@gdr-innovation.fr comme from.email
      for (const [profileName, profileConfig] of Object.entries(savedConfig.config.smtp_profiles)) {
        if (profileConfig.from && profileConfig.from.email === 'app@gdr-innovation.fr') {
          smtpProfile = profileName;
          break;
        }
      }
      
      // Si aucun profil trouvé, utiliser le premier profil disponible
      if (!smtpProfile && Object.keys(savedConfig.config.smtp_profiles).length > 0) {
        smtpProfile = Object.keys(savedConfig.config.smtp_profiles)[0];
        console.log(`⚠️  Profil app@gdr-innovation.fr non trouvé, utilisation du profil: ${smtpProfile}`);
      }
    }

    if (!smtpProfile) {
      console.error('❌ Aucun profil SMTP disponible');
      return res.status(500).json({
        success: false,
        message: 'Configuration email incomplète'
      });
    }

    // Préparer le contenu de l'email
    const subjectMap = {
      'demande': 'Demande d\'information',
      'devis': 'Demande de devis',
      'support': 'Support technique',
      'autre': 'Autre demande'
    };

    const emailSubject = `[Formulaire Contact] ${subjectMap[subject] || subject}`;
    
    // Corps texte
    const emailBody = `
Nouveau message depuis le formulaire de contact

Nom: ${name}
Email: ${email}
${phone ? `Téléphone: ${phone}` : ''}
Sujet: ${subjectMap[subject] || subject}

Message:
${message}

---
Ce message a été envoyé depuis le formulaire de contact du site GDR-Innovation.
    `.trim();

    // Corps HTML
    const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #9edbeb; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #606163; }
    .message-box { background-color: white; padding: 15px; border-left: 4px solid #b9e821; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e4e4e4; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #606163;">Nouveau message depuis le formulaire de contact</h2>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">Nom:</span> ${name}
      </div>
      <div class="field">
        <span class="label">Email:</span> <a href="mailto:${email}">${email}</a>
      </div>
      ${phone ? `<div class="field"><span class="label">Téléphone:</span> <a href="tel:${phone}">${phone}</a></div>` : ''}
      <div class="field">
        <span class="label">Sujet:</span> ${subjectMap[subject] || subject}
      </div>
      <div class="message-box">
        <div class="label" style="margin-bottom: 10px;">Message:</div>
        <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">Ce message a été envoyé depuis le formulaire de contact du site GDR-Innovation.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Envoyer l'email
    const result = await mail.send({
      to: 'contact@gdr-innovation.fr',
      subject: emailSubject,
      body: emailBody,
      body_html: emailBodyHtml,
      profile: smtpProfile,
      module_name: 'contact',
      entity_id: entityId
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.'
      });
    } else {
      console.error('Erreur envoi email contact:', result.error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du message. Veuillez réessayer plus tard.'
      });
    }

  } catch (error) {
    console.error('Erreur route contact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur. Veuillez réessayer plus tard.'
    });
  }
});

module.exports = router;


