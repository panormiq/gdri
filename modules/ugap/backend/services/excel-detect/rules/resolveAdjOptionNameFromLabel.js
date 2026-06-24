/**
 * Nom d'option cible (mino/majo) — aligné options de base.
 * Moteur « non fourniture du moteur de base » : motorName uniquement (inchangé).
 * Sinon : parse remplacement ; si vide → libellé Excel (surtout suppression / non fourniture).
 */

const parseReplacementFromLabel = require('./parseReplacementFromLabel');
const isMotorBaseNonSupplyMinoration = require('./isMotorBaseNonSupplyMinoration');

function stripPostesSuffix(text) {
  return String(text || '')
    .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
    .replace(/\s+postes?\s+[\d\s,etàa\-–—]+$/i, '')
    .trim();
}

function isGenericPlaceholder(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n || n === 'de base' || n === 'produit de base') return true;
  if (n === 'moteur choisi' || n === 'moteur de base') return true;
  if (/^(\d+\s+)?moteurs?\s+de\s+base$/.test(n)) return true;
  if (/^ce(lui|lle|ux)\s+de\s+base$/.test(n)) return true;
  return false;
}

function isSuppressionLabel(label) {
  return /^sup+p?ress/i.test(String(label || '').replace(/\s+/g, ' ').trim());
}

function isNonFournitureLabel(label) {
  return /\bnon\s+fourniture\b/i.test(String(label || ''));
}

function excelLabelAsOptionName(label) {
  return stripPostesSuffix(String(label || '').replace(/\s+/g, ' ').trim());
}

/**
 * @param {{ label?: string, motorName?: string }} line
 * @param {{ forMinoration?: boolean }} [opts]
 */
function resolveAdjOptionNameFromLabel(line, opts = {}) {
  const label = String(line?.label || '').replace(/\s+/g, ' ').trim();
  const motorName = String(line?.motorName || '').trim();

  if (opts.forMinoration === true && isMotorBaseNonSupplyMinoration(label) && motorName) {
    return motorName;
  }

  const replacement = parseReplacementFromLabel(label);
  let name = String(replacement.replacedObject || replacement.newObject || '').trim();
  if (name && !isGenericPlaceholder(name)) return name;

  const fromExcel = excelLabelAsOptionName(label);
  if (!fromExcel) return '';

  if (isSuppressionLabel(label) || isNonFournitureLabel(label)) {
    return fromExcel;
  }

  return fromExcel;
}

module.exports = resolveAdjOptionNameFromLabel;
