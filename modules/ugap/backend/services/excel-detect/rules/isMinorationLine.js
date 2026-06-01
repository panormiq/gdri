/**
 * Minoration : réf. UGAP contient MINO, ou libellé commence par moins-value.
 */
function isMinorationLine(label, refUgap) {
  if (String(refUgap || '').trim().toUpperCase().includes('MINO')) {
    return true;
  }
  return /^(moins-value|moins\s+value)\b/i.test(String(label || '').trim());
}

module.exports = isMinorationLine;
