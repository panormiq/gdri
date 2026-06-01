/**
 * Option de base dérivée d’une minoration.
 * Moteur de base : motorName (pas de parsing mot-clé sur le libellé).
 */

const parseReplacementFromLabel = require('./rules/parseReplacementFromLabel');
const isMotorBaseNonSupplyMinoration = require('./rules/isMotorBaseNonSupplyMinoration');

function buildBaseOptionFromMinoration(line) {
  const motorName = String(line?.motorName || '').trim();

  if (isMotorBaseNonSupplyMinoration(line?.label) && motorName) {
    return {
      keyword: '',
      newObject: '',
      replacedObject: '',
      baseOptionName: motorName
    };
  }

  const replacement = parseReplacementFromLabel(line?.label || '');
  const baseOptionName =
    replacement.replacedObject || replacement.newObject || '';

  return {
    ...replacement,
    baseOptionName
  };
}

module.exports = buildBaseOptionFromMinoration;
