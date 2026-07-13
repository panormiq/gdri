/**
 * Résolution SMTP GDERPI : config module gderpi → mail entité → gdri_app
 */

const path = require('path');

function getMailService() {
  const mailModule = require(path.join(__dirname, '../../../../mail/backend/index'));
  return mailModule.getMailService();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hasUsableEntitySmtp(entityMailConfig) {
  if (!entityMailConfig || typeof entityMailConfig !== 'object') return false;

  const legacy = entityMailConfig.smtp_profiles;
  if (legacy && typeof legacy === 'object') {
    const keys = Object.keys(legacy);
    if (!keys.length) return false;
    const p = legacy[keys[0]];
    return Boolean(p?.smtp?.host && p?.smtp?.auth?.user && p?.smtp?.auth?.pass);
  }

  const comptes = entityMailConfig.comptes;
  const profilsSmtp = entityMailConfig.profils_smtp;
  if (!Array.isArray(comptes) || !comptes.length || !Array.isArray(profilsSmtp)) return false;

  const smtpById = profilsSmtp.reduce((acc, p) => {
    if (p?.id) acc[p.id] = p;
    return acc;
  }, {});

  return comptes.some((c) => {
    if (!c?.email || !c?.password || !c?.profil_smtp_id) return false;
    const profil = smtpById[c.profil_smtp_id];
    return Boolean(profil && profil.host);
  });
}

function registerEntityProfilesAndPickKey(mail, entityMailConfig, moduleKey) {
  if (!hasUsableEntitySmtp(entityMailConfig)) return null;

  try {
    mail.initModule({
      module_name: moduleKey,
      ...entityMailConfig
    });
  } catch (err) {
    console.warn('GDERPI: SMTP entité non utilisable:', err.message);
    return null;
  }

  const keys = mail.smtpManager.getProfileKeys();
  const hasComptes = Array.isArray(entityMailConfig.comptes) && entityMailConfig.comptes.length > 0;

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

function resolveMappedProfileFromConfig(entityMailConfig, recipientEmail) {
  const recipient = normalizeEmail(recipientEmail);
  if (!recipient) return null;
  const mappings = entityMailConfig?.gderpi_contact_accounts;
  if (!mappings || typeof mappings !== 'object') return null;
  const mapped = mappings[recipient];
  if (!mapped) return null;
  const profileKey = String(mapped).trim();
  return profileKey || null;
}

function resolveProfileBySenderEmail(mail, entityMailConfig, senderEmail) {
  const sender = normalizeEmail(senderEmail);
  if (!sender || !entityMailConfig) return null;

  if (Array.isArray(entityMailConfig.comptes)) {
    for (const compte of entityMailConfig.comptes) {
      if (normalizeEmail(compte?.email) !== sender) continue;
      const key = String(compte.id || compte.email || '').trim();
      if (key && mail.smtpManager.getProfileKeys().includes(key)) return key;
    }
  }

  const profiles = entityMailConfig.smtp_profiles;
  if (profiles && typeof profiles === 'object') {
    for (const key of Object.keys(profiles)) {
      const user = profiles[key]?.smtp?.auth?.user;
      if (normalizeEmail(user) === sender && mail.smtpManager.getProfileKeys().includes(key)) {
        return key;
      }
    }
  }

  return null;
}

async function resolveSmtpProfile(entrepriseId) {
  const mail = getMailService();
  await mail.init();
  mail.registerFallbackFromEnv();

  const moduleKey = `gderpi-smtp-${entrepriseId}`;
  const gderpiConfig = await mail.loadConfigFromDB(entrepriseId, 'gderpi');
  const gderpiProfile = registerEntityProfilesAndPickKey(mail, gderpiConfig, moduleKey);
  if (gderpiProfile) return gderpiProfile;

  const mailConfig = await mail.loadConfigFromDB(entrepriseId, 'mail');
  const mailProfile = registerEntityProfilesAndPickKey(mail, mailConfig, `gderpi-mail-fallback-${entrepriseId}`);
  if (mailProfile) return mailProfile;

  if (mail.hasFallbackProfile()) return 'gdri_app';

  const preferred = mail.smtpManager.getPreferredProfile(['gdri_app', 'gdri', 'client']);
  if (preferred) return preferred;

  throw new Error(
    'Aucun serveur mail disponible. Configurez le module Mail (Configuration → Mail) ou les variables SMTP du serveur.'
  );
}

async function resolveSmtpProfileForSender(entrepriseId, senderEmail, options = {}) {
  const mail = getMailService();
  await mail.init();
  mail.registerFallbackFromEnv();

  const gderpiConfig = await mail.loadConfigFromDB(entrepriseId, 'gderpi');
  const gderpiModuleKey = `gderpi-smtp-${entrepriseId}`;
  registerEntityProfilesAndPickKey(mail, gderpiConfig, gderpiModuleKey);

  const mailConfig = await mail.loadConfigFromDB(entrepriseId, 'mail');
  const mailModuleKey = `gderpi-mail-fallback-${entrepriseId}`;
  registerEntityProfilesAndPickKey(mail, mailConfig, mailModuleKey);

  const sender = normalizeEmail(senderEmail);
  const profileKeys = () => mail.smtpManager.getProfileKeys();

  const mappedFromGderpi = resolveMappedProfileFromConfig(gderpiConfig, senderEmail);
  if (mappedFromGderpi && profileKeys().includes(mappedFromGderpi)) {
    return mappedFromGderpi;
  }

  const matchedFromGderpi = resolveProfileBySenderEmail(mail, gderpiConfig, senderEmail);
  if (matchedFromGderpi) return matchedFromGderpi;

  const matchedFromMail = resolveProfileBySenderEmail(mail, mailConfig, senderEmail);
  if (matchedFromMail) return matchedFromMail;

  const genericEmail = normalizeEmail(options.boutiqueGenericEmail);
  if (genericEmail && genericEmail !== sender) {
    const fromBoutiqueGeneric = resolveMappedProfileFromConfig(gderpiConfig, genericEmail);
    if (fromBoutiqueGeneric && profileKeys().includes(fromBoutiqueGeneric)) {
      return fromBoutiqueGeneric;
    }
  }

  const defaultGderpi = String(gderpiConfig?.gderpi_default_account || '').trim();
  if (defaultGderpi && profileKeys().includes(defaultGderpi)) {
    return defaultGderpi;
  }

  const mappedFromMail = resolveMappedProfileFromConfig(mailConfig, senderEmail);
  if (mappedFromMail && profileKeys().includes(mappedFromMail)) {
    return mappedFromMail;
  }

  const defaultMail = String(mailConfig?.gderpi_default_account || '').trim();
  if (defaultMail && profileKeys().includes(defaultMail)) {
    return defaultMail;
  }

  return resolveSmtpProfile(entrepriseId);
}

/** @deprecated utiliser resolveSmtpProfileForSender */
async function resolveSmtpProfileForRecipient(entrepriseId, email) {
  return resolveSmtpProfileForSender(entrepriseId, email);
}

async function checkMailAvailable(entrepriseId) {
  try {
    await resolveSmtpProfile(entrepriseId);
    return { available: true, message: 'Serveur mail prêt' };
  } catch (error) {
    return { available: false, message: error.message || 'Mail non configuré' };
  }
}

module.exports = {
  getMailService,
  resolveSmtpProfile,
  resolveSmtpProfileForSender,
  resolveSmtpProfileForRecipient,
  checkMailAvailable,
  hasUsableEntitySmtp
};
