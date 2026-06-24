/**
 * Service de gestion des données UGAP (MongoDB)
 * Fichier : modules/ugap/backend/services/UgapDataService.js
 */
const fs = require('fs');
const { ObjectId } = require('mongodb');
const UgapImportAssignmentService = require('./UgapImportAssignmentService');
const UgapExcelService = require('./UgapExcelService');
const resolveImportLineKind = require('./excel-detect/resolveImportLineKind');
const buildBaseOptions = require('./excel-detect/buildBaseOptions');
const isMotorBaseNonSupplyMinoration = require('./excel-detect/rules/isMotorBaseNonSupplyMinoration');
const parseReplacementFromLabel = require('./excel-detect/rules/parseReplacementFromLabel');

class UgapDataService {
  /** Familles validées : `families: []` est une valeur explicite (pas un fallback validatedFamilies). */
  static resolveUiStateFamilies(source) {
    const src = source && typeof source === 'object' ? source : {};
    if (Object.prototype.hasOwnProperty.call(src, 'families')) {
      return Array.isArray(src.families) ? src.families : [];
    }
    if (Array.isArray(src.validatedFamilies)) {
      return src.validatedFamilies;
    }
    return [];
  }

  static normalizeCatalogObject(raw, index) {
    const o = raw && typeof raw === 'object' ? raw : {};
    const id = String(o.id || `obj_${(Number(index) || 0) + 1}`).trim();
    const label = String(o.label || id).trim();
    const typeRaw = String(o.type || 'choice_set').trim().toLowerCase();
    const allowedTypes = new Set(['choice_set', 'addon', 'model', 'garantie', 'static']);
    const type = allowedTypes.has(typeRaw) ? typeRaw : 'choice_set';
    const decisionMode = String(o.decisionMode || '').trim().toLowerCase() === 'multi_choice'
      ? 'multi_choice'
      : 'single_choice';
    const tags = Array.isArray(o.tags)
      ? o.tags.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    return {
      id,
      label,
      type,
      categoryId: String(o.categoryId || '').trim(),
      subCategoryId: String(o.subCategoryId || '').trim(),
      decisionMode,
      tags,
      keywords: String(o.keywords || '').trim()
    };
  }

  static normalizeCatalogSubCategory(raw, index) {
    const sc = raw && typeof raw === 'object' ? raw : {};
    const id = String(sc.id || `sub_${(Number(index) || 0) + 1}`).trim();
    const name = String(sc.name || 'Sous-catégorie').trim();
    if (!id) return null;
    return { id, name: name || 'Sous-catégorie' };
  }

  static normalizeCatalogCategory(raw, index) {
    const c = raw && typeof raw === 'object' ? raw : {};
    const id = String(c.id || `cat_${(Number(index) || 0) + 1}`).trim();
    const name = String(c.name || 'Catégorie').trim();
    if (!id) return null;
    const subCategories = (Array.isArray(c.subCategories) ? c.subCategories : [])
      .map((sc, i) => UgapDataService.normalizeCatalogSubCategory(sc, i))
      .filter(Boolean);
    return { id, name: name || 'Catégorie', subCategories };
  }

  static normalizeCatalogTag(raw) {
    const t = raw && typeof raw === 'object' ? raw : {};
    const id = String(t.id || t.value || '').trim().toLowerCase();
    const label = String(t.label || t.title || id).trim();
    if (!id) return null;
    return { id, label: label || id };
  }

  static defaultCatalogTagRegistry() {
    return [
      { id: 'design', label: 'Design' },
      { id: 'garantie', label: 'Garantie' },
      { id: 'equipement', label: 'Équipement' },
      { id: 'motorisation', label: 'Motorisation' },
      { id: 'securite', label: 'Sécurité' },
      { id: 'divers', label: 'Divers' }
    ];
  }

  static normalizeCatalogNode(raw, index) {
    const n = raw && typeof raw === 'object' ? raw : {};
    const id = String(n.id || `node_${(Number(index) || 0) + 1}`).trim();
    const decisionMode = String(n.decisionMode || '').trim().toLowerCase() === 'multi_choice'
      ? 'multi_choice'
      : 'single_choice';
    const tags = Array.isArray(n.tags)
      ? n.tags.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    return {
      id,
      parentId: String(n.parentId || '').trim(),
      label: String(n.label || n.name || 'Nœud').trim(),
      decisionMode,
      keywords: String(n.keywords || '').trim(),
      tags,
      sortOrder: Number.isFinite(Number(n.sortOrder)) ? Number(n.sortOrder) : (Number(index) || 0) * 10,
    };
  }

