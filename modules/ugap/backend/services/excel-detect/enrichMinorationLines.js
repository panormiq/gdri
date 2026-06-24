/**
 * Enrichit les minorations : nom moteur, postes ; sépare si 2 moteurs différents / même prix.
 */

const extractMotorNameFromLabel = require('./rules/extractMotorNameFromLabel');
const isMotorBaseNonSupplyMinoration = require('./rules/isMotorBaseNonSupplyMinoration');
const resolveAdjOptionNameFromLabel = require('./rules/resolveAdjOptionNameFromLabel');
const UgapImportAssignmentService = require('../UgapImportAssignmentService');

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

function postesDisplayFromModelIds(modelIds, models) {
  const map = new Map((models || []).map((m) => [m.id, m.posteNumber]));
  return (modelIds || [])
    .map((id) => map.get(id))
    .filter((p) => p != null)
    .sort((a, b) => Number(a) - Number(b))
    .join(', ');
}

/** Postes depuis libellé uniquement (pas de fallback « tous les postes »). */
function modelIdsFromExplicitLabelPostes(label, models) {
  const list = Array.isArray(models) ? models : [];
  const explicit = UgapImportAssignmentService.getExplicitPosteSetFromLabel(label);
  if (explicit && explicit.size) {
    return list
      .filter((m) => {
        const pn = Number(m?.posteNumber);
        return Number.isFinite(pn) && explicit.has(pn);
      })
      .map((m) => m.id)
      .filter(Boolean);
  }
  const single = String(label || '').match(/\bposte\s+(\d+)\b/i);
  if (single) {
    const pn = parseInt(single[1], 10);
    return list
      .filter((m) => Number(m?.posteNumber) === pn)
      .map((m) => m.id)
      .filter(Boolean);
  }
  return [];
}

function optionNameForMinorationLine(line, motorName) {
  return resolveAdjOptionNameFromLabel(
    { ...line, motorName: String(motorName || line?.motorName || '').trim() },
    { forMinoration: true }
  );
}

function applyResolvedModelIds(line, modelIds, models, extra = {}) {
  const ids = Array.isArray(modelIds) ? modelIds : [];
  const labelPostes = UgapImportAssignmentService.getSortedExplicitPosteNumbersFromLabel(line.label);
  const excelCrossCount = Number(line.crosses) || 0;
  const displayPostes = labelPostes.length
    ? labelPostes.join(', ')
    : postesDisplayFromModelIds(ids, models);
  const crosses = extra.crosses != null
    ? extra.crosses
    : (excelCrossCount > 0 ? excelCrossCount : (labelPostes.length || ids.length));
  const motorName = String(extra.motorName || '').trim();
  const optionName = optionNameForMinorationLine(line, motorName);
  return {
    ...line,
    compatibleModelIds: ids,
    crosses,
    displayPostes,
    optionName,
    ...extra
  };
}

function enrichMinorationLines(lines, models) {
  const modelById = new Map((models || []).map((m) => [m.id, m]));
  const out = [];

  (lines || []).forEach((line) => {
    let modelIds = Array.isArray(line.compatibleModelIds) ? line.compatibleModelIds.slice() : [];
    if (!modelIds.length) {
      modelIds = modelIdsFromExplicitLabelPostes(line.label, models);
    }

    if (modelIds.length <= 1) {
      const model = modelIds[0] ? modelById.get(modelIds[0]) : null;
      const motorName = motorNameForMinoration(line, model);
      out.push(applyResolvedModelIds(line, modelIds, models, { motorName }));
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
      out.push(applyResolvedModelIds(line, modelIds, models, { motorName }));
      return;
    }

    perModel.forEach((entry) => {
      out.push(applyResolvedModelIds(line, [entry.modelId], models, {
        motorName: entry.motorName,
        crosses: 1,
        splitFromRowIndex: line.rowIndex
      }));
    });
  });

  return out;
}

module.exports = enrichMinorationLines;
