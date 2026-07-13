/**
 * Détecte le mode rendu économique (N&B, sans fonds).
 */

function isEconomyRenderMode(source) {
  if (source === true) return true;
  if (source && typeof source === 'object' && source.economy === true) return true;
  const raw = String(source?.query?.economy ?? source?.economy ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

module.exports = isEconomyRenderMode;
