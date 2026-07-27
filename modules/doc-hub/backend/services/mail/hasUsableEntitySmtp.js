/**
 * FICHIER : modules/doc-hub/backend/services/mail/hasUsableEntitySmtp.js
 * RÔLE : Vérifie qu'une config mail d'entité contient un compte SMTP réellement
 *        utilisable (mot de passe + serveur renseignés) — formats legacy et actuel.
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

module.exports = hasUsableEntitySmtp;
