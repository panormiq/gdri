/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildCgvPdfFilename.js
 * RÔLE : Nom de fichier PDF pour les CGV d'une boutique.
 */

function buildCgvPdfFilename(boutique, profil) {
  const raw = String(boutique?.slug || boutique?.nom || boutique?.libelle || 'cgv').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'cgv';
  const suffix = String(profil || 'b2b').trim().toLowerCase() === 'b2c' ? 'b2c' : 'b2b';
  return `cgv-${safe}-${suffix}.pdf`;
}

module.exports = buildCgvPdfFilename;