  /** Ancien modèle categories + objects → nodes[] (une seule fois au chargement). */
  static migrateLegacyCatalogToNodes(source) {
    const src = source && typeof source === 'object' ? source : {};
    if (Array.isArray(src.nodes) && src.nodes.length) {
      return src.nodes.map((n, i) => UgapDataService.normalizeCatalogNode(n, i));
    }
    const nodes = [];
    let order = 0;
    const nextOrder = () => {
      order += 10;
      return order;
    };
    (Array.isArray(src.categories) ? src.categories : []).forEach((cat) => {
      const c = cat && typeof cat === 'object' ? cat : {};
      const catId = String(c.id || `cat_${nextOrder()}`).trim();
      nodes.push({
        id: catId,
        parentId: '',
        label: String(c.name || 'Catégorie').trim(),
        decisionMode: 'single_choice',
        keywords: '',
        tags: [],
        sortOrder: nextOrder(),
      });
      (Array.isArray(c.subCategories) ? c.subCategories : []).forEach((sc) => {
        const s = sc && typeof sc === 'object' ? sc : {};
        const subId = String(s.id || `sub_${nextOrder()}`).trim();
        nodes.push({
          id: subId,
          parentId: catId,
          label: String(s.name || 'Sous-catégorie').trim(),
          decisionMode: 'single_choice',
          keywords: '',
          tags: [],
          sortOrder: nextOrder(),
        });
      });
    });
    (Array.isArray(src.objects) ? src.objects : []).forEach((o) => {
      const obj = o && typeof o === 'object' ? o : {};
      const objId = String(obj.id || `node_${nextOrder()}`).trim();
      const parentId = String(obj.subCategoryId || obj.categoryId || '').trim();
      const decisionMode = String(obj.decisionMode || '').trim().toLowerCase() === 'multi_choice'
        ? 'multi_choice'
        : 'single_choice';
      const tags = Array.isArray(obj.tags)
        ? obj.tags.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      nodes.push({
        id: objId,
        parentId,
        label: String(obj.label || 'Choix').trim(),
        decisionMode,
        keywords: String(obj.keywords || '').trim(),
        tags,
        sortOrder: nextOrder(),
      });
    });
    const byId = new Map();
    nodes.forEach((node) => {
      if (!byId.has(node.id)) byId.set(node.id, node);
    });
    return Array.from(byId.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'fr')
    );
  }

  static normalizeCatalog(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    let nodes = (Array.isArray(source.nodes) ? source.nodes : [])
      .map((n, i) => UgapDataService.normalizeCatalogNode(n, i))
      .filter((n) => n && n.id);
    if (!nodes.length) {
      nodes = UgapDataService.migrateLegacyCatalogToNodes(source);
    }
    const tagRegistryRaw = Array.isArray(source.tagRegistry) ? source.tagRegistry : [];
    const tagRegistry = tagRegistryRaw.length
      ? tagRegistryRaw.map((t) => UgapDataService.normalizeCatalogTag(t)).filter(Boolean)
      : UgapDataService.defaultCatalogTagRegistry();
    return { nodes, tagRegistry };
  }

  static normalizeUiState(uiState) {
    const source = uiState && typeof uiState === 'object' ? uiState : {};
    const families = this.resolveUiStateFamilies(source);
    const businessViews = Array.isArray(source.businessViews)
      ? source.businessViews
      : (Array.isArray(source.viewHeuristicRules) ? source.viewHeuristicRules : []);
    const baseModelTemplateFamilies = Array.isArray(source.baseModelTemplateFamilies)
      ? source.baseModelTemplateFamilies.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const normalizePreset = (preset) => {
      const p = preset && typeof preset === 'object' ? preset : {};
      return {
        id: String(p.id || '').trim(),
        label: String(p.label || '').trim(),
        businessViewIds: Array.isArray(p.businessViewIds)
          ? p.businessViewIds.map((x) => String(x)).filter(Boolean)
          : []
      };
    };
    const rawViewPresets = Array.isArray(source.viewPresets) ? source.viewPresets.map(normalizePreset).filter((p) => p.id) : [];
    const defaultPreset = {
      id: 'basic',
      label: 'Basic',
      businessViewIds: businessViews.map((v) => String(v?.id || '').trim()).filter(Boolean)
    };
    const viewPresets = rawViewPresets.length > 0
      ? rawViewPresets
      : [defaultPreset];
    const activeViewPresetIdRaw = String(source.activeViewPresetId || '').trim();
    const activeViewPresetId = viewPresets.some((p) => p.id === activeViewPresetIdRaw)
      ? activeViewPresetIdRaw
      : viewPresets[0]?.id || 'basic';
    const familyDecisionGroupTemplates = Array.isArray(source.familyDecisionGroupTemplates)
      ? source.familyDecisionGroupTemplates
          .map((tpl) => {
            const t = tpl && typeof tpl === 'object' ? tpl : {};
            return {
              id: String(t.id || '').trim(),
              title: String(t.title || '').trim(),
              description: String(t.description || '').trim(),
              suggestedFamilyLabel: String(t.suggestedFamilyLabel || '').trim(),
              suggestedObjectName: String(t.suggestedObjectName || '').trim(),
              decisionGroups: Array.isArray(t.decisionGroups) ? t.decisionGroups : []
            };
          })
          .filter((t) => t.id)
      : [];
    const familyGroupTypes = Array.isArray(source.familyGroupTypes)
      ? source.familyGroupTypes
          .map((row) => {
            const t = row && typeof row === 'object' ? row : {};
            const title = String(t.title || '').trim();
            const id = String(t.id || '').trim();
            if (!id || !title) return null;
            const defaultDecisionMode = String(t.defaultDecisionMode || '').trim();
            const defaultPriceMode = String(t.defaultPriceMode || '').trim();
            return {
              id,
              title,
              ...(defaultDecisionMode ? { defaultDecisionMode } : {}),
              ...(defaultPriceMode ? { defaultPriceMode } : {})
            };
          })
          .filter(Boolean)
      : [];
    const optionFamilyStatuses = source.optionFamilyStatuses && typeof source.optionFamilyStatuses === 'object'
      ? Object.fromEntries(
        Object.entries(source.optionFamilyStatuses)
          .map(([k, v]) => {
            const id = String(k || '').trim();
            const status = String(v || '').trim();
            if (!id) return null;
            if (status === 'assigne' || status === 'non_assigne') return [id, status];
            return null;
          })
          .filter(Boolean)
      )
      : {};
    const familleHeuristicRules = Array.isArray(source.familleHeuristicRules)
      ? source.familleHeuristicRules
          .map((r) => {
            const rule = r && typeof r === 'object' ? r : {};
            return {
              familyLabel: String(rule.familyLabel || '').trim(),
              keywords: String(rule.keywords || '').trim(),
              scope: String(rule.scope || 'all').trim() || 'all'
            };
          })
          .filter((r) => r.familyLabel && r.keywords)
      : [];
    const boatTemplates = UgapDataService.normalizeBoatTemplates(source.boatTemplates);
    const modelBaseSlotPicks = UgapDataService.normalizeModelBaseSlotPicks(source.modelBaseSlotPicks);
    const catalog = UgapDataService.normalizeCatalog(source.catalog);
    return {
      families,
      catalog,
      businessViews,
      baseModelTemplateFamilies,
      viewPresets,
      activeViewPresetId,
      familyDecisionGroupTemplates,
      familyGroupTypes,
      optionFamilyStatuses,
      familleHeuristicRules,
      boatTemplates,
      modelBaseSlotPicks,
      updatedAt: source.updatedAt || null
    };
  }

  static normalizeModelBaseSlotPickValue(optionId) {
    if (Array.isArray(optionId)) {
      const ids = optionId.map((x) => String(x || '').trim()).filter(Boolean);
      if (!ids.length) return null;
      return ids.length === 1 ? ids[0] : ids;
    }
    const one = String(optionId || '').trim();
    return one || null;
  }

  static normalizeModelBaseSlotPicks(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    Object.entries(source).forEach(([modelId, slots]) => {
      const mid = String(modelId || '').trim();
      if (!mid || !slots || typeof slots !== 'object' || Array.isArray(slots)) return;
      const slotMap = {};
      Object.entries(slots).forEach(([key, optionId]) => {
        const k = String(key || '').trim();
        const val = UgapDataService.normalizeModelBaseSlotPickValue(optionId);
        if (k && val != null) slotMap[k] = val;
      });
      if (Object.keys(slotMap).length) out[mid] = slotMap;
    });
    return out;
  }

  static normalizeFamilyDecisionGroup(grp, index) {
    const g = grp && typeof grp === 'object' ? grp : {};
    const id = String(g.id || `group_${(Number(index) || 0) + 1}`).trim();
    const label = String(g.label || id || '').trim();
    const rawType = String(g.type || '').trim().toLowerCase();
    let type = 'option';
    if (rawType === 'model') type = 'model';
    else if (rawType === 'static') type = 'static';
    else if (rawType === 'garantie' || rawType === 'garanties') type = 'garantie';
    else if (rawType === 'personnalise' || rawType === 'personnalisé' || rawType === 'custom') type = 'personnalise';
    const decisionMode = String(g.decisionMode || '').trim().toLowerCase() === 'multi_choice'
      ? 'multi_choice'
      : 'single_choice';
    const legacyPrice = String(g.priceMode ?? g.pricingMode ?? '').trim().toLowerCase();
    let priceMode = 'option';
    if (legacyPrice === 'minoration' || legacyPrice === 'majoration') priceMode = legacyPrice;
    else if (legacyPrice === 'static') priceMode = 'static';
    else if (legacyPrice === 'none' || legacyPrice === 'aucun') priceMode = 'none';
    else if (type === 'static') priceMode = 'static';
    const keywords = String(g.keywords || '').trim();
    const optionIds = Array.isArray(g.optionIds)
      ? g.optionIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    if (!id || !label) return null;
    return {
      id,
      label,
      type,
      decisionMode,
      priceMode,
      pricingMode: priceMode,
      keywords,
      optionIds
    };
  }

  static normalizeFamilyDecisionGroups(rawGroups) {
    return (Array.isArray(rawGroups) ? rawGroups : [])
      .map((g, i) => UgapDataService.normalizeFamilyDecisionGroup(g, i))
      .filter(Boolean);
  }

  static normalizeBoatTemplateFamilyRow(row) {
    const f = row && typeof row === 'object' ? row : {};
    const decisionGroups = UgapDataService.normalizeFamilyDecisionGroups(f.decisionGroups);
    const familyLabel = String(f.familyLabel || '').trim();
    if (!familyLabel) return null;
    return {
      familyLabel,
      objectName: String(f.objectName || '').trim(),
      decisionGroups
    };
  }

  static normalizeBoatTemplateCategoryEntry(entry) {
    const c = entry && typeof entry === 'object' ? entry : {};
    const name = String(c.name || c.objectName || '').trim();
    const objectName = String(c.objectName || name || '').trim();
    const families = (Array.isArray(c.families) ? c.families : [])
      .map((f) => UgapDataService.normalizeBoatTemplateFamilyRow(f))
      .filter(Boolean);
    if (!name && !families.length) return null;
    return {
      id: String(c.id || '').trim(),
      name: name || objectName || 'Catégorie',
      objectName: objectName || name,
      families
    };
  }

  static normalizeBoatTemplateDecisionGroupRef(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const familyLabel = String(r.familyLabel || '').trim();
    const groupId = String(r.groupId || '').trim();
    if (!familyLabel || !groupId) return null;
    const sourceIndex = Number(r.sourceIndex);
    const out = { familyLabel, groupId };
    if (Number.isInteger(sourceIndex)) out.sourceIndex = sourceIndex;
    return out;
  }

  static normalizeBoatTemplateTreeNode(raw) {
    const n = raw && typeof raw === 'object' ? raw : {};
    const id = String(n.id || '').trim()
      || `tplcat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const label = String(n.label || '').trim() || 'Catégorie';
    const categoryRefId = String(n.categoryRefId || '').trim();
    const subCategoryRefId = String(n.subCategoryRefId || '').trim();
    const decisionGroupRefs = (Array.isArray(n.decisionGroupRefs) ? n.decisionGroupRefs : [])
      .map((ref) => UgapDataService.normalizeBoatTemplateDecisionGroupRef(ref))
      .filter(Boolean);
    let children = [];
    if (!subCategoryRefId) {
      children = (Array.isArray(n.children) ? n.children : [])
        .map((child) => UgapDataService.normalizeBoatTemplateTreeNode(child))
        .filter(Boolean);
    }
    const node = { id, label, decisionGroupRefs, children };
    if (categoryRefId) node.categoryRefId = categoryRefId;
    if (subCategoryRefId) node.subCategoryRefId = subCategoryRefId;
    return node;
  }

  static normalizeBoatTemplateCategoryTree(raw) {
    return (Array.isArray(raw) ? raw : [])
      .map((node) => UgapDataService.normalizeBoatTemplateTreeNode(node))
      .filter(Boolean);
  }

  static flattenBoatTemplateCategoryRefIds(tree) {
    const ids = [];
    const walk = (nodes) => {
      (Array.isArray(nodes) ? nodes : []).forEach((node) => {
        const ref = String(node?.categoryRefId || '').trim();
        if (ref) ids.push(ref);
        walk(node.children);
      });
    };
    walk(tree);
    return [...new Set(ids)];
  }

  static migrateBoatTemplateCategoryIdsToTree(snap) {
    let tree = UgapDataService.normalizeBoatTemplateCategoryTree(snap.categoryTree);
    if (tree.length) return tree;
    let categoryIds = Array.isArray(snap.categoryIds)
      ? snap.categoryIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    if (!categoryIds.length && Array.isArray(snap.categories)) {
      categoryIds = snap.categories
        .map((cat) => String(cat?.id || '').trim())
        .filter(Boolean);
    }
    return categoryIds.map((catId) => ({
      id: `tplcat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: catId,
      categoryRefId: catId,
      decisionGroupRefs: [],
      children: []
    }));
  }

  static normalizeBoatTemplateSnapshot(snapshot) {
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    let categoryTree = UgapDataService.migrateBoatTemplateCategoryIdsToTree(snap);
    categoryTree = UgapDataService.normalizeBoatTemplateCategoryTree(categoryTree);

    let categoryIds = Array.isArray(snap.categoryIds)
      ? snap.categoryIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const fromTree = UgapDataService.flattenBoatTemplateCategoryRefIds(categoryTree);
    if (fromTree.length) categoryIds = fromTree;
    else if (!categoryIds.length) {
      categoryIds = categoryTree
        .map((n) => String(n.categoryRefId || '').trim())
        .filter(Boolean);
    }

    const baseOptionIds = Array.isArray(snap.baseOptionIds)
      ? snap.baseOptionIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];

    let catalogNodeOrder = {};
    if (snap.catalogNodeOrder && typeof snap.catalogNodeOrder === 'object' && !Array.isArray(snap.catalogNodeOrder)) {
      Object.keys(snap.catalogNodeOrder).forEach((key) => {
        const pid = String(key === 'root' ? '' : key).trim();
        const ids = (Array.isArray(snap.catalogNodeOrder[key]) ? snap.catalogNodeOrder[key] : [])
          .map((x) => String(x || '').trim())
          .filter(Boolean);
        if (ids.length) catalogNodeOrder[pid] = ids;
      });
    }

    return { categoryTree, categoryIds, baseOptionIds, catalogNodeOrder };
  }

  static normalizeBoatTemplate(tpl) {
    const t = tpl && typeof tpl === 'object' ? tpl : {};
    const id = String(t.id || '').trim();
    const label = String(t.label || '').trim();
    if (!id || !label) return null;
    return {
      id,
      label,
      snapshot: UgapDataService.normalizeBoatTemplateSnapshot(t.snapshot)
    };
  }

  static normalizeBoatTemplates(list) {
    return (Array.isArray(list) ? list : [])
      .map((t) => UgapDataService.normalizeBoatTemplate(t))
      .filter(Boolean);
  }

  static normalizeSelectionRules(rules) {
    const source = rules && typeof rules === 'object' ? rules : {};
    return {
      unique: !!source.unique,
      required: !!source.required
    };
  }

  /** Anciennes clés composant (ex. principal::model) → id groupe catalogue. */
  static stripLegacyGroupSelectionKey(key) {
    const raw = String(key || '').trim();
    if (!raw.includes('::')) return raw;
    const idx = raw.indexOf('::');
    const prefix = raw.slice(0, idx).toLowerCase();
    if (prefix === 'principal' || prefix === 'composant' || prefix === 'default' || prefix === 'main') {
      return raw.slice(idx + 2).trim();
    }
    return raw;
  }

    static normalizeCategoryFamilyEntry(entry) {
    const e = entry && typeof entry === 'object' ? entry : {};
    const rawSourceIndex = e.sourceIndex;
    const hasExplicitSourceIndex = rawSourceIndex !== null
      && rawSourceIndex !== undefined
      && String(rawSourceIndex).trim() !== '';
    const sourceIndex = hasExplicitSourceIndex ? Number(rawSourceIndex) : NaN;
    const familyLabel = String(e.familyLabel || '').trim();
    const selectedGroupIds = Array.isArray(e.selectedGroupIds)
      ? e.selectedGroupIds.map((x) => UgapDataService.stripLegacyGroupSelectionKey(x)).filter(Boolean)
      : [];
    const groupOrder = Array.isArray(e.groupOrder)
      ? e.groupOrder.map((x) => UgapDataService.stripLegacyGroupSelectionKey(x)).filter(Boolean)
      : [];
    if (!familyLabel) return null;
    const row = {
      familyLabel,
      objectName: String(e.objectName || '').trim(),
      selectedGroupIds
    };
    if (Number.isInteger(sourceIndex)) row.sourceIndex = sourceIndex;
    if (groupOrder.length) row.groupOrder = groupOrder;
    return row;
  }

  static normalizeCategoryFamilies(list) {
    return (Array.isArray(list) ? list : [])
      .map((entry) => this.normalizeCategoryFamilyEntry(entry))
      .filter(Boolean);
  }

  static normalizeCategory(category) {
    const source = category && typeof category === 'object' ? category : {};
    const families = this.normalizeCategoryFamilies(source.families);
    const familyIdsFromList = families
      .map((f) => (Number.isInteger(f.sourceIndex) ? String(f.sourceIndex) : f.familyLabel))
      .filter(Boolean);
    const legacyFamilyIds = Array.isArray(source.familyIds)
      ? source.familyIds.map((x) => String(x)).filter(Boolean)
      : [];
    const name = String(source.name || '').trim();
    const objectName = String(source.objectName || name || '').trim();
    return {
      ...source,
      id: String(source.id || ''),
      name: name || objectName,
      objectName: objectName || name,
      catalogue: source.catalogue === true,
      selectionRules: this.normalizeSelectionRules(source.selectionRules),
      businessViewIds: Array.isArray(source.businessViewIds) ? source.businessViewIds.map((x) => String(x)).filter(Boolean) : [],
      families,
      familyIds: familyIdsFromList.length ? familyIdsFromList : legacyFamilyIds,
      options: Array.isArray(source.options) ? source.options.map((opt) => this.normalizeOption(opt)) : [],
      subCategories: Array.isArray(source.subCategories) ? source.subCategories : []
    };
  }

  /**
   * Garantit l'unicité globale des options catalogue par id.
   * Si un même id apparaît plusieurs fois (même catégorie ou catégories différentes),
   * on conserve une seule occurrence et on fusionne les champs.
   */
  static dedupeCategoryOptionsById(categories = []) {
    const list = (Array.isArray(categories) ? categories : []).map((c) => this.normalizeCategory(c));
    const seenByOptionId = new Map();

    list.forEach((cat) => {
      const dedupedOptions = [];
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const normalized = this.normalizeOption(opt);
        const oid = String(normalized?.id || '').trim();
        if (!oid) {
          dedupedOptions.push(normalized);
          return;
        }
        const existing = seenByOptionId.get(oid);
        if (!existing) {
          dedupedOptions.push(normalized);
          seenByOptionId.set(oid, normalized);
          return;
        }
        Object.assign(existing, this.normalizeOption({ ...existing, ...normalized }));
      });
      cat.options = dedupedOptions;
    });

    return list;
  }

  /**
   * Tarif moteur catalogue Excel (ligne longue type « Moteur hors-bord essence - Suzuki DF150ATX… »).
   * Ce n'est pas l'option de base du bateau (registre import / IBP).
   */
  static isCatalogMotorTarifOptionName(name) {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (!n || /\ben\s+remplacement\b/i.test(n) || /\blieu\s+et\s+place\b/i.test(n)) return false;
    if (!/\b(moteur|motorisation)\b/i.test(n)) return false;
    if (n.length < 55) return false;
    return (
      /\b(hors-bord|essence|démarrage|direction|hélice|helice|arbre)\b/i.test(n)
      || (/\bDF\d{2,4}/i.test(n) && /\bsuzuki|mercury|yamaha|honda\b/i.test(n))
    );
  }

  /** Retire les flags « option de base » sur les tarifs moteur catalogue (majoration). */
  static clearMotorCatalogTarifBaseFlags(option) {
    const opt = option && typeof option === 'object' ? option : null;
    if (!opt || opt.importGeneratedFromBaseProduct === true) {
      if (opt && opt.importGeneratedFromBaseProduct === true && this.isCatalogMotorTarifOptionName(opt.name)) {
        opt.importGeneratedFromBaseProduct = false;
        opt.baseIncluded = false;
        opt.isBaseOption = false;
        opt.manualBaseOption = false;
        delete opt.importBaseProductId;
        delete opt.importBaseProductSourceOptionIds;
        delete opt.linkedBaseCatalogOptionId;
      }
      return opt;
    }
    if (!this.isCatalogMotorTarifOptionName(opt.name)) return opt;
    // Correction manuelle (paramétrage) : ne pas écraser un marquage base explicite.
    if (opt.manualBaseOption === true || opt.baseIncluded === true) return opt;
    opt.baseIncluded = false;
    opt.isBaseOption = false;
    opt.manualBaseOption = false;
    return opt;
  }

  static clearMotorCatalogTarifBaseFlagsOnOptions(options) {
    (Array.isArray(options) ? options : []).forEach((o) => this.clearMotorCatalogTarifBaseFlags(o));
    return options;
  }

  /** Retire les IBP legacy créées à partir d'une ligne tarif moteur catalogue (Mercury…). */
  static stripCorruptImportBaseProductOptions(categories) {
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      if (!Array.isArray(cat?.options)) return;
      cat.options = cat.options.filter((opt) => {
        if (opt?.importGeneratedFromBaseProduct !== true) return true;
        return !this.isCatalogMotorTarifOptionName(opt?.name);
      });
    });
    return categories;
  }

  static clearMotorCatalogTarifBaseFlagsOnCategories(categories) {
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((o) => this.clearMotorCatalogTarifBaseFlags(o));
      (Array.isArray(cat?.subCategories) ? cat.subCategories : []).forEach((sc) => {
        (Array.isArray(sc?.optionIds) ? sc.optionIds : []).forEach(() => {});
      });
    });
    return categories;
  }

  /**
   * Retire les IBP synthétiques (opt_ibp_*) d'un import précédent
   * qui ne font plus partie du staging courant.
   */
  static stripStalePublishedImportGeneratedOptions(categories, importBaseProducts) {
    const cats = Array.isArray(categories) ? categories : [];
    const products = Array.isArray(importBaseProducts) ? importBaseProducts : [];
    const activeBpIds = new Set(products.map((p) => String(p?.id || '').trim()).filter(Boolean));
    const activeCatIds = new Set(
      products.map((p) => String(p?.catalogOptionId || '').trim()).filter(Boolean)
    );

    cats.forEach((cat) => {
      if (!Array.isArray(cat?.options)) return;
      cat.options = cat.options.filter((opt) => {
        if (opt?.importGeneratedFromBaseProduct !== true) return true;
        const bpId = String(opt?.importBaseProductId || '').trim();
        const oid = String(opt?.id || '').trim();
        if (products.length === 0) return false;
        if (bpId && activeBpIds.has(bpId)) return true;
        if (oid && activeCatIds.has(oid)) return true;
        return false;
      });
    });
    return cats;
  }

  /** Snapshots mino/majo liées (conservés sur l'option de base publiée). */
  static buildLinkedMinorationSnapshots(bp, stagingById) {
    const snapshots = [];
    (Array.isArray(bp?.optionIds) ? bp.optionIds : []).forEach((oid) => {
      const id = String(oid || '').trim();
      if (!id) return;
      const opt = stagingById?.get(id);
      snapshots.push({
        optionId: id,
        name: String(opt?.name || opt?.importOptionLabel || '').trim(),
        refUgap: String(opt?.refUgap || '').trim()
      });
    });
    return snapshots;
  }

  /**
   * Publication : une option de base publiée par entrée importBaseProducts
   * (pas de réutilisation d'une ligne catalogue Excel au même libellé).
   */
  static allocatePublishedBaseProductOptionId(bp, globalOptionById, allIds) {
    const row = bp && typeof bp === 'object' ? bp : {};
    const bpId = String(row.id || '').trim();
    let catalogId = String(row.catalogOptionId || '').trim();
    if (catalogId) {
      const hit = globalOptionById.get(catalogId);
      if (
        hit?.importGeneratedFromBaseProduct === true
        && String(hit?.importBaseProductId || '').trim() === bpId
      ) {
        allIds.add(catalogId);
        return catalogId;
      }
    }
    const keySlug = String(row.key || this.normalizeImportBaseProductKey(row.label))
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .slice(0, 48) || String(row.id || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
    const base = `opt_ibp_${keySlug}`;
    catalogId = base;
    let n = 0;
    while (allIds.has(catalogId)) catalogId = `${base}_${++n}`;
    allIds.add(catalogId);
    row.catalogOptionId = catalogId;
    return catalogId;
  }

  /** Écrit baseProductId / libellé sur les mino/majo publiées liées à une option de base. */
  static applyBaseProductLinksOnPublishedCatalog(categories, importBaseProducts) {
    const cats = Array.isArray(categories) ? categories : [];
    const products = Array.isArray(importBaseProducts) ? importBaseProducts : [];
    const bpBySourceOid = new Map();
    products.forEach((bp) => {
      (bp.optionIds || []).forEach((oid) => {
        const id = String(oid || '').trim();
        if (id) bpBySourceOid.set(id, bp);
      });
    });

    cats.forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        if (opt?.importGeneratedFromBaseProduct === true) return;
        const oid = String(opt?.id || '').trim();
        const bp = bpBySourceOid.get(oid);
        if (!bp) return;
        opt.baseProductId = bp.id;
        const lab = String(bp.label || '').trim();
        if (lab) opt.baseProductLabel = lab;
        else delete opt.baseProductLabel;
        const cid = String(bp.catalogOptionId || '').trim();
        if (cid) opt.linkedBaseCatalogOptionId = cid;
        else delete opt.linkedBaseCatalogOptionId;
      });
    });
    return cats;
  }

  /**
   * Fusion importOptions → catalogue publié, puis matérialisation des importBaseProducts.
   */
  static finalizePublishedCategoriesFromImport(existingCategories, importOptions, importBaseProducts, models = []) {
    const stagingOptions = Array.isArray(importOptions) ? importOptions : [];
    const stagingById = this.buildOptionByIdFromImportOptions(stagingOptions);
    let products = this.prepareImportBaseProductsForPublish(
      importBaseProducts,
      stagingOptions,
      models,
      stagingById
    );
    products = this.ensureMotorImportBaseProductsFromModels(products, models, { dedupeByLabel: false });

    let categories = this.mergePublishedOptionsFromImportStaging(existingCategories, stagingOptions);
    categories = this.ensureStagingOptionsPresentInCategories(categories, stagingOptions);
    categories = this.dissolveLegacyExcelAutoCategories(categories);
    categories = this.stripCorruptImportBaseProductOptions(categories);
    categories = this.stripStalePublishedImportGeneratedOptions(categories, products);

    const materialized = this.materializeImportBaseProductsAsCatalogOptions(
      categories,
      products,
      stagingById,
      models
    );
    categories = this.applyBaseProductLinksOnPublishedCatalog(
      materialized.categories,
      materialized.importBaseProducts
    );
    this.clearMotorCatalogTarifBaseFlagsOnCategories(categories);
    this.applyPublishFlagsFromSavedState(categories);
    return { categories, importBaseProducts: materialized.importBaseProducts || [] };
  }

  /** Lignes staging absentes du catalogue publié (sécurité après fusion). */
  static ensureStagingOptionsPresentInCategories(categories, stagingOptions) {
    const cats = Array.isArray(categories) ? categories : [];
    const optionById = this.buildOptionByIdFromCategories(cats);
    const missing = [];
    (Array.isArray(stagingOptions) ? stagingOptions : []).forEach((raw) => {
      if (raw?.importGeneratedFromBaseProduct === true) return;
      const opt = this.normalizeOption(raw);
      const id = String(opt?.id || '').trim();
      if (!id || optionById.has(id)) return;
      missing.push(opt);
      optionById.set(id, opt);
    });
    if (!missing.length) return cats;
    return this.relocateOptionsToUnclassifiedCategory(cats, missing);
  }

  /**
   * Type effectif pour publication : override staging, flags Excel, puis règles detect-excel.
   */
  static resolveEffectiveImportLineKind(opt) {
    const o = opt && typeof opt === 'object' ? opt : {};
    const manual = String(o.importOptionLineKind || '').trim().toLowerCase();
    if (manual === 'minoration' || manual === 'majoration' || manual === 'option' || manual === 'pr') {
      return manual;
    }
    if (manual === 'catalogue') return 'option';
    if (o.manualMinorationAssignment === true) return 'minoration';
    if (o.manualMajorationAssignment === true) return 'majoration';
    if (o.isSparePart === true) return 'pr';
    if (o.isMinoration === true) return 'minoration';

    const inferred = resolveImportLineKind({
      label: o.name || o.importOptionLabel,
      refUgap: o.refUgap
    });
    return inferred === 'catalogue' ? 'option' : inferred;
  }

  /** Options staging pour publish : liste plate sans IBP synthétiques (matérialisées à part). */
  static getStagingImportOptionsForPublish(doc) {
    return this.getStagingImportOptions(doc)
      .filter((o) => o?.importGeneratedFromBaseProduct !== true);
  }

  /**
   * Tag catalogue « option de base » (persisté sur l'option).
   */
  static computeIsBaseOption(option) {
    const opt = option && typeof option === 'object' ? option : {};
    if (opt.manualBaseOption === true || opt.baseIncluded === true) return true;
    if (this.isCatalogMotorTarifOptionName(opt.name) && opt.importGeneratedFromBaseProduct !== true) {
      return false;
    }
    if (opt.isBaseOption === true) return true;
    if (opt.importGeneratedFromBaseProduct === true) return true;
    if (String(opt.importBaseProductId || '').trim()) return true;
    const ref = String(opt.refUgap || '').trim().toUpperCase();
    if (ref.startsWith('IBP-')) return true;
    return false;
  }

  static applyBaseOptionTag(option) {
    const opt = option && typeof option === 'object' ? option : {};
    opt.isBaseOption = this.computeIsBaseOption(opt);
    return opt;
  }

  static normalizeInclusionKind(option) {
    const raw = String(option?.inclusionKind || '').trim().toLowerCase();
    if (raw === 'inclus' || raw === 'option_devis' || raw === 'devis_5pct') return raw;
    if (this.computeIsBaseOption(option)) return 'inclus';
    return 'option_devis';
  }

  static isPublishedImportBaseCatalogOption(opt) {
    if (!opt || typeof opt !== 'object') return false;
    if (opt.importGeneratedFromBaseProduct === true || opt.importBaseProductId) return true;
    const id = String(opt.id || '').trim();
    if (id.startsWith('opt_ibp_')) return true;
    return String(opt.refUgap || '').trim().toUpperCase().startsWith('IBP-');
  }

  static normalizeOption(option) {
    const source = option && typeof option === 'object' ? option : {};
    const isIbp = this.isPublishedImportBaseCatalogOption(source);
    this.clearMotorCatalogTarifBaseFlags(source);
    const compatibleModels = Array.isArray(source.compatibleModels)
      ? source.compatibleModels.map((x) => String(x)).filter(Boolean)
      : [];
    const hasExplicitDivers = source.isDivers !== undefined && source.isDivers !== null;
    const inclusionKind = this.normalizeInclusionKind(source);
    const normalizedName = String(source.name || '').trim();
    const normalizedDetails = String(source.details || '').trim();
    const tags = Array.isArray(source.tags)
      ? source.tags.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const out = this.applyBaseOptionTag({
      ...source,
      id: String(source.id || ''),
      name: normalizedName,
      refUgap: String(source.refUgap || ''),
      details: normalizedDetails,
      inclusionKind,
      compatibleModels,
      catalogObjectId: String(source.catalogObjectId || '').trim(),
      tags,
      // Persistance explicite "Divers" (fallback historique: pas de croix => divers)
      isDivers: hasExplicitDivers ? !!source.isDivers : compatibleModels.length === 0,
      isSparePart: !!source.isSparePart,
      isMinoration: !!source.isMinoration
    });
    if (isIbp && source.importGeneratedFromBaseProduct !== false) {
      out.importGeneratedFromBaseProduct = true;
      out.baseIncluded = true;
      out.isBaseOption = true;
      out.manualBaseOption = true;
      out.isMinoration = false;
      out.isSparePart = false;
      if (!String(out.importOptionLineKind || '').trim()) out.importOptionLineKind = 'option';
    }
    return out;
  }

  static normalizeBusinessView(view) {
    const source = view && typeof view === 'object' ? view : {};
    return {
      ...source,
      id: String(source.id || ''),
      label: String(source.label || ''),
      categoryIds: Array.isArray(source.categoryIds) ? source.categoryIds.map((x) => String(x)).filter(Boolean) : [],
      familyIds: Array.isArray(source.familyIds) ? source.familyIds.map((x) => String(x)).filter(Boolean) : []
    };
  }

  static normalizeDependencyRules(rules) {
    if (!Array.isArray(rules)) return [];
    return rules
      .map((rule) => {
        const source = rule && typeof rule === 'object' ? rule : {};
        return {
          triggerOptionId: String(source.triggerOptionId || '').trim(),
          autoSelectOptionIds: Array.isArray(source.autoSelectOptionIds)
            ? source.autoSelectOptionIds.map((x) => String(x)).filter(Boolean)
            : [],
          message: source.message != null ? String(source.message) : ''
        };
      })
      .filter((rule) => rule.triggerOptionId && rule.autoSelectOptionIds.length > 0);
  }

  static normalizeSubCategory(subCategory) {
    const source = subCategory && typeof subCategory === 'object' ? subCategory : {};
    const families = UgapDataService.normalizeCategoryFamilies(source.families);
    const parentSubCategoryId = String(source.parentSubCategoryId || '').trim();
    const base = {
      ...source,
      id: String(source.id || ''),
      name: String(source.name || ''),
      description: String(source.description || ''),
      families,
      optionIds: Array.isArray(source.optionIds) ? source.optionIds.map((x) => String(x)).filter(Boolean) : [],
      familyId: String(source.familyId || '').trim()
    };
    if (parentSubCategoryId) base.parentSubCategoryId = parentSubCategoryId;
    else delete base.parentSubCategoryId;
    return base;
  }

  /**
   * Sauvegarde les données extraites dans MongoDB
   * @param {Object} db - Base de données MongoDB
   * @param {Object} data - Données à sauvegarder { models, categories }
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Données sauvegardées
   */
  static async saveData(db, data, entrepriseId) {
    const collection = db.collection('ugap_data');
    const existing = await collection.findOne({ entrepriseId });
    const inputUiState = data?.uiState && typeof data.uiState === 'object' ? data.uiState : null;
    const normalizedInputUiState = this.normalizeUiState(inputUiState || {});
    const existingUiState = this.normalizeUiState(existing?.uiState);
    const resolvedUiState = {
      families: inputUiState && Object.prototype.hasOwnProperty.call(inputUiState, 'families')
        ? normalizedInputUiState.families
        : existingUiState.families,
      businessViews: normalizedInputUiState.businessViews.length
        ? normalizedInputUiState.businessViews
        : existingUiState.businessViews,
      baseModelTemplateFamilies: normalizedInputUiState.baseModelTemplateFamilies.length
        ? normalizedInputUiState.baseModelTemplateFamilies
        : existingUiState.baseModelTemplateFamilies,
      viewPresets: normalizedInputUiState.viewPresets.length
        ? normalizedInputUiState.viewPresets
        : existingUiState.viewPresets,
      activeViewPresetId: normalizedInputUiState.activeViewPresetId || existingUiState.activeViewPresetId || 'basic',
      familyDecisionGroupTemplates: normalizedInputUiState.familyDecisionGroupTemplates.length
        ? normalizedInputUiState.familyDecisionGroupTemplates
        : existingUiState.familyDecisionGroupTemplates,
      familyGroupTypes: normalizedInputUiState.familyGroupTypes.length
        ? normalizedInputUiState.familyGroupTypes
        : existingUiState.familyGroupTypes,
      optionFamilyStatuses: Object.keys(normalizedInputUiState.optionFamilyStatuses || {}).length
        ? normalizedInputUiState.optionFamilyStatuses
        : existingUiState.optionFamilyStatuses,
      modelBaseSlotPicks: Object.keys(normalizedInputUiState.modelBaseSlotPicks || {}).length
        ? normalizedInputUiState.modelBaseSlotPicks
        : existingUiState.modelBaseSlotPicks,
      familleHeuristicRules: normalizedInputUiState.familleHeuristicRules.length
        ? normalizedInputUiState.familleHeuristicRules
        : existingUiState.familleHeuristicRules,
      boatTemplates: normalizedInputUiState.boatTemplates.length
        ? normalizedInputUiState.boatTemplates
        : existingUiState.boatTemplates,
      updatedAt: normalizedInputUiState.updatedAt || existingUiState.updatedAt || null
    };
    
    const document = {
      entrepriseId,
      models: data.models || [],
      categories: this.dedupeCategoryOptionsById(data.categories || []),
      importBaseProducts: Array.isArray(data.importBaseProducts)
        ? this.normalizeImportBaseProductsRows(data.importBaseProducts)
        : (Array.isArray(existing?.importBaseProducts) ? existing.importBaseProducts : []),
      businessViews: Array.isArray(data.businessViews) ? data.businessViews.map((view) => this.normalizeBusinessView(view)) : [],
      dependencyRules: this.normalizeDependencyRules(data.dependencyRules),
      uiState: this.normalizeUiState(resolvedUiState),
      updatedAt: new Date(),
      createdAt: new Date()
    };

    // Mise à jour ou insertion
    if (existing) {
      document.createdAt = existing.createdAt;
      await collection.updateOne(
        { entrepriseId },
        { $set: document }
      );
    } else {
      await collection.insertOne(document);
    }

    return document;
  }

  /**
   * Pousse les modèles validés du staging dans le catalogue publié (ugap_data)
   * sans attendre la publication complète de l'import.
   */
  static async syncValidatedModelsToPublishedCatalog(db, entrepriseId, stagingModels = [], validatedModelIds = []) {
    const ids = new Set(
      (Array.isArray(validatedModelIds) ? validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    );
    if (!ids.size) return;

    const collection = db.collection('ugap_data');
    const existing = await collection.findOne({ entrepriseId });
    const existingModels = Array.isArray(existing?.models) ? existing.models : [];
    const byId = new Map(
      existingModels
        .map((m) => ({ id: String(m?.id || '').trim(), model: m }))
        .filter((row) => row.id)
        .map((row) => [row.id, row.model])
    );

    (Array.isArray(stagingModels) ? stagingModels : []).forEach((m) => {
      const id = String(m?.id || '').trim();
      if (!id || !ids.has(id)) return;
      const prev = byId.get(id) || {};
      byId.set(id, {
        ...prev,
        ...m,
        importValidationStatus: 'validated',
        // Conserver les configurations déjà faites côté catalogue si le staging n'en a pas.
        configurations: Array.isArray(m?.configurations)
          ? m.configurations
          : (Array.isArray(prev?.configurations) ? prev.configurations : [])
      });
    });

    // Mettre à jour uniquement les IDs cochés; ne pas toucher aux autres modèles.
    const nextModels = Array.from(byId.values());
    const now = new Date();
    await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          models: nextModels,
          updatedAt: now
        },
        $setOnInsert: {
          entrepriseId,
          categories: [],
          businessViews: [],
          dependencyRules: [],
          uiState: this.normalizeUiState({}),
          createdAt: now
        }
      },
      { upsert: true }
    );
  }

  /**
   * Synchronise la liste complète des modèles du staging vers le catalogue publié.
   * Utilisé après validation modèles pour garantir que le catalogue n'est jamais vide
   * à cause d'un problème de sous-ensemble d'IDs.
   */
  static async syncAllStagingModelsToPublishedCatalog(db, entrepriseId, stagingModels = [], validatedModelIds = []) {
    const validatedSet = new Set(
      (Array.isArray(validatedModelIds) ? validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    );
    const collection = db.collection('ugap_data');
    const existing = await collection.findOne({ entrepriseId });
    const prev = Array.isArray(existing?.models) ? existing.models : [];
    const prevById = new Map(
      prev
        .map((m) => ({ id: String(m?.id || '').trim(), model: m }))
        .filter((row) => row.id)
        .map((row) => [row.id, row.model])
    );
    const next = (Array.isArray(stagingModels) ? stagingModels : []).map((m) => {
      const id = String(m?.id || '').trim();
      const old = id ? (prevById.get(id) || {}) : {};
      return {
        ...old,
        ...m,
        importValidationStatus: id && validatedSet.has(id) ? 'validated' : 'to_validate',
        configurations: Array.isArray(m?.configurations)
          ? m.configurations
          : (Array.isArray(old?.configurations) ? old.configurations : [])
      };
    });

    const now = new Date();
    await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          models: next,
          updatedAt: now
        },
        $setOnInsert: {
          entrepriseId,
          categories: [],
          businessViews: [],
          dependencyRules: [],
          uiState: this.normalizeUiState({}),
          createdAt: now
        }
      },
      { upsert: true }
    );
  }


  /**
   * Récupère les données sauvegardées
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object|null>} Données sauvegardées ou null
   */
  static async getData(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) return null;

    if (
      document.uiState
      && typeof document.uiState === 'object'
      && Object.prototype.hasOwnProperty.call(document.uiState, 'validatedFamilies')
    ) {
      const migrated = this.normalizeUiState(document.uiState);
      await collection.updateOne(
        { entrepriseId },
        { $set: { uiState: migrated, updatedAt: new Date() } }
      );
      document.uiState = migrated;
    }

    const rawCategories = document.categories || [];
    const hadLegacyExcelCategories = rawCategories.some((c) => this.isLegacyExcelAutoCategory(c));
    const catalogCategories = hadLegacyExcelCategories
      ? this.dissolveLegacyExcelAutoCategories(rawCategories)
      : rawCategories;
    if (hadLegacyExcelCategories) {
      await collection.updateOne(
        { entrepriseId },
        { $set: { categories: catalogCategories, updatedAt: new Date() } }
      );
    }

    const categories = catalogCategories.map((rawCategory) => {
      const category = this.normalizeCategory(rawCategory);
      // S'assurer qu'il y a toujours une sous-catégorie "Non attribuée"
      const subCategories = (category.subCategories || []).map((sc) => this.normalizeSubCategory(sc));
      const allAssignedOptionIds = new Set();
      subCategories.forEach(sc => {
        (sc.optionIds || []).forEach(id => allAssignedOptionIds.add(id));
      });

      const options = category.options || [];
      const unassignedOptions = options.filter(opt => !allAssignedOptionIds.has(opt.id));

      // Vérifier si une sous-catégorie "Non attribuée" existe déjà
      let nonAttribueeSubCat = subCategories.find(sc => 
        sc.name === 'Non attribuées' || sc.name === 'Non attribuée'
      );

      if (unassignedOptions.length > 0) {
        if (nonAttribueeSubCat) {
          // Mettre à jour les optionIds pour inclure toutes les options non assignées
          const existingIds = new Set(nonAttribueeSubCat.optionIds || []);
          unassignedOptions.forEach(opt => {
            if (!existingIds.has(opt.id)) {
              existingIds.add(opt.id);
            }
          });
          nonAttribueeSubCat.optionIds = Array.from(existingIds);
        } else {
          // Créer une nouvelle sous-catégorie "Non attribuées"
          nonAttribueeSubCat = {
            id: `subcat_${Date.now()}_non_attribuee`,
            name: 'Non attribuées',
            description: `Options non classées dans les autres sous-catégories (${unassignedOptions.length} option(s))`,
            optionIds: unassignedOptions.map(opt => opt.id)
          };
          subCategories.push(nonAttribueeSubCat);
        }
      } else if (nonAttribueeSubCat && (nonAttribueeSubCat.optionIds || []).length === 0) {
        // Supprimer la sous-catégorie "Non attribuées" si elle est vide
        const index = subCategories.indexOf(nonAttribueeSubCat);
        if (index > -1) {
          subCategories.splice(index, 1);
        }
      }

      return {
        ...category,
        subCategories
      };
    });

    return {
      models: document.models || [],
      categories,
      businessViews: Array.isArray(document.businessViews) ? document.businessViews.map((view) => this.normalizeBusinessView(view)) : [],
      dependencyRules: this.normalizeDependencyRules(document.dependencyRules),
      uiState: this.normalizeUiState(document.uiState)
    };
  }

  static async getUiState(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne(
      { entrepriseId },
      { projection: { uiState: 1 } }
    );
    return this.normalizeUiState(document?.uiState);
  }

  static applyUiStatePatch(current, updates) {
    const base = this.normalizeUiState(current);
    const patch = updates && typeof updates === 'object' ? updates : {};
    const next = { ...base, updatedAt: new Date() };
    const assignIfPresent = (key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        next[key] = patch[key];
      }
    };
    const assignArrayIfNonEmpty = (key) => {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
      const value = patch[key];
      if (!Array.isArray(value) || value.length === 0) return;
      next[key] = value;
    };
    const assignObjectIfNonEmpty = (key) => {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
      const value = patch[key];
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      if (!Object.keys(value).length) return;
      next[key] = value;
    };
    // families : accepter [] pour persister une suppression (mode import n'appelle pas PUT /ui-state).
    if (Object.prototype.hasOwnProperty.call(patch, 'families')) {
      next.families = Array.isArray(patch.families) ? patch.families : [];
      delete next.validatedFamilies;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'catalog')) {
      next.catalog = this.normalizeCatalog(patch.catalog);
    }
    assignArrayIfNonEmpty('businessViews');
    assignIfPresent('baseModelTemplateFamilies');
    assignArrayIfNonEmpty('viewPresets');
    assignIfPresent('activeViewPresetId');
    assignArrayIfNonEmpty('familyDecisionGroupTemplates');
    assignArrayIfNonEmpty('familyGroupTypes');
    assignObjectIfNonEmpty('optionFamilyStatuses');
    assignObjectIfNonEmpty('modelBaseSlotPicks');
    assignArrayIfNonEmpty('familleHeuristicRules');
    assignArrayIfNonEmpty('boatTemplates');
    return this.normalizeUiState(next);
  }

  static async updateUiState(db, entrepriseId, updates) {
    const collection = db.collection('ugap_data');
    const existing = await collection.findOne(
      { entrepriseId },
      { projection: { uiState: 1 } }
    );
    const current = this.normalizeUiState(existing?.uiState);
    const patch = updates && typeof updates === 'object' ? updates : {};
    const next = this.applyUiStatePatch(current, patch);
    const now = new Date();
    const updateOp = {
      $set: { uiState: next, updatedAt: now },
      $setOnInsert: {
        entrepriseId,
        models: [],
        categories: [],
        businessViews: [],
        dependencyRules: [],
        createdAt: now
      }
    };
    await collection.updateOne({ entrepriseId }, updateOp, { upsert: true });
    return next;
  }

  /**
   * Crée une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} name - Nom de la catégorie
   * @returns {Promise<string>} ID de la catégorie
   */
  static async createCategory(db, entrepriseId, name) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const baseSlug = `cat_${(name || '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')}`;
    let candidateId = baseSlug || `cat_${Date.now()}`;
    let suffix = 1;
    const existingIds = new Set(categories.map(cat => cat.id));
    while (existingIds.has(candidateId)) {
      suffix += 1;
      candidateId = `${baseSlug || 'cat'}_${suffix}`;
    }

    const label = String(name || '').trim();
    const newCategory = {
      id: candidateId,
      name: label,
      objectName: label,
      catalogue: true,
      selectionRules: { unique: false, required: false },
      businessViewIds: [],
      familyIds: [],
      families: [],
      options: [],
      subCategories: []
    };

    const result = await collection.updateOne(
      { entrepriseId },
      { $push: { categories: newCategory }, $set: { updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Impossible de créer la catégorie');
    }

    return candidateId;
  }

  /**
   * Met à jour une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<boolean>} Succès
   */
  static async updateCategory(db, entrepriseId, categoryId, updates) {
    const collection = db.collection('ugap_data');
    const current = await collection.findOne({ entrepriseId, 'categories.id': categoryId }, { projection: { categories: 1 } });
    const existing = (current?.categories || []).find((cat) => String(cat?.id) === String(categoryId));
    if (!existing) return false;
    const merged = this.normalizeCategory({
      ...existing,
      ...(updates && typeof updates === 'object' ? updates : {}),
      id: categoryId
    });
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { $set: { 'categories.$[cat]': merged, updatedAt: new Date() } },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Réordonne les catégories
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string[]} orderedCategoryIds - Liste des IDs dans l'ordre souhaité
   * @returns {Promise<boolean>} Succès
   */
  static async reorderCategories(db, entrepriseId, orderedCategoryIds) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const categoryById = new Map(categories.map(cat => [cat.id, cat]));
    const seen = new Set();
    const reordered = [];

    orderedCategoryIds.forEach(id => {
      if (seen.has(id)) return;
      const category = categoryById.get(id);
      if (category) {
        reordered.push(category);
        seen.add(id);
      }
    });

    // Conserver les catégories non listées à la fin (ordre existant)
    categories.forEach(cat => {
      if (!seen.has(cat.id)) {
        reordered.push(cat);
        seen.add(cat.id);
      }
    });

    const result = await collection.updateOne(
      { entrepriseId },
      { $set: { categories: reordered, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Met à jour une option
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} optionId - ID de l'option
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<boolean>} Succès
   */
  static async updateOption(db, entrepriseId, optionId, updates) {
    const collection = db.collection('ugap_data');
    const targetId = String(optionId || '').trim();
    if (!targetId) return false;
    const patch = updates && typeof updates === 'object' ? updates : {};
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }
    let existing = null;
    (Array.isArray(document.categories) ? document.categories : []).some((cat) =>
      (Array.isArray(cat?.options) ? cat.options : []).some((opt) => {
        if (String(opt?.id || '').trim() !== targetId) return false;
        existing = opt;
        return true;
      })
    );
    if (!existing) return false;
    const merged = this.normalizeOption({ ...existing, ...patch, id: targetId });
    const result = await collection.updateOne(
      { entrepriseId, 'categories.options.id': targetId },
      { 
        $set: { 
          'categories.$[cat].options.$[opt]': merged,
          updatedAt: new Date()
        }
      },
      { 
        arrayFilters: [
          { 'cat.options.id': targetId },
          { 'opt.id': targetId }
        ]
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Assigne des familles a un lot d'options en une seule ecriture
   * @param {Object} db
   * @param {string} entrepriseId
   * @param {Array<{optionId:string,familyLabel:string}>} assignments
   * @returns {Promise<{updatedCount:number,updatedOptionIds:string[]}>}
   */
  static async assignOptionsFamiliesBulk(db, entrepriseId, assignments) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const updatesMap = new Map();
    (Array.isArray(assignments) ? assignments : []).forEach((item) => {
      const optionId = String(item?.optionId || '').trim();
      const familyLabel = String(item?.familyLabel || '').trim();
      if (!optionId || !familyLabel) return;
      updatesMap.set(optionId, familyLabel);
    });
    if (!updatesMap.size) return { updatedCount: 0, updatedOptionIds: [] };

    let updatedCount = 0;
    const updatedOptionIds = [];
    const categories = (document.categories || []).map((cat) => {
      const options = (cat.options || []).map((opt) => {
        const optionId = String(opt?.id || '').trim();
        if (!optionId || !updatesMap.has(optionId)) return opt;
        updatedCount += 1;
        updatedOptionIds.push(optionId);
        return {
          ...opt,
          familyLabel: updatesMap.get(optionId)
        };
      });
      return { ...cat, options };
    });

    await collection.updateOne(
      { entrepriseId },
      { $set: { categories, updatedAt: new Date() } }
    );
    return { updatedCount, updatedOptionIds };
  }

  /** Retire les optionIds d’une famille (groupes, composants) sans toucher à la structure. */
  /**
   * Assigne des nœuds catalogue (catalogObjectId) à un lot d'options en une seule écriture.
   * @param {Object} db
   * @param {string} entrepriseId
   * @param {Array<{optionId:string,catalogObjectId?:string}>} assignments
   * @returns {Promise<{updatedCount:number,updatedOptionIds:string[]}>}
   */
  static async assignOptionsCatalogBulk(db, entrepriseId, assignments) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const updatesMap = new Map();
    (Array.isArray(assignments) ? assignments : []).forEach((item) => {
      const optionId = String(item?.optionId || '').trim();
      if (!optionId || !Object.prototype.hasOwnProperty.call(item, 'catalogObjectId')) return;
      updatesMap.set(optionId, String(item.catalogObjectId || '').trim());
    });
    if (!updatesMap.size) return { updatedCount: 0, updatedOptionIds: [] };

    let updatedCount = 0;
    const updatedOptionIds = [];
    const categories = (document.categories || []).map((cat) => {
      const options = (cat.options || []).map((opt) => {
        const optionId = String(opt?.id || '').trim();
        if (!optionId || !updatesMap.has(optionId)) return opt;
        updatedCount += 1;
        updatedOptionIds.push(optionId);
        const catalogObjectId = updatesMap.get(optionId);
        const next = { ...opt };
        if (catalogObjectId) {
          next.catalogObjectId = catalogObjectId;
        } else {
          delete next.catalogObjectId;
        }
        return next;
      });
      return { ...cat, options };
    });

    await collection.updateOne(
      { entrepriseId },
      { $set: { categories, updatedAt: new Date() } }
    );
    return { updatedCount, updatedOptionIds };
  }

  static stripFamilyOptionAssignments(family) {
    const f = family && typeof family === 'object' ? { ...family } : {};
    f.optionIds = [];
    const clearGroups = (groups) => (Array.isArray(groups) ? groups : []).map((g) => {
      const grp = g && typeof g === 'object' ? { ...g } : {};
      grp.optionIds = [];
      return grp;
    });
    if (Array.isArray(f.decisionGroups)) f.decisionGroups = clearGroups(f.decisionGroups);
    if (Array.isArray(f.groups)) f.groups = clearGroups(f.groups);
    if (Array.isArray(f.components)) {
      f.components = f.components.map((comp) => {
        const c = comp && typeof comp === 'object' ? { ...comp } : {};
        c.optionIds = [];
        if (Array.isArray(c.groups)) c.groups = clearGroups(c.groups);
        if (Array.isArray(c.decisionGroups)) c.decisionGroups = clearGroups(c.decisionGroups);
        return c;
      });
    }
    return f;
  }

  /**
   * Réinitialise les assignations options ↔ familles/groupes (legacy) et catalogObjectId (nœuds catalogue).
   * Conserve les familles, l’arbre catalogue et les options catalogue.
   */
  static async resetAllOptionsFamilyAssignments(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    let catalogClearedCount = 0;
    const categories = (document.categories || []).map((cat) => {
      const options = (cat.options || []).map((opt) => {
        const familyLabel = String(opt?.familyLabel || '').trim();
        const catalogObjectId = String(opt?.catalogObjectId || '').trim();
        if (!familyLabel && !catalogObjectId) return opt;
        catalogClearedCount += 1;
        const next = { ...opt };
        if (familyLabel) delete next.familyLabel;
        if (catalogObjectId) delete next.catalogObjectId;
        return next;
      });
      return { ...cat, options };
    });

    const ui = this.normalizeUiState(document.uiState);
    const families = this.resolveUiStateFamilies(ui).map((f) => this.stripFamilyOptionAssignments(f));
    const nextUi = this.normalizeUiState({
      ...ui,
      families,
      optionFamilyStatuses: {},
      updatedAt: new Date()
    });

    await collection.updateOne(
      { entrepriseId },
      { $set: { categories, uiState: nextUi, updatedAt: new Date() } }
    );

    return {
      catalogClearedCount,
      familiesCount: families.length,
      uiState: nextUi
    };
  }

  /** IDs d'options déjà présents dans le catalogue (options + sous-catégories). */
  static collectCatalogOptionIds(categories) {
    const ids = new Set();
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const id = String(opt?.id || '').trim();
        if (id) ids.add(id);
      });
      (Array.isArray(cat?.subCategories) ? cat.subCategories : []).forEach((sc) => {
        (Array.isArray(sc?.optionIds) ? sc.optionIds : []).forEach((oid) => {
          const id = String(oid || '').trim();
          if (id) ids.add(id);
        });
      });
    });
    return ids;
  }

  /** Premier identifiant opt_N libre dans tout le catalogue. */
  static allocateNextOptionId(categories) {
    const existingIds = this.collectCatalogOptionIds(categories);
    let maxNum = 0;
    existingIds.forEach((id) => {
      const m = id.match(/^opt_(\d+)$/i);
      if (!m) return;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    });
    let n = Math.max(1, maxNum + 1);
    while (existingIds.has(`opt_${n}`)) n += 1;
    return `opt_${n}`;
  }

  /**
   * Ajoute une nouvelle option dans une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie cible
   * @param {Object} option - Données de l'option à créer
   * @returns {Promise<{ ok: boolean, id: string }>} Succès et id effectivement créé
   */
  static async createOption(db, entrepriseId, categoryId, option) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = Array.isArray(document.categories) ? document.categories : [];
    if (!categories.length) {
      throw new Error('Aucune catégorie disponible');
    }

    const targetCategory = categories.find((cat) => String(cat?.id || '') === String(categoryId || '').trim()) || categories[0];
    if (!targetCategory) {
      throw new Error('Catégorie cible introuvable');
    }

    const existingIds = this.collectCatalogOptionIds(categories);
    const requestedId = String(option?.id || '').trim();
    const optionId = (!requestedId || existingIds.has(requestedId))
      ? this.allocateNextOptionId(categories)
      : requestedId;

    const refUgap = String(option?.refUgap || '').trim();
    const baseRefUgap = String(option?.baseRefUgap || refUgap).trim();
    const toCreate = this.normalizeOption({
      ...option,
      id: optionId,
      name: String(option?.name || '').trim(),
      refUgap,
      baseRefUgap,
      details: String(option?.details || '').trim(),
      importExcelLabel: String(option?.importExcelLabel || option?.details || '').trim(),
      familyLabel: String(option?.familyLabel || '').trim(),
      subFamily: String(option?.subFamily || '').trim(),
      priceClient: Number.isFinite(Number(option?.priceClient)) ? Number(option.priceClient) : 0,
      priceUgap: Number.isFinite(Number(option?.priceUgap)) ? Number(option.priceUgap) : 0,
      baseIncluded: option?.baseIncluded !== false,
      manualBaseOption: option?.manualBaseOption !== false,
      baseIncludedPrice: Number.isFinite(Number(option?.baseIncludedPrice)) ? Number(option.baseIncludedPrice) : 0,
      compatibleModels: Array.isArray(option?.compatibleModels)
        ? option.compatibleModels.map((x) => String(x)).filter(Boolean)
        : [],
      catalogObjectId: String(option?.catalogObjectId || '').trim(),
      tags: Array.isArray(option?.tags) ? option.tags : [],
      isDivers: option?.isDivers !== undefined ? !!option.isDivers : false,
      importOptionLineKind: String(option?.importOptionLineKind || 'option').trim() || 'option',
    });

    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': targetCategory.id },
      {
        $push: { 'categories.$.options': toCreate },
        $set: { updatedAt: new Date() }
      }
    );

    return { ok: result.modifiedCount > 0, id: optionId };
  }

  /**
   * Retire une option du document (catalogue, familles, picks de base, import).
   * @param {Object} document
   * @param {string} optionId
   * @returns {boolean} true si l'option existait dans le catalogue
   */
  static purgeOptionIdFromDocument(document, optionId) {
    const targetId = String(optionId || '').trim();
    if (!targetId || !document || typeof document !== 'object') return false;

    let removedFromCatalog = false;
    document.categories = (Array.isArray(document.categories) ? document.categories : []).map((cat) => {
      const before = Array.isArray(cat.options) ? cat.options.length : 0;
      const options = (Array.isArray(cat.options) ? cat.options : [])
        .filter((opt) => {
          const keep = String(opt?.id || '').trim() !== targetId;
          if (!keep) removedFromCatalog = true;
          return keep;
        });
      const subCategories = (Array.isArray(cat.subCategories) ? cat.subCategories : []).map((sc) => ({
        ...sc,
        optionIds: Array.isArray(sc.optionIds)
          ? sc.optionIds.map((x) => String(x)).filter((id) => id !== targetId)
          : []
      }));
      if (before !== options.length) removedFromCatalog = true;
      return { ...cat, options, subCategories };
    });

    const ui = this.normalizeUiState(document.uiState);
    ui.families = (Array.isArray(ui.families) ? ui.families : []).map((family) => {
      const decisionGroups = (Array.isArray(family.decisionGroups) ? family.decisionGroups : []).map((group) => ({
        ...group,
        optionIds: (Array.isArray(group.optionIds) ? group.optionIds : [])
          .map((x) => String(x || '').trim())
          .filter((id) => id && id !== targetId)
      }));
      const defaultOptionId = String(family.defaultOptionId || '').trim();
      return {
        ...family,
        optionIds: (Array.isArray(family.optionIds) ? family.optionIds : [])
          .map((x) => String(x || '').trim())
          .filter((id) => id && id !== targetId),
        decisionGroups,
        ...(defaultOptionId === targetId ? { defaultOptionId: '' } : {})
      };
    });

    const picks = ui.modelBaseSlotPicks && typeof ui.modelBaseSlotPicks === 'object'
      ? { ...ui.modelBaseSlotPicks }
      : {};
    Object.keys(picks).forEach((modelId) => {
      const slots = picks[modelId];
      if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return;
      const nextSlots = { ...slots };
      Object.keys(nextSlots).forEach((slotKey) => {
        if (String(nextSlots[slotKey] || '').trim() === targetId) {
          delete nextSlots[slotKey];
        }
      });
      picks[modelId] = nextSlots;
    });
    ui.modelBaseSlotPicks = picks;
    document.uiState = ui;

    if (Array.isArray(document.importOptions)) {
      document.importOptions = document.importOptions
        .filter((row) => String(row?.id || row?.optionId || '').trim() !== targetId)
        .map((row) => {
          const next = { ...row };
          if (Array.isArray(next.linkedCatalogOptionIds)) {
            next.linkedCatalogOptionIds = next.linkedCatalogOptionIds
              .map((x) => String(x || '').trim())
              .filter((id) => id && id !== targetId);
          }
          return next;
        });
    }

    if (Array.isArray(document.importBaseProducts)) {
      document.importBaseProducts = document.importBaseProducts.map((bp) => {
        const next = { ...bp };
        if (String(next.catalogOptionId || '').trim() === targetId) {
          next.catalogOptionId = '';
        }
        if (Array.isArray(next.optionIds)) {
          next.optionIds = next.optionIds
            .map((x) => String(x || '').trim())
            .filter((id) => id && id !== targetId);
        }
        return next;
      });
    }

    return removedFromCatalog;
  }

  /**
   * Supprime une option (catalogue + références uiState / import)
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} optionId - ID de l'option à supprimer
   * @returns {Promise<boolean>} Succès
   */
  static async deleteOption(db, entrepriseId, optionId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const targetId = String(optionId || '').trim();
    if (!targetId) {
      throw new Error('optionId requis');
    }

    this.purgeOptionIdFromDocument(document, targetId);

    const result = await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          categories: document.categories,
          uiState: document.uiState,
          importOptions: document.importOptions || [],
          importBaseProducts: document.importBaseProducts || [],
          updatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Supprime plusieurs options catalogue en une fois.
   * @returns {Promise<{ deletedCount: number, notFoundIds: string[] }>}
   */
  static async deleteOptionsBulk(db, entrepriseId, optionIds) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const ids = [...new Set(
      (Array.isArray(optionIds) ? optionIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )];
    if (!ids.length) {
      throw new Error('optionIds requis (tableau non vide)');
    }

    const notFoundIds = [];
    let deletedCount = 0;
    ids.forEach((targetId) => {
      const existed = this.purgeOptionIdFromDocument(document, targetId);
      if (existed) deletedCount += 1;
      else notFoundIds.push(targetId);
    });

    if (!deletedCount) {
      return { deletedCount: 0, notFoundIds };
    }

    await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          categories: document.categories,
          uiState: document.uiState,
          importOptions: document.importOptions || [],
          importBaseProducts: document.importBaseProducts || [],
          updatedAt: new Date()
        }
      }
    );

    return { deletedCount, notFoundIds };
  }

  /**
   * Déplace une option vers une autre catégorie et/ou sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} fromCategoryId - ID de la catégorie source
   * @param {string} optionId - ID de l'option
   * @param {string} toCategoryId - ID de la catégorie destination
   * @param {string} toSubCategoryId - ID de la sous-catégorie destination (optionnel)
   * @returns {Promise<boolean>} Succès
   */
  static async moveOptionToCategory(db, entrepriseId, fromCategoryId, optionId, toCategoryId, toSubCategoryId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const fromCategory = categories.find(cat => cat.id === fromCategoryId);
    const toCategory = categories.find(cat => cat.id === toCategoryId);

    if (!fromCategory) {
      throw new Error('Catégorie source non trouvée');
    }
    if (!toCategory) {
      throw new Error('Catégorie destination non trouvée');
    }

    const removeOptionFromSubCategories = (category) => {
      (category.subCategories || []).forEach(sc => {
        if (Array.isArray(sc.optionIds)) {
          sc.optionIds = sc.optionIds.filter(id => id !== optionId);
        }
      });
    };

    let option = null;

    if (fromCategoryId === toCategoryId) {
      option = (fromCategory.options || []).find(opt => opt.id === optionId);
    } else {
      const fromOptions = fromCategory.options || [];
      const optionIndex = fromOptions.findIndex(opt => opt.id === optionId);
      if (optionIndex === -1) {
        throw new Error('Option non trouvée');
      }

      option = fromOptions.splice(optionIndex, 1)[0];
      fromCategory.options = fromOptions;

      const toOptions = toCategory.options || [];
      const existsInTarget = toOptions.some(opt => opt.id === optionId);
      if (!existsInTarget) {
        toOptions.push({ ...option, category: toCategory.name || option.category });
      } else {
        toCategory.options = toOptions.map(opt =>
          opt.id === optionId ? { ...opt, category: toCategory.name || opt.category } : opt
        );
      }
    }

    if (!option) {
      throw new Error('Option non trouvée');
    }

    removeOptionFromSubCategories(fromCategory);
    if (fromCategoryId !== toCategoryId) {
      removeOptionFromSubCategories(toCategory);
    }

    if (toSubCategoryId && toSubCategoryId !== 'none') {
      const targetSubCategory = (toCategory.subCategories || []).find(sc => sc.id === toSubCategoryId);
      if (!targetSubCategory) {
        throw new Error('Sous-catégorie destination non trouvée');
      }
      targetSubCategory.optionIds = Array.isArray(targetSubCategory.optionIds)
        ? targetSubCategory.optionIds
        : [];
      if (!targetSubCategory.optionIds.includes(optionId)) {
        targetSubCategory.optionIds.push(optionId);
      }
    }

    const result = await collection.updateOne(
      { entrepriseId },
      { $set: { categories, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Ajoute une nouvelle catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} category - Données de la catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async addCategory(db, entrepriseId, category) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId },
      { 
        $push: { 
          categories: {
            id: category.id || `cat_${Date.now()}`,
            name: category.name,
            selectionRules: this.normalizeSelectionRules(category.selectionRules),
            businessViewIds: Array.isArray(category.businessViewIds) ? category.businessViewIds.map((x) => String(x)).filter(Boolean) : [],
            familyIds: Array.isArray(category.familyIds) ? category.familyIds.map((x) => String(x)).filter(Boolean) : [],
            subCategories: category.subCategories || [],
            options: category.options || []
          }
        },
        $set: { updatedAt: new Date() }
      }
    );
    return result.modifiedCount > 0 || result.upsertedCount > 0;
  }

  static UNCLASSIFIED_CATEGORY_ID = 'cat_non_classees';

  /**
   * Déplace des options vers le seau « Non classées » (sans écraser les ids déjà présents).
   * @param {Array} categories
   * @param {Array} options
   * @returns {Array}
   */
  static relocateOptionsToUnclassifiedCategory(categories, options) {
    const UNCLASSIFIED_ID = this.UNCLASSIFIED_CATEGORY_ID;
    const list = Array.isArray(categories) ? categories.map((c) => ({ ...c })) : [];
    const incoming = (Array.isArray(options) ? options : []).map((o) => this.normalizeOption({
      ...o,
      category: 'Non classées',
      subCategory: null
    }));
    if (!incoming.length) {
      return list.map((c) => this.normalizeCategory(c));
    }

    let idx = list.findIndex((c) => String(c?.id || '') === UNCLASSIFIED_ID);
    if (idx < 0) {
      list.push({
        id: UNCLASSIFIED_ID,
        name: 'Non classées',
        options: [],
        subCategories: [],
        catalogue: false,
        selectionRules: { unique: false, required: false },
        businessViewIds: []
      });
      idx = list.length - 1;
    }

    const bucket = { ...list[idx] };
    const existingIds = new Set(
      (Array.isArray(bucket.options) ? bucket.options : [])
        .map((o) => String(o?.id || '').trim())
        .filter(Boolean)
    );
    bucket.options = [...(Array.isArray(bucket.options) ? bucket.options : [])];
    incoming.forEach((opt) => {
      const id = String(opt?.id || '').trim();
      if (!id || existingIds.has(id)) return;
      bucket.options.push(opt);
      existingIds.add(id);
    });
    list[idx] = bucket;
    return list.map((c) => this.normalizeCategory(c));
  }

  /**
   * Supprime une catégorie (les options sont conservées dans « Non classées »).
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<{deleted:boolean, optionsMoved:number}>}
   */
  static async deleteCategory(db, entrepriseId, categoryId) {
    const collection = db.collection('ugap_data');
    const targetId = String(categoryId || '').trim();
    if (!targetId) throw new Error('ID catégorie requis');
    if (targetId === this.UNCLASSIFIED_CATEGORY_ID) {
      throw new Error('Impossible de supprimer le réservoir « Non classées »');
    }

    const document = await collection.findOne({ entrepriseId });
    if (!document) throw new Error('Données non trouvées');

    const categories = document.categories || [];
    const target = categories.find((c) => String(c?.id || '') === targetId);
    if (!target) throw new Error('Catégorie introuvable');

    const optionsToMove = Array.isArray(target.options) ? target.options : [];
    let nextCategories = categories.filter((c) => String(c?.id || '') !== targetId);
    if (optionsToMove.length) {
      nextCategories = this.relocateOptionsToUnclassifiedCategory(nextCategories, optionsToMove);
    } else {
      nextCategories = nextCategories.map((c) => this.normalizeCategory(c));
    }

    const businessViews = (document.businessViews || []).map((view) => {
      const source = view && typeof view === 'object' ? view : {};
      const categoryIds = Array.isArray(source.categoryIds)
        ? source.categoryIds.map((x) => String(x)).filter((id) => id && id !== targetId)
        : [];
      return this.normalizeBusinessView({ ...source, categoryIds });
    });

    const result = await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          categories: nextCategories,
          businessViews,
          updatedAt: new Date()
        }
      }
    );
    if (result.modifiedCount === 0) {
      throw new Error('Impossible de supprimer la catégorie');
    }
    return { deleted: true, optionsMoved: optionsToMove.length };
  }

  /**
   * Réinitialise toutes les catégories:
   * - Regroupe TOUTES les options existantes dans une catégorie unique "Non classées"
   * - Supprime toutes les sous-catégories (elles seront régénérées si besoin)
   *
   * Important: on ne met PAS categories=[] sinon on perd l'accès aux options côté UI/configurateur.
   *
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<{categoriesCleared:number, optionsMoved:number}>}
   */
  static async clearAllCategories(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const optionById = new Map();

    categories.forEach(cat => {
      (cat.options || []).forEach(opt => {
        if (!opt || !opt.id) return;
        if (!optionById.has(opt.id)) {
          optionById.set(opt.id, {
            ...opt,
            category: 'Non classées',
            subCategory: null
          });
        }
      });
    });

    const options = Array.from(optionById.values());
    const newCategories = [{
      id: 'cat_non_classees',
      name: 'Non classées',
      options,
      subCategories: []
    }];

    const result = await collection.updateOne(
      { entrepriseId },
      { $set: { categories: newCategories, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Impossible de réinitialiser les catégories');
    }

    return { categoriesCleared: categories.length, optionsMoved: options.length };
  }

  static async purgePublishedData(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const result = await collection.deleteOne({ entrepriseId });
    return {
      deleted: result.deletedCount > 0,
      deletedCount: result.deletedCount || 0
    };
  }

  static reextractModelsAndCategoriesFromSource(doc) {
    const filePath = String(doc?.source?.sourceFilePath || '').trim();
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Fichier source introuvable pour ré-extraire les données');
    }
    const extracted = UgapExcelService.extractData(filePath);
    return {
      models: Array.isArray(extracted?.models) ? extracted.models : [],
      importOptions: this.importOptionsFromExtractedPayload(extracted)
    };
  }

  static async reopenImportStaging(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    const doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) throw new Error('Import staging introuvable');
    if (String(doc.status || '').toLowerCase() !== 'published') {
      return doc;
    }
    const progress = doc.progress || {};
    const computed = this.computeStagingStatuses(progress, { ...doc, status: 'validated' });
    let nextStatus = String(computed.status || 'validated').toLowerCase();
    if (nextStatus === 'published') nextStatus = 'validated';
    await collection.updateOne(
      { _id, entrepriseId },
      {
        $set: {
          status: nextStatus,
          updatedAt: new Date()
        },
        $unset: { publishedAt: '' }
      }
    );
    return await collection.findOne({ _id, entrepriseId });
  }

  /**
   * Vide toutes les options du catalogue publié et de l'import staging.
   * Conserve modèles, familles (structure sans liens options) et vues métier.
   * Permet un nouvel import Excel sans recréer d'anciennes options.
   */
  static async resetCatalogAndImportFromExtract(db, entrepriseId, importId = null, opts = {}) {
    const collection = db.collection('ugap_import_staging');
    let doc = null;
    if (importId) {
      doc = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    } else {
      doc = await collection.find({ entrepriseId }).sort({ updatedAt: -1 }).limit(1).next();
    }

    const dataCol = db.collection('ugap_data');
    const published = await dataCol.findOne({ entrepriseId });
    const publishedModels = Array.isArray(published?.models) ? published.models : [];
    const oldUiState = this.normalizeUiState(published?.uiState);
    const familiesBackup = Array.isArray(opts.familiesBackup) ? opts.familiesBackup : [];
    const sourceFamilies = oldUiState.families.length ? oldUiState.families : familiesBackup;
    const families = this.stripFamiliesOptionLinks(sourceFamilies);
    const preservedUiState = {
      ...oldUiState,
      families,
      optionFamilyStatuses: {}
    };
    const models = publishedModels.length
      ? publishedModels
      : (Array.isArray(doc?.models) ? doc.models : []);

    const previousOptionsCount = (Array.isArray(published?.categories) ? published.categories : [])
      .reduce((n, cat) => n + (Array.isArray(cat?.options) ? cat.options.length : 0), 0);

    await this.saveData(
      db,
      {
        models,
        categories: [],
        importBaseProducts: [],
        businessViews: Array.isArray(published?.businessViews) ? published.businessViews : [],
        dependencyRules: [],
        uiState: preservedUiState
      },
      entrepriseId
    );

    if (doc?._id) {
      const now = new Date();
      const stagingModels = Array.isArray(doc.models) ? doc.models : models;
      const prevProgress = doc.progress && typeof doc.progress === 'object' ? doc.progress : {};
      const progress = {
        ...prevProgress,
        optionsCompleted: false,
        familiesCompleted: false
      };
      const baseProg = this.normalizeStagingProgressForModels(stagingModels, progress);
      const normalizedProgress = this.coerceStagingProgressOptionsWithDocument(
        baseProg,
        { ...doc, models: stagingModels, categories: [] }
      );
      const computed = this.computeStagingStatuses(normalizedProgress, {
        ...doc,
        models: stagingModels,
        categories: [],
        progress: normalizedProgress
      });
      await collection.updateOne(
        { _id: doc._id, entrepriseId },
        {
          $set: {
            categories: [],
            importBaseProducts: [],
            importAssignmentsSummary: null,
            progress: normalizedProgress,
            status: computed.status,
            optionsStatus: 'to_validate',
            baseOptionsStatus: 'to_validate',
            minorationsStatus: 'to_validate',
            majorationsStatus: 'to_validate',
            diversStatus: 'to_validate',
            updatedAt: now
          },
          $unset: { publishedAt: '', importAssignmentsAppliedAt: '' }
        }
      );
    }

    return {
      importId: doc?._id ? String(doc._id) : null,
      modelsCount: models.length,
      optionsCount: 0,
      optionsRemoved: previousOptionsCount,
      familiesCount: families.length,
      status: doc?.status || null
    };
  }

  /** Conserve libellés / groupes de familles ; retire uniquement les liens vers des options. */
  static stripFamiliesOptionLinks(families = []) {
    return (Array.isArray(families) ? families : []).map((family) => {
      const f = family && typeof family === 'object' ? { ...family } : {};
      const decisionGroups = (Array.isArray(f.decisionGroups) ? f.decisionGroups : []).map((g) => {
        const group = g && typeof g === 'object' ? { ...g } : {};
        return { ...group, optionIds: [] };
      });
      const next = { ...f, optionIds: [], decisionGroups };
      delete next.defaultOptionId;
      return next;
    });
  }

  /**
   * Ajoute une sous-catégorie à une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} subCategory - Données de la sous-catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async addSubCategory(db, entrepriseId, categoryId, subCategory) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { 
        $push: { 
          'categories.$[cat].subCategories': {
            id: subCategory.id || `subcat_${Date.now()}`,
            name: subCategory.name,
            description: subCategory.description || '',
            optionIds: subCategory.optionIds || []
          }
        },
        $set: { updatedAt: new Date() }
      },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Met à jour une sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {string} subCategoryId - ID de la sous-catégorie
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<boolean>} Succès
   */
  /**
   * Crée une nouvelle sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} subCategory - Données de la sous-catégorie { name, description, optionIds? }
   * @returns {Promise<string>} ID de la sous-catégorie créée
   */
  static async createSubCategory(db, entrepriseId, categoryId, subCategory) {
    const collection = db.collection('ugap_data');
    
    const subCategoryId = subCategory.id || `subcat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSubCategory = {
      id: subCategoryId,
      name: subCategory.name || '',
      description: subCategory.description || '',
      optionIds: subCategory.optionIds || [],
      familyId: subCategory.familyId != null ? String(subCategory.familyId) : ''
    };

    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { 
        $push: { 
          'categories.$[cat].subCategories': newSubCategory
        },
        $set: {
          updatedAt: new Date()
        }
      },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Catégorie non trouvée');
    }

    return subCategoryId;
  }

  static async updateSubCategory(db, entrepriseId, categoryId, subCategoryId, updates) {
    const collection = db.collection('ugap_data');
    
    // Récupérer la sous-catégorie actuelle pour préserver les champs non fournis
    const data = await this.getData(db, entrepriseId);
    const category = data?.categories?.find(c => c.id === categoryId);
    const subCategory = category?.subCategories?.find(sc => sc.id === subCategoryId);
    
    // Fusionner les mises à jour avec les données existantes
    const updatedSubCategory = {
      id: subCategoryId,
      name: updates.name !== undefined ? updates.name : (subCategory?.name || ''),
      description: updates.description !== undefined ? updates.description : (subCategory?.description || ''),
      optionIds: updates.optionIds !== undefined ? updates.optionIds : (subCategory?.optionIds || []),
      familyId: updates.familyId !== undefined ? String(updates.familyId || '') : String(subCategory?.familyId || '')
    };
    
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId, 'categories.subCategories.id': subCategoryId },
      { 
        $set: { 
          'categories.$[cat].subCategories.$[subcat]': updatedSubCategory,
          updatedAt: new Date()
        }
      },
      { 
        arrayFilters: [
          { 'cat.id': categoryId },
          { 'subcat.id': subCategoryId }
        ]
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Supprime une sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {string} subCategoryId - ID de la sous-catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async deleteSubCategory(db, entrepriseId, categoryId, subCategoryId) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { 
        $pull: { 'categories.$[cat].subCategories': { id: subCategoryId } },
        $set: { updatedAt: new Date() }
      },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );
    return result.modifiedCount > 0;
  }

  // ========================================
  // GESTION DES PROMPTS IA
  // ========================================

  /**
   * Récupère les prompts IA configurés
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Prompts configurés avec valeurs par défaut si non configurés
   */
  static async getPrompts(db, entrepriseId) {
    const collection = db.collection('ugap_prompts');
    const document = await collection.findOne({ entrepriseId });
    
    // Prompts par défaut
    const defaultPrompts = {
      subCategoryPrompt: `### CONTEXTE (MODIFIABLE)
Tu travailles pour un constructeur de bateaux. Tu souhaites classer tes options dans des catégories afin de faciliter la configuration des bateaux.
Ta mission: regrouper les options en sous-catégories logiques et utiles pour la navigation.

Contexte important:
- Regrouper les options qui se remplacent (mutuellement exclusives).
- Exemple: motorisation / moteur -> un bateau ne peut avoir qu'un seul moteur, donc tous les types de moteur doivent être dans la même sous-catégorie.
- Prioriser des sous-catégories claires et orientées usage.

### REGLES FIXES (NON MODIFIABLE)
Instructions IMPORTANTES:
1. Analyse CHAQUE option individuellement et identifie des groupes logiques (sous-catégories)
2. Chaque sous-catégorie doit regrouper des options similaires MAIS pas trop nombreuses (idéalement 5-15 options par sous-catégorie)
3. Crée des sous-catégories FINES et SPÉCIFIQUES plutôt que des groupes trop larges
4. TOUTES les options DOIVENT être incluses dans au moins une sous-catégorie - aucune option ne doit être oubliée
5. Si une option peut appartenir à plusieurs groupes, choisis le groupe le plus spécifique
6. Les sous-catégories doivent être pertinentes et utiles pour la navigation

INTERDICTIONS STRICTES - À NE JAMAIS FAIRE :
❌ NE JAMAIS regrouper par marque (Suzuki, Yamaha, Mercury, etc.) - C'EST INTERDIT
❌ NE JAMAIS regrouper par caractéristique technique (puissance, carburant, arbre, etc.) - Ce sont des caractéristiques, pas des catégories
❌ NE JAMAIS créer de sous-catégories comme "Moteurs Suzuki", "Moteurs Yamaha", "Moteurs 150 ch", "Moteurs essence"

RÈGLES DE REGROUPEMENT - À FAIRE :
✅ Regrouper par FONCTION ou TYPE D'USAGE uniquement
✅ Exemples CORRECTS :
   - "Moteurs" (TOUS les moteurs, toutes marques, toutes puissances, tous carburants confondus)
   - "Hélices" (TOUTES les hélices, tous types, toutes marques)
   - "Pièces de rechange" (toutes les pièces détachées, toutes marques)
   - "Accessoires moteurs" (tous les accessoires pour moteurs, toutes marques)
   - "Configurations jumelées" (moteurs en double/twin, toutes marques)
   - "Services et maintenance" (services, révisions, garanties)
   - "Garanties" (toutes les garanties, toutes marques)
   - "Formations" (toutes les formations, toutes marques)

PRINCIPE FONDAMENTAL :
Une sous-catégorie doit répondre à la question "QU'EST-CE QUE C'EST ?" (fonction/usage),
PAS "QUI L'A FAIT ?" (marque) ou "QUELLES SONT SES CARACTÉRISTIQUES ?" (puissance, carburant, etc.)

### DONNEES (NON MODIFIABLE)
Catégorie: "{{categoryName}}"
Options:
{{optionsList}}

### REPONSE ATTENDUE (NON MODIFIABLE)
RÉPONDS UNIQUEMENT AVEC UN TABLEAU JSON VALIDE, SANS AUCUN TEXTE AVANT OU APRÈS.
Commence directement par [ et termine par ].

Format exact:
[
  {
    "name": "Nom de la sous-catégorie",
    "description": "Description courte",
    "optionIds": ["ID_EXACT_DE_L_OPTION_1", "ID_EXACT_DE_L_OPTION_2"]
  }
]

IMPORTANT:
- Utilise UNIQUEMENT les IDs exacts fournis dans la liste des options (format: "ID: xxx")
- Vérifie que TOUTES les options sont incluses dans au moins une sous-catégorie
- Ne crée pas de nouveaux IDs
- Si tu as {{totalOptions}} options, assure-toi que la somme des optionIds dans toutes les sous-catégories = {{totalOptions}}

Si aucune sous-catégorie pertinente ne peut être identifiée, retourne un tableau vide: [].`,
      categorizationPrompt: `Analyse les options suivantes et assigne-les à des catégories pertinentes.

Options:
{{optionsList}}

Catégories existantes: Motorisation, Flotteurs, Aménagement, Électronique, Remorque, Sécurité, Services, Divers

Réponds UNIQUEMENT avec un JSON valide au format suivant:
{
  "categorizations": [
    {
      "optionName": "Nom de l'option",
      "category": "Nom de la catégorie",
      "assignation": "Nom de l'assignation (optionnel)"
    }
  ]
}`,
      minorationPrompt: `Tu analyses des lignes de minoration UGAP.

Objectif:
1) Identifier le ou les poste(s) concerné(s)
2) Identifier l'option actuellement présente (moteur actuel / base)
3) Identifier l'option qui remplace
4) Calculer la moins-value à déduire

