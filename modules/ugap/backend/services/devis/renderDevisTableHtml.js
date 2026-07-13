/**
 * FICHIER : modules/ugap/backend/services/devis/renderDevisTableHtml.js
 * RÔLE : Génère le HTML du tableau des lignes de devis.
 *
 * ENTRÉES : lignes [{ refUgap, libelle, libelleApp, categorie, prix }]
 * SORTIES : fragment HTML <table>
 *
 * DÉPEND DE : aucun
 * NE PAS : appels agent documentaire
 *
 * APPELÉ PAR : buildDevisVariables.js
 */

const { resolveModelUgapPrice } = require('./devisBillablePrice');
const { resolveDevisRefUgap, resolveDevisUgapLabel, resolveDevisAppLabel } = require('./resolveDevisLabels');
const UgapDataService = require('../UgapDataService');
const { resolveDevisOptionCategory } = require('./resolveDevisCatalogCategory');
const {
  normalizeColumnWidths,
  buildColgroupHtml,
  paginateLines,
  findLignesLayout,
  rowsPerPage
} = require('../../../../../backend/modules/agent-documentaire-v2/lib/devis-table-utils');

const COLUMN_DEFS = [
  { key: 'refUgap', label: 'Réf. UGAP' },
  { key: 'libelle', label: 'Libellé UGAP' },
  { key: 'libelleApp', label: 'Libellé' },
  { key: 'categorie', label: 'Catégorie' },
  { key: 'prix', label: 'Prix UGAP HT' }
];

/** Colonnes par défaut si le modèle canvas n'a pas encore fieldOrder (aligné éditeur V2). */
const DEFAULT_TABLE_FIELD_ORDER = ['refUgap', 'libelle', 'prix'];

