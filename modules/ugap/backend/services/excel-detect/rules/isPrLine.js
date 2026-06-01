/**
 * Ligne PR : libellé commence par « PR » + espace.
 */
function isPrLine(label) {
  return /^PR\s/i.test(String(label || '').trim());
}

module.exports = isPrLine;
