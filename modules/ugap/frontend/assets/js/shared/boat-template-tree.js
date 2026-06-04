/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/boat-template-tree.js
 * RÔLE : Arbre categoryTree des templates bateau — normalisation et migration (groupes → ugap-group-catalog.js).
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

    function normalizeTreeNode(raw) {
        const n = raw && typeof raw === 'object' ? raw : {};
        const id = String(n.id || '').trim() || newNodeId('tplcat');
        const label = String(n.label || '').trim() || 'Catégorie';
        const categoryRefId = String(n.categoryRefId || '').trim() || undefined;
        const catalogNodeRefId = String(n.catalogNodeRefId || '').trim() || undefined;
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
        if (catalogNodeRefId) out.catalogNodeRefId = catalogNodeRefId;
        if (subCategoryRefId) out.subCategoryRefId = subCategoryRefId;
        return out;
    }

    /** Enfants template = sous-arbre complet du nœud catalogue (récursif). */
    function buildTemplateChildNodesFromCatalogNode(catalogNodeId, catalogNodes) {
        const Core = global.UgapCatalogueNodesCore;
        const Catalog = global.UgapGroupCatalog;
        const nid = String(catalogNodeId || '').trim();
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        if (!nid || !Core?.getChildren) return [];

        const buildRefs = (catalogNode) => {
            if (typeof buildRefsFromCatalogNode === 'function') {
                return buildRefsFromCatalogNode(catalogNode, nodes);
            }
            if (Catalog?.buildRefsFromCatalogNode) {
                return Catalog.buildRefsFromCatalogNode(catalogNode, nodes);
            }
            return [];
        };

        const walk = (parentId) => Core.getChildren(nodes, parentId).map((child) => {
            const childId = String(child?.id || '').trim();
            if (!childId) return null;
            const label = Core.nodeBreadcrumb?.(nodes, childId)
                || String(child.label || childId).trim();
            return normalizeTreeNode({
                label,
                catalogNodeRefId: childId,
                decisionGroupRefs: buildRefs(child),
                children: walk(childId),
            });
        }).filter(Boolean);

        return walk(nid);
    }

    function normalizeCatalogNodeOrder(raw) {
        const out = {};
        const src = raw && typeof raw === 'object' ? raw : {};
        Object.keys(src).forEach((key) => {
            const pid = String(key === 'root' ? '' : key).trim();
            const ids = (Array.isArray(src[key]) ? src[key] : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (ids.length) out[pid] = ids;
        });
        return out;
    }

    function defaultCatalogNodeOrder(catalogNodes) {
        const Core = global.UgapCatalogueNodesCore;
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        if (!Core?.getChildren) return {};
        const order = {};
        const walk = (parentId) => {
            const pid = String(parentId || '').trim();
            const kids = Core.getChildren(nodes, pid);
            if (!kids.length) return;
            order[pid] = kids.map((n) => String(n.id || '').trim()).filter(Boolean);
            kids.forEach((n) => walk(n.id));
        };
        walk('');
        return order;
    }

    /** Fusionne l’ordre sauvegardé avec tous les nœuds catalogue actuels (nouveaux nœuds en fin de liste). */
    function mergeCatalogNodeOrder(catalogNodes, orderMap) {
        const Core = global.UgapCatalogueNodesCore;
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const stored = normalizeCatalogNodeOrder(orderMap);
        const merged = { ...stored };
        if (!Core?.getChildren) return merged;

        const siblingIdsForParent = (parentId) => {
            const pid = String(parentId || '').trim();
            return Core.getChildren(nodes, pid)
                .map((n) => String(n.id || '').trim())
                .filter(Boolean);
        };

        const visit = (parentId) => {
            const pid = String(parentId || '').trim();
            let defaultIds = siblingIdsForParent(pid);
            if (!defaultIds.length && !pid && nodes.length) {
                defaultIds = nodes.map((n) => String(n.id || '').trim()).filter(Boolean);
            }
            const prev = Array.isArray(merged[pid]) ? merged[pid] : [];
            if (!defaultIds.length) {
                if (prev.length) merged[pid] = prev.slice();
                return;
            }
            const valid = new Set(defaultIds);
            const result = [];
            prev.forEach((id) => {
                if (valid.has(id)) {
                    result.push(id);
                    valid.delete(id);
                }
            });
            defaultIds.forEach((id) => {
                if (valid.has(id)) result.push(id);
            });
            merged[pid] = result;
            defaultIds.forEach((id) => visit(id));
        };
        visit('');
        return merged;
    }

    function orderedCatalogSiblingIds(parentId, catalogNodes, orderMap, premerged) {
        const merged = premerged && typeof premerged === 'object'
            ? premerged
            : mergeCatalogNodeOrder(catalogNodes, orderMap);
        const pid = String(parentId || '').trim();
        if (Array.isArray(merged[pid]) && merged[pid].length) {
            return merged[pid].slice();
        }
        const Core = global.UgapCatalogueNodesCore;
        if (Core?.getChildren) {
            return Core.getChildren(catalogNodes, pid)
                .map((n) => String(n.id || '').trim())
                .filter(Boolean);
        }
        return [];
    }

    function templateNodeIdForCatalog(catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        return id ? `tplcn_${id}` : newNodeId('tplcn');
    }

    /** Arbre categoryTree dérivé du catalogue + ordre d’affichage (parcours configurateur). */
    function buildCategoryTreeFromCatalog(catalogNodes, orderMap) {
        const Core = global.UgapCatalogueNodesCore;
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const merged = mergeCatalogNodeOrder(nodes, orderMap);
        if (!Core?.getChildren || !nodes.length) return [];

        const buildRefs = (catalogNode) => {
            if (typeof buildRefsFromCatalogNode === 'function') {
                return buildRefsFromCatalogNode(catalogNode, nodes);
            }
            const Catalog = global.UgapGroupCatalog;
            if (Catalog?.buildRefsFromCatalogNode) {
                return Catalog.buildRefsFromCatalogNode(catalogNode, nodes);
            }
            return [];
        };

        const buildNode = (catalogNodeId) => {
            const nid = String(catalogNodeId || '').trim();
            if (!nid) return null;
            const cn = Core.getNodeById?.(nodes, nid) || { id: nid, label: nid };
            const label = Core.nodeBreadcrumb?.(nodes, nid)
                || String(cn.label || nid).trim();
            const childIds = orderedCatalogSiblingIds(nid, nodes, orderMap, merged);
            const children = childIds.map((cid) => buildNode(cid)).filter(Boolean);
            return normalizeTreeNode({
                id: templateNodeIdForCatalog(nid),
                label,
                catalogNodeRefId: nid,
                decisionGroupRefs: buildRefs(cn),
                children,
            });
        };

        return orderedCatalogSiblingIds('', nodes, orderMap, merged)
            .map((rootId) => buildNode(rootId))
            .filter(Boolean);
    }

    /** Extrait catalogNodeOrder depuis un categoryTree legacy (nœuds catalogNodeRefId). */
    function extractCatalogNodeOrderFromCategoryTree(tree, catalogNodes) {
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const catalogIds = new Set(nodes.map((n) => String(n?.id || '').trim()).filter(Boolean));
        const order = {};

        const siblingIds = (list) => (Array.isArray(list) ? list : [])
            .map((n) => String(n?.catalogNodeRefId || '').trim())
            .filter((id) => id && catalogIds.has(id));

        const walk = (list, parentCatalogId) => {
            const pid = String(parentCatalogId || '').trim();
            const ids = siblingIds(list);
            if (ids.length) order[pid] = ids;
            (Array.isArray(list) ? list : []).forEach((raw) => {
                const cnId = String(raw?.catalogNodeRefId || '').trim();
                if (!cnId) return;
                const kids = Array.isArray(raw?.children) ? raw.children : [];
                if (kids.length) walk(kids, cnId);
            });
        };

        walk(normalizeCategoryTree(tree), '');
        return order;
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

    function catalogFn(name) {
        return function (...args) {
            const Cat = global.UgapGroupCatalog;
            const TreeApi = global.UgapBoatTemplateTree;
            const fn = (Cat && Cat[name]) || (TreeApi && TreeApi[name]);
            if (typeof fn !== 'function') {
                throw new Error('UgapGroupCatalog.' + name + ' — charger ugap-group-catalog.js');
            }
            const ctx = (Cat && Cat[name]) ? Cat : TreeApi;
            return fn.apply(ctx, args);
        };
    }

    const findCatalogueFamily = catalogFn('findCatalogueFamily');
    const resolveCategoryFamiliesWithGroups = catalogFn('resolveCategoryFamiliesWithGroups');
    const hasExplicitSourceIndexValue = catalogFn('hasExplicitSourceIndexValue');
    const buildRefsFromCategoryFamilies = catalogFn('buildRefsFromCategoryFamilies');
    const findFamilyInCatalogue = catalogFn('findFamilyInCatalogue');
    const alignRefsToCatalogueFamilies = catalogFn('alignRefsToCatalogueFamilies');
    const buildSnapshotFamiliesFromRefs = catalogFn('buildSnapshotFamiliesFromRefs');
    const groupsForCatalogueFamily = catalogFn('groupsForCatalogueFamily');
    const resolveGroupFromRef = catalogFn('resolveGroupFromRef');
    const buildSnapshotFamiliesFromResolvedGroups = catalogFn('buildSnapshotFamiliesFromResolvedGroups');
    const flattenTemplateNodesForSnapshot = catalogFn('flattenTemplateNodesForSnapshot');
    const buildSnapshotCategoryFromNode = catalogFn('buildSnapshotCategoryFromNode');
    const resolveNodeRefs = catalogFn('resolveNodeRefs');
    const syncCategoryLinkedNodeRefs = catalogFn('syncCategoryLinkedNodeRefs');
    const syncCatalogNodeLinkedRefs = catalogFn('syncCatalogNodeLinkedRefs');
    const buildRefsFromCatalogNode = catalogFn('buildRefsFromCatalogNode');
    const countResolvedTreeStats = catalogFn('countResolvedTreeStats');
    const resolveSubCategoryFamilies = catalogFn('resolveSubCategoryFamilies');
    const resolveNodeForConfigurator = catalogFn('resolveNodeForConfigurator');
    const resolveTemplateTree = catalogFn('resolveTemplateTree');
    const walkTemplateDecisionGroupRefs = catalogFn('walkTemplateDecisionGroupRefs');
    const normalizeBoatTemplateSnapshot = catalogFn('normalizeBoatTemplateSnapshot');
    const migrateCategoryIdsToTree = catalogFn('migrateCategoryIdsToTree');
    const getNodeAtPath = catalogFn('getNodeAtPath');
    const countTreeStats = catalogFn('countTreeStats');
    const hasTemplateTree = catalogFn('hasTemplateTree');
    const treeHasResolvableGroups = catalogFn('treeHasResolvableGroups');

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
        buildTemplateChildNodesFromCatalogNode,
        normalizeCatalogNodeOrder,
        defaultCatalogNodeOrder,
        mergeCatalogNodeOrder,
        orderedCatalogSiblingIds,
        buildCategoryTreeFromCatalog,
        extractCatalogNodeOrderFromCategoryTree,
        templateNodeIdForCatalog,
        buildRefsFromCatalogNode,
        resolveGroupFromRef,
        buildSnapshotFamiliesFromRefs,
        buildSnapshotFamiliesFromResolvedGroups,
        flattenTemplateNodesForSnapshot,
        buildSnapshotCategoryFromNode,
        resolveSubCategoryFamilies,
        resolveNodeRefs,
        syncCategoryLinkedNodeRefs,
        syncCatalogNodeLinkedRefs,
        countResolvedTreeStats,
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
        findCatalogueFamily,
        walkTemplateDecisionGroupRefs,
    };
})(typeof window !== 'undefined' ? window : global);
