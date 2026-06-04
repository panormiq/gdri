/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-group-catalog.js
 * RÔLE : Catalogue unique des groupes de décision (famille, catégorie, template, affichage).
 *
 * ENTRÉES : categories[], ui-state.families, refs template
 * SORTIES : refs, groupes résolus, compteurs, libellés
 *
 * DÉPEND DE : ugap-family-decision-group.js, ugap-family-components.js, boat-template-tree.js
 * NE PAS : normalisation categoryTree, UI onglets
 *
 * APPELÉ PAR : boat-template-tree (délégation), template-bateau, modeles, categorie, configurateur
 */
(function initUgapGroupCatalog(global) {
    'use strict';

    const Tree = () => global.UgapBoatTemplateTree;

    /** Capturés avant Object.assign(api) — évite récursion si api écrase UgapBoatTemplateTree. */
    const treeNewNodeId = global.UgapBoatTemplateTree?.newNodeId;
    const treeFlattenCategoryRefIds = global.UgapBoatTemplateTree?.flattenCategoryRefIds;
    const treeNormalizeDecisionGroupRef = global.UgapBoatTemplateTree?.normalizeDecisionGroupRef;

    function newNodeId(prefix) {
        if (typeof treeNewNodeId === 'function') {
            return treeNewNodeId(prefix);
        }
        return `${String(prefix || 'tpl').trim() || 'tpl'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function flattenCategoryRefIds(nodes) {
        if (typeof treeFlattenCategoryRefIds === 'function') {
            return treeFlattenCategoryRefIds(nodes);
        }
        const ids = [];
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((node) => {
                const ref = String(node?.categoryRefId || '').trim();
                if (ref) ids.push(ref);
                walk(node?.children);
            });
        };
        walk(nodes);
        return Array.from(new Set(ids));
    }

    function normalizeTreeNode(node) {
        return Tree()?.normalizeTreeNode?.(node) || node;
    }

    function normalizeCategoryTree(tree) {
        return Tree()?.normalizeCategoryTree?.(tree) || tree;
    }

    function normalizeDecisionGroupRefFallback(raw) {
        const r = raw && typeof raw === 'object' ? raw : {};
        const catalogNodeId = String(r.catalogNodeId || '').trim();
        if (catalogNodeId) {
            const label = String(r.label || r.familyLabel || '').trim();
            return {
                catalogNodeId,
                familyLabel: label || catalogNodeId,
                groupId: String(r.groupId || `cn_${catalogNodeId}`).trim(),
                label,
                decisionMode: String(r.decisionMode || '').trim() === 'multi_choice' ? 'multi_choice' : 'single_choice',
            };
        }
        const familyLabel = String(r.familyLabel || '').trim();
        const groupId = String(r.groupId || '').trim();
        if (!familyLabel || !groupId) return null;
        const sourceIndex = Number(r.sourceIndex);
        const componentId = String(r.componentId || '').trim();
        const out = {
            familyLabel,
            groupId,
            sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : undefined,
        };
        if (componentId) out.componentId = componentId;
        return out;
    }

    function normalizeDecisionGroupRef(ref) {
        if (typeof treeNormalizeDecisionGroupRef === 'function') {
            return treeNormalizeDecisionGroupRef(ref);
        }
        return normalizeDecisionGroupRefFallback(ref);
    }

    function syncFamilyOptionsToDecisionGroups(family) {
        if (Tree()?.syncFamilyOptionsToDecisionGroups) {
            return Tree().syncFamilyOptionsToDecisionGroups(family);
        }
        return family;
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
        const FCmp = typeof global !== 'undefined' ? global.UgapFamilyComponents : null;
        const matchSel = FCmp?.selectionKeyMatchesGroup
            ? (g, key) => FCmp.selectionKeyMatchesGroup(key, g)
            : (g, key) => String(g?.id || g?.groupId || '').trim() === String(key || '').trim();
        const selKey = (g) => (FCmp?.groupSelectionKey
            ? FCmp.groupSelectionKey(g)
            : String(g?.id || g?.groupId || '').trim());

        return entries.map((entry) => {
            const e = entry && typeof entry === 'object'
                ? entry
                : { familyLabel: String(entry || '').trim() };
            const src = findCatalogueFamily(catalogue, e);
            const familyLabel = String(e.familyLabel || src?.familyLabel || '').trim();
            if (!familyLabel) return null;
            const FCmpSync = typeof global !== 'undefined' ? global.UgapFamilyComponents : null;
            const familySrc = src
                ? (FCmpSync?.syncOptionsToComponents
                    ? FCmpSync.syncOptionsToComponents({ ...src })
                    : syncFamilyOptionsToDecisionGroups(src))
                : {};
            const allGroups = FCmp?.flattenDecisionGroups
                ? FCmp.flattenDecisionGroups(familySrc)
                : normalizeGroups(familySrc?.decisionGroups || e.decisionGroups);
            const selectedKeys = (Array.isArray(e.selectedGroupIds) ? e.selectedGroupIds : (Array.isArray(e.groupIds) ? e.groupIds : []))
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            let decisionGroups = selectedKeys.length
                ? allGroups.filter((g) => selectedKeys.some((key) => matchSel(g, key)))
                : [];
            if (!decisionGroups.length && selectedKeys.length) {
                decisionGroups = allGroups.filter((g) => {
                    const gid = String(g?.id || g?.groupId || '').trim();
                    return selectedKeys.some((key) => {
                        const parsed = FCmp?.parseGroupSelectionKey
                            ? FCmp.parseGroupSelectionKey(key)
                            : { componentId: '', groupId: key };
                        const wantGid = String(parsed.groupId || key || '').trim();
                        return wantGid && gid === wantGid;
                    });
                });
            }
            // Clés selectedGroupIds obsolètes (ex. après dédup composants) — ne pas vider la catégorie.
            if (!decisionGroups.length && selectedKeys.length && allGroups.length) {
                decisionGroups = allGroups;
            }
            if (!decisionGroups.length && !selectedKeys.length) {
                decisionGroups = allGroups;
            }
            const selKeyFn = (g) => (FCmp?.groupSelectionKey
                ? FCmp.groupSelectionKey(g)
                : String(g?.id || g?.groupId || '').trim());
            const haveKeys = new Set(decisionGroups.map(selKeyFn));
            allGroups
                .filter((g) => String(g?.type || '').trim() === 'model')
                .forEach((mg) => {
                    const k = selKeyFn(mg);
                    if (!k || haveKeys.has(k)) return;
                    haveKeys.add(k);
                    decisionGroups.push(mg);
                });
            const groupOrder = (Array.isArray(e.groupOrder) ? e.groupOrder : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (groupOrder.length && decisionGroups.length > 1) {
                const byKey = new Map(decisionGroups.map((g) => [selKey(g), g]));
                const ordered = groupOrder.map((key) => byKey.get(key)).filter(Boolean);
                if (ordered.length) decisionGroups = ordered;
            }
            if (!decisionGroups.length) return null;
            return {
                familyLabel,
                objectName: String(e.objectName || src?.objectName || cat.objectName || '').trim(),
                sourceIndex: hasExplicitSourceIndexValue(e.sourceIndex) ? Number(e.sourceIndex) : undefined,
                decisionGroups: decisionGroups.map((g) => ({
                    id: String(g?.id || g?.groupId || '').trim(),
                    label: String(g?.label || g?.id || '').trim(),
                    type: String(g?.type || 'option').trim() || 'option',
                    componentId: String(g?.componentId || '').trim(),
                    componentLabel: String(g?.componentLabel || '').trim(),
                    componentKeyword: String(g?.componentKeyword || '').trim(),
                    selectionKey: FCmp?.groupSelectionKey
                        ? FCmp.groupSelectionKey(g)
                        : (String(g?.componentId || '').trim()
                            ? `${g.componentId}::${g.id || g.groupId}`
                            : String(g?.id || g?.groupId || '').trim()),
                    decisionMode: g?.decisionMode || 'single_choice',
                    optionIds: Array.isArray(g?.optionIds) ? g.optionIds : [],
                })).filter((g) => g.id),
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
                const groupId = String(g?.id || g?.groupId || '').trim();
                const componentId = String(g?.componentId || '').trim();
                const componentLabel = String(g?.componentLabel || '').trim();
                if (!familyLabel || !groupId) return;
                const label = componentLabel && !/^option\s*catalogue$/i.test(componentLabel)
                    ? componentLabel
                    : String(g.label || groupId).trim();
                const ref = {
                    familyLabel,
                    groupId,
                    label,
                    sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : undefined,
                };
                if (componentId) ref.componentId = componentId;
                refs.push(ref);
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

    function treeHasCatalogNodeRefs(nodes) {
        let found = false;
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((n) => {
                if (String(n?.catalogNodeRefId || '').trim()) found = true;
                walk(n?.children);
            });
        };
        walk(nodes);
        return found;
    }

    function resolveCatalogNodes(ctx) {
        const opts = ctx && typeof ctx === 'object' ? ctx : {};
        const Core = global.UgapCatalogueNodesCore;
        if (opts.catalog && Core?.normalizeCatalog) {
            const fromFull = Core.normalizeCatalog(opts.catalog).nodes || [];
            if (fromFull.length) return fromFull;
        }
        if (Array.isArray(opts.catalogNodes) && opts.catalogNodes.length) {
            if (Core?.normalizeCatalog) {
                return Core.normalizeCatalog({ nodes: opts.catalogNodes }).nodes || opts.catalogNodes;
            }
            return opts.catalogNodes;
        }
        let nodes = global.UgapCatalogueLcState?.getCatalog?.()?.nodes || [];
        if (!nodes.length) {
            const data = typeof global.getUgapCurrentData === 'function'
                ? global.getUgapCurrentData()
                : (global.UgapBateauBaseLcState?.getData?.() || null);
            const raw = data?.uiState?.catalog;
            if (raw && Core?.normalizeCatalog) {
                nodes = Core.normalizeCatalog(raw).nodes || [];
            }
            if (!nodes.length && Array.isArray(data?.categories) && data.categories.length && Core?.migrateLegacyCatalog) {
                const migrated = Core.migrateLegacyCatalog({
                    categories: data.categories,
                    objects: raw?.objects,
                    nodes: raw?.nodes,
                });
                nodes = Array.isArray(migrated) ? migrated : [];
            }
        }
        if (nodes.length && Core?.normalizeCatalog) {
            return Core.normalizeCatalog({ nodes }).nodes || [];
        }
        return Array.isArray(nodes) ? nodes : [];
    }

    function catalogNodesFromContext(ctx) {
        return resolveCatalogNodes(ctx);
    }

    function normalizeBoatTemplateSnapshot(snapshot, options) {
        const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
        const opts = options && typeof options === 'object' ? options : {};
        const resolveCategoryById = opts.resolveCategoryById;
        const catalogNodes = catalogNodesFromContext(opts);
        const BTree = typeof global !== 'undefined' ? global.UgapBoatTemplateTree : null;

        let categoryTree = migrateCategoryIdsToTree(snap, resolveCategoryById);
        categoryTree = normalizeCategoryTree(categoryTree);

        let catalogNodeOrder = {};
        if (snap.catalogNodeOrder && typeof snap.catalogNodeOrder === 'object') {
            Object.keys(snap.catalogNodeOrder).forEach((key) => {
                const pid = String(key === 'root' ? '' : key).trim();
                const ids = (Array.isArray(snap.catalogNodeOrder[key]) ? snap.catalogNodeOrder[key] : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                if (ids.length) catalogNodeOrder[pid] = ids;
            });
        }

        if (catalogNodes.length && BTree?.buildCategoryTreeFromCatalog && BTree.mergeCatalogNodeOrder) {
            const hasOrder = Object.keys(catalogNodeOrder).length > 0;
            const hasCatalogRefs = treeHasCatalogNodeRefs(categoryTree);
            if (hasOrder || hasCatalogRefs || !categoryTree.length) {
                let order = catalogNodeOrder;
                if (!hasOrder && hasCatalogRefs && BTree.extractCatalogNodeOrderFromCategoryTree) {
                    order = BTree.extractCatalogNodeOrderFromCategoryTree(categoryTree, catalogNodes);
                }
                const merged = BTree.mergeCatalogNodeOrder(catalogNodes, order);
                catalogNodeOrder = merged;
                categoryTree = BTree.buildCategoryTreeFromCatalog(catalogNodes, merged);
            }
        }

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

        return { categoryTree, categoryIds, baseOptionIds, catalogNodeOrder };
    }

    function findFamilyInCatalogue(familyLabel, sourceIndex, catalogueFamilies) {
        const catalogue = Array.isArray(catalogueFamilies) ? catalogueFamilies : [];
        const label = String(familyLabel || '').trim().toLowerCase();
        const idx = Number(sourceIndex);
        if (Number.isInteger(idx)) {
            const hit = catalogue.find((f) => Number(f.__idx) === idx);
            if (hit) return hit;
        }
        if (!label) return null;
        return catalogue.find((f) => String(f?.familyLabel || '').trim().toLowerCase() === label) || null;
    }

    /** Réaligne les refs template sur le catalogue Famille actuel (ignore familles supprimées). */
    function alignRefsToCatalogueFamilies(refs, catalogueFamilies) {
        return (Array.isArray(refs) ? refs : [])
            .map(normalizeDecisionGroupRef)
            .filter(Boolean)
            .map((r) => {
                if (String(r.catalogNodeId || '').trim()) return r;
                const fam = findFamilyInCatalogue(r.familyLabel, r.sourceIndex, catalogueFamilies);
                if (!fam) return null;
                const out = {
                    familyLabel: String(fam.familyLabel || '').trim(),
                    groupId: String(r.groupId || '').trim(),
                };
                const sourceIndex = Number.isInteger(fam.__idx) ? fam.__idx : r.sourceIndex;
                if (Number.isInteger(sourceIndex)) out.sourceIndex = sourceIndex;
                const componentId = String(r.componentId || '').trim();
                if (componentId) out.componentId = componentId;
                return out.familyLabel && out.groupId ? out : null;
            })
            .filter(Boolean);
    }

    /**
     * Familles / groupes pour le snapshot « options de base » : uniquement les refs du nœud template.
     */
    function buildSnapshotFamiliesFromRefs(refs, catalogueFamilies, optionById) {
        const list = Array.isArray(refs) ? refs : [];
        if (!list.length) return [];
        const byFamily = new Map();
        list.forEach((rawRef) => {
            const r = normalizeDecisionGroupRef(rawRef);
            if (!r) return;
            const resolved = resolveGroupFromRef(rawRef, catalogueFamilies, optionById, () => true);
            if (!resolved || resolved.missing) return;
            const familyLabel = String(
                resolved.familyLabel || r.familyLabel || resolved.catalogNodeId || ''
            ).trim();
            if (!familyLabel && !resolved.catalogNodeId) return;
            const groupId = String(resolved.groupId || '').trim();
            if (!familyLabel || !groupId) return;
            if (!byFamily.has(familyLabel)) {
                byFamily.set(familyLabel, { familyLabel, decisionGroups: [] });
            }
            byFamily.get(familyLabel).decisionGroups.push({
                id: groupId,
                label: String(resolved.label || groupId).trim(),
                componentId: String(resolved.componentId || '').trim(),
                componentLabel: String(resolved.componentLabel || '').trim(),
                decisionMode: resolved.decisionMode || 'single_choice',
                optionIds: (Array.isArray(resolved.optionIds) ? resolved.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean),
            });
        });
        return Array.from(byFamily.values()).filter((f) => (f.decisionGroups || []).length > 0);
    }

    function groupsForCatalogueFamily(fam) {
        if (!fam) return [];
        const FCmp = typeof global !== 'undefined' ? global.UgapFamilyComponents : null;
        if (FCmp?.flattenDecisionGroups) {
            const flat = FCmp.flattenDecisionGroups(fam);
            if (Array.isArray(flat) && flat.length) return normalizeGroups(flat);
        }
        const synced = syncFamilyOptionsToDecisionGroups(fam);
        return normalizeGroups(synced?.decisionGroups || fam?.decisionGroups);
    }

    function collectOptionsForCatalogNode(catalogNodeId, optionById, isOptionSelectable) {
        const nid = String(catalogNodeId || '').trim();
        if (!nid) return [];
        const selectable = typeof isOptionSelectable === 'function' ? isOptionSelectable : () => true;
        const map = optionById instanceof Map ? optionById : new Map();
        const options = [];
        map.forEach((opt) => {
            if (String(opt?.catalogObjectId || '').trim() !== nid) return;
            if (opt && selectable(opt)) options.push(opt);
        });
        return options;
    }

    function buildRefsFromCatalogNode(catalogNode, catalogNodes) {
        const nid = String(catalogNode?.id || '').trim();
        if (!nid) return [];
        const Core = global.UgapCatalogueNodesCore;
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const label = Core?.nodeBreadcrumb?.(nodes, nid)
            || String(catalogNode?.label || nid).trim();
        const decisionMode = String(catalogNode?.decisionMode || '').trim() === 'multi_choice'
            ? 'multi_choice'
            : 'single_choice';
        return [{
            catalogNodeId: nid,
            familyLabel: label,
            groupId: `cn_${nid}`,
            label,
            decisionMode,
        }];
    }

    function resolveGroupFromRef(ref, catalogueFamilies, optionById, isOptionSelectable) {
        const r = normalizeDecisionGroupRef(ref);
        if (!r) return null;

        const catalogNodeId = String(r.catalogNodeId || '').trim();
        if (catalogNodeId) {
            const options = collectOptionsForCatalogNode(catalogNodeId, optionById, isOptionSelectable);
            const label = String(r.label || r.familyLabel || catalogNodeId).trim();
            return {
                catalogNodeId,
                familyLabel: label,
                groupId: String(r.groupId || `cn_${catalogNodeId}`).trim(),
                label,
                decisionMode: r.decisionMode === 'multi_choice' ? 'multi_choice' : 'single_choice',
                type: 'option',
                priceMode: 'option',
                pricingMode: 'option',
                optionIds: options.map((o) => String(o?.id || '').trim()).filter(Boolean),
                options,
                /** Nœud catalogue valide : affiché même sans option liée (paramétrage options de base). */
                missing: false,
                emptyOptions: options.length === 0,
            };
        }

        const fam = findFamilyInCatalogue(r.familyLabel, r.sourceIndex, catalogueFamilies);
        const gid = String(r.groupId || '').trim();
        const compId = String(r.componentId || '').trim();
        const FCmp = typeof global !== 'undefined' ? global.UgapFamilyComponents : null;
        let group = null;
        if (fam && FCmp?.resolveGroupInFamily) {
            const resolved = FCmp.resolveGroupInFamily(fam, compId, gid);
            const hit = resolved?.group;
            if (hit) {
                group = {
                    ...hit,
                    id: String(resolved.groupId || hit.id || hit.groupId || gid).trim(),
                    groupId: String(resolved.groupId || hit.id || hit.groupId || gid).trim(),
                    componentId: String(resolved.componentId || hit.componentId || '').trim(),
                    componentLabel: String(
                        resolved.component?.label || hit.componentLabel || ''
                    ).trim(),
                };
            }
        }
        if (!group) {
            const groups = groupsForCatalogueFamily(fam);
            group = groups.find((g) => {
                const gId = String(g.id || g.groupId || '').trim();
                if (!gId || gId !== gid) return false;
                if (!compId) return true;
                const gComp = String(g.componentId || '').trim();
                if (gComp === compId) return true;
                return !gComp;
            }) || null;
        }
        if (!fam || !group) {
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
        const liveSourceIndex = Number.isInteger(fam.__idx) ? fam.__idx : r.sourceIndex;
        return {
            ...r,
            familyLabel: String(fam.familyLabel || r.familyLabel || '').trim(),
            sourceIndex: Number.isInteger(liveSourceIndex) ? liveSourceIndex : undefined,
            label: String(group.label || group.id).trim(),
            componentId: String(group.componentId || '').trim(),
            componentLabel: String(group.componentLabel || '').trim(),
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

    function buildSnapshotFamiliesFromResolvedGroups(resolved) {
        const byFamily = new Map();
        (Array.isArray(resolved) ? resolved : []).forEach((g) => {
            if (!g || g.missing) return;
            const familyLabel = String(g.familyLabel || '').trim();
            const groupId = String(g.groupId || '').trim();
            if (!familyLabel || !groupId) return;
            if (!byFamily.has(familyLabel)) {
                byFamily.set(familyLabel, { familyLabel, decisionGroups: [] });
            }
            byFamily.get(familyLabel).decisionGroups.push({
                id: groupId,
                label: String(g.label || groupId).trim(),
                type: String(g.type || '').trim(),
                componentId: String(g.componentId || '').trim(),
                componentLabel: String(g.componentLabel || '').trim(),
                decisionMode: g.decisionMode || 'single_choice',
                optionIds: (Array.isArray(g.optionIds) ? g.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean),
            });
        });
        return Array.from(byFamily.values()).filter((f) => (f.decisionGroups || []).length > 0);
    }

    /** Tous les nœuds de l’arbre template (racines + enfants Pont / Carène…). */
    function flattenTemplateNodesForSnapshot(categoryTree) {
        const out = [];
        function walk(nodes) {
            (Array.isArray(nodes) ? nodes : []).forEach((raw) => {
                const n = normalizeTreeNode(raw);
                out.push(n);
                const kids = Array.isArray(n.children) ? n.children : [];
                if (kids.length && !String(n.subCategoryRefId || '').trim()) walk(kids);
            });
        }
        walk(normalizeCategoryTree(categoryTree));
        return out;
    }

    function buildSnapshotCategoryFromNode(node, resolveCategoryById, catalogueFamilies, optionById, options) {
        const n = normalizeTreeNode(node);
        const opts = options && typeof options === 'object' ? options : {};
        const catalogNodes = Array.isArray(opts.catalogNodes) ? opts.catalogNodes : [];
        const refId = String(n.categoryRefId || '').trim();
        const catalogNodeRefId = String(n.catalogNodeRefId || '').trim();
        const cat = refId && typeof resolveCategoryById === 'function'
            ? resolveCategoryById(refId)
            : null;
        const Core = global.UgapCatalogueNodesCore;
        const catalogLabel = catalogNodeRefId && Core?.nodeBreadcrumb
            ? Core.nodeBreadcrumb(catalogNodes, catalogNodeRefId)
            : '';
        const name = String(n.label || catalogLabel || cat?.objectName || cat?.name || refId || catalogNodeRefId).trim() || '—';

        if (String(n.subCategoryRefId || '').trim()) {
            const resolved = resolveSubCategoryFamilies(
                n,
                catalogueFamilies,
                optionById,
                () => true,
                resolveCategoryById
            );
            const families = buildSnapshotFamiliesFromResolvedGroups(resolved);
            return { id: n.id, name, objectName: name, families, missing: !families.length };
        }

        const refs = resolveNodeRefs(n, resolveCategoryById, catalogueFamilies, { catalogNodes });
        let families = [];
        if (refs.length) {
            families = buildSnapshotFamiliesFromRefs(refs, catalogueFamilies, optionById);
        }
        return {
            id: n.id,
            name,
            objectName: name,
            families,
            missing: (refId && !cat && !families.length)
                || (catalogNodeRefId && !families.length),
        };
    }

    function resolveNodeRefs(node, resolveCategoryById, catalogueFamilies, options) {
        const n = normalizeTreeNode(node);
        const catId = String(n.categoryRefId || '').trim();
        const catalogNodeRefId = String(n.catalogNodeRefId || '').trim();
        const subId = String(n.subCategoryRefId || '').trim();
        const opts = options && typeof options === 'object' ? options : {};
        const catalogNodes = Array.isArray(opts.catalogNodes) ? opts.catalogNodes : [];

        const storedRefs = (Array.isArray(n.decisionGroupRefs) ? n.decisionGroupRefs : [])
            .map(normalizeDecisionGroupRef)
            .filter(Boolean);

        if (catalogNodeRefId && !subId) {
            const catalogNode = catalogNodes.find((cn) => String(cn?.id || '').trim() === catalogNodeRefId)
                || { id: catalogNodeRefId, label: n.label };
            return buildRefsFromCatalogNode(catalogNode, catalogNodes);
        }

        // Nœud lié à une catégorie → priorité onglet Catégories ; sinon refs déjà sur le template.
        if (catId && !subId && typeof resolveCategoryById === 'function') {
            const cat = resolveCategoryById(catId);
            if (cat) {
                const families = resolveCategoryFamiliesWithGroups(cat, catalogueFamilies)
                    .filter((fam) => findFamilyInCatalogue(
                        fam?.familyLabel,
                        fam?.sourceIndex,
                        catalogueFamilies
                    ));
                const fromCategory = alignRefsToCatalogueFamilies(
                    buildRefsFromCategoryFamilies(families),
                    catalogueFamilies
                );
                if (fromCategory.length) return fromCategory;
            }
        }

        return alignRefsToCatalogueFamilies(storedRefs, catalogueFamilies);
    }

    /** Réaligne decisionGroupRefs des nœuds liés au catalogue unifié (catalogNodeRefId). */
    function syncCatalogNodeLinkedRefs(tree, catalogNodes, catalogueFamilies, optionById) {
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const byId = new Map(nodes.map((cn) => [String(cn?.id || '').trim(), cn]));
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((raw) => {
                const n = raw && typeof raw === 'object' ? raw : {};
                const catalogNodeRefId = String(n.catalogNodeRefId || '').trim();
                const subId = String(n.subCategoryRefId || '').trim();
                if (catalogNodeRefId && !subId) {
                    const catalogNode = byId.get(catalogNodeRefId) || { id: catalogNodeRefId, label: n.label };
                    n.decisionGroupRefs = buildRefsFromCatalogNode(catalogNode, nodes);
                }
                if (Array.isArray(n.children)) walk(n.children);
            });
        };
        walk(tree);
        return tree;
    }

    /** Réaligne decisionGroupRefs des nœuds catalogue avant persistance template. */
    function syncCategoryLinkedNodeRefs(tree, resolveCategoryById, catalogueFamilies) {
        const walk = (nodes) => {
            (Array.isArray(nodes) ? nodes : []).forEach((raw) => {
                const n = raw && typeof raw === 'object' ? raw : {};
                const catId = String(n.categoryRefId || '').trim();
                const subId = String(n.subCategoryRefId || '').trim();
                if (catId && !subId) {
                    const fresh = resolveNodeRefs(
                        normalizeTreeNode(n),
                        resolveCategoryById,
                        catalogueFamilies
                    );
                    const hadStored = (Array.isArray(n.decisionGroupRefs) ? n.decisionGroupRefs : []).length > 0;
                    if (fresh.length || !hadStored) {
                        n.decisionGroupRefs = fresh;
                    }
                }
                if (Array.isArray(n.children)) walk(n.children);
            });
        };
        walk(tree);
        return tree;
    }

    function countResolvedTreeStats(tree, resolveCategoryById, catalogueFamilies, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const catalogNodes = resolveCatalogNodes(opts);
        let nodes = 0;
        let groups = 0;
        const optionById = new Map();
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((raw) => {
                const n = normalizeTreeNode(raw);
                nodes += 1;
                if (String(n.subCategoryRefId || '').trim()) {
                    const resolved = resolveSubCategoryFamilies(
                        n,
                        catalogueFamilies,
                        optionById,
                        () => true,
                        resolveCategoryById
                    );
                    groups += resolved.filter((g) => g && !g.missing).length;
                } else {
                    groups += resolveNodeRefs(n, resolveCategoryById, catalogueFamilies, { catalogNodes }).length;
                }
                walk(n.children);
            });
        };
        walk(normalizeCategoryTree(tree));
        return { nodes, groups };
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

    function resolveNodeForConfigurator(node, catalogueFamilies, optionById, isOptionSelectable, resolveCategoryById, catalogNodes) {
        const n = normalizeTreeNode(node);
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
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
        const refs = resolveNodeRefs(n, resolveCategoryById, catalogueFamilies, { catalogNodes: nodes });
        const groups = refs
            .map((ref) => resolveGroupFromRef(ref, catalogueFamilies, optionById, isOptionSelectable))
            .filter(Boolean);
        return {
            id: n.id,
            label: n.label,
            categoryRefId: n.categoryRefId,
            catalogNodeRefId: n.catalogNodeRefId,
            children: (n.children || []).map((child) =>
                resolveNodeForConfigurator(
                    child,
                    catalogueFamilies,
                    optionById,
                    isOptionSelectable,
                    resolveCategoryById,
                    nodes
                )
            ),
            decisionGroups: groups,
            catalogOptions: []
        };
    }

    function resolveTemplateTree(tpl, context) {
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const ctx = context && typeof context === 'object' ? context : {};
        const catalogNodes = catalogNodesFromContext(ctx);
        const normalized = normalizeBoatTemplateSnapshot(snap, {
            resolveCategoryById: ctx.resolveCategoryById,
            catalogNodes,
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
                    resolveCategoryById,
                    catalogNodes
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

    /**
     * Parcours template — catalogue v2 uniquement (nodes[] + catalogNodeOrder).
     * Aucune résolution famille / catégorie legacy.
     */
    function walkCatalogOnlyTemplateRefs(tpl, ctx) {
        const options = ctx && typeof ctx === 'object' ? ctx : {};
        const catalogNodes = resolveCatalogNodes(options);
        if (!catalogNodes.length) return [];

        const BTree = global.UgapBoatTemplateTree;
        const Core = global.UgapCatalogueNodesCore;
        if (!BTree?.buildCategoryTreeFromCatalog || !BTree.normalizeTreeNode) return [];

        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const optionById = options.optionById instanceof Map ? options.optionById : new Map();
        let order = snap.catalogNodeOrder && typeof snap.catalogNodeOrder === 'object'
            ? BTree.normalizeCatalogNodeOrder(snap.catalogNodeOrder)
            : {};
        if (!Object.keys(order).length && BTree.defaultCatalogNodeOrder) {
            order = BTree.defaultCatalogNodeOrder(catalogNodes);
        }
        const merged = BTree.mergeCatalogNodeOrder
            ? BTree.mergeCatalogNodeOrder(catalogNodes, order)
            : order;
        const categoryTree = BTree.buildCategoryTreeFromCatalog(catalogNodes, merged);
        const out = [];

        const visit = (node) => {
            const n = BTree.normalizeTreeNode(node);
            const catalogNodeRefId = String(n.catalogNodeRefId || '').trim();
            if (catalogNodeRefId) {
                const cn = Core?.getNodeById?.(catalogNodes, catalogNodeRefId)
                    || { id: catalogNodeRefId, label: String(n.label || catalogNodeRefId).trim() };
                const nodeCtx = {
                    nodeId: String(n.id || '').trim(),
                    categoryName: Core?.nodeBreadcrumb?.(catalogNodes, catalogNodeRefId)
                        || String(n.label || '').trim(),
                };
                buildRefsFromCatalogNode(cn, catalogNodes).forEach((rawRef) => {
                    const resolved = resolveGroupFromRef(rawRef, [], optionById, () => true);
                    if (!resolved || resolved.missing) return;
                    out.push({
                        rawRef,
                        resolved,
                        nodeId: nodeCtx.nodeId,
                        categoryName: nodeCtx.categoryName,
                    });
                });
            }
            (Array.isArray(n.children) ? n.children : []).forEach(visit);
        };

        (Array.isArray(categoryTree) ? categoryTree : []).forEach(visit);
        return out;
    }

    /**
     * Parcourt categoryTree dans l’ordre de l’éditeur Bateau de base (une entrée par decisionGroupRef).
     */
    function walkTemplateDecisionGroupRefs(tpl, ctx) {
        const options = ctx && typeof ctx === 'object' ? ctx : {};
        const catalogNodes = resolveCatalogNodes(options);
        if (catalogNodes.length) {
            return walkCatalogOnlyTemplateRefs(tpl, options);
        }

        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogueFamilies = Array.isArray(options.catalogueFamilies) ? options.catalogueFamilies : [];
        const resolveCategoryById = options.resolveCategoryById;
        const optionById = options.optionById instanceof Map ? options.optionById : new Map();
        const normalized = normalizeBoatTemplateSnapshot(snap, {
            resolveCategoryById,
            catalogNodes,
        });
        const out = [];

        const pushEntry = (nodeCtx, rawRef, resolved) => {
            if (!resolved || resolved.missing) return;
            out.push({
                rawRef: rawRef && typeof rawRef === 'object' ? rawRef : null,
                resolved,
                nodeId: String(nodeCtx.nodeId || '').trim(),
                categoryName: String(nodeCtx.categoryName || '').trim(),
            });
        };

        const visitNode = (node) => {
            const n = normalizeTreeNode(node);
            const nodeCtx = {
                nodeId: n.id,
                categoryName: String(n.label || '').trim(),
            };

            if (String(n.subCategoryRefId || '').trim()) {
                const list = resolveSubCategoryFamilies(
                    n,
                    catalogueFamilies,
                    optionById,
                    () => true,
                    resolveCategoryById
                );
                list.forEach((resolved) => pushEntry(nodeCtx, null, resolved));
                return;
            }

            const refs = resolveNodeRefs(n, resolveCategoryById, catalogueFamilies, { catalogNodes });
            refs.forEach((rawRef) => {
                const resolved = resolveGroupFromRef(
                    rawRef,
                    catalogueFamilies,
                    optionById,
                    () => true
                );
                pushEntry(nodeCtx, rawRef, resolved);
            });
            (Array.isArray(n.children) ? n.children : []).forEach(visitNode);
        };

        (normalized.categoryTree || []).forEach(visitNode);
        return out;
    }

    
    function getCatalogueFamilies() {
        const rows = global.UgapFamilleLcState?.getFamilies?.() || [];
        const FCmp = global.UgapFamilyComponents;
        return rows.map((f, idx) => {
            let decisionGroups = normalizeGroups(f?.decisionGroups);
            if (!decisionGroups.length && FCmp?.flattenDecisionGroups) {
                decisionGroups = normalizeGroups(FCmp.flattenDecisionGroups(f));
            }
            return { ...f, __idx: idx, decisionGroups };
        });
    }

    function buildContext(categories, catalogNodes) {
        const list = Array.isArray(categories) ? categories : [];
        const byId = new Map(list.map((c) => [String(c?.id || '').trim(), c]));
        const nodes = Array.isArray(catalogNodes)
            ? catalogNodes
            : (global.UgapCatalogueLcState?.getCatalog?.()?.nodes || []);
        return {
            catalogueFamilies: getCatalogueFamilies(),
            catalogNodes: nodes,
            resolveCategoryById: (id) => byId.get(String(id || '').trim()) || null,
            optionById: Tree()?.buildCatalogueOptionById?.(list) || new Map(),
        };
    }

    function countGroupsForCategory(category, catalogueFamilies) {
        return resolveCategoryFamiliesWithGroups(category, catalogueFamilies)
            .reduce((n, f) => n + (Array.isArray(f?.decisionGroups) ? f.decisionGroups.length : 0), 0);
    }

    function listNodeGroupItems(node, ctx) {
        const c = ctx && typeof ctx === 'object' ? ctx : buildContext([]);
        const cf = c.catalogueFamilies || getCatalogueFamilies();
        const n = Tree()?.normalizeTreeNode?.(node) || node;
        const refs = resolveNodeRefs(n, c.resolveCategoryById, cf, {
            catalogNodes: c.catalogNodes || [],
        });
        const ob = c.optionById instanceof Map ? c.optionById : new Map();
        return refs.map((r) => {
            const resolved = resolveGroupFromRef(r, cf, ob, () => true);
            return {
                ref: r,
                resolved,
                label: String(r?.label || resolved?.label || r?.groupId || '').trim(),
            };
        }).filter((x) => x.resolved && !x.resolved.missing);
    }

    function listPickerChoicesFromCatalogNodes(catalogNodes, optionById) {
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const Core = global.UgapCatalogueNodesCore;
        const out = [];
        nodes.forEach((cn) => {
            const catalogNodeId = String(cn?.id || '').trim();
            if (!catalogNodeId) return;
            const options = collectOptionsForCatalogNode(catalogNodeId, optionById, () => true);
            if (!options.length) return;
            const path = Core?.nodeBreadcrumb?.(nodes, catalogNodeId) || String(cn.label || catalogNodeId).trim();
            const decisionMode = String(cn?.decisionMode || '').trim() === 'multi_choice'
                ? 'multi_choice'
                : 'single_choice';
            out.push({
                catalogNodeId,
                familyLabel: path,
                groupId: `cn_${catalogNodeId}`,
                label: String(cn.label || path).trim(),
                decisionMode,
                categoryName: path,
                groupLabel: String(cn.label || path).trim(),
            });
        });
        return out.sort((a, b) => String(a.categoryName || '').localeCompare(String(b.categoryName || ''), 'fr'));
    }

    function listPickerChoicesFromCategories(categories) {
        const cf = getCatalogueFamilies();
        const out = [];
        (Array.isArray(categories) ? categories : []).forEach((cat) => {
            resolveCategoryFamiliesWithGroups(cat, cf).forEach((fam) => {
                (fam.decisionGroups || []).forEach((g) => {
                    const groupId = String(g.id || g.groupId || '').trim();
                    const familyLabel = String(fam.familyLabel || '').trim();
                    if (!groupId || !familyLabel) return;
                    const cl = String(g.componentLabel || '').trim();
                    const title = cl && !/^option\s*catalogue$/i.test(cl)
                        ? cl
                        : String(g.label || groupId).trim();
                    out.push({
                        familyLabel,
                        groupId,
                        componentId: g.componentId || undefined,
                        sourceIndex: fam.sourceIndex,
                        label: title,
                        decisionMode: g.decisionMode || 'single_choice',
                        categoryName: String(cat.objectName || cat.name || '').trim(),
                    });
                });
            });
        });
        return out;
    }

    /** Libellés groupes pour un nœud template (Bateau de base, options de base). */
    function getResolvedGroupItemsForNode(node, ctx) {
        return listNodeGroupItems(node, ctx).map((item) => {
            const r = item.ref && typeof item.ref === 'object' ? item.ref : {};
            const resolved = item.resolved && typeof item.resolved === 'object' ? item.resolved : {};
            const GD = global.UgapGroupDisplay;
            const label = GD?.resolvePrimaryGroupTitle
                ? GD.resolvePrimaryGroupTitle({ ...r, ...resolved, groupLabel: resolved.label })
                : String(item.label || resolved.label || r.groupId || '').trim();
            return {
                familyLabel: String(resolved.familyLabel || r.familyLabel || '').trim(),
                groupId: String(resolved.groupId || r.groupId || '').trim(),
                label: String(label || resolved.label || r.groupId).trim(),
            };
        }).filter((row) => row.groupId);
    }

    function resolveLiveGroupInFamily(fam, groupId, componentId) {
        const gid = String(groupId || '').trim();
        if (!fam || !gid) return null;
        const FCmp = global.UgapFamilyComponents;
        const compId = String(componentId || '').trim();
        if (FCmp?.resolveGroupInFamily) {
            const hit = FCmp.resolveGroupInFamily(fam, compId, gid);
            if (hit?.group) {
                return {
                    ...hit.group,
                    id: String(hit.groupId || gid).trim(),
                    groupId: String(hit.groupId || gid).trim(),
                    componentId: String(hit.componentId || '').trim(),
                };
            }
        }
        return groupsForCatalogueFamily(fam).find((g) => {
            return String(g?.id || g?.groupId || '').trim() === gid;
        }) || null;
    }

    function normalizeGroups(raw) {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.normalizeList) return FDG.normalizeList(raw);
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return Array.isArray(raw) ? raw : [];
    }

    const api = {
        resolveCatalogNodes,
        catalogNodesFromContext,
        getCatalogueFamilies,
        buildContext,
        countGroupsForCategory,
        listNodeGroupItems,
        getResolvedGroupItemsForNode,
        listPickerChoicesFromCategories,
        listPickerChoicesFromCatalogNodes,
        buildRefsFromCatalogNode,
        syncCatalogNodeLinkedRefs,
        resolveLiveGroupInFamily,
        findCatalogueFamily,
        findFamilyInCatalogue,
        resolveCategoryFamiliesWithGroups,
        buildRefsFromCategoryFamilies,
        alignRefsToCatalogueFamilies,
        collectOptionsForCatalogNode,
        resolveGroupFromRef,
        resolveNodeRefs,
        resolveSubCategoryFamilies,
        walkCatalogOnlyTemplateRefs,
        walkTemplateDecisionGroupRefs,
        syncCategoryLinkedNodeRefs,
        countResolvedTreeStats,
        buildSnapshotFamiliesFromRefs,
        buildSnapshotFamiliesFromResolvedGroups,
        buildSnapshotCategoryFromNode,
        flattenTemplateNodesForSnapshot,
        resolveTemplateTree,
        resolveNodeForConfigurator,
        groupsForCatalogueFamily,
        normalizeGroups,
        normalizeBoatTemplateSnapshot,
        migrateCategoryIdsToTree,
        getNodeAtPath,
        countTreeStats,
        hasTemplateTree,
        treeHasResolvableGroups,
        normalizeDecisionGroupRef,
    };

    global.UgapGroupCatalog = api;
    global.getFamiliesForAssignationTab = getCatalogueFamilies;

    if (global.UgapBoatTemplateTree) {
        const skipOnTreeAssign = new Set([
            'flattenCategoryRefIds',
            'newNodeId',
            'normalizeDecisionGroupRef',
        ]);
        Object.keys(api).forEach((key) => {
            if (skipOnTreeAssign.has(key)) return;
            global.UgapBoatTemplateTree[key] = api[key];
        });
    }
})(typeof window !== 'undefined' ? window : global);
