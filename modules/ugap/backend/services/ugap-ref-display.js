/**
 * Références UGAP affichables — conserve MINO (ref minoration légitime).
 * Masque uniquement les refs techniques internes (IBP-, BASE-, …).
 */

function isTechnicalCatalogRef(ref) {
  const r = String(ref || '').trim();
  if (!r) return false;
  return /^(BASE-|IBP-|bp_src_|opt_ibp_)/i.test(r);
}

/** Ref UGAP affichable : valeur Excel telle quelle, sauf refs techniques internes. */
function sanitizeUgapRefForDisplay(ref) {
  const raw = String(ref || '').trim();
  if (!raw || isTechnicalCatalogRef(raw)) return '';
  return raw;
}

module.exports = {
  isTechnicalCatalogRef,
  sanitizeUgapRefForDisplay,
};
