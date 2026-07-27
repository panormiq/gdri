/**
 * FICHIER : modules/ugap/backend/services/devis/renderDevisTableHtml.js
 * RÔLE : Génère le HTML du tableau des lignes de devis.
 *
 * ENTRÉES : lignes [{ refUgap, libelle, libelleApp, categorie, prix, prixPublic }]
 * SORTIES : fragment HTML <table>
 *
 * DÉPEND DE : aucun
 * NE PAS : appels agent documentaire
 *
 * APPELÉ PAR : buildDevisVariables.js
 */

const {
  resolveModelUgapPrice,
  getOptionBillablePrice,
  buildBillableAdjIdSet
} = require('./devisBillablePrice');
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
  { key: 'refFournisseur', label: 'Réf. fournisseur' },
  { key: 'libelle', label: 'Libellé UGAP' },
  { key: 'libelleApp', label: 'Libellé' },
  { key: 'categorie', label: 'Catégorie' },
  { key: 'prix', label: 'Prix UGAP HT' },
  { key: 'prixPublic', label: 'Prix public HT' }
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
  // Évite l'espace fine insécable (U+202F) de toLocaleString fr-FR — mal rendu en PDF.
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const [intRaw, dec = '00'] = abs.toFixed(2).split('.');
  const intGrouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${intGrouped},${dec}`;
}

function coerceMoneyAmount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .trim()
    .replace(/[€\s\u00a0\u202f]/g, '')
    .replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
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

function resolveIncludedDevisDisplayPrice(option, modelId = '') {
  const opt = option && typeof option === 'object' ? option : {};
  const mid = String(modelId || '').trim();
  const byModel = opt.importBaseProductPricesByModelId;
  if (mid && byModel && typeof byModel === 'object') {
    const modelPrice = Number(byModel[mid]);
    if (Number.isFinite(modelPrice) && modelPrice > 0) return modelPrice;
  }
  const baseIncluded = Number(opt.baseIncludedPrice);
  if (Number.isFinite(baseIncluded) && baseIncluded > 0) return baseIncluded;
  const ugap = Number(opt.priceUgap);
  if (Number.isFinite(ugap) && ugap > 0) return ugap;
  const client = Number(opt.priceClient ?? opt.price);
  return Number.isFinite(client) && client > 0 ? client : 0;
}

/**
 * Montant prix public catalogue.
 * priceClient: 0 est traité comme absent (sinon on masque basePrice).
 */
function resolvePublicPriceAmount(option, modelId = '') {
  const opt = option && typeof option === 'object' ? option : {};
  const mid = String(modelId || '').trim();
  const byModel = mid && opt.importBaseProductPricesByModelId && typeof opt.importBaseProductPricesByModelId === 'object'
    ? opt.importBaseProductPricesByModelId[mid]
    : null;
  const candidates = [
    opt.priceClient,
    opt.pricePublic,
    opt.clientPrice,
    opt.basePrice,
    opt.baseIncludedPrice,
    byModel,
    opt.price
  ];
  for (const candidate of candidates) {
    const amount = coerceMoneyAmount(candidate);
    if (amount != null && amount !== 0) return amount;
  }
  for (const candidate of candidates) {
    const amount = coerceMoneyAmount(candidate);
    if (amount != null) return amount;
  }
  return 0;
}

function formatDevisLinePrice(option, modelId = '') {
  const opt = option && typeof option === 'object' ? option : {};
  if (opt.isModelBaseLine === true) {
    const amount = Number(opt.billablePrice);
    return Number.isFinite(amount) ? formatMoney(amount) : '—';
  }
  if (isIncludedDevisOption(opt)) {
    const amount = resolveIncludedDevisDisplayPrice(opt, modelId);
    if (amount > 0) return `${formatMoney(amount)} (inclus)`;
    return 'Inclus';
  }
  const billable = Number(opt.billablePrice);
  const rawPrice = Number.isFinite(billable)
    ? billable
    : (Number.isFinite(Number(opt.priceUgap)) ? Number(opt.priceUgap) : Number(opt.priceClient ?? opt.price ?? 0));
  return formatMoney(rawPrice);
}

function formatDevisLinePublicPrice(option, modelId = '') {
  const opt = option && typeof option === 'object' ? option : {};
  const mid = String(modelId || '').trim();
  if (opt.isModelBaseLine === true) {
    const amount = resolvePublicPriceAmount(opt, mid);
    return Number.isFinite(amount) ? formatMoney(amount) : '—';
  }
  if (isIncludedDevisOption(opt)) {
    const amount = resolvePublicPriceAmount(opt, mid);
    if (amount > 0) return `${formatMoney(amount)} (inclus)`;
    return 'Inclus';
  }
  let raw = resolvePublicPriceAmount(opt, mid);
  if (UgapDataService.resolveEffectiveImportLineKind(opt) === 'minoration') {
    raw = -Math.abs(raw);
  }
  return formatMoney(raw);
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

function optionToLine(option, categoryName, modelId = '') {
  const opt = option && typeof option === 'object' ? option : {};
  const mid = String(modelId || opt._devisModelId || '').trim();
  return {
    refUgap: resolveDevisRefUgap(opt),
    refFournisseur: String(opt.refFournisseur || '').trim(),
    libelle: resolveDevisUgapLabel(opt),
    libelleApp: resolveDevisAppLabel(opt),
    categorie: String(categoryName || opt.category || opt.familyLabel || '').trim(),
    prix: formatDevisLinePrice(opt, mid),
    prixPublic: formatDevisLinePublicPrice(opt, mid)
  };
}

function buildModelBaseLine(model, _configName, modelCategory = '') {
  const m = model && typeof model === 'object' ? model : {};
  const basePrice = resolveModelUgapPrice(m);
  const publicPrice = resolvePublicPriceAmount(m);
  const poste = m.posteNumber;
  const refUgap = String(m.refUgap || m.ref || '').trim()
    || (poste != null && poste !== '' && Number.isFinite(Number(poste)) ? `P${poste}` : '');
  const modelName = String(m.name || 'Modèle').trim();
  const excelDesignation = String(m.baseLabel || '').trim();
  const categorie = String(modelCategory || '').trim() || 'Modèle';
  return {
    refUgap,
    refFournisseur: String(m.refFournisseur || '').trim(),
    name: modelName,
    importExcelLabel: excelDesignation || modelName,
    libelle: excelDesignation || modelName,
    libelleApp: modelName,
    category: categorie,
    priceClient: Number.isFinite(publicPrice) ? publicPrice : 0,
    basePrice: Number.isFinite(Number(m.basePrice)) ? Number(m.basePrice) : (Number.isFinite(publicPrice) ? publicPrice : 0),
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
  const selectedSet = new Set(
    [
      ...(Array.isArray(pricing.requestedOptionIds) ? pricing.requestedOptionIds : []),
      ...(Array.isArray(displayOptionIds) ? displayOptionIds : []),
      ...(Array.isArray(pricing.selectedOptions)
        ? pricing.selectedOptions.map((opt) => String(opt?.id || '').trim())
        : [])
    ]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const billableAdjIds = buildBillableAdjIdSet(selectedSet, categories);
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
      billablePrice: getOptionBillablePrice(hit.option, {
        selectedSet,
        categories,
        billableAdjIds
      })
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
        const display = (col.key === 'prix' || col.key === 'prixPublic')
          && raw != null && raw !== ''
          && !String(raw).includes('€')
          ? `${raw} €`
          : (raw ?? '');
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
