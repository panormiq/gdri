/**
 * Majoration : formulations libellé + hors-bord (moteur catalogue).
 * Sans catégorie Excel ni détection « motorisation » / marques moteur seules.
 */

const isPrLine = require('./isPrLine');
const isMinorationLine = require('./isMinorationLine');
const isExcludedFromMajorationLine = require('./isExcludedFromMajorationLine');
const isHorsBordMotorLine = require('./isHorsBordMotorLine');

function isMajorationLine(label, refUgap) {
  if (isPrLine(label)) return false;
  if (isMinorationLine(label, refUgap)) return false;

  const n = String(label || '').replace(/\s+/g, ' ').trim();
  if (!n) return false;
  if (/^supp?ress(?:ion)?\b/i.test(n)) return false;
  if (isExcludedFromMajorationLine(n)) return false;

  if (/^(plus-value|plus\s+value)\b/i.test(n)) return true;
  if (/\ben\s+lieux?\s+et\s+place\b/i.test(n)) return true;
  if (/\bau\s+lieu\s+et\s+place\b/i.test(n)) return true;
  if (/\ben\s+remplacement\b/i.test(n)) return true;
  if (/\bnon\s+fourniture\b/i.test(n)) return true;
  if (isHorsBordMotorLine(n)) return true;

  return false;
}

module.exports = isMajorationLine;
