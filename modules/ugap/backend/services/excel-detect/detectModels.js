/**
 * Détection des modèles (colonnes avec croix, ligne récap = première croix).
 */

const extractModelRecapRow = require('./extractModelRecapRow');

function extractModelNameFromHeader(raw, colIndex, headerRowIndex) {
  for (let i = Math.max(0, headerRowIndex - 3); i <= headerRowIndex + 3 && i < raw.length; i += 1) {
    const cell = raw[i] && raw[i][colIndex];
    if (cell && typeof cell === 'string' && cell.trim().length > 0) {
      const name = String(cell).trim();
      if (/p\d+|alu|620|750|rescue|patrol|zeppelin/i.test(name)) {
        return name;
      }
    }
  }
  return `Colonne ${colIndex}`;
}

/**
 * @returns {{ models: object[], baseRowIndices: Set<number> }}
 */
function detectModels(raw, structure, priceClientCol, priceUgapCol) {
  const startRow = structure.headerRowIndex + 1;
  const models = [];
  const baseRowIndices = new Set();

  structure.modelCols.forEach((colIdx) => {
    const recap = extractModelRecapRow(
      raw,
      colIdx,
      structure.labelCol,
      priceClientCol,
      priceUgapCol,
      startRow
    );
    if (recap.rowIndex >= 0) {
      baseRowIndices.add(recap.rowIndex);
    }
    const nameFallback = extractModelNameFromHeader(raw, colIdx, structure.headerRowIndex);
    models.push({
      id: `model_${colIdx}`,
      colIndex: colIdx,
      name: recap.parsed.modelName || nameFallback,
      baseLabel: recap.label,
      motorizationBase: recap.parsed.motorizationBase || '',
      posteNumber: recap.parsed.posteNumber,
      priceClient: recap.priceClient,
      priceUgap: recap.priceUgap,
      rowIndex: recap.rowIndex
    });
  });

  return { models, baseRowIndices };
}

module.exports = detectModels;
