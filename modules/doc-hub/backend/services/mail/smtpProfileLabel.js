/**
 * FICHIER : modules/doc-hub/backend/services/mail/smtpProfileLabel.js
 * RÔLE : Libellé affichable d'un profil SMTP pour la traçabilité.
 */

function smtpProfileLabel(profileKey) {
  if (profileKey === 'gdri_app') return 'GDRI (app@gdr-innovation.fr)';
  return profileKey || '—';
}

module.exports = smtpProfileLabel;
