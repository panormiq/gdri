/**
 * FICHIER : backend/modules/agent-documentaire-v2/lib/devis-table-utils.js
 * RÔLE : Largeurs de colonnes et pagination des lignes de devis.
 *
 * La hauteur du bloc lignes n'est pas fixe : on remplit l'espace disponible
 * jusqu'au bloc suivant (totaux), puis on ajuste la hauteur au nombre de lignes.
 */

const ROW_HEIGHT_MM = 9.5;
const HEADER_ROW_HEIGHT_MM = 8;
const TABLE_ROW_GAP_MM = 0.5;
/** Espace minimal entre le bas du tableau et le bloc totaux / pied. */
const LIGNES_TO_FOOTER_GAP_MM = 4;
/** Hauteur d'une ligne de texte dans une cellule (9pt, interligne ~1.25). */
const ROW_LINE_HEIGHT_MM = 4;
/** Padding vertical + bordures d'une cellule (6px haut + 6px bas). */
const ROW_VERTICAL_PADDING_MM = 3.6;
/** Largeur moyenne d'un caractère à 9pt (volontairement pessimiste). */
const CELL_TEXT_CHAR_MM = 1.8;
/** Padding horizontal cellule (8px gauche + 8px droite) + bordures. */
const CELL_HORIZONTAL_PADDING_MM = 4.6;
/** Garde-fou : nombre max de lignes de texte estimées par cellule. */
const MAX_ESTIMATED_TEXT_LINES = 8;

const HEADER_ZONE_TYPES = new Set(['entreprise', 'client', 'devis']);
const CLOSING_FOOTER_ZONE_TYPES = new Set(['total-devis', 'transport', 'bon-pour-accord']);
const RUNNING_FOOTER_ZONE_TYPES = new Set(['pied-de-page']);
const FOOTER_ZONE_TYPES = new Set([...CLOSING_FOOTER_ZONE_TYPES, ...RUNNING_FOOTER_ZONE_TYPES]);

function rowsPerPage(tableHeightMm) {
  const h = Number(tableHeightMm);
  if (!Number.isFinite(h) || h <= HEADER_ROW_HEIGHT_MM) return 1;
  return Math.max(1, Math.floor((h - HEADER_ROW_HEIGHT_MM - TABLE_ROW_GAP_MM) / ROW_HEIGHT_MM));
}

function tableHeightForRows(rowCount) {
  const n = Math.max(0, Number(rowCount) || 0);
  if (n <= 0) return HEADER_ROW_HEIGHT_MM + 2;
  return HEADER_ROW_HEIGHT_MM + TABLE_ROW_GAP_MM + n * ROW_HEIGHT_MM;
}

function zoneHeightForRows(rowCount, tableYInZone = 1.8) {
  const inset = Number(tableYInZone) || 1.8;
  return inset + tableHeightForRows(rowCount) + 1;
}

/**
 * Nombre de lignes de texte qu'occupera une ligne du tableau une fois
 * le texte replié dans ses colonnes (word-wrap). Estimation pessimiste.
 */
function estimateRowTextLines(row, fieldOrder, columnWidths, tableWidthMm = 172.8) {
  const r = row && typeof row === 'object' ? row : {};
  const order = Array.isArray(fieldOrder) && fieldOrder.length ? fieldOrder : Object.keys(r);
  if (!order.length) return 1;
  const widths = normalizeColumnWidths(order, columnWidths);
  let maxLines = 1;
  order.forEach((key) => {
    const text = String(r[key] ?? '').trim();
    if (!text) return;
    const colMm = ((Number(widths[key]) || (100 / order.length)) / 100) * tableWidthMm;
    const usableMm = Math.max(CELL_TEXT_CHAR_MM * 4, colMm - CELL_HORIZONTAL_PADDING_MM);
    const charsPerLine = Math.max(4, Math.floor(usableMm / CELL_TEXT_CHAR_MM));
    const lines = Math.min(MAX_ESTIMATED_TEXT_LINES, Math.ceil(text.length / charsPerLine));
    if (lines > maxLines) maxLines = lines;
  });
  return maxLines;
}

function estimatedRowHeightMm(textLines) {
  const n = Math.max(1, Number(textLines) || 1);
  return Math.max(ROW_HEIGHT_MM, ROW_VERTICAL_PADDING_MM + n * ROW_LINE_HEIGHT_MM);
}

