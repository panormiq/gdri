/**
 * FICHIER : modules/ugap/backend/services/excel-detect/extractModelRecapRow.js
 * RÔLE : Première ligne avec croix X dans une colonne modèle = récap (prix + libellé).
 * ENTRÉES : raw, colIndex, labelCol, priceClientCol, priceUgapCol, startRow.
 * SORTIES : { rowIndex, label, priceClient, priceUgap, parsed } ou valeurs vides.
 * DÉPEND DE : isCrossMarker, parseBaseModelLabel, parsePrice.
 * NE PAS : classifier autres lignes.
 * APPELÉ PAR : buildExcelDetectionReport.
 */

const isCrossMarker = require('./isCrossMarker');
const parseBaseModelLabel = require('./parseBaseModelLabel');

function parsePrice(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d,.\-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

function extractModelRecapRow(raw, colIndex, labelCol, priceClientCol, priceUgapCol, startRow) {
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r] || [];
    if (!isCrossMarker(row[colIndex])) continue;

    const label = row[labelCol];
    const labelStr = typeof label === 'string' ? label.trim() : String(label || '').trim();
    if (!labelStr) continue;

    const priceClient = parsePrice(row[priceClientCol]);
    const priceUgap = priceUgapCol > -1 ? parsePrice(row[priceUgapCol]) : priceClient;

    return {
      rowIndex: r,
      label: labelStr,
      priceClient: priceClient > 0 ? priceClient : 0,
      priceUgap: priceUgap > 0 ? priceUgap : 0,
      parsed: parseBaseModelLabel(labelStr)
    };
  }

  return {
    rowIndex: -1,
    label: '',
    priceClient: 0,
    priceUgap: 0,
    parsed: parseBaseModelLabel('')
  };
}

module.exports = extractModelRecapRow;
module.exports.parsePrice = parsePrice;
