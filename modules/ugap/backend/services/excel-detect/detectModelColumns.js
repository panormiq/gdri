/**
 * FICHIER : modules/ugap/backend/services/excel-detect/detectModelColumns.js
 * RÔLE : Repère les colonnes « modèle » (≥ seuil de croix X après en-tête).
 * ENTRÉES : raw[][], startRow.
 * SORTIES : number[] indices colonnes.
 * DÉPEND DE : isCrossMarker.js.
 * NE PAS : extraire noms modèles ni prix.
 * APPELÉ PAR : detectExcelColumns, buildExcelDetectionReport.
 */

const isCrossMarker = require('./isCrossMarker');

function detectModelColumns(raw, startRow = 0, threshold = 2) {
  const counts = {};
  let maxLen = 0;

  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r] || [];
    maxLen = Math.max(maxLen, row.length);
    for (let c = 0; c < row.length; c++) {
      if (isCrossMarker(row[c])) {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
  }

  const cols = [];
  for (let c = 0; c < maxLen; c++) {
    if ((counts[c] || 0) >= threshold) {
      cols.push(c);
    }
  }
  return cols;
}

module.exports = detectModelColumns;
