/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/boat-template-tree.js
 * RÔLE : Arbre categoryTree des templates bateau — normalisation, migration, résolution groupes.
 *
 * ENTRÉES : snapshot template, catalogue categories[], familles validées
 * SORTIES : snapshot normalisé, nœuds résolus pour configurateur / admin
 *
 * DÉPEND DE : ugap-family-decision-group.js (optionnel)
 * NE PAS : UI configurateur ou admin (consommateurs uniquement)
 *
 * APPELÉ PAR : template-bateau-tab.js, admin.php sanitize, configurateur-template-tree.js
 */
(function initUgapBoatTemplateTree(global) {
    'use strict';

    function slugify(input) {
        return String(input || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function newNodeId(prefix) {
        return `${prefix || 'tplcat'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeDecisionGroupRef(raw) {
        const r = raw && typeof raw === 'object' ? raw : {};
        const familyLabel = String(r.familyLabel || '').trim();
        const groupId = String(r.groupId || '').trim();
        if (!familyLabel || !groupId) return null;
        const sourceIndex = Number(r.sourceIndex);
        return {
            familyLabel,
            groupId,
            sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : undefined
        };
    }

    function normalizeTreeNode(raw) {
        const n = raw && typeof raw === 'object' ? raw : {};
        const id = String(n.id || '').trim() || newNodeId('tplcat');
        const label = String(n.label || '').trim() || 'Catégorie';
        const categoryRefId = String(n.categoryRefId || '').trim() || undefined;
        const subCategoryRefId = String(n.subCategoryRefId || '').trim() || undefined;
        const refs = (Array.isArray(n.decisionGroupRefs) ? n.decisionGroupRefs : [])
            .map(normalizeDecisionGroupRef)
            .filter(Boolean);
        let children = [];
        if (!subCategoryRefId) {
            children = (Array.isArray(n.children) ? n.children : [])
                .map(normalizeTreeNode)
                .filter(Boolean);
        }
        const out = { id, label, decisionGroupRefs: refs, children };
        if (categoryRefId) out.categoryRefId = categoryRefId;
        if (subCategoryRefId) out.subCategoryRefId = subCategoryRefId;
        return out;
    }

    /** Nœuds template = sous-catégories catalogue (2 niveaux max). */
    function buildTemplateChildNodesFromCategory(cat) {
        const category = cat && typeof cat === 'object' ? cat : {};
        const categoryRefId = String(category.id || '').trim();
        return (Array.isArray(category.subCategories) ? category.subCategories : [])
            .map((sc) => {
                const subCategoryRefId = String(sc?.id || '').trim();
                const label = String(sc?.name || '').trim() || 'Sous-catégorie';
                if (!subCategoryRefId) return null;
                return normalizeTreeNode({
                    label,
                    categoryRefId,
                    subCategoryRefId,
                    decisionGroupRefs: [],
                    children: []
                });
            })
            .filter(Boolean);
    }

    function normalizeCategoryTree(raw) {
        return (Array.isArray(raw) ? raw : [])
            .map(normalizeTreeNode)
            .filter(Boolean);
    }

    function flattenCategoryRefIds(nodes) {
        const ids = [];
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((node) => {
                const ref = String(node?.categoryRefId || '').trim();
                if (ref) ids.push(ref);
                walk(node.children);
            });
        };
        walk(nodes);
        return Array.from(new Set(ids));
    }

    function normalizeGroups(raw) {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG && typeof FDG.normalizeList === 'function') {
            return FDG.normalizeList(raw);
        }
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return (Array.isArray(raw) ? raw : [])
            .map((g, index) => {
                const gg = g && typeof g === 'object' ? g : {};
                const id = String(gg.id || `group_${index + 1}`).trim();
                const label = String(gg.label || id).trim();
                const decisionMode = String(gg.decisionMode || '').toLowerCase() === 'multi_choice'
                    ? 'multi_choice'
                    : 'single_choice';
                const optionIds = (Array.isArray(gg.optionIds) ? gg.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                return id && label ? { ...gg, id, label, decisionMode, optionIds } : null;
            })
            .filter(Boolean);
    }

    /** Répartit family.optionIds dans decisionGroups[].optionIds (comme l’admin Famille). */
    function syncFamilyOptionsToDecisionGroups(family) {
        const f = family && typeof family === 'object' ? { ...family } : {};
        const familyOptionIds = (Array.isArray(f.optionIds) ? f.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const familyOptionSet = new Set(familyOptionIds);
        const hasFamilyOptionScope = familyOptionSet.size > 0;
        let groups = normalizeGroups(f.decisionGroups);
        if (!groups.length) {
            f.optionIds = familyOptionIds;
            return f;
        }
        const defaultGroup = groups.find((g) => String(g.type || '') === 'model') || groups[0];
        const defaultGroupId = String(defaultGroup?.id || '').trim();
        const assignedInGroups = new Set();
        groups = groups.map((g) => {
            const rawIds = (Array.isArray(g.optionIds) ? g.optionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            const ids = hasFamilyOptionScope
                ? rawIds.filter((x) => familyOptionSet.has(x))
                : rawIds;
            ids.forEach((id) => assignedInGroups.add(id));
            return { ...g, optionIds: ids };
        });
        if (defaultGroupId) {
            const orphans = familyOptionIds.filter((id) => !assignedInGroups.has(id));
            if (orphans.length) {
                groups = groups.map((g) => {
                    if (String(g.id) !== defaultGroupId) return g;
                    return { ...g, optionIds: Array.from(new Set([...(g.optionIds || []), ...orphans])) };
                });
            }
        }
        f.decisionGroups = groups;
        return f;
    }

    function prepareCatalogueFamiliesForConfigurator(families) {
        return (Array.isArray(families) ? families : []).map((f, idx) => {
            const synced = syncFamilyOptionsToDecisionGroups(f);
            return { ...synced, __idx: idx };
        });
    }

    function findCatalogueFamily(catalogue, entry) {
        const catalogueList = Array.isArray(catalogue) ? catalogue : [];
        const e = entry && typeof entry === 'object' ? entry : {};
        const rawSourceIndex = e.sourceIndex;
        const hasExplicitSourceIndex = rawSourceIndex !== null
            && rawSourceIndex !== undefined
            && String(rawSourceIndex).trim() !== '';
        const sourceIndex = hasExplicitSourceIndex ? Number(rawSourceIndex) : NaN;
        if (Number.isInteger(sourceIndex)) {
            const hit = catalogueList.find((f) => Number(f.__idx) === sourceIndex);
            if (hit) return hit;
        }
        const familyLabel = String(e.familyLabel || '').trim().toLowerCase();
        if (!familyLabel) return null;
        return catalogueList.find((f) =>
            String(f?.familyLabel || '').trim().toLowerCase() === familyLabel
        ) || null;
    }

    /**
     * Résout familles + groupes cochés pour une catégorie catalogue (même logique que template-bateau-tab).
     */
    function resolveCategoryFamiliesWithGroups(category, catalogueFamilies) {
        const cat = category && typeof category === 'object' ? category : {};
        const catalogue = Array.isArray(catalogueFamilies) ? catalogueFamilies : [];
        const entries = Array.isArray(cat.families) ? cat.families : [];
        return entries.map((entry) => {
            const e = entry && typeof entry === 'object'
                ? entry
                : { familyLabel: String(entry || '').trim() };
            const src = findCatalogueFamily(catalogue, e);
            const familyLabel = String(e.familyLabel || src?.familyLabel || '').trim();
            if (!familyLabel) return null;
            const srcSynced = src ? syncFamilyOptionsToDecisionGroups(src) : null;
            const allGroups = normalizeGroups(srcSynced?.decisionGroups || src?.decisionGroups || e.decisionGroups);
            const selectedIds = new Set(
                (Array.isArray(e.selectedGroupIds) ? e.selectedGroupIds : (Array.isArray(e.groupIds) ? e.groupIds : []))
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            );
            let decisionGroups = selectedIds.size
                ? allGroups.filter((g) => selectedIds.has(String(g.id || '').trim()))
                : allGroups;
            const groupOrder = (Array.isArray(e.groupOrder) ? e.groupOrder : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (groupOrder.length && decisionGroups.length > 1) {
                const byId = new Map(decisionGroups.map((g) => [String(g.id || '').trim(), g]));
                decisionGroups = groupOrder.map((gid) => byId.get(gid)).filter(Boolean);
            }
            if (!decisionGroups.length && allGroups.length) {
                decisionGroups = allGroups;
            }
            if (!decisionGroups.length) return null;
            return {
                familyLabel,
                objectName: String(e.objectName || src?.objectName || cat.objectName || '').trim(),
                sourceIndex: hasExplicitSourceIndexValue(e.sourceIndex) ? Number(e.sourceIndex) : undefined,
                decisionGroups
            };
        }).filter(Boolean);
    }

    function hasExplicitSourceIndexValue(value) {
        if (value === null || value === undefined) return false;
        const text = String(value).trim();
        if (!text) return false;
        return Number.isInteger(Number(text));
    }

    function buildRefsFromCategoryFamilies(families) {
        const refs = [];
        (Array.isArray(families) ? families : []).forEach((fam) => {
            const familyLabel = String(fam?.familyLabel || '').trim();
            const sourceIndex = Number(fam?.sourceIndex);
            (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                const groupId = String(g?.id || '').trim();
                if (!familyLabel || !groupId) return;
                refs.push({
                    familyLabel,
                    groupId,
                    sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : undefined
                });
            });
        });
        return refs;
    }

    function migrateCategoryIdsToTree(snapshot, resolveCategoryById) {
        const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
        let tree = normalizeCategoryTree(snap.categoryTree);
        if (tree.length) return tree;

        const resolver = typeof resolveCategoryById === 'function' ? resolveCategoryById : () => null;
        const categoryIds = Array.isArray(snap.categoryIds)
            ? snap.categoryIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        if (!categoryIds.length && Array.isArray(snap.categories)) {
            snap.categories.forEach((c) => {
                const id = String(c?.id || '').trim();
                if (id) categoryIds.push(id);
            });
        }
        if (!categoryIds.length) return [];

        return categoryIds.map((catId) => {
            const cat = resolver(catId);
            const label = String(cat?.objectName || cat?.name || catId).trim() || catId;
            const families = cat ? resolveCategoryFamiliesWithGroups(cat, []) : [];
            return {
                id: newNodeId('tplcat'),
                label,
                categoryRefId: catId,
                decisionGroupRefs: buildRefsFromCategoryFamilies(families),
                children: []
            };
        });
    }

    function normalizeBoatTemplateSnapshot(snapshot, options) {
        const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
        const opts = options && typeof options === 'object' ? options : {};
        const resolveCategoryById = opts.resolveCategoryById;

        let categoryTree = migrateCategoryIdsToTree(snap, resolveCategoryById);
        categoryTree = normalizeCategoryTree(categoryTree);

        let categoryIds = Array.isArray(snap.categoryIds)
            ? snap.categoryIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const fromTree = flattenCategoryRefIds(categoryTree);
        if (fromTree.length) categoryIds = fromTree;
        else if (!categoryIds.length && categoryTree.length) {
            categoryIds = categoryTree
                .map((n) => String(n.categoryRefId || '').trim())
                .filter(Boolean);
        }

        const baseOptionIds = Array.isArray(snap.baseOptionIds)
            ? snap.baseOptionIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];

        return { categoryTree, categoryIds, baseOptionIds };
    }

    function findFamilyInCatalogue(familyLabel, sourceIndex, catalogueFamilies) {
        const catalogue = Array.isArray(catalogueFamilies) ? catalogueFamilies : [];
        const idx = Number(sourceIndex);
        if (Number.isInteger(idx)) {
            const hit = catalogue.find((f) => Number(f.__idx) === idx);
            if (hit) return hit;
        }
        const label = String(familyLabel || '').trim().toLowerCase();
        return catalogue.find((f) => String(f?.familyLabel || '').trim().toLowerCase() === label) || null;
    }

    function resolveGroupFromRef(ref, catalogueFamilies, optionById, isOptionSelectable) {
        const r = normalizeDecisionGroupRef(ref);
        if (!r) return null;
        const fam = findFamilyInCatalogue(r.familyLabel, r.sourceIndex, catalogueFamilies);
        const groups = normalizeGroups(fam?.decisionGroups);
        const group = groups.find((g) => String(g.id) === r.groupId);
        if (!group) {
            return {
                ...r,
                label: r.groupId,
                decisionMode: 'single_choice',
                type: 'option',
                options: [],
                missing: true
            };
        }
        const selectable = typeof isOptionSelectable === 'function'
            ? isOptionSelectable
            : () => true;
        const map = optionById && typeof optionById.get === 'function' ? optionById : new Map();
        const options = (Array.isArray(group.optionIds) ? group.optionIds : [])
            .map((id) => map.get(String(id || '').trim()))
            .filter((opt) => opt && selectable(opt));
        const defaultOptionId = String(fam?.defaultOptionId || '').trim();
        const priceMode = String(group.priceMode || group.pricingMode || 'option').trim().toLowerCase();
        return {
            ...r,
            label: String(group.label || group.id).trim(),
            decisionMode: group.decisionMode || 'single_choice',
            type: group.type || 'option',
            priceMode,
            pricingMode: priceMode,
            optionIds: group.optionIds || [],
            options,
            defaultOptionId: defaultOptionId || undefined,
            missing: false
        };
    }

    function getNodeAtPath(tree, pathIndices) {
        const indices = Array.isArray(pathIndices) ? pathIndices : [];
        let nodes = normalizeCategoryTree(tree);
        let node = null;
        indices.forEach((i) => {
            const idx = Number(i);
            if (!Number.isInteger(idx) || idx < 0 || idx >= nodes.length) return;
            node = nodes[idx];
            nodes = Array.isArray(node?.children) ? node.children : [];
        });
        return node;
    }

    function resolveNodeRefs(node, resolveCategoryById, catalogueFamilies) {
        const n = normalizeTreeNode(node);
        let refs = Array.isArray(n.decisionGroupRefs) ? n.decisionGroupRefs : [];
        if (!refs.length && n.categoryRefId && typeof resolveCategoryById === 'function') {
            const cat = resolveCategoryById(n.categoryRefId);
            if (cat) {
                refs = buildRefsFromCategoryFamilies(
                    resolveCategoryFamiliesWithGroups(cat, catalogueFamilies)
                );
            }
        }
        return refs;
    }

    function resolveSubCategoryFamilies(node, catalogueFamilies, optionById, isOptionSelectable, resolveCategoryById) {
        const n = normalizeTreeNode(node);
        const subId = String(n.subCategoryRefId || '').trim();
        const catId = String(n.categoryRefId || '').trim();
        if (!subId || !catId || typeof resolveCategoryById !== 'function') return [];
        const cat = resolveCategoryById(catId);
        const sc = (Array.isArray(cat?.subCategories) ? cat.subCategories : [])
            .find((s) => String(s?.id || '') === subId);
        if (!sc) return [];
        const pseudoCat = { ...cat, families: Array.isArray(sc.families) ? sc.families : [] };
        const refs = buildRefsFromCategoryFamilies(
            resolveCategoryFamiliesWithGroups(pseudoCat, catalogueFamilies)
        );
        return refs
            .map((ref) => resolveGroupFromRef(ref, catalogueFamilies, optionById, isOptionSelectable))
            .filter(Boolean);
    }

    function resolveNodeForConfigurator(node, catalogueFamilies, optionById, isOptionSelectable, resolveCategoryById) {
        const n = normalizeTreeNode(node);
        const subCategoryRefId = String(n.subCategoryRefId || '').trim();
        if (subCategoryRefId) {
            const decisionGroups = resolveSubCategoryFamilies(
                n,
                catalogueFamilies,
                optionById,
                isOptionSelectable,
                resolveCategoryById
            );
            return {
                id: n.id,
                label: n.label,
                categoryRefId: n.categoryRefId,
                subCategoryRefId,
                children: [],
                decisionGroups,
                catalogOptions: []
            };
        }
        const refs = resolveNodeRefs(n, resolveCategoryById, catalogueFamilies);
        const groups = refs
            .map((ref) => resolveGroupFromRef(ref, catalogueFamilies, optionById, isOptionSelectable))
            .filter(Boolean);
        return {
            id: n.id,
            label: n.label,
            categoryRefId: n.categoryRefId,
            children: (n.children || []).map((child) =>
                resolveNodeForConfigurator(
                    child,
                    catalogueFamilies,
                    optionById,
                    isOptionSelectable,
                    resolveCategoryById
                )
            ),
            decisionGroups: groups,
            catalogOptions: []
        };
    }

    function resolveTemplateTree(tpl, context) {
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const ctx = context && typeof context === 'object' ? context : {};
        const normalized = normalizeBoatTemplateSnapshot(snap, {
            resolveCategoryById: ctx.resolveCategoryById
        });
        const tree = normalized.categoryTree;
        const catalogueFamilies = Array.isArray(ctx.catalogueFamilies) ? ctx.catalogueFamilies : [];
        const optionById = ctx.optionById instanceof Map ? ctx.optionById : new Map();
        const isOptionSelectable = ctx.isOptionSelectable;
        const resolveCategoryById = ctx.resolveCategoryById;
        return {
            categoryTree: tree,
            categoryIds: normalized.categoryIds,
            baseOptionIds: normalized.baseOptionIds,
            resolvedRoots: tree.map((node) =>
                resolveNodeForConfigurator(
                    node,
                    catalogueFamilies,
                    optionById,
                    isOptionSelectable,
                    resolveCategoryById
                )
            )
        };
    }

    function treeHasResolvableGroups(resolvedRoots) {
        const walk = (nodes) => {
            for (const n of Array.isArray(nodes) ? nodes : []) {
                const groups = Array.isArray(n.decisionGroups) ? n.decisionGroups : [];
                if (groups.some((g) => !g.missing && (g.options || []).length)) return true;
                if (walk(n.children)) return true;
            }
            return false;
        };
        return walk(resolvedRoots);
    }

    function countTreeStats(tree) {
        let nodes = 0;
        let groups = 0;
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((n) => {
                nodes += 1;
                groups += (Array.isArray(n.decisionGroupRefs) ? n.decisionGroupRefs : []).length;
                walk(n.children);
            });
        };
        walk(normalizeCategoryTree(tree));
        return { nodes, groups };
    }

    function hasTemplateTree(tpl) {
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const tree = normalizeCategoryTree(snap.categoryTree);
        if (tree.length) return true;
        return Array.isArray(snap.categoryIds) && snap.categoryIds.length > 0;
    }

    /** Index global des objets option (stock catalogue import, toutes catégories). */
    function buildCatalogueOptionById(categories) {
        const map = new Map();
        (Array.isArray(categories) ? categories : []).forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (id && !map.has(id)) map.set(id, opt);
            });
        });
        return map;
    }

    /** IDs d’options exposées par les familles/groupes cochés (catégorie + sous-catégories). */
    function collectCategoryOptionIdsFromFamilies(category, catalogueFamilies) {
        const cat = category && typeof category === 'object' ? category : {};
        const ids = [];
        const seen = new Set();
        const pushFromFamilies = (familiesList) => {
            const pseudo = { ...cat, families: Array.isArray(familiesList) ? familiesList : [] };
            resolveCategoryFamiliesWithGroups(pseudo, catalogueFamilies).forEach((fam) => {
                (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                    (Array.isArray(g?.optionIds) ? g.optionIds : []).forEach((idRaw) => {
                        const id = String(idRaw || '').trim();
                        if (!id || seen.has(id)) return;
                        seen.add(id);
                        ids.push(id);
                    });
                });
            });
        };
        pushFromFamilies(cat.families);
        (Array.isArray(cat.subCategories) ? cat.subCategories : []).forEach((sc) => {
            pushFromFamilies(sc.families);
        });
        return ids;
    }

    /** Libellé sous-catégorie par optionId (familles rattachées aux sous-catégories). */
    function buildSubCategoryNameByOptionId(category, catalogueFamilies) {
        const map = new Map();
        const cat = category && typeof category === 'object' ? category : {};
        (Array.isArray(cat.subCategories) ? cat.subCategories : []).forEach((subCat) => {
            const subName = String(subCat?.name || '').trim() || '—';
            const pseudo = { ...cat, families: Array.isArray(subCat.families) ? subCat.families : [] };
            resolveCategoryFamiliesWithGroups(pseudo, catalogueFamilies).forEach((fam) => {
                (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                    (Array.isArray(g?.optionIds) ? g.optionIds : []).forEach((idRaw) => {
                        const id = String(idRaw || '').trim();
                        if (!id || map.has(id)) return;
                        map.set(id, subName);
                    });
                });
            });
        });
        return map;
    }

    global.UgapBoatTemplateTree = {
        newNodeId,
        normalizeDecisionGroupRef,
        normalizeTreeNode,
        normalizeCategoryTree,
        normalizeBoatTemplateSnapshot,
        migrateCategoryIdsToTree,
        flattenCategoryRefIds,
        resolveCategoryFamiliesWithGroups,
        buildRefsFromCategoryFamilies,
        buildTemplateChildNodesFromCategory,
        resolveGroupFromRef,
        resolveSubCategoryFamilies,
        resolveNodeRefs,
        resolveNodeForConfigurator,
        resolveTemplateTree,
        getNodeAtPath,
        countTreeStats,
        hasTemplateTree,
        treeHasResolvableGroups,
        buildCatalogueOptionById,
        collectCategoryOptionIdsFromFamilies,
        buildSubCategoryNameByOptionId,
        syncFamilyOptionsToDecisionGroups,
        prepareCatalogueFamiliesForConfigurator,
        findCatalogueFamily
    };
})(typeof window !== 'undefined' ? window : global);