Règles métier:
- Une croix indique le moteur actuellement présent pour le poste.
- Si on change de moteur, la minoration correspond à la déduction du prix du moteur actuel.
- Priorité d'analyse: poste(s) > option actuelle > option remplaçante > impact prix.
- Si une donnée est absente, retourner null sur le champ.

Réponds UNIQUEMENT en JSON valide:
{
  "assignments": [
    {
      "sourceLine": "ligne brute",
      "postes": [1, 2],
      "currentOption": "moteur actuel",
      "replacementOption": "moteur remplaçant",
      "minorationAmount": 0,
      "currency": "EUR",
      "confidence": 0
    }
  ]
}`,
      subCategoryLlmId: null,
      categorizationLlmId: null,
      minorationLlmId: null,
      familleLlmId: null,
      assignationLlmId: null,
      assignationPrompt: `Tu dois assigner UNE famille à UNE vue métier.

Vues métier disponibles:
{{businessViews}}

Famille à classer:
- familyLabel: {{familyLabel}}
- assignation actuelle: {{assignation}}
- sousFamille: {{subFamily}}
- nombre options: {{optionsCount}}
- exemples options:
{{optionsList}}

Règles:
- Choisir exactement UNE vue métier parmi les id fournis.
- Se baser sur le sens métier de la famille et les mots-clés des vues.
- Répondre en JSON strict, sans texte autour.

