/**
 * Forfait / garantie : jamais majoration.
 */
function isExcludedFromMajorationLine(label) {
  const n = String(label || '').replace(/\s+/g, ' ').trim();
  if (!n) return false;
  return /\b(forfait|garanties?|extension\s+de\s+garantie)\b/i.test(n);
}

module.exports = isExcludedFromMajorationLine;
