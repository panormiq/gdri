/**
 * FICHIER : modules/doc-hub/backend/services/mail/registerEntityProfilesAndPickKey.js
 * RÔLE : Enregistre les profils SMTP de l'entité dans le service mail et
 *        retourne la clé du premier profil utilisable (null sinon).
 */

const hasUsableEntitySmtp = require('./hasUsableEntitySmtp');

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

module.exports = registerEntityProfilesAndPickKey;