Format:
{
  "businessViewId": "id_exact_si_possible",
  "businessViewLabel": "label_vue_metier",
  "confidence": 0.0,
  "reason": "explication courte"
}`,
      familleContext: `Tu es expert catalogue options bateau / UGAP.

Contexte : listes d'options et de minorations issues de catalogues. Une « famille » regroupe des VARIANTES du même produit / même prestation : pour un même poste catalogue, le client ne fait **qu'un seul choix** parmi ces lignes (ex. une couleur parmi toutes les teintes proposées pour ce flotteur ou cette console — on ne peut pas commander 5 couleurs différentes pour le même équipement). Toutes les lignes « couleur X / couleur Y / RAL … » qui décrivent ce même équipement doivent donc être dans **une seule** famille avec tous leurs \`id\` dans \`optionIds\`.`,
      famillePrompt: `## Tâche
Produire le regroupement « familles d'options » : une famille = toutes les options **en concurrence** pour le même besoin : **une seule** peut être retenue (choix unique). Les variantes couleur, RAL, finition ou teinte du **même** article / équipement sont **toujours** dans la **même** famille : l'utilisateur choisit une option parmi la liste, pas plusieurs couleurs à la fois pour le même produit.

## Choix unique — couleurs et finitions (règle absolue)
- Si plusieurs lignes ne diffèrent que par la couleur, la teinte, le RAL ou la finition du **même** équipement (ex. « Console de pilotage en rouge … », « … en vert … », « … Noir - RAL 9005 »), elles forment **une seule** famille ; \`optionIds\` contient **tous** les ids de ces lignes (ex. 5 couleurs → 5 ids dans **la même** entrée JSON, pas 5 familles).
- Ne jamais éclater les couleurs d'un même produit en plusieurs familles : ce serait faux métier (on ne cumule pas plusieurs coloris pour un seul équipement).

## Méthode (à appliquer dans l'ordre)
1) Parcourir **toute** la liste numérotée ; ne rien ignorer.
2) Repérer les **groupes de variantes** : même intention métier, libellés qui partagent une **racine stable** et ne changent que sur la partie variante.
   - Exemples de racines stables : « Coloris flotteur en … », « Coloris de la coque en … », « Console de pilotage en … », « Marquage comprenant … lettres », « Pulvérisation zone renfort … », « Bâche … Postes … ».
3) **Regrouper** dans une seule famille tous les ids de ces variantes ; \`familyLabel\` = nom générique du choix (ex. « Couleur du flotteur », « Couleur de la coque », « Console de pilotage (couleur / finition) », « Marquage (nombre de lettres) »).
4) **Ne pas regrouper** des lignes qui ne sont pas des variantes du même choix :
   - Libellés décrivant des **postes / emplacements différents** sur l'embarcation (ex. « … Poste 1 » vs « … Postes 2 et 9 ») : ce sont des **prestations distinctes** (même famille d'équipement répétée à plusieurs endroits), mets-les dans des **familles séparées** ou laisse des familles à une ligne selon le cas.
   - Équipements ou prestations de nature différente (même catégorie catalogue ne suffit pas à fusionner).
5) Les **minorations** (\`type=minoration\`) : applique les mêmes règles ; ne fusionne pas une minoration avec une option si ce n'est pas la même variante logique.

## Exemple canonique (référence métier)
Entrées (5 teintes du même flotteur) :
- Coloris flotteur en Rouge Etna
- Coloris flotteur en Vert Army
- Coloris flotteur en Noir
- Coloris flotteur en Orange Sylvano
- Coloris flotteur en Gris Military ou Jaune Colorado
Sortie attendue : **une seule** famille, **5** ids dans \`optionIds\` (pas 5 familles).
\`{"familyLabel":"Couleur du flotteur","optionIds":["id1","id2","id3","id4","id5"]}\`
Le client ne peut en sélectionner qu'une ; \`defaultOptionId\` optionnel si une teinte « standard » est identifiable, sinon omis.

## DONNÉES (liste injectée automatiquement)
{{LISTE_LIGNES}}

## FORMAT DE RETOUR (obligatoire)
- Un **seul** tableau JSON (array), racine directe. Aucun texte avant \`[\` ni après \`]\` (pas de markdown, pas de \`\`\`json).
- Chaque élément : \`familyLabel\` (string, non vide), \`optionIds\` (array de strings = valeurs \`id=\` **exactes** de la liste).
- Optionnel : \`defaultOptionId\` (string) ∈ \`optionIds\`, seulement si une ligne est clairement la référence / standard.
- Requis : \`assignation\` (string) = nom d'assignation métier pour la famille.
- Requis : \`businessView\` (string) = vue métier principale.
- Optionnel : \`subFamily\` (string) = sous-famille métier si pertinent.
- **Choix unique** : pour un même équipement, toutes les variantes couleur / RAL / finition → **une** famille et **tous** les ids dans \`optionIds\` (une seule teinte retenue, pas plusieurs).

Exemple de forme (ids fictifs) :
[
  {"familyLabel":"Couleur du flotteur","optionIds":["opt_23","opt_24","opt_25"]},
  {"familyLabel":"Console de pilotage (couleur)","optionIds":["opt_86","opt_87","opt_88"],"defaultOptionId":"opt_86"}
]

## Règles strictes
- Chaque \`id\` présent dans les données apparaît **exactement une fois** au total dans tous les \`optionIds\`.
- Pas de doublon d'id entre familles ; pas d'id inventé.
- \`familyLabel\` : court, en français, nom du **choix catalogue** (ex. « Couleur du flotteur »), pas le nom d'une teinte isolée.
- \`assignation\` : terme métier court et exploitable en production.
- \`businessView\` : vue métier de rattachement.
- Couleurs / RAL / finitions du même équipement : **toujours** regroupées ; interdit de créer une famille par teinte.
- Liste longue : reste cohérent du début à la fin ; une seule réponse JSON couvrant **toutes** les lignes.`
    };

    if (!document) {
      // Créer avec les valeurs par défaut
      await collection.insertOne({
        entrepriseId,
        ...defaultPrompts,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return defaultPrompts;
    }

    // Fusionner avec les valeurs par défaut pour les champs manquants
    return {
      subCategoryPrompt: document.subCategoryPrompt || defaultPrompts.subCategoryPrompt,
      categorizationPrompt: document.categorizationPrompt || defaultPrompts.categorizationPrompt,
      minorationPrompt: document.minorationPrompt || defaultPrompts.minorationPrompt,
      subCategoryLlmId: document.subCategoryLlmId || defaultPrompts.subCategoryLlmId,
      categorizationLlmId: document.categorizationLlmId || defaultPrompts.categorizationLlmId,
      minorationLlmId: document.minorationLlmId || defaultPrompts.minorationLlmId,
      familleLlmId: document.familleLlmId || defaultPrompts.familleLlmId,
      assignationLlmId: document.assignationLlmId || defaultPrompts.assignationLlmId,
      assignationPrompt: document.assignationPrompt || defaultPrompts.assignationPrompt,
      familleContext:
        document.familleContext !== undefined && document.familleContext !== null
          ? document.familleContext
          : defaultPrompts.familleContext,
      famillePrompt: document.famillePrompt || defaultPrompts.famillePrompt
    };
  }

  /**
   * Met à jour les prompts IA
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} prompts - Prompts à mettre à jour { subCategoryPrompt?, categorizationPrompt? }
   * @returns {Promise<Object>} Prompts mis à jour
   */
  static async updatePrompts(db, entrepriseId, prompts) {
    const collection = db.collection('ugap_prompts');
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (prompts.subCategoryPrompt !== undefined && prompts.subCategoryPrompt !== null) {
      updateData.subCategoryPrompt = prompts.subCategoryPrompt;
    }
    
    if (prompts.categorizationPrompt !== undefined && prompts.categorizationPrompt !== null) {
      updateData.categorizationPrompt = prompts.categorizationPrompt;
    }
    
    if (prompts.minorationPrompt !== undefined && prompts.minorationPrompt !== null) {
      updateData.minorationPrompt = prompts.minorationPrompt;
    }

    if (prompts.famillePrompt !== undefined && prompts.famillePrompt !== null) {
      updateData.famillePrompt = prompts.famillePrompt;
    }

    if (prompts.familleContext !== undefined && prompts.familleContext !== null) {
      updateData.familleContext = prompts.familleContext;
    }
    if (prompts.subCategoryLlmId !== undefined) {
      updateData.subCategoryLlmId = prompts.subCategoryLlmId ? String(prompts.subCategoryLlmId).trim() : null;
    }
    if (prompts.categorizationLlmId !== undefined) {
      updateData.categorizationLlmId = prompts.categorizationLlmId ? String(prompts.categorizationLlmId).trim() : null;
    }
    if (prompts.minorationLlmId !== undefined) {
      updateData.minorationLlmId = prompts.minorationLlmId ? String(prompts.minorationLlmId).trim() : null;
    }
    if (prompts.familleLlmId !== undefined) {
      updateData.familleLlmId = prompts.familleLlmId ? String(prompts.familleLlmId).trim() : null;
    }
    if (prompts.assignationLlmId !== undefined) {
      updateData.assignationLlmId = prompts.assignationLlmId ? String(prompts.assignationLlmId).trim() : null;
    }
    if (prompts.assignationPrompt !== undefined && prompts.assignationPrompt !== null) {
      updateData.assignationPrompt = prompts.assignationPrompt;
    }

    const existing = await collection.findOne({ entrepriseId });
    
    if (existing) {
      await collection.updateOne(
        { entrepriseId },
        { $set: updateData }
      );
    } else {
      // Récupérer les valeurs par défaut pour les champs non fournis
      const defaults = await this.getPrompts(db, entrepriseId);
      await collection.insertOne({
        entrepriseId,
        subCategoryPrompt: prompts.subCategoryPrompt || defaults.subCategoryPrompt,
        categorizationPrompt: prompts.categorizationPrompt || defaults.categorizationPrompt,
        minorationPrompt: prompts.minorationPrompt || defaults.minorationPrompt,
        subCategoryLlmId: prompts.subCategoryLlmId !== undefined
          ? (prompts.subCategoryLlmId ? String(prompts.subCategoryLlmId).trim() : null)
          : defaults.subCategoryLlmId,
        categorizationLlmId: prompts.categorizationLlmId !== undefined
          ? (prompts.categorizationLlmId ? String(prompts.categorizationLlmId).trim() : null)
          : defaults.categorizationLlmId,
        minorationLlmId: prompts.minorationLlmId !== undefined
          ? (prompts.minorationLlmId ? String(prompts.minorationLlmId).trim() : null)
          : defaults.minorationLlmId,
        familleLlmId: prompts.familleLlmId !== undefined
          ? (prompts.familleLlmId ? String(prompts.familleLlmId).trim() : null)
          : defaults.familleLlmId,
        assignationLlmId: prompts.assignationLlmId !== undefined
          ? (prompts.assignationLlmId ? String(prompts.assignationLlmId).trim() : null)
          : defaults.assignationLlmId,
        assignationPrompt: prompts.assignationPrompt || defaults.assignationPrompt,
        familleContext: prompts.familleContext !== undefined && prompts.familleContext !== null
          ? prompts.familleContext
          : defaults.familleContext,
        famillePrompt: prompts.famillePrompt || defaults.famillePrompt,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return await this.getPrompts(db, entrepriseId);
  }

  /**
   * Réinitialise les prompts aux valeurs par défaut
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Prompts réinitialisés
   */
  static async resetPrompts(db, entrepriseId) {
    const collection = db.collection('ugap_prompts');
    await collection.deleteOne({ entrepriseId });
    return await this.getPrompts(db, entrepriseId);
  }

  /**
   * Ajoute une configuration à un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {Object} config - Configuration { name, description?, image? }
   * @returns {Promise<Object>} Données mises à jour
   */
  static async addModelConfiguration(db, entrepriseId, modelId, config) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error('Modèle non trouvé');
    }

    if (!model.configurations) {
      model.configurations = [];
    }

    const newConfig = {
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      description: config.description || '',
      image: config.image || null,
      createdAt: new Date()
    };

    model.configurations.push(newConfig);

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Met à jour une configuration d'un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {string} configId - ID de la configuration
   * @param {Object} updates - Mises à jour { name?, description?, image? }
   * @returns {Promise<Object>} Données mises à jour
   */
  static async updateModelConfiguration(db, entrepriseId, modelId, configId, updates) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model || !model.configurations) {
      throw new Error('Modèle ou configuration non trouvé(e)');
    }

    const config = model.configurations.find(c => c.id === configId);
    if (!config) {
      throw new Error('Configuration non trouvée');
    }

    Object.assign(config, updates);
    config.updatedAt = new Date();

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Supprime une configuration d'un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {string} configId - ID de la configuration
   * @returns {Promise<Object>} Données mises à jour
   */
  static async deleteModelConfiguration(db, entrepriseId, modelId, configId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model || !model.configurations) {
      throw new Error('Modèle ou configuration non trouvé(e)');
    }

    const index = model.configurations.findIndex(c => c.id === configId);
    if (index === -1) {
      throw new Error('Configuration non trouvée');
    }

    model.configurations.splice(index, 1);

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Met à jour l'image d'un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {string} image - URL de l'image
   * @returns {Promise<Object>} Données mises à jour
   */
  static async updateModelImage(db, entrepriseId, modelId, image) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error('Modèle non trouvé');
    }

    model.image = image;

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  static buildManualModelId(name, existingModels = []) {
    const slug = String(name || 'modele')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'modele';
    const ids = new Set(
      (Array.isArray(existingModels) ? existingModels : [])
        .map((m) => String(m?.id || '').trim())
        .filter(Boolean)
    );
    let id = `model_${slug}`;
    let n = 0;
    while (ids.has(id)) {
      n += 1;
      id = `model_${slug}_${n}`;
    }
    return id;
  }

  /**
   * Crée un modèle manuel dans le catalogue publié.
   */
  static async createModel(db, entrepriseId, payload = {}) {
    const name = String(payload?.name || '').trim();
    if (!name) {
      throw new Error('Nom du modèle requis');
    }

    const collection = db.collection('ugap_data');
    const now = new Date();
    let document = await collection.findOne({ entrepriseId });
    const models = Array.isArray(document?.models) ? document.models.slice() : [];

    const nameKey = name.toLowerCase();
    if (models.some((m) => String(m?.name || '').trim().toLowerCase() === nameKey)) {
      throw new Error('Un modèle avec ce nom existe déjà');
    }

    const posteRaw = payload?.posteNumber;
    const posteParsed = posteRaw === '' || posteRaw == null ? null : parseInt(posteRaw, 10);
    const posteNumber = Number.isFinite(posteParsed) ? posteParsed : null;
    const basePriceRaw = payload?.basePrice;
    const basePrice = Number.isFinite(Number(basePriceRaw)) ? Number(basePriceRaw) : 0;

    const newModel = {
      id: this.buildManualModelId(name, models),
      name,
      basePrice,
      motorizationBase: String(payload?.motorizationBase || '').trim(),
      posteNumber,
      defaultDeliveryMode: String(payload?.defaultDeliveryMode || '').trim(),
      configurations: [],
      image: null,
      boatTemplateId: null
    };

    models.push(newModel);

    if (document) {
      await collection.updateOne(
        { entrepriseId },
        { $set: { models, updatedAt: now } }
      );
    } else {
      await collection.insertOne({
        entrepriseId,
        models,
        categories: [],
        businessViews: [],
        dependencyRules: [],
        uiState: this.normalizeUiState({}),
        importBaseProducts: [],
        createdAt: now,
        updatedAt: now
      });
    }

    return { model: newModel, models };
  }

  /**
   * Met à jour les champs d'un modèle catalogue.
   */
  static async updateModel(db, entrepriseId, modelId, updates = {}) {
    const mid = String(modelId || '').trim();
    if (!mid) {
      throw new Error('ID modèle requis');
    }

    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = (Array.isArray(document.models) ? document.models : []).find((m) => m.id === mid);
    if (!model) {
      throw new Error('Modèle non trouvé');
    }

    if (updates.name !== undefined) {
      const name = String(updates.name || '').trim();
      if (!name) throw new Error('Nom du modèle requis');
      model.name = name;
    }
    if (updates.basePrice !== undefined) {
      const basePrice = Number(updates.basePrice);
      model.basePrice = Number.isFinite(basePrice) ? basePrice : 0;
    }
    if (updates.motorizationBase !== undefined) {
      model.motorizationBase = String(updates.motorizationBase || '').trim();
    }
    if (updates.posteNumber !== undefined) {
      const posteRaw = updates.posteNumber;
      const posteParsed = posteRaw === '' || posteRaw == null ? null : parseInt(posteRaw, 10);
      model.posteNumber = Number.isFinite(posteParsed) ? posteParsed : null;
    }
    if (updates.defaultDeliveryMode !== undefined) {
      model.defaultDeliveryMode = String(updates.defaultDeliveryMode || '').trim();
    }
    if (updates.boatTemplateId !== undefined) {
      const tid = String(updates.boatTemplateId || '').trim();
      model.boatTemplateId = tid || null;
    }

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return { model, models: document.models };
  }

  /**
   * Met à jour le lien doc-template d'une option
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} optionId - ID de l'option
   * @param {string} idDocTemplate - ID de la collection doc-template
   * @returns {Promise<Object>} Données mises à jour
   */
  static async updateOptionDocTemplate(db, entrepriseId, optionId, idDocTemplate) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    let option = null;
    for (const category of document.categories) {
      option = (category.options || []).find(o => o.id === optionId);
      if (option) break;
    }

    if (!option) {
      throw new Error('Option non trouvée');
    }

    option.idDocTemplate = idDocTemplate || null;

    await collection.updateOne(
      { entrepriseId },
      { $set: { categories: document.categories, updatedAt: new Date() } }
    );

    return document;
  }

  static buildOptionRemapStableKey(option, categoryName = '') {
    const ref = String(option?.refUgap || '').trim().toUpperCase();
    if (ref) return `ref:${ref}`;
    const normalize = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const name = normalize(option?.name);
    const category = normalize(categoryName || option?.category);
    return `name:${name}|cat:${category}`;
  }

  static buildOptionIdRemapMap(oldCategories = [], newCategories = []) {
    const buckets = new Map();
    (Array.isArray(oldCategories) ? oldCategories : []).forEach((cat) => {
      const categoryName = String(cat?.name || '').trim();
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const key = this.buildOptionRemapStableKey(opt, categoryName);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(String(opt?.id || '').trim());
      });
    });
    const map = new Map();
    (Array.isArray(newCategories) ? newCategories : []).forEach((cat) => {
      const categoryName = String(cat?.name || '').trim();
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const key = this.buildOptionRemapStableKey(opt, categoryName);
        const queue = buckets.get(key);
        if (!queue?.length) return;
        const oldId = queue.shift();
        const newId = String(opt?.id || '').trim();
        if (oldId && newId) map.set(oldId, newId);
      });
    });
    return map;
  }

  static remapOptionId(optionId, idMap) {
    const raw = String(optionId || '').trim();
    if (!raw) return '';
    if (idMap.has(raw)) return idMap.get(raw);
    const legacy = raw.match(/^(opt_\d+)/);
    if (legacy && idMap.has(legacy[1])) return idMap.get(legacy[1]);
    return raw;
  }

  static remapUiStateFamilies(families = [], idMap = new Map()) {
    return (Array.isArray(families) ? families : []).map((family) => {
      const f = family && typeof family === 'object' ? { ...family } : {};
      const optionIds = Array.from(new Set(
        (Array.isArray(f.optionIds) ? f.optionIds : [])
          .map((id) => this.remapOptionId(id, idMap))
          .filter(Boolean)
      ));
      const decisionGroups = (Array.isArray(f.decisionGroups) ? f.decisionGroups : []).map((g) => {
        const group = g && typeof g === 'object' ? { ...g } : {};
        return {
          ...group,
          optionIds: Array.from(new Set(
            (Array.isArray(group.optionIds) ? group.optionIds : [])
              .map((id) => this.remapOptionId(id, idMap))
              .filter(Boolean)
          ))
        };
      });
      const def = this.remapOptionId(f.defaultOptionId, idMap);
      const next = { ...f, optionIds, decisionGroups };
      if (def && optionIds.includes(def)) next.defaultOptionId = def;
      else delete next.defaultOptionId;
      return next;
    });
  }

  static remapDependencyRules(rules = [], idMap = new Map()) {
    return this.normalizeDependencyRules(
      (Array.isArray(rules) ? rules : [])
        .map((rule) => {
          const r = rule && typeof rule === 'object' ? rule : {};
          return {
            triggerOptionId: this.remapOptionId(r.triggerOptionId, idMap),
            autoSelectOptionIds: (Array.isArray(r.autoSelectOptionIds) ? r.autoSelectOptionIds : [])
              .map((id) => this.remapOptionId(id, idMap))
              .filter(Boolean),
            message: r.message
          };
        })
        .filter((r) => r.triggerOptionId && r.autoSelectOptionIds.length > 0)
    );
  }

  static stripCategoriesForOptionsReset(categories = []) {
    return (Array.isArray(categories) ? categories : []).map((cat) => {
      const normalized = this.normalizeCategory(cat);
      normalized.familyIds = [];
      normalized.subCategories = (Array.isArray(normalized.subCategories) ? normalized.subCategories : [])
        .map((sub) => ({
          ...this.normalizeSubCategory(sub),
          optionIds: []
        }));
      normalized.options = (Array.isArray(normalized.options) ? normalized.options : [])
        .map((opt) => {
          const o = { ...this.normalizeOption(opt) };
          delete o.manualMinorationAssignment;
          delete o.manualMajorationAssignment;
          delete o.manualBaseOption;
          delete o.baseIncluded;
          delete o.importGeneratedFromBaseProduct;
          delete o.importBaseProductId;
          delete o.importOptionLineKind;
          return this.applyBaseOptionTag(o);
        });
      return normalized;
    });
  }

  static buildOptionBusinessKey(option, categoryName = '') {
    // Une ligne Excel = un id (opt_<row>) : ne pas fusionner plusieurs lignes ayant la même réf. UGAP.
    const id = String(option?.id || '').trim();
    if (id) return `id:${id}`;
    const ref = String(option?.refUgap || '').trim().toUpperCase();
    if (ref) return `ref:${ref}`;
    const normalize = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const name = normalize(option?.name);
    const category = normalize(categoryName || option?.category);
    return `name:${name}|cat:${category}`;
  }

  static mergeImportedCategories(categories) {
    const incoming = Array.isArray(categories) ? categories : [];
    const mergedByCategory = new Map();
    incoming.forEach((category) => {
      const categoryName = String(category?.name || 'Divers').trim() || 'Divers';
      const categoryId = String(category?.id || `cat_${categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
      if (!mergedByCategory.has(categoryName)) {
        mergedByCategory.set(categoryName, {
          id: categoryId,
          name: categoryName,
          options: [],
          subCategories: Array.isArray(category?.subCategories) ? category.subCategories : [],
          _optionIndex: new Map()
        });
      }
      const target = mergedByCategory.get(categoryName);
      (category?.options || []).forEach((option) => {
        const businessKey = this.buildOptionBusinessKey(option, categoryName);
        const existing = target._optionIndex.get(businessKey);
        if (!existing) {
          const normalized = this.normalizeOption(option);
          normalized.businessKey = businessKey;
          target._optionIndex.set(businessKey, normalized);
          target.options.push(normalized);
          return;
        }
        const mergedModels = new Set([...(existing.compatibleModels || []), ...((option?.compatibleModels || []).map((x) => String(x)))]);
        existing.compatibleModels = Array.from(mergedModels).filter(Boolean);
        if (!existing.refUgap && option?.refUgap) existing.refUgap = String(option.refUgap);
        if (!existing.name && option?.name) existing.name = String(option.name);
        if (Number(option?.priceClient) > 0) existing.priceClient = Number(option.priceClient);
        if (Number(option?.priceUgap) > 0) existing.priceUgap = Number(option.priceUgap);
      });
    });
    return Array.from(mergedByCategory.values()).map((cat) => {
      delete cat._optionIndex;
      return cat;
    });
  }

  /** @deprecated Utiliser UNCLASSIFIED_CATEGORY_ID — seau unique pour options orphelines à la publication. */
  static IMPORT_PUBLISH_OPTIONS_BUCKET_ID = 'cat_non_classees';

  /** Noms de catégories créées par l'ancienne heuristique Excel (determineCategory). */
  static LEGACY_EXCEL_AUTO_CATEGORY_NAMES = new Set([
    'Motorisation',
    'Flotteurs',
    'Aménagement',
    'Électronique',
    'Remorque',
    'Sécurité',
    'Services',
    'Divers',
    'Autre'
  ]);

  static isLegacyExcelAutoCategory(cat) {
    if (!cat || typeof cat !== 'object') return false;
    const id = String(cat.id || '').trim();
    const name = String(cat.name || '').trim();
    if (id === this.UNCLASSIFIED_CATEGORY_ID) return false;
    const families = Array.isArray(cat.families) ? cat.families : [];
    if (families.length > 0) return false;
    if (cat.catalogue === true) return false;
    const objectName = String(cat.objectName || '').trim();
    if (objectName && objectName !== name) return false;
    if (this.LEGACY_EXCEL_AUTO_CATEGORY_NAMES.has(name)) return true;
    if (name === 'Options import Excel') return true;
    // Conserver la catégorie IBP publiée (materialize importBaseProducts).
    if (id === this.IMPORT_BASE_PRODUCTS_CATEGORY_ID) return false;
    if (/^cat_(motorisation|flotteurs|divers|amenagement|electronique|remorque|securite|services|autre|catalogue_import)/i.test(id)) {
      return true;
    }
    return false;
  }

  /** Supprime les coquilles Motorisation/Divers/etc. et garde les options dans « Non classées ». */
  static dissolveLegacyExcelAutoCategories(categories = []) {
    const list = (Array.isArray(categories) ? categories : []).map((c) => this.normalizeCategory(c));
    const toRelocate = [];
    const keep = [];
    list.forEach((cat) => {
      if (this.isLegacyExcelAutoCategory(cat)) {
        (Array.isArray(cat.options) ? cat.options : []).forEach((o) => toRelocate.push(o));
      } else {
        keep.push(cat);
      }
    });
    if (!toRelocate.length) return keep;
    return this.relocateOptionsToUnclassifiedCategory(keep, toRelocate);
  }

  /** Staging import : liste plate uniquement (plus de categories[]). */
  static normalizeImportStagingDocument(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const hadLegacyCategories = Array.isArray(doc.categories) && doc.categories.length > 0;
    const importOptions = this.getStagingImportOptions(doc);
    return {
      ...doc,
      importOptions,
      categories: [],
      _stagingShapeMigrated: hadLegacyCategories
    };
  }

  static async persistStagingImportOptionsShape(db, doc) {
    if (!doc?._id || !doc._stagingShapeMigrated) return doc;
    const collection = db.collection('ugap_import_staging');
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      {
        $set: {
          importOptions: doc.importOptions || [],
          categories: [],
          updatedAt: new Date()
        }
      }
    );
    const next = { ...doc };
    delete next._stagingShapeMigrated;
    return next;
  }

  /** Options du staging : liste plate `importOptions` (legacy : aplatit categories[]). */
  static getStagingImportOptions(doc) {
    if (Array.isArray(doc?.importOptions)) {
      return doc.importOptions.map((o) => this.normalizeOption(o));
    }
    return (Array.isArray(doc?.categories) ? doc.categories : [])
      .flatMap((cat) => (Array.isArray(cat?.options) ? cat.options : []))
      .map((o) => this.normalizeOption(o));
  }

  static importOptionsFromExtractedPayload(payload) {
    if (Array.isArray(payload?.importOptions) && payload.importOptions.length) {
      return payload.importOptions.map((o) => this.normalizeOption(o));
    }
    return (Array.isArray(payload?.categories) ? payload.categories : [])
      .flatMap((cat) => (Array.isArray(cat?.options) ? cat.options : []))
      .map((o) => {
        const norm = this.normalizeOption(o);
        const m = String(norm.id || '').match(/^opt_(\d+)$/);
        if (m && !Number.isFinite(Number(norm.rowOrder))) norm.rowOrder = Number(m[1]);
        return norm;
      });
  }

  static stagingDocWithImportOptions(doc, importOptions) {
    const next = doc && typeof doc === 'object' ? { ...doc } : {};
    next.importOptions = (Array.isArray(importOptions) ? importOptions : []).map((o) => this.normalizeOption(o));
    next.categories = [];
    return next;
  }

  /**
   * Publication import : met à jour les options existantes par id ; nouvelles options → seau unique.
   * Ne crée jamais de catégories Motorisation/Divers issus de l'Excel.
   */
  static mergePublishedOptionsFromImportStaging(existingCategories = [], importOptions = []) {
    const existing = this.dedupeCategoryOptionsById(existingCategories);
    const incoming = (Array.isArray(importOptions) ? importOptions : [])
      // Les IBP générées sont matérialisées plus loin via importBaseProducts.
      .filter((o) => o?.importGeneratedFromBaseProduct !== true)
      .map((o) => {
        const normalized = this.normalizeOption(o);
        this.applyImportOptionLineKindToOption(
          normalized,
          this.resolveEffectiveImportLineKind(normalized)
        );
        return normalized;
      });
    const optIndex = new Map();
    existing.forEach((cat) => {
      (Array.isArray(cat.options) ? cat.options : []).forEach((opt) => {
        const id = String(opt?.id || '').trim();
        if (id) optIndex.set(id, { cat, opt });
      });
    });

    const orphans = [];
    incoming.forEach((opt) => {
      const id = String(opt?.id || '').trim();
      if (!id) return;
      const hit = optIndex.get(id);
      if (hit) {
        const idx = hit.cat.options.findIndex((o) => String(o?.id || '').trim() === id);
        if (idx >= 0) {
          hit.cat.options[idx] = this.normalizeOption({ ...hit.cat.options[idx], ...opt });
        }
        return;
      }
      orphans.push(opt);
    });

    if (orphans.length) {
      const bucketId = this.UNCLASSIFIED_CATEGORY_ID;
      let bucket = existing.find((c) => String(c?.id || '') === bucketId);
      if (!bucket) {
        bucket = {
          id: bucketId,
          name: 'Non classées',
          objectName: 'Non classées',
          catalogue: false,
          options: [],
          subCategories: [],
          families: [],
          familyIds: [],
          selectionRules: { unique: false, required: false },
          businessViewIds: []
        };
        existing.push(bucket);
      }
      const byId = new Map(
        (Array.isArray(bucket.options) ? bucket.options : [])
          .map((o) => [String(o?.id || '').trim(), o])
          .filter(([id]) => id)
      );
      orphans.forEach((o) => {
        const id = String(o?.id || '').trim();
        if (id) byId.set(id, o);
      });
      bucket.options = Array.from(byId.values()).map((o) => this.normalizeOption(o));
    }

    return existing;
  }

  /**
   * Garde progress.validatedModelIds aligné sur les modèles réellement présents dans le staging
   * (réimport / suppression de modèles avant la fin du workflow).
   */
  static normalizeStagingProgressForModels(models, progress = {}) {
    const modelIdSet = new Set(
      (Array.isArray(models) ? models : [])
        .map((m) => String(m?.id || '').trim())
        .filter(Boolean)
    );
    const raw = Array.isArray(progress?.validatedModelIds) ? progress.validatedModelIds : [];
    const seen = new Set();
    const pruned = [];
    raw.forEach((x) => {
      const id = String(x || '').trim();
      if (!id || !modelIdSet.has(id) || seen.has(id)) return;
      seen.add(id);
      pruned.push(id);
    });
    const modelsCompleted = modelIdSet.size > 0 && [...modelIdSet].every((mid) => seen.has(mid));
    const base = {
      ...progress,
      validatedModelIds: pruned,
      modelsCompleted
    };
    if (!modelsCompleted) {
      base.optionsCompleted = false;
      base.familiesCompleted = false;
      base.viewsCompleted = false;
    }
    return base;
  }

  /**
   * progress.optionsCompleted ne peut être vrai que si les modèles sont complets
   * ET que le document staging indique optionsStatus === 'validated'.
   */
  static coerceStagingProgressOptionsWithDocument(progress, stagingDoc = {}) {
    const p = progress && typeof progress === 'object' ? { ...progress } : {};
    const modelsDone = !!p.modelsCompleted;
    const optionsValidated = String(stagingDoc.optionsStatus || '').toLowerCase() === 'validated';
    p.optionsCompleted = !!(modelsDone && optionsValidated);
    if (!modelsDone) {
      p.familiesCompleted = false;
      p.viewsCompleted = false;
    }
    return p;
  }

  /**
   * Source unique de vérité du statut import.
   */
  static computeStagingStatuses(progress = {}, stagingDoc = {}) {
    const modelsCompleted = !!progress?.modelsCompleted;
    const optionsValidated = String(stagingDoc?.optionsStatus || '').toLowerCase() === 'validated';
    const modelsStatus = modelsCompleted ? 'validated' : 'to_validate';
    const status = !modelsCompleted
      ? 'draft'
      : (optionsValidated ? 'validated' : 'in_review');
    return { status, modelsStatus };
  }


  static _stagingModelProgressOutOfSync(doc, normalizedProgress) {
    const prev = doc?.progress || {};
    const prevIds = JSON.stringify((Array.isArray(prev.validatedModelIds) ? prev.validatedModelIds : []).map((x) => String(x)));
    const nextIds = JSON.stringify((normalizedProgress.validatedModelIds || []).map((x) => String(x)));
    const modelsMismatch = prevIds !== nextIds || Boolean(prev.modelsCompleted) !== Boolean(normalizedProgress.modelsCompleted);
    const optionsMismatch = Boolean(prev.optionsCompleted) !== Boolean(normalizedProgress.optionsCompleted);
    return modelsMismatch || optionsMismatch;
  }

  static countStagingMinorationOptions(source) {
    const options = Array.isArray(source)
      ? source
      : this.getStagingImportOptions(source || {});
    let count = 0;
    options.forEach((opt) => {
      if (UgapImportAssignmentService.isMinorationLine(opt?.name, opt?.refUgap)) count += 1;
    });
    return count;
  }

  /**
   * Ancien import : mergeImportedCategories fusionnait toutes les lignes partageant la même réf. UGAP.
   * Ré-extrait le fichier source si encore présent et si des minorations MINO manquent.
   */
  static async repairImportStagingMergedOptionsIfNeeded(db, doc) {
    if (!doc || !doc._id || doc.status === 'published') return doc;
    const filePath = String(doc?.source?.sourceFilePath || '').trim();
    if (!filePath || !fs.existsSync(filePath)) return doc;

    let extracted;
    try {
      extracted = UgapExcelService.extractData(filePath);
    } catch {
      return doc;
    }

    const freshOptions = this.importOptionsFromExtractedPayload(extracted);
    const freshMino = this.countStagingMinorationOptions(freshOptions);
    const currentMino = this.countStagingMinorationOptions(doc);
    if (freshMino <= currentMino) return doc;

    const freshTotal = freshOptions.length;
    const currentTotal = this.getStagingImportOptions(doc).length;
    if (freshTotal <= currentTotal) return doc;

    const collection = db.collection('ugap_import_staging');
    const patch = {
      importOptions: freshOptions,
      categories: [],
      updatedAt: new Date()
    };
    if (Array.isArray(extracted?.models) && extracted.models.length > 0) {
      patch.models = extracted.models;
    }
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      { $set: patch }
    );
    return { ...doc, ...patch };
  }

  static async repairImportStagingMinorationsIfNeeded(db, doc) {
    if (!doc || !doc._id || doc.status === 'published') return doc;
    const importOptions = this.getStagingImportOptions(doc);
    const cleared = UgapImportAssignmentService.clearMinorationCrossAssignmentsForOptions(importOptions, true);
    if (!cleared) return doc;
    const { doc: assignedDoc, summary } = UgapImportAssignmentService.applyStagingAssignments(
      this.stagingDocWithImportOptions(doc, importOptions)
    );
    const collection = db.collection('ugap_import_staging');
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      {
        $set: {
          importOptions: assignedDoc.importOptions || importOptions,
          categories: [],
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: assignedDoc.importAssignmentsAppliedAt,
          updatedAt: new Date()
        }
      }
    );
    return {
      ...doc,
      importOptions: assignedDoc.importOptions || importOptions,
      categories: [],
      importAssignmentsSummary: summary
    };
  }

  static async repairImportStagingModelProgressIfNeeded(db, doc) {
    if (!doc || !doc._id || doc.status === 'published') return doc;
    let normalized = this.normalizeStagingProgressForModels(doc.models, doc.progress || {});
    normalized = this.coerceStagingProgressOptionsWithDocument(normalized, doc);
    const progressDirty = this._stagingModelProgressOutOfSync(doc, normalized);
    const computed = this.computeStagingStatuses(normalized, doc);
    const statusDirty = String(doc.status || '').toLowerCase() !== computed.status
      || String(doc.modelsStatus || '').toLowerCase() !== computed.modelsStatus;
    if (!progressDirty && !statusDirty) return doc;
    const collection = db.collection('ugap_import_staging');
    const patch = { progress: normalized, updatedAt: new Date() };
    if (!normalized.modelsCompleted) {
      patch.status = 'draft';
      patch.modelsStatus = 'to_validate';
      patch.optionsStatus = 'to_validate';
      patch.baseOptionsStatus = 'to_validate';
      patch.minorationsStatus = 'to_validate';
      patch.majorationsStatus = 'to_validate';
      patch.diversStatus = 'to_validate';
    } else {
      patch.status = computed.status;
      patch.modelsStatus = computed.modelsStatus;
    }
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      { $set: patch }
    );
    return { ...doc, ...patch };
  }

  static async saveImportStaging(db, entrepriseId, payload) {
    const collection = db.collection('ugap_import_staging');
    const now = new Date();
    const source = payload?.source || {};
    const sourceFileHash = String(source.sourceFileHash || '').trim();
    const existing = sourceFileHash
      ? await collection.findOne({ entrepriseId, 'source.sourceFileHash': sourceFileHash })
      : null;

    const importOptions = this.importOptionsFromExtractedPayload(payload).map((opt) => {
      const normalized = this.normalizeOption(opt);
      this.applyImportOptionLineKindToOption(
        normalized,
        this.resolveEffectiveImportLineKind(normalized)
      );
      return normalized;
    });
    const document = {
      entrepriseId,
      source: {
        sourceFileName: String(source.sourceFileName || ''),
        sourceFileHash,
        sourceFilePath: String(source.sourceFilePath || ''),
        importedAt: source.importedAt || now
      },
      status: 'draft',
      modelsStatus: 'to_validate',
      optionsStatus: 'to_validate',
      baseOptionsStatus: 'to_validate',
      minorationsStatus: 'to_validate',
      majorationsStatus: 'to_validate',
      diversStatus: 'to_validate',
      models: Array.isArray(payload?.models) ? payload.models : [],
      importOptions,
      categories: [],
      businessViews: Array.isArray(payload?.businessViews) ? payload.businessViews : [],
      dependencyRules: this.normalizeDependencyRules(payload?.dependencyRules),
      uiState: this.normalizeUiState(payload?.uiState),
      progress: {
        validatedModelIds: [],
        modelsCompleted: false,
        optionsCompleted: false,
        familiesCompleted: false,
        viewsCompleted: false
      },
      updatedAt: now,
      createdAt: now
    };

    if (existing) {
      document.createdAt = existing.createdAt || now;
      // Réimport du même fichier: repartir sur une validation modèles propre
      // pour éviter de réinjecter d'anciens validatedModelIds.
      const prevProgress = {
        ...(existing.progress || {}),
        validatedModelIds: [],
        modelsCompleted: false,
        optionsCompleted: false,
        familiesCompleted: false,
        viewsCompleted: false
      };
      const baseProg = this.normalizeStagingProgressForModels(document.models, prevProgress);
      document.progress = this.coerceStagingProgressOptionsWithDocument(
        baseProg,
        document
      );
      const computed = this.computeStagingStatuses(document.progress, document);
      document.status = computed.status;
      document.modelsStatus = computed.modelsStatus;
      document.optionsStatus = 'to_validate';
      document.baseOptionsStatus = 'to_validate';
      document.minorationsStatus = 'to_validate';
      document.majorationsStatus = 'to_validate';
      document.diversStatus = 'to_validate';
      document.importBaseProducts = [];
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: document,
          $unset: { _importBpSyncFingerprint: '' }
        }
      );
      const out = this.normalizeImportStagingDocument({ ...document, _id: existing._id });
      delete out._stagingShapeMigrated;
      return { ...out, alreadyProcessed: true, alreadyValidated: existing.status === 'validated' || existing.status === 'published' };
    }

    const result = await collection.insertOne(document);
    const out = this.normalizeImportStagingDocument({ ...document, _id: result.insertedId });
    delete out._stagingShapeMigrated;
    return { ...out, alreadyProcessed: false, alreadyValidated: false };
  }

  static async finalizeImportStagingRead(db, doc) {
    if (!doc) return null;
    let next = await this.repairImportStagingMergedOptionsIfNeeded(db, doc);
    next = await this.repairImportStagingMinorationsIfNeeded(db, next);
    next = await this.repairImportStagingModelProgressIfNeeded(db, next);
    next = this.normalizeImportStagingDocument(next);
    return await this.persistStagingImportOptionsShape(db, next);
  }

  static async getLatestImportStaging(db, entrepriseId) {
    const collection = db.collection('ugap_import_staging');
    let active = await collection.find({
      entrepriseId,
      status: { $ne: 'published' }
    }).sort({ updatedAt: -1 }).limit(1).next();
    if (active) {
      return await this.finalizeImportStagingRead(db, active);
    }
    const latest = await collection.find({ entrepriseId }).sort({ updatedAt: -1 }).limit(1).next();
    if (!latest) return null;
    return await this.finalizeImportStagingRead(db, latest);
  }

  static getImportStagingDisplayName(doc) {
    const source = doc?.source && typeof doc.source === 'object' ? doc.source : {};
    const displayName = String(source.displayName || '').trim();
    if (displayName) return displayName;
    const fileName = String(source.sourceFileName || '').trim();
    return fileName || 'Sans nom';
  }

  static async listImportStaging(db, entrepriseId) {
    const collection = db.collection('ugap_import_staging');
    const docs = await collection.find(
      { entrepriseId },
      {
        projection: {
          status: 1,
          source: 1,
          progress: 1,
          modelsStatus: 1,
          optionsStatus: 1,
          updatedAt: 1,
          createdAt: 1,
          models: 1
        }
      }
    ).sort({ updatedAt: -1 }).toArray();

    return docs.map((doc) => {
      const models = Array.isArray(doc.models) ? doc.models : [];
      const validatedIds = new Set((doc.progress?.validatedModelIds || []).map((x) => String(x)));
      const validatedModelsCount = models.filter((m) => validatedIds.has(String(m?.id || ''))).length;
      return {
        _id: String(doc._id),
        status: String(doc.status || 'draft'),
        sourceFileName: String(doc.source?.sourceFileName || ''),
        displayName: String(doc.source?.displayName || ''),
        label: this.getImportStagingDisplayName(doc),
        importedAt: doc.source?.importedAt || doc.createdAt || null,
        updatedAt: doc.updatedAt || null,
        modelsCount: models.length,
        validatedModelsCount
      };
    });
  }

  static async updateImportStagingDisplayName(db, entrepriseId, importId, displayName) {
    const label = String(displayName || '').trim();
    if (!label) throw new Error('Nom requis');
    const collection = db.collection('ugap_import_staging');
    const result = await collection.updateOne(
      { _id: new ObjectId(String(importId)), entrepriseId },
      { $set: { 'source.displayName': label, updatedAt: new Date() } }
    );
    if (!result.matchedCount) throw new Error('Import staging introuvable');
    return {
      _id: String(importId),
      displayName: label,
      label
    };
  }

  static async getImportStagingById(db, entrepriseId, importId) {
    if (!importId) return null;
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    const doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) return null;
    return await this.finalizeImportStagingRead(db, doc);
  }

  static async markImportModelsValidated(db, entrepriseId, importId, modelIds = [], modelUpdates = []) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');

    const updateMap = new Map(
      (Array.isArray(modelUpdates) ? modelUpdates : [])
        .map((row) => ({
          id: String(row?.id || '').trim(),
          basePrice: Number(row?.basePrice),
          name: row?.name !== undefined && row?.name !== null ? String(row.name).trim() : undefined
        }))
        .filter((row) => row.id)
        .map((row) => [row.id, row])
    );

    const nextModels = (Array.isArray(document.models) ? document.models : []).map((model) => {
      const id = String(model?.id || '').trim();
      if (!id || !updateMap.has(id)) return model;
      const patch = updateMap.get(id);
      const next = { ...model };
      if (Number.isFinite(patch.basePrice)) next.basePrice = Number(patch.basePrice);
      if (patch.name !== undefined) next.name = patch.name || next.name || id;
      return next;
    });

    const allModelIds = new Set((nextModels || []).map((m) => String(m?.id || '').trim()).filter(Boolean));
    const normalizedProgress = this.normalizeStagingProgressForModels(nextModels, document.progress || {});
    const incoming = (Array.isArray(modelIds) ? modelIds : [])
      .map((x) => String(x || '').trim())
      .filter((id) => id && allModelIds.has(id));
    if (!incoming.length) {
      throw new Error('Aucun modele pending selectionne pour validation');
    }
    const mergedValidated = new Set(
      (Array.isArray(normalizedProgress.validatedModelIds) ? normalizedProgress.validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter((id) => id && allModelIds.has(id))
    );
    incoming.forEach((id) => mergedValidated.add(id));
    const mergedArray = Array.from(mergedValidated);
    const modelsCompleted = allModelIds.size > 0 && mergedArray.every((id) => allModelIds.has(id))
      && [...allModelIds].every((id) => mergedArray.includes(id));
    const mergedFinal = mergedArray;
    const optionsValidated = String(document.optionsStatus || '').toLowerCase() === 'validated';
    const nextOptionsCompleted = !!(modelsCompleted && optionsValidated);
    const computed = this.computeStagingStatuses(
      { modelsCompleted, optionsCompleted: nextOptionsCompleted },
      { optionsStatus: optionsValidated ? 'validated' : 'to_validate' }
    );
    const setPayload = {
      models: nextModels,
      'progress.validatedModelIds': mergedFinal,
      'progress.modelsCompleted': modelsCompleted,
      'progress.optionsCompleted': nextOptionsCompleted,
      modelsStatus: computed.modelsStatus,
      status: computed.status,
      updatedAt: new Date()
    };
    if (!modelsCompleted) {
      setPayload.optionsStatus = 'to_validate';
      setPayload.baseOptionsStatus = 'to_validate';
      setPayload.minorationsStatus = 'to_validate';
      setPayload.majorationsStatus = 'to_validate';
      setPayload.diversStatus = 'to_validate';
    }

    const draftForAssign = {
      ...document,
      models: nextModels,
      progress: {
        ...(document.progress || {}),
        validatedModelIds: mergedFinal,
        modelsCompleted,
        optionsCompleted: nextOptionsCompleted
      }
    };
    const { doc: assignedDoc, summary } = UgapImportAssignmentService.applyStagingAssignments(draftForAssign);
    setPayload.importOptions = assignedDoc.importOptions || [];
    setPayload.categories = [];
    setPayload.importAssignmentsSummary = summary;
    setPayload.importAssignmentsAppliedAt = assignedDoc.importAssignmentsAppliedAt;

    const updated = await collection.findOneAndUpdate(
      { _id: document._id, entrepriseId },
      { $set: setPayload },
      { returnDocument: 'after' }
    );
    const resultDoc = updated?.value || {
      ...assignedDoc,
      ...setPayload,
      progress: {
        ...(document.progress || {}),
        validatedModelIds: mergedFinal,
        modelsCompleted,
        optionsCompleted: nextOptionsCompleted
      }
    };

    try {
      await this.syncValidatedModelsToPublishedCatalog(
        db,
        entrepriseId,
        resultDoc.models || nextModels,
        mergedFinal
      );
    } catch (syncErr) {
      console.warn('⚠️ UGAP syncValidatedModelsToPublishedCatalog:', syncErr.message || syncErr);
    }

    return resultDoc;
  }

  static normalizeImportBaseProductKey(label) {
    return String(label || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[^\wàâäéèêëïîôùûüç\s-]/gi, '')
      .trim();
  }

  static normalizeMotorLabelKey(label) {
    return this.normalizeImportBaseProductKey(label);
  }

  static buildMotorBaseProductRegistryKey(motorLabel, model) {
    const motorNorm = this.normalizeMotorLabelKey(motorLabel);
    if (!motorNorm) return '';
    const mid = String(model?.id || '').trim();
    if (mid) return `${motorNorm}__${mid}`;
    const pn = model?.posteNumber;
    if (pn != null && pn !== '') return `${motorNorm}__p${pn}`;
    return `${motorNorm}__unknown`;
  }

  /** Libellé court moteur (motorisation modèle) — pas tarif catalogue Excel. */
  static isImportMotorBaseProductLabel(label) {
    const n = String(label || '').replace(/\s+/g, ' ').trim();
    if (!n || this.isCatalogMotorTarifOptionName(n)) return false;
    if (n.length > 80) return false;
    return (
      /\b(moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude|tohatsu|yanmar|volvo)\b/i.test(n)
      || /\b\d{2,4}\s*cv\b/i.test(n)
      || /\bdf\s*\d{2,4}\b/i.test(n)
    );
  }

  static isImportMotorBaseProductRow(bp) {
    if (!bp || typeof bp !== 'object') return false;
    if (this.isImportMotorBaseProductLabel(bp.label)) return true;
    const key = String(bp.key || '');
    return /__p\d+$/.test(key) || /__[a-f0-9]{6,}$/i.test(key);
  }

  /** Placeholders parsing Excel — pas un nom d'option de base affichable. */
  static isGenericBasePlaceholderLabel(label) {
    const n = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!n || n === 'de base' || n === 'produit de base') return true;
    if (n === 'moteur choisi' || n === 'moteur de base') return true;
    if (/^(\d+\s+)?moteurs?\s+de\s+base$/.test(n)) return true;
    if (/^ceux?\s+de\s+base$/.test(n)) return true;
    return false;
  }

  static getMotorLabelForModel(model) {
    return String(model?.motorizationBase || '').trim();
  }

  static resolveImportMinorationPosteModelIdsForOpt(opt, models) {
    const list = Array.isArray(models) ? models : [];
    const allIds = list.map((m) => String(m?.id || '').trim()).filter(Boolean);
    const fromLabel = UgapImportAssignmentService.modelIdsFromExplicitLabelPostes(opt?.name, list);
    const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    const hasLabelPostes = UgapImportAssignmentService.getExplicitPosteSetFromLabel(opt?.name) !== null;

    if (cm.length && allIds.length > 1 && cm.length >= allIds.length) {
      if (!hasLabelPostes) return fromLabel;
      if (fromLabel.length && fromLabel.length < cm.length) return fromLabel;
    }
    if (cm.length) return cm;
    return fromLabel;
  }

  /**
   * Nom affiché IBP — aligné onglet import « Options de base » (motorisation modèle, champ Option…).
   */
  static resolveImportBaseProductDisplayName(opt, models = []) {
    if (!opt || typeof opt !== 'object') return 'de base';

    const custom = String(opt.importOptionLabel || '').trim();
    if (custom && !this.isGenericBasePlaceholderLabel(custom)) return custom;

    if (isMotorBaseNonSupplyMinoration(opt?.name)) {
      const modelList = Array.isArray(models) ? models : [];
      const targets = this.resolveImportMinorationPosteModelIdsForOpt(opt, modelList)
        .map((id) => modelList.find((m) => String(m?.id || '').trim() === id))
        .filter(Boolean)
        .sort((a, b) => {
          const na = Number(a?.posteNumber);
          const nb = Number(b?.posteNumber);
          if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
          return 0;
        });
      for (const model of targets) {
        const lab = this.getMotorLabelForModel(model);
        if (lab && !this.isGenericBasePlaceholderLabel(lab)) return lab;
      }
    }

    const parsed = UgapExcelService.parseBaseReplacementProducts(opt?.name);
    const finalP = String(parsed?.finalProduct || '').trim();
    const initialP = String(parsed?.initialProduct || '').trim();
    // initial = équipement de base remplacé ; final = nouveau (ligne « en remplacement de »).
    if (initialP && !this.isGenericBasePlaceholderLabel(initialP)) return initialP;
    if (finalP && !this.isGenericBasePlaceholderLabel(finalP)) return finalP;

    const rep = parseReplacementFromLabel(opt?.name);
    const newO = String(rep?.newObject || '').trim();
    const repO = String(rep?.replacedObject || '').trim();
    if (repO && !this.isGenericBasePlaceholderLabel(repO)) return repO;
    if (newO && !this.isGenericBasePlaceholderLabel(newO)) return newO;

    const name = String(opt?.name || '')
      .replace(/^\d{5,}\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name && !this.isGenericBasePlaceholderLabel(name)) return name;

    return 'de base';
  }

  static enrichImportBaseProductRowFromSourceOption(bp, sourceOpt, models = []) {
    if (!bp || !sourceOpt) return bp;
    if (bp.labelCustomized === true) return bp;
    const display = this.resolveImportBaseProductDisplayName(sourceOpt, models);
    const current = String(bp.label || bp.baseOptionName || '').trim();
    const hasCustomLabel = current && !this.isGenericBasePlaceholderLabel(current);
    if (!hasCustomLabel && display && !this.isGenericBasePlaceholderLabel(display)) {
      bp.label = display;
      bp.baseOptionName = display;
    }
    if (!String(bp.excelLabel || '').trim() && sourceOpt.name) {
      bp.excelLabel = String(sourceOpt.name).trim();
    }
    return bp;
  }

  /**
   * Prix inclus pour une option de base matérialisée (moteur = pricesByModelId / price du registre).
   */
  static resolveImportBaseProductMaterializedPricing(bp) {
    const row = bp && typeof bp === 'object' ? bp : {};
    const modelIds = Array.isArray(row.modelIds)
      ? row.modelIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const pricesByModelId = {};
    const raw = row.pricesByModelId && typeof row.pricesByModelId === 'object' ? row.pricesByModelId : {};
    modelIds.forEach((mid) => {
      const v = Number(raw[mid]);
      if (Number.isFinite(v)) pricesByModelId[mid] = v;
    });
    if (!Object.keys(pricesByModelId).length) {
      const fixed = Number(row.price);
      if (Number.isFinite(fixed) && modelIds.length) {
        modelIds.forEach((mid) => {
          pricesByModelId[mid] = fixed;
        });
      }
    }

    const priceVals = modelIds.map((mid) => pricesByModelId[mid]).filter((v) => Number.isFinite(v));
    const distinct = [...new Set(priceVals.map((v) => Number(v.toFixed(2))))];
    const pricingMode = row.pricingMode === 'per_model' && distinct.length > 1
      ? 'per_model'
      : 'fixed';
    const baseIncludedPrice = pricingMode === 'fixed' && distinct.length === 1
      ? distinct[0]
      : (distinct.length === 1 ? distinct[0] : 0);

    return {
      pricingMode,
      pricesByModelId,
      baseIncludedPrice: Number.isFinite(baseIncludedPrice) ? baseIncludedPrice : 0,
      priceUgap: Number.isFinite(baseIncludedPrice) ? baseIncludedPrice : 0
    };
  }

  /**
   * Injecte les motorisations des modèles validés dans importBaseProducts (côté serveur à la publication).
   */
  static ensureMotorImportBaseProductsFromModels(importBaseProducts, models, opts = {}) {
    const dedupeByLabel = opts?.dedupeByLabel === true;
    let products = this.normalizeImportBaseProductsRows(importBaseProducts);
    if (dedupeByLabel) {
      products = this.dedupeImportBaseProductsByKey(products);
    }
    const list = Array.isArray(models) ? models : [];
    if (!list.length) return products;

    list.forEach((model) => {
      const motor = String(model?.motorizationBase || '').trim();
      const mid = String(model?.id || '').trim();
      if (!motor || !mid) return;

      const key = this.buildMotorBaseProductRegistryKey(motor, model);
      if (!key) return;

      let bp = products.find(
        (p) => (p.modelIds || []).length === 1
          && String(p.modelIds[0]) === mid
          && this.isImportMotorBaseProductRow(p)
      );
      if (!bp) bp = products.find((p) => String(p.key || '') === key);
      if (!bp) {
        bp = {
          id: `bp_motor_${key.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 28)}`,
          key,
          label: motor,
          pricingMode: 'fixed',
          price: null,
          pricesByModelId: {},
          optionIds: [],
          modelIds: [],
          catalogOptionId: ''
        };
        products.push(bp);
      }

      bp.key = key;
      const currentLabel = String(bp.label || bp.baseOptionName || '').trim();
      if (bp.labelCustomized !== true && (!currentLabel || this.isGenericBasePlaceholderLabel(currentLabel))) {
        bp.label = motor;
        bp.baseOptionName = motor;
      }
      if (!bp.modelIds.includes(mid)) bp.modelIds.push(mid);

      const boatBase = Number(model?.basePrice);
      if (Number.isFinite(boatBase) && boatBase > 0 && bp.pricesByModelId[mid] == null) {
        bp.pricesByModelId[mid] = boatBase;
      }
      if (bp.pricingMode !== 'per_model') {
        const vals = (bp.modelIds || [])
          .map((m) => Number(bp.pricesByModelId?.[m]))
          .filter(Number.isFinite);
        const distinct = [...new Set(vals.map((v) => Number(v.toFixed(2))))];
        if (distinct.length === 1) {
          bp.pricingMode = 'fixed';
          bp.price = distinct[0];
        } else if (distinct.length > 1) {
          bp.pricingMode = 'per_model';
          bp.price = null;
        }
      }
    });

    products = this.dedupeImportMotorBaseProductsByModel(products);
    return dedupeByLabel ? this.dedupeImportBaseProductsByKey(products) : products;
  }

  /** Fusionne les bases moteur doublons pour un même poste (un bateau = un moteur de base). */
  static dedupeImportMotorBaseProductsByModel(baseProducts) {
    const products = Array.isArray(baseProducts) ? baseProducts.map((p) => ({ ...p })) : [];
    const keeperByModel = new Map();
    const out = [];

    products.forEach((bp) => {
      const isMotor = this.isImportMotorBaseProductRow(bp);
      const mids = [...new Set((bp.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
      if (!isMotor || mids.length !== 1) {
        out.push(bp);
        return;
      }
      const mid = mids[0];
      const keeper = keeperByModel.get(mid);
      if (!keeper) {
        keeperByModel.set(mid, bp);
        out.push(bp);
        return;
      }
      keeper.optionIds = [...new Set([...(keeper.optionIds || []), ...(bp.optionIds || [])])];
      keeper.modelIds = [...new Set([...(keeper.modelIds || []), ...(bp.modelIds || [])])];
      Object.assign(keeper.pricesByModelId || {}, bp.pricesByModelId || {});
      if (!keeper.catalogOptionId && bp.catalogOptionId) keeper.catalogOptionId = bp.catalogOptionId;
      const keeperLabel = String(keeper.label || keeper.baseOptionName || '').trim();
      const bpLabel = String(bp.label || bp.baseOptionName || '').trim();
      const keeperCustom = keeper.labelCustomized === true;
      const bpCustom = bp.labelCustomized === true;
      if (bpCustom && !keeperCustom) {
        keeper.label = bpLabel;
        keeper.baseOptionName = bpLabel;
        keeper.labelCustomized = true;
      } else if (!keeperCustom && !bpCustom) {
        if (bpLabel && this.isImportMotorBaseProductLabel(bpLabel) && !this.isImportMotorBaseProductLabel(keeperLabel)) {
          keeper.label = bpLabel;
          keeper.baseOptionName = bpLabel;
        } else if (bpLabel && (!keeperLabel || this.isGenericBasePlaceholderLabel(keeperLabel))) {
          keeper.label = bpLabel;
          keeper.baseOptionName = bpLabel;
        } else if (bpLabel && (!keeperLabel || keeperLabel.length < bpLabel.length)) {
          keeper.label = bpLabel;
          keeper.baseOptionName = bpLabel;
        }
      }
      if (bp.key) keeper.key = bp.key;
    });

    return out;
  }

  static buildOptionByIdFromCategories(categories = []) {
    const optionById = new Map();
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const id = String(opt?.id || '').trim();
        if (id) optionById.set(id, opt);
      });
    });
    return optionById;
  }

  /**
   * Ligne Excel catalogue déjà présente : on la réutilise comme cible base
   * (pas de doublon opt_ibp_*).
   */
  static isReusableCatalogueLineForBaseProduct(opt) {
    if (!opt || typeof opt !== 'object') return false;
    if (opt.importGeneratedFromBaseProduct === true) return false;
    const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
    if (/\ben\s+remplacement\b/i.test(name) || /\blieu\s+et\s+place\b/i.test(name)) return false;
    const kind = String(opt.importOptionLineKind || '').trim().toLowerCase();
    if (kind === 'minoration' || kind === 'majoration' || kind === 'pr') return false;
    if (this.isCatalogMotorTarifOptionName(name)) return false;
    return true;
  }

  static buildOptionByIdFromImportOptions(importOptions = []) {
    const optionById = new Map();
    (Array.isArray(importOptions) ? importOptions : []).forEach((opt) => {
      const id = String(opt?.id || '').trim();
      if (id) optionById.set(id, opt);
    });
    return optionById;
  }

  static findCatalogueOptionIdForBaseProduct(bp, optionById, sourceOpt = null) {
    const presetId = String(bp?.catalogOptionId || '').trim();
    if (presetId) {
      const preset = optionById.get(presetId);
      if (preset && this.isReusableCatalogueLineForBaseProduct(preset)) return presetId;
    }
    const keys = new Set();
    const addKey = (label) => {
      const k = this.normalizeImportBaseProductKey(label);
      if (k && !this.isGenericBasePlaceholderLabel(label)) keys.add(k);
    };
    addKey(bp?.label);
    addKey(bp?.baseOptionName);
    if (sourceOpt && typeof sourceOpt === 'object') {
      const parsed = UgapExcelService.parseBaseReplacementProducts(sourceOpt.name);
      addKey(parsed?.initialProduct);
    }
    for (const labelKey of keys) {
      for (const [id, opt] of optionById.entries()) {
        if (!this.isReusableCatalogueLineForBaseProduct(opt)) continue;
        if (this.normalizeImportBaseProductKey(opt?.name) === labelKey) return id;
      }
    }
    return '';
  }

  static linkBaseProductToCatalogueOption(opt, bp, catalogId) {
    if (!opt || typeof opt !== 'object') return;
    const bpId = String(bp?.id || '').trim();
    const cid = String(catalogId || opt?.id || '').trim();
    if (bpId) opt.importBaseProductId = bpId;
    if (bp?.label) opt.baseProductLabel = String(bp.label).trim();
    if (cid) opt.linkedBaseCatalogOptionId = cid;
    delete opt.importGeneratedFromBaseProduct;
    delete opt.isBaseOption;
    delete opt.baseIncluded;
    delete opt.manualBaseOption;
    this.applyBaseOptionTag(opt);
  }

  /** Ne jamais réutiliser une ligne tarif moteur catalogue comme option IBP. */
  static resolveImportBaseProductCatalogOptionId(bp, optionById, allIds) {
    const products = bp && typeof bp === 'object' ? bp : {};
    let catalogId = String(products.catalogOptionId || '').trim();
    const existing = catalogId ? optionById.get(catalogId) : null;

    if (catalogId && existing && this.isReusableCatalogueLineForBaseProduct(existing)) {
      allIds.add(catalogId);
      return catalogId;
    }

    const srcOid = String((products.optionIds || [])[0] || '').trim();
    const sourceOpt = srcOid ? optionById.get(srcOid) : null;
    const byLabel = this.findCatalogueOptionIdForBaseProduct(products, optionById, sourceOpt);
    if (byLabel) {
      allIds.add(byLabel);
      return byLabel;
    }

    if (
      catalogId
      && (
        !allIds.has(catalogId)
        || !existing
        || existing.importGeneratedFromBaseProduct !== true
        || this.isCatalogMotorTarifOptionName(existing.name)
      )
    ) {
      catalogId = '';
    }
    if (!catalogId) {
      const keySlug = String(products.key || this.normalizeImportBaseProductKey(products.label))
        .replace(/[^a-zA-Z0-9_]+/g, '_')
        .slice(0, 48) || String(products.id || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
      const base = `opt_ibp_${keySlug}`;
      catalogId = base;
      let n = 0;
      while (allIds.has(catalogId)) catalogId = `${base}_${++n}`;
    }
    allIds.add(catalogId);
    return catalogId;
  }

  /** Fusionne les lignes au même `key` avant création catalogue (un article, pas N). */
  static dedupeImportBaseProductsByKey(baseProducts) {
    const map = new Map();
    (Array.isArray(baseProducts) ? baseProducts : []).forEach((row) => {
      const key = String(row?.key || '').trim() || this.normalizeImportBaseProductKey(row?.label);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          ...row,
          optionIds: [...(row.optionIds || [])],
          modelIds: [...(row.modelIds || [])],
          pricesByModelId: { ...(row.pricesByModelId || {}) },
          aliases: [...(row.aliases || [])]
        });
        return;
      }
      const t = map.get(key);
      t.optionIds = [...new Set([...(t.optionIds || []), ...(row.optionIds || [])])];
      t.modelIds = [...new Set([...(t.modelIds || []), ...(row.modelIds || [])])];
      Object.assign(t.pricesByModelId, row.pricesByModelId || {});
      (row.aliases || []).forEach((a) => {
        const s = String(a || '').trim();
        if (s && !(t.aliases || []).includes(s)) {
          if (!t.aliases) t.aliases = [];
          t.aliases.push(s);
        }
      });
      if (!t.catalogOptionId && row.catalogOptionId) t.catalogOptionId = row.catalogOptionId;
      Object.keys(t.pricesByModelId || {}).forEach((k) => {
        if (!t.modelIds.includes(String(k))) delete t.pricesByModelId[k];
      });
      const priceVals = (t.modelIds || [])
        .map((mid) => Number(t.pricesByModelId?.[mid]))
        .filter(Number.isFinite);
      const distinct = [...new Set(priceVals.map((v) => Number(v.toFixed(2))))];
      if (t.modelIds.length <= 1) {
        t.pricingMode = 'fixed';
        t.price = distinct.length ? distinct[0] : (Number.isFinite(Number(t.price)) ? Number(t.price) : null);
        if (t.modelIds.length === 1 && t.price != null) {
          t.pricesByModelId = { [t.modelIds[0]]: t.price };
        }
      } else if (distinct.length > 1) {
        t.pricingMode = 'per_model';
        t.price = null;
      } else if (distinct.length === 1) {
        t.pricingMode = 'fixed';
        t.price = distinct[0];
      }
    });
    return [...map.values()];
  }

  static pruneOrphanImportBaseCatalogOptions(categories, importBaseProducts) {
    return this.stripStalePublishedImportGeneratedOptions(categories, importBaseProducts);
  }

  static normalizeImportBaseProductsRows(baseProducts) {
    return (Array.isArray(baseProducts) ? baseProducts : []).map((row) => {
      const pricesByModelId = {};
      const rawPrices = row?.pricesByModelId && typeof row.pricesByModelId === 'object' ? row.pricesByModelId : {};
      Object.keys(rawPrices).forEach((mid) => {
        const v = Number(rawPrices[mid]);
        if (Number.isFinite(v)) pricesByModelId[String(mid)] = v;
      });
      const priceRaw = row?.price;
      const price = priceRaw === '' || priceRaw == null ? null : Number(priceRaw);
      const baseOptionName = String(row?.baseOptionName || row?.label || '').trim() || 'de base';
      const excelLabel = String(row?.excelLabel || '').trim();
      const priceClientRaw = row?.priceClient;
      const priceUgapRaw = row?.priceUgap;
      const priceClient = priceClientRaw === '' || priceClientRaw == null ? null : Number(priceClientRaw);
      const priceUgap = priceUgapRaw === '' || priceUgapRaw == null ? null : Number(priceUgapRaw);
      return {
        id: String(row?.id || '').trim() || `bp_${Date.now()}`,
        key: String(row?.key || '').trim(),
        label: String(row?.label || baseOptionName).trim() || 'de base',
        baseOptionName,
        labelCustomized: row?.labelCustomized === true,
        excelLabel,
        priceClient: Number.isFinite(priceClient) ? priceClient : null,
        priceUgap: Number.isFinite(priceUgap) ? priceUgap : null,
        pricingMode: row?.pricingMode === 'per_model' ? 'per_model' : 'fixed',
        price: Number.isFinite(price) ? price : null,
        pricesByModelId,
        optionIds: Array.isArray(row?.optionIds) ? row.optionIds.map((x) => String(x || '').trim()).filter(Boolean) : [],
        modelIds: Array.isArray(row?.modelIds) ? row.modelIds.map((x) => String(x || '').trim()).filter(Boolean) : [],
        aliases: Array.isArray(row?.aliases) ? row.aliases.map((x) => String(x || '').trim()).filter(Boolean) : [],
        catalogOptionId: String(row?.catalogOptionId || '').trim()
      };
    }).filter((row) => {
      const hasName = String(row.label || row.baseOptionName || '').trim();
      return hasName || (row.optionIds || []).length > 0 || (row.modelIds || []).length > 0;
    });
  }

  /** Postes : modelIds saisis, croix Excel des mino liées, libellé, sinon tous les modèles. */
  static resolveImportBaseProductModelIds(bp, models, stagingById) {
    const list = Array.isArray(models) ? models : [];
    const allIds = list.map((m) => String(m?.id || '').trim()).filter(Boolean);
    const explicitIds = [...new Set((bp?.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
    if (explicitIds.length) return explicitIds;

    const fromOpts = new Set();
    (bp?.optionIds || []).forEach((oid) => {
      const opt = stagingById instanceof Map ? stagingById.get(String(oid)) : null;
      (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .forEach((mid) => fromOpts.add(mid));
    });
    if (fromOpts.size) return [...fromOpts];

    const labels = [
      bp?.excelLabel,
      bp?.label,
      ...(Array.isArray(bp?.aliases) ? bp.aliases : [])
    ].map((x) => String(x || '').trim()).filter(Boolean);
    (bp?.optionIds || []).forEach((oid) => {
      const opt = stagingById instanceof Map ? stagingById.get(String(oid)) : null;
      if (opt?.name) labels.push(String(opt.name).trim());
    });
    for (let i = 0; i < labels.length; i += 1) {
      const explicit = UgapImportAssignmentService.getExplicitPosteSetFromLabel(labels[i]);
      if (explicit && explicit.size) {
        return list
          .filter((m) => explicit.has(Number(m?.posteNumber)))
          .map((m) => String(m?.id || '').trim())
          .filter(Boolean);
      }
    }

    return [];
  }

  /**
   * Prépare importBaseProducts pour publication : lignes enregistrées (étape 4) conservées 1:1.
   * Si vide, génère 1 ligne par mino/majo source (sans fusion sur le libellé).
   */
  static prepareImportBaseProductsForPublish(savedProducts, importOptions, models, stagingById) {
    const list = Array.isArray(models) ? models : [];
    const stagingMap = stagingById instanceof Map
      ? stagingById
      : this.buildOptionByIdFromImportOptions(stagingById);
    const saved = this.normalizeImportBaseProductsRows(savedProducts);

    const onePerLine = this.buildImportBaseProductRowsOnePerSourceLine(importOptions, models, stagingMap);

    if (saved.length > 0) {
      const bySourceOpt = new Map();
      saved.forEach((bp) => {
        (bp.optionIds || []).forEach((oid) => {
          const id = String(oid || '').trim();
          if (id) bySourceOpt.set(id, bp);
        });
      });
      onePerLine.forEach((gen) => {
        const oid = String((gen.optionIds || [])[0] || '').trim();
        if (oid && !bySourceOpt.has(oid)) {
          saved.push(gen);
          bySourceOpt.set(oid, gen);
        }
      });
      return saved.map((bp) => {
        const next = { ...bp };
        const srcOid = String((next.optionIds || [])[0] || '').trim();
        const srcOpt = srcOid ? stagingMap.get(srcOid) : null;
        if (srcOpt && next.labelCustomized !== true) {
          this.enrichImportBaseProductRowFromSourceOption(next, srcOpt, list);
        }
        next.modelIds = this.resolveImportBaseProductModelIds(next, list, stagingMap);
        if (!String(next.label || '').trim()) next.label = 'de base';
        if (!String(next.baseOptionName || '').trim()) next.baseOptionName = next.label;
        return next;
      });
    }

    return onePerLine;
  }

  /** 1 importBaseProducts par ligne mino/majo (clé src_opt_N), aligné onglet Détection. */
  static buildImportBaseProductRowsOnePerSourceLine(importOptions, models, stagingById) {
    const list = Array.isArray(models) ? models : [];
    const stagingMap = stagingById instanceof Map
      ? stagingById
      : this.buildOptionByIdFromImportOptions(stagingById);
    const minos = [];
    const majos = [];
    (Array.isArray(importOptions) ? importOptions : []).forEach((opt) => {
      if (opt?.importGeneratedFromBaseProduct === true) return;
      const kind = this.resolveEffectiveImportLineKind(opt);
      const line = {
        rowIndex: Number(opt?.rowOrder) || 0,
        label: String(opt?.name || '').trim(),
        refUgap: String(opt?.refUgap || '').trim(),
        priceClient: opt?.priceClient,
        priceUgap: opt?.priceUgap,
        compatibleModelIds: (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
          .map((x) => String(x || '').trim())
          .filter(Boolean),
        motorName: String(opt?.finalProduct || opt?.initialProduct || '').trim()
      };
      if (kind === 'minoration') minos.push(line);
      else if (kind === 'majoration') majos.push(line);
    });

    const derived = buildBaseOptions(minos, majos, list);
    const out = [];

    derived.forEach((row) => {
      const sourceRowIndex = Number(row.sourceRowIndex);
      const sourceOptId = Number.isFinite(sourceRowIndex) && sourceRowIndex > 0
        ? `opt_${sourceRowIndex}`
        : '';
      const baseOptionName = String(row.baseOptionName || '').trim() || 'de base';
      const excelLabel = String(row.label || '').trim();
      const key = sourceOptId ? `src_${sourceOptId}` : String(row.id || `bp_${out.length}`);

      const bp = {
        id: `bp_${key.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 40)}`,
        key,
        label: baseOptionName,
        baseOptionName,
        excelLabel,
        pricingMode: 'fixed',
        price: null,
        pricesByModelId: {},
        priceClient: null,
        priceUgap: null,
        optionIds: sourceOptId ? [sourceOptId] : [],
        modelIds: [...(row.compatibleModelIds || [])],
        aliases: [],
        catalogOptionId: ''
      };
      const pc = Number(row.priceClient);
      const pu = Number(row.priceUgap);
      if (Number.isFinite(pc)) {
        bp.priceClient = pc;
        bp.price = pc;
      }
      if (Number.isFinite(pu)) bp.priceUgap = pu;
      out.push(bp);
    });

    return out.map((bp) => {
      const next = { ...bp };
      const srcOid = String((next.optionIds || [])[0] || '').trim();
      const srcOpt = srcOid ? stagingMap.get(srcOid) : null;
      if (srcOpt) this.enrichImportBaseProductRowFromSourceOption(next, srcOpt, list);
      next.modelIds = this.resolveImportBaseProductModelIds(next, list, stagingMap);
      if (!String(next.label || '').trim()) next.label = 'de base';
      if (!String(next.baseOptionName || '').trim()) next.baseOptionName = next.label;
      return next;
    });
  }

  /** Payload catalogue : valeurs directes de la ligne importBaseProducts (1:1). */
  static buildCatalogOptionPayloadFromImportBaseProduct(bp, catalogId, models, stagingMap) {
    const row = bp && typeof bp === 'object' ? bp : {};
    const compatibleModels = this.resolveImportBaseProductModelIds(row, models, stagingMap);
    row.modelIds = compatibleModels;

    let displayName = String(row.baseOptionName || row.label || '').trim() || 'de base';
    if (this.isGenericBasePlaceholderLabel(displayName)) {
      const srcOid = String((row.optionIds || [])[0] || '').trim();
      const srcOpt = srcOid && stagingMap instanceof Map ? stagingMap.get(srcOid) : null;
      if (srcOpt) {
        const resolved = this.resolveImportBaseProductDisplayName(srcOpt, models);
        if (resolved && !this.isGenericBasePlaceholderLabel(resolved)) displayName = resolved;
      }
    }
    const excelLabel = String(row.excelLabel || '').trim();
    let priceClient = Number(row.priceClient);
    let priceUgap = Number(row.priceUgap);
    if (!Number.isFinite(priceClient)) priceClient = Number(row.price);
    if (!Number.isFinite(priceUgap)) priceUgap = priceClient;

    const pricesByModelId = {};
    const raw = row.pricesByModelId && typeof row.pricesByModelId === 'object' ? row.pricesByModelId : {};
    compatibleModels.forEach((mid) => {
      const v = Number(raw[mid]);
      if (Number.isFinite(v)) pricesByModelId[mid] = v;
    });
    if (!Object.keys(pricesByModelId).length && Number.isFinite(priceClient) && compatibleModels.length) {
      compatibleModels.forEach((mid) => {
        pricesByModelId[mid] = priceClient;
      });
    }

    const priceVals = Object.values(pricesByModelId).filter(Number.isFinite);
    const distinct = [...new Set(priceVals.map((v) => Number(v.toFixed(2))))];
    const pricingMode = row.pricingMode === 'per_model' && distinct.length > 1 ? 'per_model' : 'fixed';
    let baseIncludedPrice = Number.isFinite(priceUgap) ? priceUgap : priceClient;
    if (!Number.isFinite(baseIncludedPrice) && distinct.length === 1) baseIncludedPrice = distinct[0];
    if (!Number.isFinite(baseIncludedPrice)) baseIncludedPrice = 0;
    if (!Number.isFinite(priceClient)) priceClient = baseIncludedPrice;
    if (!Number.isFinite(priceUgap)) priceUgap = baseIncludedPrice;

    const linkedMinorationOptions = this.buildLinkedMinorationSnapshots(row, stagingMap);
    const sourceOptionIds = linkedMinorationOptions.map((x) => x.optionId).filter(Boolean);
    const details = excelLabel && excelLabel !== displayName ? excelLabel : '';

    const payload = {
      id: catalogId,
      name: displayName,
      details,
      importExcelLabel: excelLabel,
      refUgap: `IBP-${String(row.id).slice(0, 32)}`,
      compatibleModels,
      priceUgap,
      priceClient,
      baseIncluded: true,
      isBaseOption: true,
      manualBaseOption: true,
      baseIncludedPrice,
      importGeneratedFromBaseProduct: true,
      importBaseProductId: row.id,
      importBaseProductSourceOptionIds: sourceOptionIds,
      linkedMinorationOptions,
      isMinoration: false,
      isSparePart: false,
      isDivers: false,
      importOptionLineKind: 'option',
      importBaseProductPricingMode: pricingMode
    };
    if (pricingMode === 'per_model' && Object.keys(pricesByModelId).length) {
      payload.importBaseProductPricesByModelId = { ...pricesByModelId };
    }
    return payload;
  }

  static IMPORT_BASE_PRODUCTS_CATEGORY_ID = 'cat_options_de_base_import';

  /**
   * Crée ou met à jour une option de base publiée (opt_ibp_*) pour chaque importBaseProducts.
   */
  static materializeImportBaseProductsAsCatalogOptions(categories, importBaseProducts, stagingById, models = []) {
    const cats = Array.isArray(categories) ? categories : [...categories];
    const products = this.normalizeImportBaseProductsRows(importBaseProducts);
    const stagingMap = stagingById instanceof Map
      ? stagingById
      : this.buildOptionByIdFromImportOptions(stagingById);
    if (!products.length) {
      return { categories: cats, importBaseProducts: products };
    }

    const catId = this.IMPORT_BASE_PRODUCTS_CATEGORY_ID;
    let targetCat = cats.find((c) => String(c?.id || '') === catId);
    if (!targetCat) {
      targetCat = {
        id: catId,
        name: 'Options de base (import)',
        options: [],
        subCategories: [],
        selectionRules: {},
        businessViewIds: [],
        familyIds: []
      };
      cats.push(targetCat);
    }

    const options = Array.isArray(targetCat.options) ? targetCat.options : [];
    const globalOptionById = this.buildOptionByIdFromCategories(cats);
    const allIds = new Set(
      cats.flatMap((c) => (Array.isArray(c?.options) ? c.options : []))
        .map((o) => String(o?.id || '').trim())
        .filter(Boolean)
    );

    const modelList = Array.isArray(models) ? models : [];

    products.forEach((bp) => {
      const catalogId = this.allocatePublishedBaseProductOptionId(bp, globalOptionById, allIds);
      bp.catalogOptionId = catalogId;
      const payload = this.buildCatalogOptionPayloadFromImportBaseProduct(
        bp,
        catalogId,
        modelList,
        stagingMap
      );

      const existingIbp = options.find((o) => String(o?.id || '').trim() === catalogId);
      if (existingIbp) {
        const merged = this.normalizeOption({ ...existingIbp, ...payload });
        Object.assign(existingIbp, merged);
        globalOptionById.set(catalogId, existingIbp);
      } else {
        const normalized = this.normalizeOption(payload);
        options.push(normalized);
        globalOptionById.set(catalogId, normalized);
      }
    });

    targetCat.options = options;
    return { categories: cats, importBaseProducts: products };
  }

  static pruneOrphanImportBaseStagingOptions(importOptions, importBaseProducts) {
    const options = Array.isArray(importOptions) ? importOptions : [];
    const products = Array.isArray(importBaseProducts) ? importBaseProducts : [];
    const activeBpIds = new Set(products.map((p) => String(p?.id || '').trim()).filter(Boolean));
    const activeCatIds = new Set(
      products.map((p) => String(p?.catalogOptionId || '').trim()).filter(Boolean)
    );
    return options.filter((opt) => {
      if (opt?.importGeneratedFromBaseProduct !== true) return true;
      const bpId = String(opt?.importBaseProductId || '').trim();
      const oid = String(opt?.id || '').trim();
      if (bpId && activeBpIds.has(bpId)) return true;
      if (oid && activeCatIds.has(oid)) return true;
      return false;
    });
  }

  static materializeImportBaseProductsAsStagingOptions(importOptions, importBaseProducts) {
    const options = Array.isArray(importOptions) ? importOptions.map((o) => ({ ...o })) : [];
    const products = this.normalizeImportBaseProductsRows(importBaseProducts);
    if (!products.length) {
      return { importOptions: options, importBaseProducts: products };
    }

    const optionById = new Map(
      options.map((o) => [String(o?.id || '').trim(), o]).filter(([id]) => id)
    );
    const allIds = new Set(options.map((o) => String(o?.id || '').trim()).filter(Boolean));

    products.forEach((bp) => {
      const catalogId = this.resolveImportBaseProductCatalogOptionId(bp, optionById, allIds);
      bp.catalogOptionId = catalogId;

      const existing = optionById.get(catalogId);
      if (existing && this.isReusableCatalogueLineForBaseProduct(existing)) {
        this.linkBaseProductToCatalogueOption(existing, bp, catalogId);
        return;
      }

      const compatibleModels = Array.isArray(bp.modelIds)
        ? bp.modelIds.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const pricing = this.resolveImportBaseProductMaterializedPricing(bp);

      const payload = {
        id: catalogId,
        name: String(bp.label || '').trim() || 'Option de base',
        refUgap: `IBP-${String(bp.id).slice(0, 32)}`,
        compatibleModels,
        priceUgap: pricing.priceUgap,
        priceClient: 0,
        baseIncluded: true,
        isBaseOption: true,
        manualBaseOption: true,
        baseIncludedPrice: pricing.baseIncludedPrice,
        importGeneratedFromBaseProduct: true,
        importBaseProductId: bp.id,
        importBaseProductSourceOptionIds: [...(bp.optionIds || [])],
        isMinoration: false,
        isSparePart: false,
        isDivers: false,
        importOptionLineKind: 'option',
        importBaseProductPricingMode: pricing.pricingMode
      };
      if (pricing.pricingMode === 'per_model' && Object.keys(pricing.pricesByModelId).length) {
        payload.importBaseProductPricesByModelId = { ...pricing.pricesByModelId };
      }

      if (existing) {
        Object.assign(existing, payload);
      } else {
        const normalized = this.normalizeOption(payload);
        options.push(normalized);
        optionById.set(catalogId, normalized);
      }
    });

    return { importOptions: options, importBaseProducts: products };
  }

  static applyImportBaseProductsToStagingOptions(importOptions, importBaseProducts) {
    const optionToBase = new Map();
    const catalogByBaseId = new Map();
    (importBaseProducts || []).forEach((bp) => {
      (bp.optionIds || []).forEach((oid) => optionToBase.set(oid, bp.id));
      if (bp.catalogOptionId) catalogByBaseId.set(bp.id, bp.catalogOptionId);
    });
    (Array.isArray(importOptions) ? importOptions : []).forEach((opt) => {
      const oid = String(opt?.id || '').trim();
      if (opt?.importGeneratedFromBaseProduct) return;
      if (opt?.importExcludeFromBaseProduct) {
        delete opt.baseProductId;
        delete opt.baseProductLabel;
        delete opt.linkedBaseCatalogOptionId;
        return;
      }
      const bpId = optionToBase.get(oid);
      if (!bpId) {
        delete opt.baseProductId;
        delete opt.baseProductLabel;
        delete opt.linkedBaseCatalogOptionId;
        return;
      }
      opt.baseProductId = bpId;
      const bp = importBaseProducts.find((x) => x.id === bpId);
      if (bp?.label) opt.baseProductLabel = bp.label;
      else delete opt.baseProductLabel;
      const catalogId = catalogByBaseId.get(bpId) || bp?.catalogOptionId;
      if (catalogId) opt.linkedBaseCatalogOptionId = catalogId;
      else delete opt.linkedBaseCatalogOptionId;
    });
  }

  static applyPublishFlagsFromSavedStateToOptions(importOptions) {
    (Array.isArray(importOptions) ? importOptions : []).forEach((opt) => {
      if (opt?.importGeneratedFromBaseProduct) return;
      this.applyImportOptionLineKindToOption(opt, this.resolveEffectiveImportLineKind(opt));
    });
  }

  static runStagingImportOptionsPipeline(document, importBaseProducts) {
    let importOptions = this.getStagingImportOptions(document);
    const products = this.normalizeImportBaseProductsRows(
      importBaseProducts ?? document.importBaseProducts ?? []
    );
    this.applyImportBaseProductsToStagingOptions(importOptions, products);
    this.clearMotorCatalogTarifBaseFlagsOnOptions(importOptions);
    const draft = this.stagingDocWithImportOptions(document, importOptions);
    draft.importBaseProducts = products;
    return UgapImportAssignmentService.applyStagingAssignments(draft);
  }

  static isAdjOptionEligibleForBaseProductLink(opt) {
    if (!opt || typeof opt !== 'object') return false;
    if (opt.importGeneratedFromBaseProduct === true) return false;
    if (opt.importExcludeFromBaseProduct === true) return false;
    const kind = this.resolveEffectiveImportLineKind(opt);
    return kind === 'minoration' || kind === 'majoration';
  }

  static findImportBaseProductForCatalogOption(importBaseProducts, catalogOptionId) {
    const cid = String(catalogOptionId || '').trim();
    if (!cid) return null;
    const products = Array.isArray(importBaseProducts) ? importBaseProducts : [];
    return products.find((bp) => String(bp?.catalogOptionId || '').trim() === cid) || null;
  }

  /**
   * Met à jour les mino/majo liées à une option de base publiée (opt_ibp_*).
   */
  static async updateBaseProductAdjLinks(db, entrepriseId, catalogOptionId, linkedOptionIds = []) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) throw new Error('Données non trouvées');

    const baseCatalogId = String(catalogOptionId || '').trim();
    if (!baseCatalogId) throw new Error('catalogOptionId requis');

    const categories = Array.isArray(document.categories) ? document.categories : [];
    const optionById = this.buildOptionByIdFromCategories(categories);
    const baseOpt = optionById.get(baseCatalogId);
    if (!baseOpt || baseOpt.importGeneratedFromBaseProduct !== true) {
      throw new Error('Option de base (IBP) introuvable');
    }

    const linked = [...new Set(
      (Array.isArray(linkedOptionIds) ? linkedOptionIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )].filter((oid) => {
      const adj = optionById.get(oid);
      return adj && this.isAdjOptionEligibleForBaseProductLink(adj);
    });

    linked.forEach((oid) => {
      const adj = optionById.get(oid);
      if (!adj) throw new Error(`Option liée introuvable: ${oid}`);
      if (!this.isAdjOptionEligibleForBaseProductLink(adj)) {
        throw new Error(`Option non éligible (mino/majo uniquement): ${oid}`);
      }
    });

    let products = this.normalizeImportBaseProductsRows(document.importBaseProducts || []);
    let bp = this.findImportBaseProductForCatalogOption(products, baseCatalogId);
    const bpIdFromOpt = String(baseOpt.importBaseProductId || '').trim();
    if (!bp && bpIdFromOpt) {
      bp = products.find((p) => String(p?.id || '').trim() === bpIdFromOpt) || null;
    }
    if (!bp) {
      bp = {
        id: bpIdFromOpt || `bp_cat_${baseCatalogId.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40)}`,
        label: String(baseOpt.name || '').trim() || 'Option de base',
        catalogOptionId: baseCatalogId,
        optionIds: [],
        modelIds: Array.isArray(baseOpt.compatibleModels)
          ? baseOpt.compatibleModels.map((x) => String(x || '').trim()).filter(Boolean)
          : []
      };
      products.push(bp);
    }

    const bpId = String(bp.id || '').trim();
    products = products.map((row) => {
      const next = {
        ...row,
        optionIds: (Array.isArray(row.optionIds) ? row.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean)
      };
      if (String(next.id || '').trim() === bpId) {
        next.optionIds = [...linked];
        next.catalogOptionId = baseCatalogId;
        const srcOpt = linked.length ? optionById.get(linked[0]) : null;
        if (srcOpt?.name) next.excelLabel = String(srcOpt.name).trim();
        return next;
      }
      next.optionIds = next.optionIds.filter((id) => !linked.includes(id));
      return next;
    });

    document.importBaseProducts = products;
    this.applyImportBaseProductsToCategories(document.categories || [], products);

    const stagingMap = this.buildOptionByIdFromCategories(document.categories || []);
    const targetBp = products.find((p) => String(p?.id || '').trim() === bpId);
    const ibp = stagingMap.get(baseCatalogId);
    if (targetBp && ibp) {
      const snapshots = this.buildLinkedMinorationSnapshots(targetBp, stagingMap);
      ibp.linkedMinorationOptions = snapshots;
      ibp.importBaseProductSourceOptionIds = snapshots.map((x) => x.optionId).filter(Boolean);
    }

    await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          categories: document.categories,
          importBaseProducts: document.importBaseProducts,
          updatedAt: new Date()
        }
      }
    );

    return {
      catalogOptionId: baseCatalogId,
      linkedOptionIds: linked,
      importBaseProductId: bpId
    };
  }

  static applyImportBaseProductsToCategories(categories, importBaseProducts) {
    const optionToBase = new Map();
    const catalogByBaseId = new Map();
    (importBaseProducts || []).forEach((bp) => {
      (bp.optionIds || []).forEach((oid) => optionToBase.set(oid, bp.id));
      if (bp.catalogOptionId) catalogByBaseId.set(bp.id, bp.catalogOptionId);
    });
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const oid = String(opt?.id || '').trim();
        if (opt?.importGeneratedFromBaseProduct) return;
        if (opt?.importExcludeFromBaseProduct) {
          delete opt.baseProductId;
          delete opt.baseProductLabel;
          delete opt.linkedBaseCatalogOptionId;
          return;
        }
        const bpId = optionToBase.get(oid);
        if (!bpId) {
          delete opt.baseProductId;
          delete opt.baseProductLabel;
          delete opt.linkedBaseCatalogOptionId;
          return;
        }
        opt.baseProductId = bpId;
        const bp = importBaseProducts.find((x) => x.id === bpId);
        if (bp?.label) opt.baseProductLabel = bp.label;
        else delete opt.baseProductLabel;
        const catalogId = catalogByBaseId.get(bpId) || bp?.catalogOptionId;
        if (catalogId) opt.linkedBaseCatalogOptionId = catalogId;
        else delete opt.linkedBaseCatalogOptionId;
      });
    });
  }

  static async updateImportStagingBaseProducts(db, entrepriseId, importId, baseProducts = []) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');

    const importOptions = this.getStagingImportOptions(document);
    const models = Array.isArray(document.models) ? document.models : [];
    const stagingById = this.buildOptionByIdFromImportOptions(importOptions);
    let products = this.prepareImportBaseProductsForPublish(
      baseProducts,
      importOptions,
      models,
      stagingById
    );
    products = this.ensureMotorImportBaseProductsFromModels(products, models, { dedupeByLabel: false });
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      {
        $set: {
          importBaseProducts: products,
          baseOptionsStatus: 'validated',
          updatedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static applyImportOptionLineKindToOption(opt, kind) {
    const k = String(kind || '').trim().toLowerCase();
    if (!opt || typeof opt !== 'object') return;
    if (k !== 'minoration' && k !== 'majoration' && k !== 'option' && k !== 'pr') return;
    opt.importOptionLineKind = k;
    if (k === 'minoration') {
      opt.isMinoration = true;
      opt.isSparePart = false;
      opt.isDivers = false;
      opt.manualMinorationAssignment = true;
      delete opt.manualMajorationAssignment;
      return;
    }
    if (k === 'majoration') {
      opt.isMinoration = false;
      opt.isSparePart = false;
      opt.isDivers = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.length === 0 : true;
      opt.manualMajorationAssignment = true;
      delete opt.manualMinorationAssignment;
      return;
    }
    if (k === 'pr') {
      opt.isMinoration = false;
      opt.isSparePart = true;
      opt.isDivers = false;
      opt.compatibleModels = [];
      delete opt.manualMajorationAssignment;
      delete opt.manualMinorationAssignment;
      return;
    }
    opt.isMinoration = false;
    opt.isSparePart = false;
    opt.isDivers = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.length === 0 : true;
    delete opt.manualMajorationAssignment;
    delete opt.manualMinorationAssignment;
  }

  static async updateImportStagingOptionsTri(db, entrepriseId, importId, updates = []) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');

    const patchByOptionId = new Map();
    (Array.isArray(updates) ? updates : []).forEach((row) => {
      const optionId = String(row?.optionId || '').trim();
      if (!optionId) return;
      const compatibleModels = Array.isArray(row?.compatibleModels)
        ? row.compatibleModels.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const importOptionLabel = String(row?.importOptionLabel || '').trim();
      const importOptionLineKind = String(row?.importOptionLineKind || '').trim().toLowerCase();
      const importExcludeFromBaseProduct = row?.importExcludeFromBaseProduct === true;
      patchByOptionId.set(optionId, {
        compatibleModels,
        importOptionLabel,
        importOptionLineKind,
        importExcludeFromBaseProduct
      });
    });

    const importOptions = this.getStagingImportOptions(document);
    importOptions.forEach((opt) => {
      const id = String(opt?.id || '').trim();
      if (!patchByOptionId.has(id)) return;
      const patch = patchByOptionId.get(id);
      opt.compatibleModels = Array.isArray(patch.compatibleModels) ? patch.compatibleModels : [];
      const label = String(patch.importOptionLabel || '').trim();
      if (label) opt.importOptionLabel = label;
      else delete opt.importOptionLabel;
      if (patch.importExcludeFromBaseProduct) {
        opt.importExcludeFromBaseProduct = true;
        delete opt.baseProductId;
        delete opt.baseProductLabel;
      }
      if (patch.importOptionLineKind) {
        this.applyImportOptionLineKindToOption(opt, patch.importOptionLineKind);
      }
    });

    const { doc, summary } = UgapImportAssignmentService.applyStagingAssignments(
      this.stagingDocWithImportOptions(document, importOptions)
    );
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      {
        $set: {
          importOptions: doc.importOptions || importOptions,
          categories: [],
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
          'progress.optionsTriCompleted': true,
          updatedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static async updateImportStagingMinorations(db, entrepriseId, importId, updates = [], baseProducts, scope = 'minoration') {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');
    const assignScope = String(scope || 'minoration').toLowerCase() === 'majoration' ? 'majoration' : 'minoration';

    const patchByOptionId = new Map();
    (Array.isArray(updates) ? updates : []).forEach((row) => {
      const optionId = String(row?.optionId || '').trim();
      if (!optionId) return;
      const compatibleModels = Array.isArray(row?.compatibleModels)
        ? row.compatibleModels.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const importOptionLabel = String(row?.importOptionLabel || '').trim();
      const importOptionLineKind = String(row?.importOptionLineKind || '').trim().toLowerCase();
      const importExcludeFromBaseProduct = row?.importExcludeFromBaseProduct === true;
      patchByOptionId.set(optionId, { compatibleModels, importOptionLabel, importOptionLineKind, importExcludeFromBaseProduct });
    });

    let importOptions = this.getStagingImportOptions(document);
    importOptions.forEach((opt) => {
      const id = String(opt?.id || '').trim();
      if (!patchByOptionId.has(id)) return;
      const patch = patchByOptionId.get(id);
      if (Array.isArray(patch)) {
        opt.compatibleModels = patch;
      } else if (patch && typeof patch === 'object') {
        opt.compatibleModels = Array.isArray(patch.compatibleModels) ? patch.compatibleModels : [];
        const label = String(patch.importOptionLabel || '').trim();
        if (label) opt.importOptionLabel = label;
        else delete opt.importOptionLabel;
        if (patch.importExcludeFromBaseProduct) {
          opt.importExcludeFromBaseProduct = true;
          delete opt.baseProductId;
          delete opt.baseProductLabel;
          delete opt.linkedBaseCatalogOptionId;
        }
        if (patch.importOptionLineKind) {
          UgapDataService.applyImportOptionLineKindToOption(opt, patch.importOptionLineKind);
        }
      }
      if (assignScope === 'minoration' && UgapImportAssignmentService.isMinorationLine(opt?.name, opt?.refUgap)) {
        opt.isMinoration = true;
        opt.manualMinorationAssignment = true;
      }
      if (assignScope === 'majoration' && UgapImportAssignmentService.isMajorationLine(opt?.name, opt?.refUgap)) {
        opt.manualMajorationAssignment = true;
      }
    });

    let pipelineDoc = document;
    let importBaseProducts = document.importBaseProducts;
    if (Array.isArray(baseProducts)) {
      const piped = this.runStagingImportOptionsPipeline(
        this.stagingDocWithImportOptions(document, importOptions),
        baseProducts
      );
      pipelineDoc = piped.doc;
      importOptions = piped.doc.importOptions || importOptions;
      importBaseProducts = piped.doc.importBaseProducts;
    } else {
      const { doc: assignedDoc, summary } = UgapImportAssignmentService.applyStagingAssignments(
        this.stagingDocWithImportOptions(document, importOptions)
      );
      pipelineDoc = assignedDoc;
      importOptions = assignedDoc.importOptions || importOptions;
    }

    const $set = {
      importOptions: pipelineDoc.importOptions || importOptions,
      categories: [],
      importAssignmentsSummary: pipelineDoc.importAssignmentsSummary,
      importAssignmentsAppliedAt: pipelineDoc.importAssignmentsAppliedAt,
      updatedAt: new Date()
    };
    if (assignScope === 'majoration') {
      $set.majorationsStatus = 'validated';
    } else {
      $set.minorationsStatus = 'validated';
    }
    if (Array.isArray(baseProducts)) {
      $set.importBaseProducts = importBaseProducts;
      $set.baseOptionsStatus = 'validated';
    }
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      { $set }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static async applyImportStagingAssignments(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');
    const importOptions = this.getStagingImportOptions(document);
    UgapImportAssignmentService.clearMinorationCrossAssignmentsForOptions(importOptions, true);
    const { doc, summary } = UgapImportAssignmentService.applyStagingAssignments(
      this.stagingDocWithImportOptions(document, importOptions)
    );
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      {
        $set: {
          importOptions: doc.importOptions || importOptions,
          categories: [],
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
          updatedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static async markImportOptionsValidated(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    const before = await collection.findOne({ _id, entrepriseId });
    if (!before) throw new Error('Import staging introuvable');
    if (!before.progress?.modelsCompleted) {
      throw new Error('Validez tous les modèles avant de valider les options');
    }
    await collection.updateOne(
      { _id, entrepriseId },
      {
        $set: {
          optionsStatus: 'validated',
          minorationsStatus: 'validated',
          majorationsStatus: 'validated',
          diversStatus: 'validated',
          'progress.optionsCompleted': true,
          status: 'validated',
          updatedAt: new Date()
        }
      }
    );
    const doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) throw new Error('Import staging introuvable');
    return doc;
  }

  /**
   * Conserve le typage et les flags définis aux étapes d'import (sans heuristique publish).
   */
  static applyPublishFlagsFromSavedState(categories) {
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        if (opt?.importGeneratedFromBaseProduct) return;
        this.applyImportOptionLineKindToOption(opt, this.resolveEffectiveImportLineKind(opt));
      });
    });
  }

  static countFlatOptionsByPublishKind(options) {
    const counts = {
      minoration: 0,
      majoration: 0,
      catalogue: 0,
      pr: 0,
      base_ibp: 0,
      other: 0,
      total: 0
    };
    (Array.isArray(options) ? options : []).forEach((opt) => {
      if (opt?.importGeneratedFromBaseProduct === true) {
        counts.base_ibp += 1;
        counts.total += 1;
        return;
      }
      const kind = this.resolveEffectiveImportLineKind(opt);
      counts.total += 1;
      if (kind === 'minoration') counts.minoration += 1;
      else if (kind === 'majoration') counts.majoration += 1;
      else if (kind === 'pr') counts.pr += 1;
      else if (kind === 'option') counts.catalogue += 1;
      else counts.other += 1;
    });
    return counts;
  }

  static flattenCategoryOptions(categories) {
    return (Array.isArray(categories) ? categories : []).flatMap(
      (cat) => (Array.isArray(cat?.options) ? cat.options : [])
    );
  }

  /** Compte les options par type (console diagnostic publication). */
  static logPublishCatalogSummary(phase, details = {}) {
    const {
      importOptions = [],
      importBaseProducts = [],
      categories = [],
      importId = ''
    } = details;

    const stagingCounts = this.countFlatOptionsByPublishKind(importOptions);
    const publishedFlat = this.flattenCategoryOptions(categories);
    const publishedCounts = this.countFlatOptionsByPublishKind(publishedFlat);

    const stagingIds = new Set(
      (Array.isArray(importOptions) ? importOptions : [])
        .filter((o) => o?.importGeneratedFromBaseProduct !== true)
        .map((o) => String(o?.id || '').trim())
        .filter(Boolean)
    );
    const publishedIds = new Set(
      publishedFlat
        .map((o) => String(o?.id || '').trim())
        .filter(Boolean)
    );
    let stagingNotInCatalogue = 0;
    stagingIds.forEach((id) => {
      if (!publishedIds.has(id)) stagingNotInCatalogue += 1;
    });

    const ibpInCatalogue = publishedFlat.filter((o) => o?.importGeneratedFromBaseProduct === true).length;

    console.log('\n========== UGAP — Publication catalogue ==========');
    console.log(`Phase : ${phase}${importId ? ` (import ${importId})` : ''}`);
    console.log('--- Staging importOptions (sans opt_ibp staging) ---');
    console.log(`  MINO      : ${stagingCounts.minoration}`);
    console.log(`  MAJO      : ${stagingCounts.majoration}`);
    console.log(`  Catalogue : ${stagingCounts.catalogue}`);
    console.log(`  PR        : ${stagingCounts.pr}`);
    console.log(`  Autre     : ${stagingCounts.other}`);
    console.log(`  Total     : ${stagingCounts.total}`);
    console.log('--- importBaseProducts (lignes → opt_ibp_* à matérialiser) ---');
    console.log(`  Lignes    : ${(Array.isArray(importBaseProducts) ? importBaseProducts : []).length}`);
    console.log('--- Catalogue publié (toutes catégories, options uniques par id) ---');
    console.log(`  MINO      : ${publishedCounts.minoration}`);
    console.log(`  MAJO      : ${publishedCounts.majoration}`);
    console.log(`  Catalogue : ${publishedCounts.catalogue}`);
    console.log(`  PR        : ${publishedCounts.pr}`);
    console.log(`  Base IBP  : ${ibpInCatalogue}`);
    console.log(`  Autre     : ${publishedCounts.other}`);
    console.log(`  Total     : ${publishedCounts.total} (${publishedIds.size} id distincts)`);
    console.log('--- Écarts ---');
    console.log(`  Staging importOptions absentes du catalogue : ${stagingNotInCatalogue}`);
    console.log(`  IBP matérialisées (importGenerated)         : ${ibpInCatalogue}`);
    console.log('================================================\n');

    return {
      stagingCounts,
      publishedCounts,
      importBaseProductsCount: (Array.isArray(importBaseProducts) ? importBaseProducts : []).length,
      stagingNotInCatalogue,
      ibpInCatalogue
    };
  }

  static async publishImportStaging(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    let doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) throw new Error('Import staging introuvable');

    const importIdStr = String(importId || doc?._id || '');

    let importOptions = this.getStagingImportOptionsForPublish(doc);
    this.logPublishCatalogSummary('1 — Staging brut', {
      importOptions,
      importBaseProducts: doc.importBaseProducts || [],
      importId: importIdStr
    });

    const models = Array.isArray(doc.models) ? doc.models : [];
    const stagingById = this.buildOptionByIdFromImportOptions(importOptions);
    const bpSavedCount = (Array.isArray(doc.importBaseProducts) ? doc.importBaseProducts : []).length;
    let importBaseProducts = this.prepareImportBaseProductsForPublish(
      doc.importBaseProducts || [],
      importOptions,
      models,
      stagingById
    );
    importBaseProducts = this.ensureMotorImportBaseProductsFromModels(importBaseProducts, models, {
      dedupeByLabel: false
    });

    this.logPublishCatalogSummary('2 — importBaseProducts pour publication', {
      importOptions,
      importBaseProducts,
      importId: importIdStr
    });
    console.log(`  (importBaseProducts MongoDB : ${bpSavedCount} → publiées : ${importBaseProducts.length})`);

    this.clearMotorCatalogTarifBaseFlagsOnOptions(importOptions);
    this.applyPublishFlagsFromSavedStateToOptions(importOptions);

    const dataCol = db.collection('ugap_data');
    const published = await dataCol.findOne({ entrepriseId });
    const finalized = this.finalizePublishedCategoriesFromImport(
      published?.categories || [],
      importOptions,
      importBaseProducts,
      models
    );
    const mergedCategories = finalized.categories;

    this.logPublishCatalogSummary('3 — Catalogue envoyé à saveData', {
      importOptions,
      importBaseProducts: finalized.importBaseProducts || importBaseProducts,
      categories: mergedCategories,
      importId: importIdStr
    });

    // Publication import : modèles + fusion options (pas de coquilles Motorisation/Divers Excel).
    const payload = {
      models: (Array.isArray(doc.models) ? doc.models : []).map((m) => {
        const id = String(m?.id || '').trim();
        if (!id) return { ...m };
        const prev = (Array.isArray(published?.models) ? published.models : [])
          .find((pm) => String(pm?.id || '').trim() === id) || {};
        return { ...prev, ...m };
      }),
      categories: mergedCategories,
      importBaseProducts: finalized.importBaseProducts || importBaseProducts || [],
      businessViews: Array.isArray(published?.businessViews) && published.businessViews.length
        ? published.businessViews
        : (Array.isArray(doc.businessViews) ? doc.businessViews : []),
      dependencyRules: Array.isArray(published?.dependencyRules) && published.dependencyRules.length
        ? published.dependencyRules
        : this.normalizeDependencyRules(doc.dependencyRules)
    };
    await this.saveData(db, payload, entrepriseId);
    await collection.updateOne(
      { _id, entrepriseId },
      {
        $set: {
          status: 'published',
          'progress.viewsCompleted': true,
          updatedAt: new Date(),
          publishedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id, entrepriseId });
  }
}

module.exports = UgapDataService;
