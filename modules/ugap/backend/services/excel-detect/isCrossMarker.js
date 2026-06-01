/**
 * FICHIER : modules/ugap/backend/services/excel-detect/isCrossMarker.js
 * RÔLE : Indique si une cellule Excel porte une croix modèle (X).
 * ENTRÉES : valeur cellule brute.
 * SORTIES : boolean.
 * DÉPEND DE : —
 * NE PAS : détection colonnes ou classification lignes.
 * APPELÉ PAR : detectModelColumns, buildExcelDetectionReport, UgapExcelService.
 */

function isCrossMarker(value) {
  const raw = String(value ?? '').trim();
  return raw === 'X' || raw === 'x' || raw === '×';
}

module.exports = isCrossMarker;
