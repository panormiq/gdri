/**
 * Détection colonne Réf. UGAP (valeur lue sur la ligne récap modèle).
 * La ref modèle est numérique (ex: 4218568) — pas la colonne « N° option » (B 01).
 */

const isCrossMarker = require('./isCrossMarker');

function normalizeHeaderText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getColumnHeaderText(raw, colIndex, headerRowIndex, span = 3) {
  const parts = [];
  const start = Math.max(0, headerRowIndex - span);
  const end = Math.min(raw.length - 1, headerRowIndex + span);
  for (let i = start; i <= end; i += 1) {
    const cell = raw[i] && raw[i][colIndex];
    if (cell == null || String(cell).trim() === '') continue;
    parts.push(normalizeHeaderText(cell));
  }
  return parts.join(' ');
}

function isFournisseurHeader(headerText) {
  const h = normalizeHeaderText(headerText);
  return h.includes('fournisseur') || h.includes('f /seur') || h.includes('f/seur');
}

function isOptionNumberHeader(headerText) {
  const h = normalizeHeaderText(headerText);
  return h.includes('n° option')
    || h.includes('n option')
    || h.includes('numero option')
    || h.includes('numero d option');
}

function isPosteContratHeader(headerText) {
  const h = normalizeHeaderText(headerText);
  return h.includes('poste contrat') || /^poste\b/.test(h);
}

function isRefUgapHeader(headerText) {
  const h = normalizeHeaderText(headerText);
  if (!h) return false;
  if (isFournisseurHeader(h)) return false;
  if (isOptionNumberHeader(h)) return false;
  if (isPosteContratHeader(h)) return false;
  if (h.includes('prix') || h.includes('libell') || h.includes('designation')) return false;
  const hasRef = h.includes('ref') || h.includes('reference');
  if (!hasRef) return false;
  if (h.includes('ugap')) return true;
  return !h.includes('fournisseur') && !h.includes('f /seur') && !h.includes('f/seur');
}

function isExcludedRefInferenceColumn(headerText, colIndex, structure) {
  if (colIndex === Number(structure?.refFournisseurCol)) return true;
  const h = normalizeHeaderText(headerText);
  if (isOptionNumberHeader(h) || isPosteContratHeader(h) || isFournisseurHeader(h)) return true;
  return false;
}

/** Valeur ref UGAP sur ligne récap : numérique (4218568) ou alphanum (MINO, B 01 pour options). */
function looksLikeRefCell(value) {
  const v = String(value ?? '').trim();
  if (!v || isCrossMarker(v)) return false;
  // Ref UGAP catalogue numérique (5 à 12 chiffres, sans décimales)
  if (/^\d{5,12}$/.test(v)) return true;
  // Montants / prix exclus (décimales, séparateurs)
  if (/^[\d.,\s€$]+$/.test(v)) return false;
  if (v.length < 2 || v.length > 48) return false;
  return /[A-Za-z0-9]/.test(v);
}

function formatUgapRefCell(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return String(value ?? '').trim();
}

/**
 * Infère la colonne ref depuis les lignes récap (première croix par modèle).
 */
function inferRefUgapColFromRecapRows(raw, structure) {
  const headerRow = Number(structure?.headerRowIndex);
  const startRow = headerRow >= 0 ? headerRow + 1 : 1;
  const modelCols = Array.isArray(structure?.modelCols) ? structure.modelCols : [];
  const labelCol = Number(structure?.labelCol);
  const priceClientCol = Number(structure?.priceClientCol);
  const priceUgapCol = Number(structure?.priceUgapCol);
  const refFournisseurCol = Number(structure?.refFournisseurCol);
  if (!modelCols.length) return -1;

  const maxCol = Math.max(
    labelCol,
    priceClientCol,
    priceUgapCol,
    refFournisseurCol,
    ...modelCols,
    0
  ) + 2;

  const scores = new Map();
  modelCols.forEach((modelCol) => {
    for (let r = startRow; r < raw.length; r += 1) {
      const row = raw[r] || [];
      if (!isCrossMarker(row[modelCol])) continue;
      for (let j = 0; j <= maxCol; j += 1) {
        if (j === labelCol || j === priceClientCol || j === priceUgapCol) continue;
        if (j === refFournisseurCol) continue;
        if (modelCols.includes(j)) continue;
        const header = getColumnHeaderText(raw, j, headerRow);
        if (isExcludedRefInferenceColumn(header, j, structure)) continue;
        const cell = row[j];
        if (!looksLikeRefCell(cell)) continue;
        const weight = /^\d{5,12}$/.test(String(cell ?? '').trim()) ? 3 : 1;
        scores.set(j, (scores.get(j) || 0) + weight);
      }
      break;
    }
  });

  let bestCol = -1;
  let bestScore = 0;
  scores.forEach((score, col) => {
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  });
  return bestScore > 0 ? bestCol : -1;
}

/**
 * @param {Array[]} raw
 * @param {{ headerRowIndex:number, labelCol:number, priceClientCol:number, priceUgapCol:number, refFournisseurCol:number, modelCols:number[] }} structure
 */
function detectRefUgapColumn(raw, structure) {
  const headerRow = Number(structure?.headerRowIndex);
  if (headerRow < 0) return -1;

  let maxLen = 0;
  for (let i = Math.max(0, headerRow - 3); i <= Math.min(raw.length - 1, headerRow + 3); i += 1) {
    maxLen = Math.max(maxLen, (raw[i] || []).length);
  }

  // Colonne « Réf UGAP » explicite : priorité absolue (ref numérique type 4218568).
  for (let j = 0; j < maxLen; j += 1) {
    const header = getColumnHeaderText(raw, j, headerRow);
    if (isRefUgapHeader(header) && header.includes('ugap')) {
      return j;
    }
  }

  let refCol = -1;
  for (let j = 0; j < maxLen; j += 1) {
    if (j === structure.refFournisseurCol) continue;
    const header = getColumnHeaderText(raw, j, headerRow);
    if (isRefUgapHeader(header)) {
      refCol = j;
      break;
    }
  }

  if (refCol === -1) {
    refCol = inferRefUgapColFromRecapRows(raw, structure);
  }

  return refCol;
}

/**
 * Lit la ref UGAP sur la ligne récap (première croix) : colonne détectée puis scan de repli.
 */
function pickRefUgapFromRecapRow(row, options = {}) {
  const r = Array.isArray(row) ? row : [];
  const refUgapCol = Number(options.refUgapCol);
  const modelCol = Number(options.modelCol);
  const labelCol = Number(options.labelCol);
  const priceClientCol = Number(options.priceClientCol);
  const priceUgapCol = Number(options.priceUgapCol);
  const refFournisseurCol = Number(options.refFournisseurCol);
  const modelCols = Array.isArray(options.modelCols) ? options.modelCols : [];

  if (refUgapCol > -1) {
    const raw = r[refUgapCol];
    if (looksLikeRefCell(raw)) return formatUgapRefCell(raw);
  }

  for (let j = 0; j < r.length; j += 1) {
    if (j === modelCol || j === labelCol || j === priceClientCol || j === priceUgapCol) continue;
    if (j === refFournisseurCol) continue;
    if (modelCols.includes(j)) continue;
    const cell = r[j];
    if (looksLikeRefCell(cell)) return formatUgapRefCell(cell);
  }
  return '';
}

module.exports = {
  detectRefUgapColumn,
  inferRefUgapColFromRecapRows,
  looksLikeRefCell,
  normalizeHeaderText,
  pickRefUgapFromRecapRow,
  formatUgapRefCell,
};
