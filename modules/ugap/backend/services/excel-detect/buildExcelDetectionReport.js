/**
 * Rapport métier modèles + lignes par type depuis un fichier Excel.
 */

const path = require('path');
const UgapExcelService = require('../UgapExcelService');
const detectExcelColumns = require('./detectExcelColumns');
const detectModels = require('./detectModels');
const resolveImportLineKind = require('./resolveImportLineKind');
const enrichMinorationLines = require('./enrichMinorationLines');
const buildBaseOptions = require('./buildBaseOptions');
const parseReplacementFromLabel = require('./rules/parseReplacementFromLabel');
const isCrossMarker = require('./isCrossMarker');
const extractModelRecapRow = require('./extractModelRecapRow');

function collectCompatibleModelIds(row, structure, models) {
  const ids = [];
  structure.modelCols.forEach((colIdx) => {
    if (!isCrossMarker(row[colIdx])) return;
    const model = models.find((m) => m.colIndex === colIdx);
    if (model) ids.push(model.id);
  });
  return ids;
}

function postesFromModelIds(modelIds, models) {
  const map = new Map((models || []).map((m) => [m.id, m.posteNumber]));
  return (modelIds || [])
    .map((id) => map.get(id))
    .filter((p) => p != null)
    .join(', ');
}

function isBaseModelRowLabel(labelStr) {
  const labelLower = String(labelStr || '').toLowerCase();
  return (
    /^poste\b/.test(labelLower) ||
    /\bconfiguration de base\b/.test(labelLower) ||
    /^\s*base\s*$/.test(labelLower)
  );
}

function enrichMajorationLines(lines, models) {
  return (lines || []).map((line) => {
    const replacement = parseReplacementFromLabel(line.label);
    return {
      ...line,
      ...replacement,
      displayPostes: postesFromModelIds(line.compatibleModelIds, models)
    };
  });
}

function enrichCatalogueLines(lines, models) {
  return (lines || []).map((line) => ({
    ...line,
    displayPostes: postesFromModelIds(line.compatibleModelIds, models)
  }));
}

function buildExcelDetectionReport(filePath) {
  const raw = UgapExcelService.readExcelFile(filePath);
  const structure = detectExcelColumns(raw);

  if (structure.headerRowIndex === -1) {
    throw new Error('Impossible de détecter la structure du fichier Excel (en-têtes manquants).');
  }

  const priceClientCol = structure.priceClientCol > -1 ? structure.priceClientCol : structure.priceUgapCol;
  const priceUgapCol = structure.priceUgapCol > -1 ? structure.priceUgapCol : priceClientCol;
  const startRow = structure.headerRowIndex + 1;

  const { models, baseRowIndices } = detectModels(raw, structure, priceClientCol, priceUgapCol);

  const linesByKind = {
    minoration: [],
    majoration: [],
    catalogue: [],
    base_option: [],
    pr: []
  };

  for (let r = startRow; r < raw.length; r += 1) {
    if (baseRowIndices.has(r)) continue;

    const row = raw[r] || [];
    const labelRaw = row[structure.labelCol];
    const labelStr = typeof labelRaw === 'string' ? labelRaw.trim() : String(labelRaw || '').trim();
    if (!labelStr || isBaseModelRowLabel(labelStr)) continue;

    const refUgapRaw = structure.refUgapCol > -1 ? row[structure.refUgapCol] : '';
    const refUgap = String(refUgapRaw ?? '').trim();
    const kind = resolveImportLineKind({ label: labelStr, refUgap });

    const priceClient = extractModelRecapRow.parsePrice(row[priceClientCol]);
    const priceUgap = extractModelRecapRow.parsePrice(row[priceUgapCol]);
    const compatibleModelIds = kind === 'pr' ? [] : collectCompatibleModelIds(row, structure, models);

    const line = {
      rowIndex: r,
      label: labelStr,
      refUgap,
      priceClient,
      priceUgap,
      compatibleModelIds,
      crosses: compatibleModelIds.length,
      displayPostes: postesFromModelIds(compatibleModelIds, models)
    };

    if (linesByKind[kind]) {
      linesByKind[kind].push(line);
    } else {
      linesByKind.catalogue.push(line);
    }
  }

  linesByKind.minoration = enrichMinorationLines(linesByKind.minoration, models);
  linesByKind.majoration = enrichMajorationLines(linesByKind.majoration, models);
  linesByKind.catalogue = enrichCatalogueLines(linesByKind.catalogue, models);
  linesByKind.base_option = buildBaseOptions(linesByKind.minoration, linesByKind.majoration, models);

  const counts = {
    models: models.length,
    minoration: linesByKind.minoration.length,
    majoration: linesByKind.majoration.length,
    catalogue: linesByKind.catalogue.length,
    base_option: linesByKind.base_option.length,
    pr: linesByKind.pr.length
  };

  return {
    sourceFile: path.basename(filePath),
    structure,
    models,
    linesByKind,
    counts
  };
}

module.exports = buildExcelDetectionReport;
