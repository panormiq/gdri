/**
 * FICHIER : modules/gderpi/backend/services/pdf/resolveCgvProfil.js
 * RÔLE : Détermine le profil CGV (B2B/B2C) pour un devis.
 */

function isClientParticulier(client) {
  if (!client) return false;
  return String(client.type || '').trim() === 'particulier';
}

function resolveCgvProfil(devis, client) {
  const raw = String(devis?.cgvProfil || 'auto').trim().toLowerCase();
  if (raw === 'b2b' || raw === 'b2c') return raw;
  return isClientParticulier(client) ? 'b2c' : 'b2b';
}

module.exports = resolveCgvProfil;
module.exports.isClientParticulier = isClientParticulier;
