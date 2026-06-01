/**
 * Enrichit les minorations : nom moteur, postes ; sépare si 2 moteurs différents / même prix.
 */

const extractMotorNameFromLabel = require('./rules/extractMotorNameFromLabel');
const isMotorBaseNonSupplyMinoration = require('./rules/isMotorBaseNonSupplyMinoration');

function normalizeMotorKey(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function motorNameForMinoration(line, model) {
  if (isMotorBaseNonSupplyMinoration(line.label)) {
    return String(model?.motorizationBase || '').trim();
  }
  return extractMotorNameFromLabel(line.label, model?.motorizationBase);
}

function enrichMinorationLines(lines, models) {
  const modelById = new Map((models || []).map((m) => [m.id, m]));
  const out = [];

  (lines || []).forEach((line) => {
    const modelIds = Array.isArray(line.compatibleModelIds) ? line.compatibleModelIds : [];

    if (modelIds.length <= 1) {
      const model = modelIds[0] ? modelById.get(modelIds[0]) : null;
      const motorName = motorNameForMinoration(line, model);
      const poste = model?.posteNumber;
      out.push({
        ...line,
        motorName,
        displayPostes: poste != null ? String(poste) : ''
      });
      return;
    }

    const perModel = modelIds.map((modelId) => {
      const model = modelById.get(modelId);
      const motorName = motorNameForMinoration(line, model);
      return {
        modelId,
        posteNumber: model?.posteNumber,
        motorName,
        motorKey: normalizeMotorKey(motorName)
      };
    });

    const uniqueMotors = new Set(perModel.map((e) => e.motorKey).filter(Boolean));

    if (uniqueMotors.size <= 1) {
      const motorName = perModel.find((e) => e.motorName)?.motorName || '';
      out.push({
        ...line,
        motorName,
        displayPostes: perModel
          .map((e) => e.posteNumber)
          .filter((p) => p != null)
          .join(', ')
      });
      return;
    }

    perModel.forEach((entry) => {
      out.push({
        ...line,
        compatibleModelIds: [entry.modelId],
        crosses: 1,
        motorName: entry.motorName,
        displayPostes: entry.posteNumber != null ? String(entry.posteNumber) : '',
        splitFromRowIndex: line.rowIndex
      });
    });
  });

  return out;
}

module.exports = enrichMinorationLines;
