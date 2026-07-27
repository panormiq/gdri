/**
 * FICHIER : modules/doc-hub/backend/services/mail/resolveSmtpProfile.js
 * RÔLE : Résout le profil SMTP à utiliser : compte entité (module mail)
 *        si utilisable, sinon repli gdri_app (GDRI).
 *
 * SORTIES : clé du profil SMTP nodemailer (string)
 */

const getMailService = require('./getMailService');
const hasUsableEntitySmtp = require('./hasUsableEntitySmtp');
const registerEntityProfilesAndPickKey = require('./registerEntityProfilesAndPickKey');

async function resolveSmtpProfile(entrepriseId) {
  const mail = getMailService();
  await mail.init();
  mail.registerFallbackFromEnv();

  const entityMailConfig = await mail.loadConfigFromDB(entrepriseId, 'mail');
  const entityProfile = registerEntityProfilesAndPickKey(mail, entityMailConfig, entrepriseId);

  if (entityProfile) {
    return entityProfile;
  }

  if (entityMailConfig && !hasUsableEntitySmtp(entityMailConfig)) {
    console.log(
      'Doc-Hub: pas de compte SMTP utilisable pour l’entité — repli sur gdri_app (app@gdr-innovation.fr)'
    );
  }

  if (mail.hasFallbackProfile()) {
    return 'gdri_app';
  }

  const preferred = mail.smtpManager.getPreferredProfile(['gdri_app', 'gdri', 'client']);
  if (preferred) {
    return preferred;
  }

  throw new Error(
    'Aucun serveur mail disponible. Configurez SMTP_HOST, SMTP_USER et SMTP_PASS sur le serveur GDRI, ' +
      'ou complétez le module Mail de votre entité (compte + mot de passe).'
  );
}

module.exports = resolveSmtpProfile;
