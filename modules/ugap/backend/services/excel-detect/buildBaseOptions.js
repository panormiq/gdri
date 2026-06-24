/**
 * Options de base dérivées : une par minoration et par majoration, sauf hors-bord.
 */

const parseReplacementFromLabel = require('./rules/parseReplacementFromLabel');
const resolveAdjOptionNameFromLabel = require('./rules/resolveAdjOptionNameFromLabel');
const isHorsBordMotorLine = require('./rules/isHorsBordMotorLine');
const buildBaseOptionFromMinoration = require('./buildBaseOptionFromMinoration');

function postesFromModelIds(modelIds, models) {
  const map = new Map((models || []).map((m) => [m.id, m.posteNumber]));
  return (modelIds || [])
    .map((id) => map.get(id))
    .filter((p) => p != null)
    .join(', ');
}

function buildBaseOptions(minorations, majorations, models) {
  const options = [];
  let seq = 0;

  (minorations || []).forEach((line) => {
    if (isHorsBordMotorLine(line.label)) return;
    const derived = buildBaseOptionFromMinoration(line);
    seq += 1;
    options.push({
      id: `base_mino_${seq}`,
      sourceKind: 'minoration',
      sourceRowIndex: line.splitFromRowIndex || line.rowIndex,
      label: line.label,
      ...derived,
      priceClient: line.priceClient,
      priceUgap: line.priceUgap,
      compatibleModelIds: line.compatibleModelIds || [],
      displayPostes: line.displayPostes || postesFromModelIds(line.compatibleModelIds, models),
      motorName: line.motorName || ''
    });
  });

  (majorations || []).forEach((line) => {
    if (isHorsBordMotorLine(line.label)) return;
    const replacement = parseReplacementFromLabel(line.label);
    const baseOptionName = resolveAdjOptionNameFromLabel(line, { forMinoration: false });
    seq += 1;
    options.push({
      id: `base_majo_${seq}`,
      sourceKind: 'majoration',
      sourceRowIndex: line.rowIndex,
      label: line.label,
      ...replacement,
      baseOptionName,
      priceClient: line.priceClient,
      priceUgap: line.priceUgap,
      compatibleModelIds: line.compatibleModelIds || [],
      displayPostes: line.displayPostes || postesFromModelIds(line.compatibleModelIds, models)
    });
  });

  return options;
}

module.exports = buildBaseOptions;
