/**
 * Classifie une ligne tarif : pr | minoration | majoration | catalogue.
 * Règles v2 — sans catégorie Excel ni UgapImportAssignmentService.
 */

const isPrLine = require('./rules/isPrLine');
const isMinorationLine = require('./rules/isMinorationLine');
const isMajorationLine = require('./rules/isMajorationLine');

function resolveImportLineKind({ label, refUgap }) {
  const labelStr = String(label || '').trim();
  const ref = String(refUgap || '').trim();

  if (isPrLine(labelStr)) return 'pr';
  if (isMinorationLine(labelStr, ref)) return 'minoration';
  if (isMajorationLine(labelStr, ref)) return 'majoration';
  return 'catalogue';
}

module.exports = resolveImportLineKind;
