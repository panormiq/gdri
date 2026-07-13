/**
 * FICHIER : modules/ugap/backend/services/excel-detect/detectExcelColumns.js
 * RÔLE : Détecte ligne d'en-tête et colonnes libellé / prix / réf. UGAP / modèles.
 * ENTRÉES : raw[][] grille Excel.
 * SORTIES : { headerRowIndex, labelCol, priceClientCol, priceUgapCol, refUgapCol, refFournisseurCol, modelCols }.
 * DÉPEND DE : detectModelColumns.js.
 * NE PAS : parcourir les lignes options ni classifier.
 * APPELÉ PAR : buildExcelDetectionReport.
 */

const detectModelColumns = require('./detectModelColumns');
const { detectRefUgapColumn } = require('./detectRefUgapColumn');

function detectExcelColumns(raw) {
  const structure = {
    headerRowIndex: -1,
    labelCol: -1,
    priceClientCol: -1,
    priceUgapCol: -1,
    refUgapCol: -1,
    refFournisseurCol: -1,
    modelCols: []
  };

  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const row = raw[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (structure.labelCol === -1 && (cell.includes('libell') || cell.includes('désignation'))) {
        structure.labelCol = j;
      }
      if (structure.priceClientCol === -1 && cell.includes('prix') && cell.includes('client')) {
        structure.priceClientCol = j;
      }
      if (structure.priceUgapCol === -1 && cell.includes('prix') && cell.includes('ugap')) {
        structure.priceUgapCol = j;
      }
      if (
        structure.refUgapCol === -1 &&
        (cell.includes('ref') || cell.includes('réf') || cell.includes('reference')) &&
        cell.includes('ugap')
      ) {
        structure.refUgapCol = j;
      }
      if (
        structure.refFournisseurCol === -1 &&
        (cell.includes('f/seur') || cell.includes('f /seur') || cell.includes('fournisseur')) &&
        (cell.includes('ref') || cell.includes('réf') || cell.includes('reference')) &&
        !cell.includes('ugap')
      ) {
        structure.refFournisseurCol = j;
      }
      if (structure.headerRowIndex === -1 && (structure.labelCol > -1 || structure.priceClientCol > -1)) {
        structure.headerRowIndex = i;
      }
    }
  }

  structure.modelCols = detectModelColumns(raw, Math.max(0, structure.headerRowIndex));
  structure.refUgapCol = detectRefUgapColumn(raw, structure);
  return structure;
}

module.exports = detectExcelColumns;
