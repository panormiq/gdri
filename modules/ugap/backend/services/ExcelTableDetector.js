/**
 * ExcelTableDetector
 * Détecte les "tableaux" dans une feuille Excel.
 *
 * Définition (selon consigne):
 * - Un tableau = un ensemble de lignes consécutives NON vides
 * - Les tableaux sont séparés par une ou plusieurs lignes vides
 *
 * Entrées attendues:
 * - ws: worksheet `xlsx`
 * - range: résultat de `XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')`
 *
 * Sortie:
 * - { count, tables } où tables = [{ start, end }] en indices 0-based (lignes Excel)
 */

const XLSX = require('xlsx');

/**
 * Détermine les bornes de colonnes réellement non vides dans la zone analysée.
 * Utile quand `ws['!ref']` inclut des colonnes vides à cause du formatage.
 *
 * @param {object} ws
 * @param {{startRow:number,endRow:number,startCol:number,endCol:number}} bounds
 * @returns {{startCol:number,endCol:number}|null}
 */
function findNonEmptyColumnBounds(ws, bounds) {
  let minC = null;
  let maxC = null;

  for (let r = bounds.startRow; r <= bounds.endRow; r++) {
    for (let c = bounds.startCol; c <= bounds.endCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || cell.v === null) continue;
      if (String(cell.v).trim().length === 0) continue;
      if (minC === null || c < minC) minC = c;
      if (maxC === null || c > maxC) maxC = c;
    }
  }

  if (minC === null || maxC === null) return null;
  return { startCol: minC, endCol: maxC };
}

/**
 * @param {object} ws - Worksheet XLSX
 * @param {{s:{r:number,c:number}, e:{r:number,c:number}}} range - Range XLSX (decode_range)
 * @param {{startRow?: number, endRow?: number, startCol?: number, endCol?: number, trimEmptyColumns?: boolean}} [options]
 * @returns {{count: number, tables: Array<{start:number,end:number}>}}
 */
function detectTablesFromWorksheet(ws, range, options = {}) {
  const startRow = Number.isInteger(options.startRow) ? options.startRow : range.s.r;
  const endRow = Number.isInteger(options.endRow) ? options.endRow : range.e.r;
  let startCol = Number.isInteger(options.startCol) ? options.startCol : range.s.c;
  let endCol = Number.isInteger(options.endCol) ? options.endCol : range.e.c;

  // Par défaut: ignorer les colonnes totalement vides (commencer à la 1ère colonne non vide)
  const shouldTrimEmptyColumns = options.trimEmptyColumns !== false;
  if (shouldTrimEmptyColumns && !Number.isInteger(options.startCol) && !Number.isInteger(options.endCol)) {
    const nonEmptyBounds = findNonEmptyColumnBounds(ws, { startRow, endRow, startCol, endCol });
    if (!nonEmptyBounds) return { count: 0, tables: [] };
    startCol = nonEmptyBounds.startCol;
    endCol = nonEmptyBounds.endCol;
  }

  const tables = [];
  let currentStart = null;

  for (let r = startRow; r <= endRow; r++) {
    let isEmpty = true;

    for (let c = startCol; c <= endCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || cell.v === null) continue;
      if (String(cell.v).trim().length === 0) continue;
      isEmpty = false;
      break;
    }

    if (isEmpty) {
      if (currentStart !== null) {
        tables.push({ start: currentStart, end: r - 1 });
        currentStart = null;
      }
      continue;
    }

    if (currentStart === null) currentStart = r;
  }

  if (currentStart !== null) {
    tables.push({ start: currentStart, end: endRow });
  }

  return { count: tables.length, tables };
}

/**
 * Alias pratique si tu veux seulement le nombre.
 * @returns {number}
 */
function countTablesFromWorksheet(ws, range, options = {}) {
  return detectTablesFromWorksheet(ws, range, options).count;
}

module.exports = {
  detectTablesFromWorksheet,
  countTablesFromWorksheet
};

