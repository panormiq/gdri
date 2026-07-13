/**
 * FICHIER : modules/ugap/backend/services/devis/computeDevisPricing.js
 * RÔLE : Calcul pricing devis (modèle + options + règles dépendances).
 *
 * ENTRÉES : données UGAP, modelId, selectedOptions, fivePercentOptions, billableOptionIds, use5Percent
 * SORTIES : { model, selectedOptions, subtotal, budget5Percent, budget5Consumed, budget5Restant, total, montantTva, totalTtc, tauxTva, violations }
 *
 * DÉPEND DE : devisBillablePrice
 * NE PAS : rendu PDF
 *
 * APPELÉ PAR : ugapController, UgapDevisRenderService
 */

const {
  catalogUgapPrice,
  resolveModelUgapPrice,
  fivePercentOptionPrice,
  getOptionBillablePrice,
  buildBillableAdjIdSet,
  buildForcedBillableIdSet,
  normalizeIdList
} = require('./devisBillablePrice');
const { resolveDevisOptionCategory, resolveDevisModelCategory } = require('./resolveDevisCatalogCategory');

function isFivePercentCatalogOption(option) {
  const kind = String(option?.inclusionKind || '').trim().toLowerCase();
  return kind === 'devis_5pct';
}

function isFivePercentCustomOptionCounted(custom) {
  const opt = custom && typeof custom === 'object' ? custom : {};
  const hasGroup = String(opt.familyLabel || '').trim() && String(opt.groupId || '').trim();
  if (!hasGroup) return true;
  return opt.selected === true;
}

function buildCustomOptionLine(custom, categoryName) {
  const opt = custom && typeof custom === 'object' ? custom : {};
  const price = catalogUgapPrice(opt);
  return {
    id: String(opt.id || '').trim(),
    refUgap: String(opt.refUgap || '').trim(),
    name: String(opt.name || opt.libelle || 'Option 5 %').trim(),
    importExcelLabel: String(opt.importExcelLabel || opt.details || opt.name || '').trim(),
    priceClient: price,
    priceUgap: price,
    category: String(categoryName || opt.categoryId || opt.familyLabel || '').trim(),
    inclusionKind: 'devis_5pct'
  };
}

