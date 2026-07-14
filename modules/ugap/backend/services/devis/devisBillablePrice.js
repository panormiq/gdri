/**
 * FICHIER : modules/ugap/backend/services/devis/devisBillablePrice.js
 * RÔLE : Prix facturable devis (aligné configurateur : UGAP, IBP, inclus, mino/majo).
 *
 * ENTRÉES : option catalogue, contexte sélection
 * SORTIES : montant HT facturable (nombre)
 *
 * DÉPEND DE : UgapDataService
 * NE PAS : rendu PDF, routes
 *
 * APPELÉ PAR : computeDevisPricing, renderDevisTableHtml
 */

const UgapDataService = require('../UgapDataService');

function catalogUgapPrice(option) {
  const opt = option && typeof option === 'object' ? option : {};
  const ugap = Number(opt.priceUgap);
  if (Number.isFinite(ugap)) return ugap;
  const client = Number(opt.priceClient ?? opt.price);
  return Number.isFinite(client) ? client : 0;
}

/** Prix bateau devis : UGAP en priorité (basePrice = prix public à l'import Excel). */
function resolveModelUgapPrice(model) {
  const m = model && typeof model === 'object' ? model : {};
  const ugap = Number(m.priceUgap ?? m.ugapPrice);
  if (Number.isFinite(ugap) && ugap > 0) return ugap;
  const client = Number(m.priceClient ?? m.basePrice);
  return Number.isFinite(client) ? client : 0;
}

/** Options 5 % personnalisées : champ `price` en priorité (aligné configurateur). */
function fivePercentOptionPrice(option) {
  const opt = option && typeof option === 'object' ? option : {};
  const direct = Number(opt.price);
  if (Number.isFinite(direct)) return direct;
  return catalogUgapPrice(opt);
}

function flattenCatalogOptions(categories) {
  const out = [];
  (Array.isArray(categories) ? categories : []).forEach((cat) => {
    (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
      if (opt && typeof opt === 'object') out.push(opt);
    });
  });
  return out;
}

function findCatalogOption(categories, optionId) {
  const id = String(optionId || '').trim();
  if (!id) return null;
  return flattenCatalogOptions(categories).find((opt) => String(opt?.id || '').trim() === id) || null;
}

function isAdjOption(option) {
  const kind = UgapDataService.resolveEffectiveImportLineKind(option);
  return kind === 'minoration' || kind === 'majoration';
}

function isBaseCatalogOption(option) {
  return UgapDataService.computeIsBaseOption(option);
}