/** Hauteur estimée (mm) de chaque ligne du devis selon le template. */
function computeRowHeightsMm(lines, template) {
  const rows = Array.isArray(lines) ? lines : [];
  const { table } = findLignesLayout(template);
  const cfg = table?.tableConfig || {};
  const rawOrder = Array.isArray(cfg.fieldOrder) && cfg.fieldOrder.length
    ? cfg.fieldOrder
    : (Array.isArray(cfg.visibleFields) ? cfg.visibleFields : []);
  const order = rawOrder.filter(Boolean);
  const fieldOrder = order.length ? order : ['refUgap', 'libelle', 'prix'];
  const tableWidthMm = Number(table?.layout?.width) || 172.8;
  return rows.map((row) => estimatedRowHeightMm(
    estimateRowTextLines(row, fieldOrder, cfg.columnWidths, tableWidthMm)
  ));
}

/** Hauteur tableau (mm) pour un corps de lignes de hauteur donnée. */
function tableHeightForBodyMm(bodyMm) {
  const b = Math.max(0, Number(bodyMm) || 0);
  if (b <= 0) return HEADER_ROW_HEIGHT_MM + 2;
  return HEADER_ROW_HEIGHT_MM + TABLE_ROW_GAP_MM + b;
}

/** Hauteur max de la zone lignes (seule zone redimensionnée automatiquement). */
function maxLignesZoneHeightMm(template, pageConfig = {}, pageContext = {}) {
  const { zoneY } = findLignesLayout(template);
  const page = pageConfig || {};
  const pageHeight = Number(page.heightMm) || 297;
  const margins = page.margins || { top: 15, bottom: 15 };
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const isMulti = pageContext.isMultiPage === true;
  const isLast = pageContext.isLast !== false;
  const piedTop = getPiedPageTopY(template);
  const closingHeight = computeClosingFooterBlockHeight(nodes);
  const minH = HEADER_ROW_HEIGHT_MM + ROW_HEIGHT_MM;
  const showClosing = !isMulti || isLast;

  if (showClosing && Number.isFinite(piedTop)) {
    return Math.max(minH, piedTop - zoneY - LIGNES_TO_FOOTER_GAP_MM - closingHeight);
  }

  if (Number.isFinite(piedTop)) {
    return Math.max(minH, piedTop - zoneY - LIGNES_TO_FOOTER_GAP_MM);
  }

  const firstFooterY = getFirstFooterZoneY(template);
  if (Number.isFinite(firstFooterY)) {
    return Math.max(minH, firstFooterY - zoneY - LIGNES_TO_FOOTER_GAP_MM);
  }

  return Math.max(minH, pageHeight - zoneY - (margins.bottom || 15) - 8);
}

/** Espace utile pour le tableau (hors inset zone + marge bas zone). */
function maxTableHeightInZone(maxZoneHeightMm, tableYInZone = 1.8) {
  const zoneH = Number(maxZoneHeightMm) || 0;
  const inset = Number(tableYInZone) || 1.8;
  return Math.max(HEADER_ROW_HEIGHT_MM + ROW_HEIGHT_MM, zoneH - inset - 1);
}

function clampZoneHeightForRows(rowCount, tableYInZone, maxZoneHeightMm) {
  const raw = zoneHeightForRows(rowCount, tableYInZone);
  const maxH = Number(maxZoneHeightMm);
  if (!Number.isFinite(maxH) || maxH <= 0) return raw;
  return Math.min(raw, maxH);
}

function getFirstFooterZoneY(template) {
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const zones = nodes.filter((n) => n.type === 'zone' && CLOSING_FOOTER_ZONE_TYPES.has(n.zoneType));
  if (!zones.length) return null;
  const ys = zones
    .map((z) => Number(z.layout?.y))
    .filter((y) => Number.isFinite(y));
  return ys.length ? Math.min(...ys) : null;
}

function getRunningFooterZoneTopY(template) {
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const pied = nodes.find((n) => n.type === 'zone' && n.zoneType === 'pied-de-page');
  if (!pied) return null;
  const y = Number(pied.layout?.y);
  return Number.isFinite(y) ? y : null;
}

/** Position Y du haut de la zone pied-de-page (ancrée au bas de page). */
function getPiedPageTopY(template) {
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const pied = nodes.find((n) => n.type === 'zone' && n.zoneType === 'pied-de-page');
  if (!pied) return getRunningFooterZoneTopY(template);
  const page = template?.page || {};
  const ph = Number(page.heightMm) || 297;
  const layout = pied.layout || {};
  const h = Number(layout.height) || 32;
  const templateY = Number(layout.y);
  const bottomInset = Number.isFinite(templateY)
    ? Math.max(0, ph - templateY - h)
    : Number(page.margins?.bottom) || 15;
  return Math.round((ph - bottomInset - h) * 10) / 10;
}