function findCatalogOption(categories, optionId) {
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

function computeDevisPricing(data, {
  modelId,
  selectedOptions,
  billableOptionIds,
  fivePercentOptions = [],
  fivePercentCustomOptions = [],
  use5Percent = true,
  tauxTva = 20,
  devisOptionCategories = null,
  devisModelCategory = ''
} = {}) {
  if (!data) {
    return { ok: false, status: 404, message: 'Aucune donnée configurée' };
  }

  const model = (data.models || []).find((m) => m.id === modelId);
  if (!model) {
    return { ok: false, status: 404, message: 'Modèle non trouvé' };
  }

  const requestedOptionIds = normalizeIdList(selectedOptions);
  const explicitBillableIds = normalizeIdList(billableOptionIds);
  const fivePercentIdSet = new Set(normalizeIdList(fivePercentOptions));
  const customFivePercentById = new Map();
  (Array.isArray(fivePercentCustomOptions) ? fivePercentCustomOptions : []).forEach((custom) => {
    const id = String(custom?.id || '').trim();
    if (id) customFivePercentById.set(id, custom);
    if (id) fivePercentIdSet.add(id);
  });

  const selectedSet = new Set(requestedOptionIds);
  explicitBillableIds.forEach((id) => selectedSet.add(id));
  const dependencyRules = Array.isArray(data?.dependencyRules) ? data.dependencyRules : [];

  let changed = true;
  while (changed) {
    changed = false;
    dependencyRules.forEach((rule) => {
      const triggerOptionId = String(rule?.triggerOptionId || '').trim();
      if (!triggerOptionId || !selectedSet.has(triggerOptionId)) return;
      const autoSelectIds = Array.isArray(rule?.autoSelectOptionIds) ? rule.autoSelectOptionIds : [];
      autoSelectIds.forEach((id) => {
        const normalizedId = String(id || '').trim();
        if (!normalizedId || selectedSet.has(normalizedId)) return;
        selectedSet.add(normalizedId);
        changed = true;
      });
    });
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const billableAdjIds = buildBillableAdjIdSet(selectedSet, categories);
  const forcedBillableIds = buildForcedBillableIdSet(explicitBillableIds);
  const priceContext = {
    selectedSet,
    categories,
    billableAdjIds,
    forcedBillableIds
  };

  let subtotal = resolveModelUgapPrice(model);
  let budget5Consumed = 0;
  const selectedOptionsData = [];
  const resolvedCatalogIds = new Set();
  const selectedOptionIds = Array.from(selectedSet);
  const pricingOptionIds = forcedBillableIds
    ? [
      ...explicitBillableIds.filter((id) => !fivePercentIdSet.has(id)),
      ...Array.from(fivePercentIdSet)
    ]
    : selectedOptionIds;

  pricingOptionIds.forEach((optionId) => {
    const hit = findCatalogOption(categories, optionId);
    if (!hit) return;

    const { option, category } = hit;
    resolvedCatalogIds.add(optionId);
    const isFivePercent = fivePercentIdSet.has(optionId) || isFivePercentCatalogOption(option);
    const billablePrice = isFivePercent
      ? fivePercentOptionPrice(option)
      : getOptionBillablePrice(option, priceContext);
    const categoryLabels = resolveDevisOptionCategory(
      data,
      option,
      devisOptionCategories,
      category
    );
    const enriched = {
      ...option,
      category: categoryLabels.categorie || category,
      devisSousNoeud: categoryLabels.sousNoeud || '',
      billablePrice
    };
    selectedOptionsData.push(enriched);

    if (isFivePercent) budget5Consumed += billablePrice;
    else subtotal += billablePrice;
  });

  customFivePercentById.forEach((custom, customId) => {
    if (!fivePercentIdSet.has(customId)) return;
    if (resolvedCatalogIds.has(customId)) return;
    if (!isFivePercentCustomOptionCounted(custom)) return;
    const line = buildCustomOptionLine(custom, custom.categoryId || custom.familyLabel);
    const categoryLabels = resolveDevisOptionCategory(
      data,
      { ...custom, id: customId },
      devisOptionCategories,
      line.category
    );
    line.category = categoryLabels.categorie || line.category;
    line.devisSousNoeud = categoryLabels.sousNoeud || '';
    line.billablePrice = fivePercentOptionPrice(custom);
    selectedOptionsData.push(line);
    budget5Consumed += line.billablePrice;
  });

  const violations = [];
  categories.forEach((category) => {
    const rules = category?.selectionRules || {};
    const categoryOptionIds = new Set(
      (category?.options || []).map((opt) => String(opt?.id || '').trim()).filter(Boolean)
    );
    const selectedInCategory = selectedOptionIds.filter((id) => categoryOptionIds.has(id));
    if (rules?.unique && selectedInCategory.length > 1) {
      violations.push(
        `Catégorie "${category?.name || category?.id}": choix unique violé (${selectedInCategory.length} options).`
      );
    }
    if (rules?.required && selectedInCategory.length === 0) {
      violations.push(
        `Catégorie "${category?.name || category?.id}": au moins une option est obligatoire.`
      );
    }
  });

  if (violations.length) {
    return {
      ok: false,
      status: 400,
      message: 'Validation des règles catégorie échouée',
      violations
    };
  }

  const budget5Percent = use5Percent ? subtotal * 0.05 : 0;
  const budget5Restant = Math.max(0, budget5Percent - budget5Consumed);
  const totalHt = subtotal + budget5Consumed;
  const rate = Number.isFinite(Number(tauxTva)) && Number(tauxTva) >= 0 ? Number(tauxTva) : 20;
  const montantTva = totalHt * (rate / 100);
  const totalTtc = totalHt + montantTva;

  const modelCategory = resolveDevisModelCategory(data, devisModelCategory);

  return {
    ok: true,
    data: {
      model,
      modelCategory,
      requestedOptionIds,
      autoSelectedOptionIds: selectedOptionIds.filter((id) => !requestedOptionIds.includes(id)),
      selectedOptions: selectedOptionsData,
      subtotal,
      budget5Percent,
      budget5Consumed,
      budget5Restant,
      total: totalHt,
      tauxTva: rate,
      montantTva,
      totalTtc
    }
  };
}

module.exports = { computeDevisPricing };