function modelsOverlap(baseOpt, otherOpt) {
  const a = new Set(
    (Array.isArray(baseOpt?.compatibleModels) ? baseOpt.compatibleModels : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  );
  const b = (Array.isArray(otherOpt?.compatibleModels) ? otherOpt.compatibleModels : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (!a.size || !b.length) return false;
  return b.some((mid) => a.has(mid));
}

function filterAdjOptionIds(categories, ids) {
  return [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map((x) => String(x || '').trim())
      .filter((id) => {
        if (!id) return false;
        const opt = findCatalogOption(categories, id);
        return opt && isAdjOption(opt);
      })
  )];
}

function findAdjByExcelLabel(categories, excelLabel) {
  const wanted = String(excelLabel || '').replace(/\s+/g, ' ').trim();
  if (!wanted) return '';
  const hit = flattenCatalogOptions(categories).find((opt) => {
    if (!isAdjOption(opt)) return false;
    return String(opt.name || '').replace(/\s+/g, ' ').trim() === wanted;
  });
  return hit ? String(hit.id || '').trim() : '';
}

function resolveSourceAdjOptionIdsForBase(baseCatalogOptionId, categories) {
  const baseId = String(baseCatalogOptionId || '').trim();
  if (!baseId) return [];

  const cats = Array.isArray(categories) ? categories : [];
  const baseOpt = findCatalogOption(cats, baseId);
  const merged = [];

  const pushUnique = (ids) => {
    filterAdjOptionIds(cats, ids).forEach((id) => {
      if (id && !merged.includes(id)) merged.push(id);
    });
  };

  if (baseOpt) {
    pushUnique(baseOpt.importBaseProductSourceOptionIds);
    pushUnique(
      (Array.isArray(baseOpt.linkedMinorationOptions) ? baseOpt.linkedMinorationOptions : [])
        .map((x) => x?.optionId)
    );
    const excelId = findAdjByExcelLabel(cats, baseOpt.importExcelLabel || baseOpt.details);
    if (excelId) pushUnique([excelId]);
  }

  flattenCatalogOptions(cats).forEach((opt) => {
    if (!isAdjOption(opt)) return;
    if (String(opt.linkedBaseCatalogOptionId || '').trim() === baseId) {
      pushUnique([opt.id]);
    }
  });

  return merged;
}

function isIbpReplacedInSelection(baseOpt, selectedSet, categories) {
  const baseId = String(baseOpt?.id || '').trim();
  if (!baseId) return false;

  for (const selId of selectedSet) {
    const sid = String(selId || '').trim();
    if (!sid || sid === baseId) continue;
    const selOpt = findCatalogOption(categories, sid);
    if (!selOpt || isBaseCatalogOption(selOpt) || isAdjOption(selOpt)) continue;
    if (modelsOverlap(baseOpt, selOpt)) return true;
  }
  return false;
}

function buildBillableAdjIdSet(selectedSet, categories) {
  const billable = new Set();
  flattenCatalogOptions(categories).forEach((opt) => {
    if (!isBaseCatalogOption(opt)) return;
    const baseId = String(opt.id || '').trim();
    if (!baseId || !isIbpReplacedInSelection(opt, selectedSet, categories)) return;
    resolveSourceAdjOptionIdsForBase(baseId, categories).forEach((adjId) => {
      if (selectedSet.has(adjId)) billable.add(adjId);
    });
  });
  return billable;
}

function adjBillablePrice(option) {
  const opt = option && typeof option === 'object' ? option : {};
  const raw = catalogUgapPrice(opt);
  if (isAdjOption(opt) && UgapDataService.resolveEffectiveImportLineKind(opt) === 'minoration') {
    return -Math.abs(raw);
  }
  return raw;
}

function getOptionBillablePrice(option, context = {}) {
  const opt = option && typeof option === 'object' ? option : {};
  const selectedSet = context.selectedSet instanceof Set ? context.selectedSet : new Set();
  const categories = Array.isArray(context.categories) ? context.categories : [];
  const billableAdjIds = context.billableAdjIds instanceof Set
    ? context.billableAdjIds
    : buildBillableAdjIdSet(selectedSet, categories);
  const forcedBillableIds = context.forcedBillableIds instanceof Set ? context.forcedBillableIds : null;

  if (isBaseCatalogOption(opt)) return 0;
  if (UgapDataService.normalizeInclusionKind(opt) === 'inclus') return 0;

  const optionId = String(opt.id || '').trim();
  if (isAdjOption(opt)) {
    if (forcedBillableIds && forcedBillableIds.has(optionId)) {
      return adjBillablePrice(opt);
    }
    return billableAdjIds.has(optionId) ? adjBillablePrice(opt) : 0;
  }

  if (forcedBillableIds && optionId && !forcedBillableIds.has(optionId)) {
    return 0;
  }

  return catalogUgapPrice(opt);
}

function normalizeIdList(values) {
  return (Array.isArray(values) ? values : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
}

function buildForcedBillableIdSet(billableOptionIds) {
  const ids = normalizeIdList(billableOptionIds);
  return ids.length ? new Set(ids) : null;
}

module.exports = {
  catalogUgapPrice,
  resolveModelUgapPrice,
  fivePercentOptionPrice,
  getOptionBillablePrice,
  buildBillableAdjIdSet,
  buildForcedBillableIdSet,
  isBaseCatalogOption,
  isAdjOption,
  normalizeIdList
};