function normalizeColumnWidths(fieldOrder, columnWidths) {
  const order = Array.isArray(fieldOrder) ? fieldOrder.filter(Boolean) : [];
  if (!order.length) return {};
  const raw = columnWidths && typeof columnWidths === 'object' ? columnWidths : {};
  const values = order.map((key) => {
    const n = Number(raw[key]);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const hasCustom = values.some((v) => v != null);
  if (!hasCustom) {
    const equal = Math.round((100 / order.length) * 100) / 100;
    const out = {};
    order.forEach((key, i) => {
      out[key] = i === order.length - 1
        ? Math.round((100 - equal * (order.length - 1)) * 100) / 100
        : equal;
    });
    return out;
  }
  const sum = values.reduce((acc, v, i) => acc + (v != null ? v : 0), 0);
  const missing = values.filter((v) => v == null).length;
  const remaining = Math.max(0, 100 - sum);
  const fallback = missing ? remaining / missing : 0;
  const out = {};
  order.forEach((key, i) => {
    out[key] = Math.round((values[i] != null ? values[i] : fallback) * 100) / 100;
  });
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (total > 0 && Math.abs(total - 100) > 0.01) {
    const lastKey = order[order.length - 1];
    out[lastKey] = Math.round((out[lastKey] + (100 - total)) * 100) / 100;
  }
  return out;
}

function buildColgroupHtml(fieldOrder, columnWidths) {
  const order = Array.isArray(fieldOrder) ? fieldOrder : [];
  const widths = normalizeColumnWidths(order, columnWidths);
  if (!order.length) return '';
  const cols = order.map((key) => `<col style="width:${widths[key]}%">`).join('');
  return `<colgroup>${cols}</colgroup>`;
}

function computeFooterBlockHeight(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const zones = list.filter((n) => n.type === 'zone' && FOOTER_ZONE_TYPES.has(n.zoneType));
  if (!zones.length) return 0;
  let minY = Infinity;
  let maxBottom = 0;
  zones.forEach((z) => {
    const y = Number(z.layout?.y) || 0;
    const h = Number(z.layout?.height) || 0;
    minY = Math.min(minY, y);
    maxBottom = Math.max(maxBottom, y + h);
  });
  return maxBottom - minY + LIGNES_TO_FOOTER_GAP_MM;
}

function computeClosingFooterBlockHeight(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const zones = list.filter((n) => n.type === 'zone' && CLOSING_FOOTER_ZONE_TYPES.has(n.zoneType));
  if (!zones.length) return 0;
  let minY = Infinity;
  let maxBottom = 0;
  zones.forEach((z) => {
    const y = Number(z.layout?.y) || 0;
    const h = Number(z.layout?.height) || 0;
    minY = Math.min(minY, y);
    maxBottom = Math.max(maxBottom, y + h);
  });
  return maxBottom - minY + LIGNES_TO_FOOTER_GAP_MM;
}

function findLignesLayout(template) {
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const zone = nodes.find((n) => n.zoneType === 'lignes' || n.id === 'zone_lignes');
  const table = nodes.find(
    (n) => n.type === 'table' && (
      n.parentId === zone?.id
      || n.tableConfig?.collectionNamespace === 'ugap:ligne-devis'
    )
  ) || (zone?.children?.length
    ? nodes.find((n) => n.id === zone.children[0] && n.type === 'table')
    : null);

  const zoneY = Number(zone?.layout?.y) || 64;
  const tableYInZone = Number(table?.layout?.y) || 1.8;
  const piedTop = getPiedPageTopY(template);
  const firstFooterY = getFirstFooterZoneY(template);
  const tableStartY = zoneY + tableYInZone;
  const maxZoneHeightMm = Number.isFinite(piedTop)
    ? Math.max(HEADER_ROW_HEIGHT_MM + ROW_HEIGHT_MM, piedTop - zoneY - LIGNES_TO_FOOTER_GAP_MM)
    : (Number.isFinite(firstFooterY)
      ? Math.max(HEADER_ROW_HEIGHT_MM + ROW_HEIGHT_MM, firstFooterY - zoneY - LIGNES_TO_FOOTER_GAP_MM)
      : (Number(zone?.layout?.height) || 90));
  const firstPageTableAreaMm = maxTableHeightInZone(maxZoneHeightMm, tableYInZone);

  return {
    zone,
    table,
    zoneY,
    tableYInZone,
    tableStartY,
    firstFooterY,
    footerGapMm: LIGNES_TO_FOOTER_GAP_MM,
    maxZoneHeightMm,
    firstPageTableAreaMm,
    /** @deprecated utiliser firstPageTableAreaMm */
    tableHeightMm: firstPageTableAreaMm
  };
}

function availableTableHeight(pageConfig, template, pageKind) {
  const { tableYInZone, zoneY } = findLignesLayout(template);
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const piedTop = getPiedPageTopY(template);
  const closingHeight = computeClosingFooterBlockHeight(nodes);
  const minZone = HEADER_ROW_HEIGHT_MM + ROW_HEIGHT_MM;
  const page = pageConfig || {};
  const pageHeight = Number(page.heightMm) || 297;
  const bottom = (page.margins || {}).bottom || 15;

  if (pageKind === 'last') {
    const maxZone = Number.isFinite(piedTop)
      ? piedTop - zoneY - LIGNES_TO_FOOTER_GAP_MM - closingHeight
      : pageHeight - zoneY - bottom - 8;
    return maxTableHeightInZone(Math.max(minZone, maxZone), tableYInZone);
  }

  // first + middle : remplir jusqu'au pied de page (pas jusqu'aux totaux)
  const maxZone = Number.isFinite(piedTop)
    ? piedTop - zoneY - LIGNES_TO_FOOTER_GAP_MM
    : pageHeight - zoneY - bottom - 8;

  return maxTableHeightInZone(Math.max(minZone, maxZone), tableYInZone);
}

/**
 * Répartit les lignes par pages en fonction de leur hauteur estimée (mm),
 * pas d'un simple comptage : une ligne au libellé long occupe plusieurs
 * lignes de texte et consomme plus de hauteur.
 */
function paginateLines(lines, template, pageConfig = {}) {
  const rows = Array.isArray(lines) ? lines : [];
  if (!rows.length) return [[]];

  const heights = computeRowHeightsMm(rows, template);
  const bodyBudget = (kind) => Math.max(
    ROW_HEIGHT_MM,
    availableTableHeight(pageConfig, template, kind) - HEADER_ROW_HEIGHT_MM - TABLE_ROW_GAP_MM
  );
  const firstBudget = bodyBudget('first');
  const middleBudget = bodyBudget('middle');
  const lastBudget = bodyBudget('last');
  const remainingHeightFrom = (idx) => heights.slice(idx).reduce((a, b) => a + b, 0);

  // Page unique = aussi la dernière page : les totaux y sont affichés,
  // donc le budget de référence est celui de la dernière page.
  if (remainingHeightFrom(0) <= lastBudget) return [rows];

  const chunks = [];
  let offset = 0;
  while (offset < rows.length) {
    if (remainingHeightFrom(offset) <= lastBudget) {
      chunks.push(rows.slice(offset));
      break;
    }
    const budget = chunks.length === 0 ? firstBudget : middleBudget;
    let take = 0;
    let used = 0;
    while (offset + take < rows.length && used + heights[offset + take] <= budget) {
      used += heights[offset + take];
      take += 1;
    }
    // Toujours avancer d'au moins une ligne, et en garder au moins une
    // pour la page suivante (qui peut être la dernière).
    take = Math.max(1, Math.min(take, rows.length - offset - 1));
    chunks.push(rows.slice(offset, offset + take));
    offset += take;
  }

  return chunks;
}

module.exports = {
  ROW_HEIGHT_MM,
  HEADER_ROW_HEIGHT_MM,
  LIGNES_TO_FOOTER_GAP_MM,
  HEADER_ZONE_TYPES,
  CLOSING_FOOTER_ZONE_TYPES,
  RUNNING_FOOTER_ZONE_TYPES,
  FOOTER_ZONE_TYPES,
  rowsPerPage,
  tableHeightForRows,
  tableHeightForBodyMm,
  estimateRowTextLines,
  estimatedRowHeightMm,
  computeRowHeightsMm,
  zoneHeightForRows,
  maxLignesZoneHeightMm,
  maxTableHeightInZone,
  clampZoneHeightForRows,
  normalizeColumnWidths,
  buildColgroupHtml,
  computeFooterBlockHeight,
  computeClosingFooterBlockHeight,
  getFirstFooterZoneY,
  getRunningFooterZoneTopY,
  getPiedPageTopY,
  findLignesLayout,
  availableTableHeight,
  paginateLines
};