const DEFAULT_COLUMNS = DEFAULT_TABLE_FIELD_ORDER.map((key) => {
  const def = COLUMN_DEFS.find((c) => c.key === key);
  return def || { key, label: key };
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isIncludedDevisOption(option) {
  const opt = option && typeof option === 'object' ? option : {};
  if (opt.isModelBaseLine === true) return true;
  if (UgapDataService.computeIsBaseOption(opt)) return true;
  if (UgapDataService.normalizeInclusionKind(opt) === 'inclus') return true;
  const ref = String(opt.refUgap || '').trim().toUpperCase();
  if (ref.startsWith('IBP-')) return true;
  return false;
}

function formatDevisLinePrice(option) {
  const opt = option && typeof option === 'object' ? option : {};
  if (isIncludedDevisOption(opt)) return 'Inclus';
  const billable = Number(opt.billablePrice);
  const rawPrice = Number.isFinite(billable)
    ? billable
    : (Number.isFinite(Number(opt.priceUgap)) ? Number(opt.priceUgap) : Number(opt.priceClient ?? opt.price ?? 0));
  return formatMoney(rawPrice);
}

function findCatalogOptionInData(categories, optionId) {
  const id = String(optionId || '').trim();
  if (!id) return null;
  for (const category of categories || []) {
    const option = (category?.options || []).find((o) => String(o?.id || '').trim() === id);
    if (option) {
      return {
        option,
        category: category?.name || category?.id || ''
      };
    }
  }
  return null;
}

function optionToLine(option, categoryName) {
  const opt = option && typeof option === 'object' ? option : {};
  return {
    refUgap: resolveDevisRefUgap(opt),
    libelle: resolveDevisUgapLabel(opt),
    libelleApp: resolveDevisAppLabel(opt),
    categorie: String(categoryName || opt.category || opt.familyLabel || '').trim(),
    prix: formatDevisLinePrice(opt)
  };
}

function buildModelBaseLine(model, configName, modelCategory = '') {
  const m = model && typeof model === 'object' ? model : {};
  const basePrice = resolveModelUgapPrice(m);
  const poste = m.posteNumber;
  const refUgap = String(m.refUgap || m.ref || '').trim()
    || (poste != null && poste !== '' && Number.isFinite(Number(poste)) ? `P${poste}` : '');
  const name = String(m.name || 'Modèle').trim();
  const config = String(configName || '').trim();
  const label = config ? `${name} — ${config}` : name;
  const categorie = String(modelCategory || '').trim() || 'Modèle';
  return {
    refUgap,
    name: label,
    libelle: label,
    libelleApp: config || name,
    category: categorie,
    billablePrice: basePrice,
    isModelBaseLine: true
  };
}

/**
 * Lignes tableau PDF / HTML devis :
 * 1) modèle de base (prix bateau)
 * 2) toutes les lignes options calculées par le pricing
 */
function buildDevisRenderTableLines(pricingData) {
  const data = pricingData && typeof pricingData === 'object' ? pricingData : {};
  const lines = [];
  if (data.model) {
    lines.push(buildModelBaseLine(data.model, data.configName, data.modelCategory));
  }
  (Array.isArray(data.selectedOptions) ? data.selectedOptions : []).forEach((opt) => {
    if (opt?.isModelBaseLine) return;
    lines.push(opt);
  });
  return lines;
}

/**
 * Lignes tableau avec options incluses (ordre parcours) — le pricing reste sur billableOptionIds.
 */
function buildDevisDisplayTableLines(data, pricingData, displayOptionIds = [], devisOptionCategories = null) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const pricing = pricingData && typeof pricingData === 'object' ? pricingData : {};
  const pricingById = new Map(
    (Array.isArray(pricing.selectedOptions) ? pricing.selectedOptions : [])
      .map((opt) => [String(opt?.id || '').trim(), opt])
      .filter(([id]) => id)
  );
  const lines = [];
  if (pricing.model) {
    lines.push(buildModelBaseLine(pricing.model, pricing.configName, pricing.modelCategory));
  }
  (Array.isArray(displayOptionIds) ? displayOptionIds : []).forEach((rawId) => {
    const id = String(rawId || '').trim();
    if (!id) return;
    const priced = pricingById.get(id);
    if (priced) {
      lines.push(priced);
      return;
    }
    const hit = findCatalogOptionInData(categories, id);
    if (!hit) return;
    const categoryLabels = resolveDevisOptionCategory(
      data,
      hit.option,
      devisOptionCategories,
      hit.category
    );
    lines.push({
      ...hit.option,
      category: categoryLabels.categorie || hit.category,
      devisSousNoeud: categoryLabels.sousNoeud || '',
      billablePrice: 0
    });
  });
  return lines;
}

/** @deprecated Préférer buildDevisRenderTableLines */
function buildDevisTableLines(pricingData) {
  return buildDevisRenderTableLines(pricingData);
}

function normalizeTableConfig(tableConfig) {
  const cfg = tableConfig && typeof tableConfig === 'object' ? tableConfig : {};
  const order = Array.isArray(cfg.fieldOrder) && cfg.fieldOrder.length
    ? [...cfg.fieldOrder]
    : (Array.isArray(cfg.visibleFields) && cfg.visibleFields.length
      ? [...cfg.visibleFields]
      : [...DEFAULT_TABLE_FIELD_ORDER]);
  const visible = Array.isArray(cfg.visibleFields) && cfg.visibleFields.length
    ? [...cfg.visibleFields]
    : [...order];
  const keys = order.filter((key) => visible.includes(key));
  const fieldOrder = keys.length ? keys : [...DEFAULT_TABLE_FIELD_ORDER];
  const columnWidths = normalizeColumnWidths(fieldOrder, cfg.columnWidths);
  return {
    ...cfg,
    fieldOrder,
    visibleFields: [...fieldOrder],
    columnWidths
  };
}

function columnsFromTableConfig(tableConfig) {
  const cfg = normalizeTableConfig(tableConfig);
  return cfg.fieldOrder.map((key) => {
    const def = COLUMN_DEFS.find((c) => c.key === key);
    return def || { key, label: key };
  });
}

function findDevisTableConfigInTemplate(template) {
  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const table = nodes.find(
    (n) => n.type === 'table' && n.tableConfig?.collectionNamespace === 'ugap:ligne-devis'
  ) || nodes.find((n) => n.type === 'table' && n.tableConfig);
  return table?.tableConfig || null;
}

function renderDevisTableHtml(lines, columns = DEFAULT_COLUMNS, tableConfig = null) {
  const rows = Array.isArray(lines) ? lines : [];
  const cols = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;
  const cfg = tableConfig ? normalizeTableConfig(tableConfig) : null;
  const fieldOrder = cfg?.fieldOrder || cols.map((c) => c.key);
  const colgroup = buildColgroupHtml(fieldOrder, cfg?.columnWidths);

  let html = '<table class="ugap-devis-lines" style="width:100%;border-collapse:collapse;margin:0;font-size:9pt;table-layout:fixed;">';
  html += colgroup;
  html += '<thead><tr>';
  cols.forEach((col) => {
    html += `<th style="border:1px solid #ccc;padding:6px 8px;background:#f3f4f6;text-align:left;">${escapeHtml(col.label)}</th>`;
  });
  html += '</tr></thead><tbody>';

  if (!rows.length) {
    html += `<tr><td colspan="${cols.length}" style="border:1px solid #ccc;padding:8px;color:#666;">Aucune ligne</td></tr>`;
  } else {
    rows.forEach((line) => {
      html += '<tr>';
      cols.forEach((col) => {
        const raw = line?.[col.key];
        const display = col.key === 'prix' && raw && !String(raw).includes('€') ? `${raw} €` : raw;
        html += `<td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;">${escapeHtml(display)}</td>`;
      });
      html += '</tr>';
    });
  }

  html += '</tbody></table>';
  return html;
}

module.exports = {
  COLUMN_DEFS,
  DEFAULT_TABLE_FIELD_ORDER,
  DEFAULT_COLUMNS,
  normalizeTableConfig,
  columnsFromTableConfig,
  findDevisTableConfigInTemplate,
  optionToLine,
  buildModelBaseLine,
  buildDevisRenderTableLines,
  buildDevisDisplayTableLines,
  buildDevisTableLines,
  renderDevisTableHtml,
  paginateLines,
  findLignesLayout,
  rowsPerPage,
  formatMoney
};
