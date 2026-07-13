/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildCgvPublicUrl.js
 * RÔLE : Construit l'URL publique des CGV d'une boutique.
 */

function buildCgvPublicUrl(req, entrepriseId, boutique, profil) {
  const slug = String(boutique?.slug || '').trim();
  const eid = String(entrepriseId || '').trim();
  if (!req || !slug || !eid) return '';

  const profile = String(profil || 'b2b').trim().toLowerCase() === 'b2c' ? 'b2c' : 'b2b';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  if (!host) return '';

  const base = `${proto}://${host}`.replace(/\/$/, '');
  return `${base}/api/gderpi/public/cgv/${encodeURIComponent(eid)}/${encodeURIComponent(slug)}?profil=${profile}`;
}

module.exports = buildCgvPublicUrl;
