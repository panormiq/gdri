/**
 * Option de base dérivée d’une minoration.
 * Moteur de base : motorName (pas de parsing mot-clé sur le libellé).
 */

const parseReplacementFromLabel = require('./rules/parseReplacementFromLabel');
const resolveAdjOptionNameFromLabel = require('./rules/resolveAdjOptionNameFromLabel');

function buildBaseOptionFromMinoration(line) {
  const replacement = parseReplacementFromLabel(line?.label || '');
  const baseOptionName = resolveAdjOptionNameFromLabel(line, { forMinoration: true });

  return {
    ...replacement,
    baseOptionName
  };
}

module.exports = buildBaseOptionFromMinoration;
