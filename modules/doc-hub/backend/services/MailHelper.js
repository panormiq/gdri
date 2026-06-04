/**
 * Résolution profil SMTP : compte entité (module mail) si utilisable, sinon gdri_app (GDRI)
 */

const path = require('path');

function getMailService() {
  const mailModule = require(path.join(__dirname, '../../../mail/backend/index'));
  return mailModule.getMailService();
}

/**
 * Compte SMTP entité réellement utilisable (mot de passe + serveur renseignés)
 * @param {Object|null} entityMailConfig
 * @returns {boolean}
 */
function hasUsableEntitySmtp(entityMailConfig) {
  if (!entityMailConfig || typeof entityMailConfig !== 'object') return false;

  const legacy = entityMailConfig.smtp_profiles;
  if (legacy && typeof legacy === 'object') {
    const keys = Object.keys(legacy);
    if (!keys.length) return false;
    const p = legacy[keys[0]];
    const user = p?.smtp?.auth?.user;
    const pass = p?.smtp?.auth?.pass;
    return Boolean(p?.smtp?.host && user && pass);
  }

  const comptes = entityMailConfig.comptes;
  const profilsSmtp = entityMailConfig.profils_smtp;
  if (!Array.isArray(comptes) || !comptes.length || !Array.isArray(profilsSmtp)) return false;

  const smtpById = profilsSmtp.reduce((acc, p) => {
    if (p && p.id) acc[p.id] = p;
    return acc;
  }, {});

  return comptes.some((c) => {
    if (!c?.email || !c?.password || !c?.profil_smtp_id) return false;
    const profil = smtpById[c.profil_smtp_id];
    return Boolean(profil && profil.host);
  });
}

/**
 * Enregistre les profils SMTP entité et retourne la clé du premier profil utilisable
 * @returns {string|null}
 */
function registerEntityProfilesAndPickKey(mail, entityMailConfig, entrepriseId) {
  if (!hasUsableEntitySmtp(entityMailConfig)) return null;

  const moduleKey = `doc-hub-smtp-${entrepriseId}`;
  try {
    mail.initModule({
      module_name: moduleKey,
      ...entityMailConfig
    });
  } catch (err) {
    console.warn('Doc-Hub: SMTP entité non utilisable:', err.message);
    return null;
  }

  const hasComptes = Array.isArray(entityMailConfig.comptes) && entityMailConfig.comptes.length > 0;
  const keys = mail.smtpManager.getProfileKeys();

  if (hasComptes) {
    const smtpById = (entityMailConfig.profils_smtp || []).reduce((acc, p) => {
      if (p?.id) acc[p.id] = p;
      return acc;
    }, {});
    for (const c of entityMailConfig.comptes) {
      if (!c?.email || !c?.password || !c?.profil_smtp_id) continue;
      if (!smtpById[c.profil_smtp_id]) continue;
      const key = c.id || c.email;
      if (keys.includes(key)) return key;
    }
    return null;
  }

  if (entityMailConfig.smtp_profiles) {
    for (const key of Object.keys(entityMailConfig.smtp_profiles)) {
      const p = entityMailConfig.smtp_profiles[key];
      if (p?.smtp?.auth?.pass && keys.includes(key)) return key;
    }
  }

  return null;
}

/**
 * @returns {Promise<string>} clé du profil SMTP nodemailer
 */
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

/**
 * Libellé affichable pour la traçabilité
 * @param {string} profileKey
 * @returns {string}
 */
function smtpProfileLabel(profileKey) {
  if (profileKey === 'gdri_app') return 'GDRI (app@gdr-innovation.fr)';
  return profileKey || '—';
}

module.exports = {
  getMailService,
  resolveSmtpProfile,
  hasUsableEntitySmtp,
  smtpProfileLabel
};
