/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/template-bateau-tab.js
 * RÔLE : Templates de base — éditeur structure (admin) + cartes avec variants (réordonnancement).
 * Pas d’édition famille/groupe ici : nœuds = Catalogue, options = onglet Options (catalogObjectId).
 *
 * SORTIES : snapshot { catalogNodeOrder, categoryTree[], categoryIds[], baseOptionIds[] }
 * APPELÉ PAR : admin.php renderActiveTab('template-bateau')
 */
(function initUgapTemplateBateauTab(global) {
    'use strict';

    const Structure = () => global.UgapTemplateBateauStructureEditor;
    const VariantEd = () => global.UgapTemplateBateauVariantEditor;
    const BateauSt = () => global.UgapBateauBaseLcState;
    const PL = () => global.UgapParcoursLabels || {};
    const Tree = () => global.UgapBoatTemplateTree;
    const Catalog = () => global.UgapGroupCatalog;
    const CatalogState = () => global.UgapCatalogueLcState;
    const NodesCore = () => global.UgapCatalogueNodesCore;

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getUgapData() {
        if (typeof global.getUgapCurrentData === 'function') return global.getUgapCurrentData();
        return global.currentData ?? null;
    }

    function isSystemBucketCategory(cat) {
        const c = cat && typeof cat === 'object' ? cat : {};
        const id = String(c.id || '').trim();
        const name = String(c.name || '').trim().toLowerCase();
        return id === 'cat_non_classees' || name === 'non classées' || name === 'non classees';
    }

    function getCatalogueCategoriesForTemplate() {
        const data = getUgapData();
        const all = Array.isArray(data?.categories) ? data.categories : [];
        return all.filter((cat) => !isSystemBucketCategory(cat));
    }

    async function ensureCatalogForTemplate() {
        const St = CatalogState();
        if (!St) return;
        if (St.refreshOptionsFromServer) {
            const payload = await St.refreshOptionsFromServer();
            if (payload && typeof global.setUgapCurrentData === 'function') {
                const cur = getUgapData();
                global.setUgapCurrentData({ ...(cur || {}), ...payload, categories: payload.categories || cur?.categories });
            }
            return;
        }
        if (St.loadFromServer) await St.loadFromServer(true);
    }

    function getCatalogNodesForTemplate() {
        const Cat = Catalog();
        if (Cat?.resolveCatalogNodes) {
            return Cat.resolveCatalogNodes({});
        }
        const Core = NodesCore();
        let nodes = CatalogState()?.getCatalog?.()?.nodes || [];
        if (!nodes.length) {
            const data = getUgapData();
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
            if (nodes.length && CatalogState()?.setCatalog) {
                const tagRegistry = Array.isArray(raw?.tagRegistry) ? raw.tagRegistry : undefined;
                CatalogState().setCatalog(
                    { nodes, ...(tagRegistry ? { tagRegistry } : {}) },
                    { persist: false }
                );
            }
        }
        if (nodes.length && Core?.normalizeCatalog) {
            return Core.normalizeCatalog({ nodes }).nodes || [];
        }
        return nodes;
    }

    function hasCatalogNodes() {
        return getCatalogNodesForTemplate().length > 0;
    }

    function getCatalogNodeById(nodeId) {
        const id = String(nodeId || '').trim();
        if (!id) return null;
        const nodes = getCatalogNodesForTemplate();
        return NodesCore()?.getNodeById?.(nodes, id)
            || nodes.find((n) => NodesCore()?.resolveNodeId?.(n) === id || String(n?.id || '').trim() === id)
            || null;
    }

    /** IDs enfants ordonnés (catalogue + ordre parcours template). */
    function getOrderedSiblingIds(parentCatalogId, catalogNodes, orderMap) {
        const Core = NodesCore();
        const pid = String(parentCatalogId || '').trim();
        const defaultIds = (Core?.getChildren?.(catalogNodes, pid) || [])
            .map((n) => String(n.id || '').trim())
            .filter(Boolean);
        const order = orderMap && typeof orderMap === 'object' ? orderMap : {};
        const stored = Array.isArray(order[pid]) ? order[pid].map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!stored.length) return defaultIds;
        const valid = new Set(defaultIds);
        const out = [];
        stored.forEach((id) => {
            if (valid.has(id)) out.push(id);
        });
        defaultIds.forEach((id) => {
            if (!out.includes(id)) out.push(id);
        });
        return out;
    }

    function sanitizeCatalogNodeOrder(orderMap, catalogNodes) {
        const Core = NodesCore();
        const rows = Core?.asNodeRows?.(catalogNodes) || [];
        const byId = new Set(rows.map((n) => n.id));
        const out = {};
        Object.keys(orderMap && typeof orderMap === 'object' ? orderMap : {}).forEach((key) => {
            const pid = String(key === 'root' ? '' : key).trim();
            if (pid && !byId.has(pid)) return;
            const raw = Array.isArray(orderMap[key]) ? orderMap[key] : [];
            const ids = raw.map((x) => String(x || '').trim()).filter((id) => byId.has(id));
            if (ids.length) out[pid] = ids;
        });
        return out;
    }

    function ensureCatalogNodeOrderIfEmpty(draft) {
        const d = draft || getTemplateBateauCreateDraft();
        if (!d.catalogNodeOrder || typeof d.catalogNodeOrder !== 'object') {
            d.catalogNodeOrder = {};
        }
        const catalogNodes = getCatalogNodesForTemplate();
        if (!catalogNodes.length) return d.catalogNodeOrder;
        const hasKeys = Object.keys(d.catalogNodeOrder).some((k) => {
            const ids = d.catalogNodeOrder[k];
            return Array.isArray(ids) && ids.length > 0;
        });
        if (!hasKeys && Tree()?.defaultCatalogNodeOrder) {
            d.catalogNodeOrder = Tree().defaultCatalogNodeOrder(catalogNodes);
        } else if (Tree()?.mergeCatalogNodeOrder) {
            d.catalogNodeOrder = Tree().mergeCatalogNodeOrder(catalogNodes, d.catalogNodeOrder);
        }
        return d.catalogNodeOrder;
    }

    function buildVirtualNodeFromCatalogId(catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        if (!id) return null;
        const catalogNodes = getCatalogNodesForTemplate();
        const cn = getCatalogNodeById(id);
        if (!cn) return null;
        const label = NodesCore()?.nodeBreadcrumb?.(catalogNodes, id)
            || String(cn.label || id).trim();
        const refs = Tree()?.buildRefsFromCatalogNode
            ? Tree().buildRefsFromCatalogNode(cn, catalogNodes)
            : [];
        return {
            id: Tree()?.templateNodeIdForCatalog?.(id) || id,
            label,
            catalogNodeRefId: id,
            decisionGroupRefs: refs,
            children: [],
        };
    }

    function catalogNodesForOptionLookup() {
        return getCatalogNodesForTemplate();
    }

    /** Compte directe — identique au badge de l’onglet Catalogue. */
    function catalogNodeOptionCount(catalogNodeId) {
        const nodes = catalogNodesForOptionLookup();
        return CatalogState()?.getOptionsForNode?.(catalogNodeId, nodes)?.length ?? 0;
    }

    function catalogNodeRoleText(catalogNodeId) {
        const nodes = catalogNodesForOptionLookup();
        const optCount = catalogNodeOptionCount(catalogNodeId);
        const childCount = NodesCore()?.getChildren?.(nodes, catalogNodeId)?.length || 0;
        return NodesCore()?.nodeRoleLabel?.(optCount, childCount)?.text || '';
    }

    function catalogNodeOptionsLinkSummary(catalogNodeId) {
        const nodes = catalogNodesForOptionLookup();
        return CatalogState()?.getOptionsLinkSummaryForNode?.(catalogNodeId, nodes)
            || { direct: [], onDescendants: [] };
    }

    function buildPreviewTreeFromDraft(draft) {
        const d = draft || getTemplateBateauCreateDraft();
        if (!Tree()?.buildCategoryTreeFromIncludedCatalog || !hasCatalogNodes()) return [];
        const catalogNodes = getCatalogNodesForTemplate();
        const included = Tree().normalizeIncludedCatalogNodeIds(d.includedCatalogNodeIds, catalogNodes);
        const order = Tree().applyStoredCatalogNodeOrder(catalogNodes, d.catalogNodeOrder, included);
        return Tree().buildCategoryTreeFromIncludedCatalog(catalogNodes, order, included);
    }

    function buildTemplateContext() {
        const categories = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const Cat = Catalog();
        if (Cat?.buildContext) {
            return Cat.buildContext(categories, catalogNodes);
        }
        return {
            catalogueFamilies: [],
            catalogNodes,
            resolveCategoryById: (id) => categories.find((c) => String(c?.id || '').trim() === String(id || '').trim()) || null,
            optionById: Tree()?.buildCatalogueOptionById?.(categories) || new Map(),
        };
    }

    function resolveSnapshotCategoryTree(snap) {
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
        const resolveCategoryById = (id) => byId.get(String(id || '').trim()) || null;
        if (!Tree()) return Array.isArray(snap?.categoryTree) ? snap.categoryTree : [];
        return Tree().normalizeBoatTemplateSnapshot(snap, {
            resolveCategoryById,
            catalogNodes,
        }).categoryTree || [];
    }

    function getBoatTemplateSnapshotCategories(tpl) {
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));

        if (!Tree()) return [];
        const optionById = Tree().buildCatalogueOptionById(catalogue);
        const resolveCategoryById = (id) => byId.get(String(id || '').trim()) || null;
        const flatNodes = Tree().flattenTemplateNodesForSnapshot(resolveSnapshotCategoryTree(snap));
        return flatNodes
            .map((node) => Tree().buildSnapshotCategoryFromNode(
                node,
                resolveCategoryById,
                [],
                optionById,
                { catalogNodes }
            ))
            .filter((entry) => (Array.isArray(entry.families) ? entry.families : []).length > 0);
    }

    global.getBoatTemplateSnapshotCategories = getBoatTemplateSnapshotCategories;

    function getTemplateBateauCreateDraft() {
        if (!global.__templateBateauCreateDraft || typeof global.__templateBateauCreateDraft !== 'object') {
            global.__templateBateauCreateDraft = {
                label: '',
                includedCatalogNodeIds: [],
                catalogNodeOrder: {},
                categoryTree: [],
                catalogNodeFivePercentEnabled: {},
            };
        }
        if (!Array.isArray(global.__templateBateauCreateDraft.includedCatalogNodeIds)) {
            global.__templateBateauCreateDraft.includedCatalogNodeIds = [];
        }
        if (!global.__templateBateauCreateDraft.catalogNodeOrder
            || typeof global.__templateBateauCreateDraft.catalogNodeOrder !== 'object') {
            global.__templateBateauCreateDraft.catalogNodeOrder = {};
        }
        if (!global.__templateBateauCreateDraft.catalogNodeFivePercentEnabled
            || typeof global.__templateBateauCreateDraft.catalogNodeFivePercentEnabled !== 'object') {
            global.__templateBateauCreateDraft.catalogNodeFivePercentEnabled = {};
        }
        if (!Array.isArray(global.__templateBateauCreateDraft.categoryTree)) {
            global.__templateBateauCreateDraft.categoryTree = [];
        }
        return global.__templateBateauCreateDraft;
    }

    function resetTemplateBateauCreateDraft() {
        global.__templateBateauCreateDraft = {
            label: '',
            includedCatalogNodeIds: [],
            catalogNodeOrder: {},
            categoryTree: [],
            catalogNodeFivePercentEnabled: {},
        };
        global.__templateBateauEditIndex = null;
        global.__templateBateauEditingVariantId = '';
        global.__templateBateauCollapseDefaultsDone = false;
        if (global.__templateBateauCollapsedNodeIds instanceof Set) {
            global.__templateBateauCollapsedNodeIds.clear();
        }
    }

    function loadDraftFromTemplate(tpl) {
        const draft = getTemplateBateauCreateDraft();
        draft.label = String(tpl?.label || '').trim();
        const catalogNodes = getCatalogNodesForTemplate();
        if (Structure()?.loadDraftStructureFromTemplate) {
            Structure().loadDraftStructureFromTemplate(tpl, catalogNodes);
            return;
        }
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        if (Tree()) {
            const included = Tree().resolveIncludedCatalogNodeIds?.(snap, catalogNodes, snap.catalogNodeOrder) || [];
            draft.includedCatalogNodeIds = included.slice();
            draft.catalogNodeOrder = Tree().applyStoredCatalogNodeOrder?.(
                catalogNodes,
                snap.catalogNodeOrder,
                included
            ) || Tree().normalizeCatalogNodeOrder?.(snap.catalogNodeOrder) || {};
            draft.catalogNodeFivePercentEnabled = Tree().normalizeCatalogNodeFivePercentEnabled?.(
                snap.catalogNodeFivePercentEnabled
            ) || {};
        }
        draft.categoryTree = [];
    }

    function normalizeDraftTree(draft) {
        return buildPreviewTreeFromDraft(draft);
    }

    function buildSnapshotFromDraft(draft) {
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const optionById = Tree()?.buildCatalogueOptionById?.(catalogue) || new Map();
        if (!Tree()?.buildCategoryTreeFromIncludedCatalog) {
            throw new Error('Module template indisponible — rechargez la page.');
        }
        if (!catalogNodes.length) {
            throw new Error('Catalogue vide — créez des nœuds dans l’onglet Catalogue avant d’enregistrer le template.');
        }
        const d = draft || getTemplateBateauCreateDraft();
        const included = Tree().normalizeIncludedCatalogNodeIds(
            d.includedCatalogNodeIds,
            catalogNodes
        );
        if (!included.length) {
            throw new Error('Ajoutez au moins un nœud catalogue au template.');
        }
        const catalogNodeOrder = Tree().sanitizeStructureCatalogNodeOrder
            ? Tree().sanitizeStructureCatalogNodeOrder(catalogNodes, {}, included)
            : Tree().applyStoredCatalogNodeOrder(catalogNodes, {}, included);
        const tree = Tree().buildCategoryTreeFromIncludedCatalog(catalogNodes, catalogNodeOrder, included);
        Tree().syncCatalogNodeLinkedRefs(tree, catalogNodes, [], optionById);
        const catalogNodeFivePercentEnabled = Tree().ensureCatalogNodeFivePercentDefaults?.(
            d.catalogNodeFivePercentEnabled,
            catalogNodes,
            catalogNodeOrder
        ) || {};
        const snap = {
            categoryTree: tree,
            baseOptionIds: [],
            catalogNodeOrder,
            includedCatalogNodeIds: included,
            catalogNodeFivePercentEnabled,
        };
        return Tree().normalizeBoatTemplateSnapshot(snap, { catalogNodes });
    }

    function reorderArrayByIndex(list, fromIdx, toIdx, mode) {
        const arr = Array.isArray(list) ? list.slice() : [];
        const from = Number(fromIdx);
        let to = Number(toIdx);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
            return arr;
        }
        if (from === to) return arr;
        const [moved] = arr.splice(from, 1);
        if (from < to) to -= 1;
        if (mode === 'after') to += 1;
        arr.splice(Math.max(0, Math.min(to, arr.length)), 0, moved);
        return arr;
    }

    function reorderCatalogSiblings(parentId, fromKey, toKey, mode) {
        const draft = getTemplateBateauCreateDraft();
        const catalogNodes = getCatalogNodesForTemplate();
        const pid = String(parentId || '').trim();
        if (!Array.isArray(draft.catalogNodeOrder[pid]) || !draft.catalogNodeOrder[pid].length) {
            draft.catalogNodeOrder[pid] = getOrderedSiblingIds(pid, catalogNodes, draft.catalogNodeOrder);
        }
        const list = draft.catalogNodeOrder[pid].slice();
        const fromIdx = list.findIndex((id) => String(id) === String(fromKey));
        const toIdx = list.findIndex((id) => String(id) === String(toKey));
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
        draft.catalogNodeOrder[pid] = reorderArrayByIndex(list, fromIdx, toIdx, mode);
    }

    const tplMirrorDndState = { fromId: '', parentId: '' };

    function getTplCollapsedSet() {
        if (!(global.__templateBateauCollapsedNodeIds instanceof Set)) {
            global.__templateBateauCollapsedNodeIds = new Set();
        }
        return global.__templateBateauCollapsedNodeIds;
    }

    function isTplNodeCollapsed(catalogNodeId) {
        return getTplCollapsedSet().has(String(catalogNodeId || '').trim());
    }

    function initTplCollapseDefaults(catalogNodes, rootIds) {
        if (global.__templateBateauCollapseDefaultsDone) return;
        global.__templateBateauCollapseDefaultsDone = true;
        const rootSet = new Set((Array.isArray(rootIds) ? rootIds : []).map((x) => String(x || '').trim()));
        const set = getTplCollapsedSet();
        (NodesCore()?.asNodeRows?.(catalogNodes) || []).forEach((row) => {
            if (rootSet.has(row.id)) return;
            const kids = NodesCore()?.getChildren?.(catalogNodes, row.id) || [];
            if (kids.length) set.add(row.id);
        });
    }

    function toggleTemplateBateauNodeCollapsed(catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        if (!id) return;
        const set = getTplCollapsedSet();
        if (set.has(id)) set.delete(id);
        else set.add(id);
        refreshTreeEditor();
    }

    function expandAllTemplateBateauTreeNodes() {
        getTplCollapsedSet().clear();
        refreshTreeEditor();
    }

    function collapseAllTemplateBateauTreeNodes() {
        const catalogNodes = getCatalogNodesForTemplate();
        const set = getTplCollapsedSet();
        set.clear();
        (NodesCore()?.asNodeRows?.(catalogNodes) || []).forEach((row) => {
            const kids = NodesCore()?.getChildren?.(catalogNodes, row.id) || [];
            if (kids.length) set.add(row.id);
        });
        refreshTreeEditor();
    }

    function resolveTplDropMode(event, itemEl) {
        const rect = itemEl.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const h = rect.height || 1;
        return y > h * 0.55 ? 'after' : 'before';
    }

    function closestTplOrderItem(target, listEl) {
        if (!target || !listEl) return null;
        let el = target;
        while (el && el !== listEl) {
            if (el.parentElement === listEl && el.hasAttribute('data-ugap-dnd-item')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function bindCatalogMirrorDragDrop() {
        const mount = global.document.getElementById('template-bateau-tree-mount');
        if (!mount || mount.dataset.tplMirrorDndBound === '1') return;
        mount.dataset.tplMirrorDndBound = '1';

        mount.addEventListener('dragstart', (e) => {
            const handle = e.target?.closest?.('.ugap-dnd-handle-cat');
            if (!handle) return;
            const listEl = handle.closest('[data-tpl-sibling-list]');
            const item = closestTplOrderItem(handle, listEl);
            if (!item || !listEl || !e.dataTransfer) return;
            const fromId = String(item.getAttribute('data-ugap-dnd-item') || '').trim();
            if (!fromId) return;
            tplMirrorDndState.fromId = fromId;
            tplMirrorDndState.parentId = String(listEl.getAttribute('data-order-parent') ?? '');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', fromId);
            e.dataTransfer.setData('application/x-ugap-tpl-node', fromId);
            item.classList.add('ugap-dnd--dragging');
        }, true);

        mount.addEventListener('dragend', (e) => {
            mount.querySelectorAll('.ugap-dnd--dragging').forEach((el) => el.classList.remove('ugap-dnd--dragging'));
            mount.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
                el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
            });
            tplMirrorDndState.fromId = '';
            tplMirrorDndState.parentId = '';
        }, true);

        mount.addEventListener('dragover', (e) => {
            if (!tplMirrorDndState.fromId) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const listEl = e.target?.closest?.('[data-tpl-sibling-list]');
            if (!listEl || String(listEl.getAttribute('data-order-parent') ?? '') !== tplMirrorDndState.parentId) {
                return;
            }
            const item = closestTplOrderItem(e.target, listEl);
            mount.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
                el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
            });
            if (item) {
                const toId = String(item.getAttribute('data-ugap-dnd-item') || '').trim();
                if (toId && toId !== tplMirrorDndState.fromId) {
                    item.classList.add(resolveTplDropMode(e, item) === 'after' ? 'ugap-dnd--drop-after' : 'ugap-dnd--drop-before');
                }
            }
        }, true);

        mount.addEventListener('drop', (e) => {
            if (!tplMirrorDndState.fromId) return;
            e.preventDefault();
            e.stopPropagation();
            const listEl = e.target?.closest?.('[data-tpl-sibling-list]');
            if (!listEl || String(listEl.getAttribute('data-order-parent') ?? '') !== tplMirrorDndState.parentId) {
                return;
            }
            const item = closestTplOrderItem(e.target, listEl);
            if (!item) return;
            const toId = String(item.getAttribute('data-ugap-dnd-item') || '').trim();
            const mode = resolveTplDropMode(e, item);
            mount.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
                el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
            });
            if (!toId || toId === tplMirrorDndState.fromId) return;
            reorderCatalogSiblings(tplMirrorDndState.parentId, tplMirrorDndState.fromId, toId, mode);
            refreshTreeEditor();
        }, true);
    }

    function bindAllTreeDragDrop() {
        bindCatalogMirrorDragDrop();
    }

    function renderCatalogNodeOptionsHtml(node) {
        const cnId = String(node?.catalogNodeRefId || '').trim();
        if (!cnId) return '';
        const cn = getCatalogNodeById(cnId);
        const catalogNodes = catalogNodesForOptionLookup();
        const { direct, onDescendants } = catalogNodeOptionsLinkSummary(cnId);
        if (direct.length) {
            const mode = String(cn?.decisionMode || 'single_choice') === 'multi_choice'
                ? 'choix multiple'
                : 'choix unique';
            return `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">${direct.length} option(s) · ${mode}</p>`;
        }
        if (onDescendants.length) {
            return `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">${onDescendants.length} option(s) sur les sous-nœuds</p>`;
        }
        const childCount = NodesCore()?.getChildren?.(catalogNodes, cnId)?.length || 0;
        if (childCount > 0) {
            return '<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Aucune option sur ce dossier — liez les options aux sous-nœuds (onglet Options).</p>';
        }
        return '<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Aucune option liée — onglet Options, colonne « Nœud catalogue ».</p>';
    }

    function renderCatalogMirrorNodeHtml(catalogNodeId, parentCatalogId, depth) {
        const node = buildVirtualNodeFromCatalogId(catalogNodeId);
        if (!node) return '';
        const draft = getTemplateBateauCreateDraft();
        const catalogNodes = getCatalogNodesForTemplate();
        const childIds = getOrderedSiblingIds(catalogNodeId, catalogNodes, draft.catalogNodeOrder);
        const cn = getCatalogNodeById(catalogNodeId);
        const hasKids = childIds.length > 0;
        const collapsed = hasKids && isTplNodeCollapsed(catalogNodeId);
        const shortLabel = escapeHtml(String(cn?.label || node.label || catalogNodeId).trim());
        const fullPath = escapeHtml(
            NodesCore()?.nodeBreadcrumb?.(catalogNodes, catalogNodeId) || shortLabel
        );
        const role = escapeHtml(catalogNodeRoleText(catalogNodeId));
        const foldBtn = hasKids
            ? `<button type="button" class="ugap-tpl-fold-btn" aria-expanded="${collapsed ? 'false' : 'true'}"
                title="${collapsed ? 'Déplier les sous-nœuds' : 'Replier les sous-nœuds'}"
                onclick="event.stopPropagation();toggleTemplateBateauNodeCollapsed(decodeURIComponent('${encodeURIComponent(catalogNodeId)}'))">${collapsed ? '▶' : '▼'}</button>`
            : '<span class="ugap-tpl-fold-spacer" aria-hidden="true"></span>';
        const kidsHtml = hasKids && !collapsed
            ? `<div class="ugap-tpl-sibling-list" data-tpl-sibling-list data-order-parent="${escapeHtml(catalogNodeId)}" style="margin-top:8px;padding-left:12px;border-left:2px solid #e2e8f0;">
                ${childIds.map((cid) => renderCatalogMirrorNodeHtml(cid, catalogNodeId, depth + 1)).join('')}
               </div>`
            : '';
        const collapsedClass = collapsed ? ' is-collapsed' : '';
        return `
            <div class="ugap-tpl-tree-node ugap-tpl-tree-node--mirror${collapsedClass}" data-ugap-dnd-item="${escapeHtml(catalogNodeId)}"
                data-catalog-node-id="${escapeHtml(catalogNodeId)}"
                style="margin-bottom:8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:${depth ? '#fff' : '#fafafa'};">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    ${foldBtn}
                    <span class="ugap-dnd-handle ugap-dnd-handle-cat" draggable="true" title="Glisser pour réordonner (même niveau)">⋮⋮</span>
                    <span style="flex:1;font-weight:600;" title="${fullPath}">${shortLabel}</span>
                    <span style="font-size:11px;color:#64748b;">${role}</span>
                </div>
                <div class="ugap-tpl-tree-node__body">
                    ${renderCatalogNodeOptionsHtml(node)}
                    ${kidsHtml}
                </div>
            </div>`;
    }

    function renderTemplateBateauTreeMountHtml() {
        if (!hasCatalogNodes()) {
            return '<p style="margin:0;color:#b45309;font-size:13px;">Aucun nœud catalogue — créez l’arborescence dans l’onglet <strong>Catalogue</strong>, puis revenez ici pour l’ordre du parcours.</p>';
        }
        const draft = getTemplateBateauCreateDraft();
        const catalogNodes = getCatalogNodesForTemplate();
        ensureCatalogNodeOrderIfEmpty(draft);
        let rootIds = getOrderedSiblingIds('', catalogNodes, draft.catalogNodeOrder);
        if (!rootIds.length) {
            rootIds = (NodesCore()?.getRootNodes?.(catalogNodes) || [])
                .map((n) => String(n.id || '').trim())
                .filter(Boolean);
        }
        initTplCollapseDefaults(catalogNodes, rootIds);
        return rootIds.length
            ? `<div class="ugap-tpl-tree-toolbar">
                <button type="button" class="btn btn-outline btn-sm" onclick="expandAllTemplateBateauTreeNodes()">Tout déplier</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="collapseAllTemplateBateauTreeNodes()">Tout replier</button>
               </div>
               <div class="ugap-tpl-sibling-list" data-tpl-sibling-list data-order-parent="">
                ${rootIds.map((id) => renderCatalogMirrorNodeHtml(id, '', 0)).join('')}
               </div>`
            : '<p style="margin:0;color:#64748b;font-size:13px;">Impossible de construire l’arbre — ouvrez l’onglet Catalogue et vérifiez le champ « Parent » de chaque nœud.</p>';
    }

    function refreshTemplateParcoursPreview() {
        const mount = global.document.getElementById('template-bateau-parcours-mount');
        if (!mount) return;

        if (!hasCatalogNodes()) {
            mount.innerHTML = '<p style="margin:0;color:#b45309;font-size:13px;">Aucun nœud catalogue — créez l’arborescence dans l’onglet <strong>Catalogue</strong>.</p>';
            return;
        }

        const draft = getTemplateBateauCreateDraft();
        const label = String(draft?.label || global.document.getElementById('new-template-bateau-label')?.value || '').trim();
        let snapshot;
        try {
            ensureCatalogNodeOrderIfEmpty(draft);
            snapshot = buildSnapshotFromDraft(draft);
        } catch (err) {
            mount.innerHTML = `<p style="margin:0;color:#b45309;font-size:13px;">${escapeHtml(err?.message || 'Impossible de prévisualiser le parcours.')}</p>`;
            return;
        }

        const bridge = global.UgapParametrageParcoursBridge;
        if (!bridge?.renderTemplateParcoursPreview) {
            mount.innerHTML = '<p style="margin:0;color:#64748b;font-size:13px;">Aperçu parcours indisponible — rechargez la page (Ctrl+F5).</p>';
            return;
        }
        const callbacks = {
            onReorder: (parentId, fromId, toId, mode) => {
                reorderCatalogSiblings(parentId, fromId, toId, mode);
                refreshTemplateParcoursPreview();
            },
            onRefreshPreview: () => refreshTemplateParcoursPreview(),
            onFivePercentLineToggle: (catalogNodeId, enabled) => {
                const draft = getTemplateBateauCreateDraft();
                if (!draft.catalogNodeFivePercentEnabled
                    || typeof draft.catalogNodeFivePercentEnabled !== 'object') {
                    draft.catalogNodeFivePercentEnabled = {};
                }
                draft.catalogNodeFivePercentEnabled[String(catalogNodeId || '').trim()] = enabled === true;
                refreshTemplateParcoursPreview();
            },
        };
        const draftTpl = { id: '__ugap_tpl_draft_preview__', label, snapshot };
        if (bridge.refreshTemplateParcoursInPlace?.(draftTpl, mount, label || 'Aperçu parcours', callbacks)) {
            return;
        }
        bridge.renderTemplateParcoursPreview(
            draftTpl,
            mount,
            label || 'Aperçu parcours',
            callbacks
        );
    }

    function renderTemplateBateauTreeEditorHtml() {
        const catalogNodes = getCatalogNodesForTemplate();
        const draft = getTemplateBateauCreateDraft();
        const Struct = Structure();
        if (!Struct?.renderStructureEditorShellHtml) {
            return '<p class="ugap-param-placeholder">Éditeur structure indisponible.</p>';
        }
        return `<div id="template-bateau-structure-mount">${Struct.renderStructureEditorShellHtml(catalogNodes, draft)}</div>`;
    }

    function refreshStructureEditor() {
        const mount = global.document.getElementById('template-bateau-structure-mount');
        const wrap = global.document.getElementById('template-bateau-tree-editor-wrap');
        const catalogNodes = getCatalogNodesForTemplate();
        const draft = getTemplateBateauCreateDraft();
        const Struct = Structure();
        if (!Struct?.renderStructureEditorShellHtml) return;
        const label = String(
            draft?.label || global.document.getElementById('new-template-bateau-label')?.value || ''
        ).trim();
        const shellHtml = Struct.renderStructureEditorShellHtml(catalogNodes, draft);
        if (mount) {
            mount.innerHTML = shellHtml;
            Struct.bindStructureEditor?.(mount, catalogNodes, () => refreshStructureEditor());
            Struct.refreshStructureParcoursPreview?.(catalogNodes, draft, label, () => {
                if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
            });
        } else if (wrap) {
            wrap.innerHTML = renderTemplateBateauTreeEditorHtml();
            const outer = wrap.querySelector('#template-bateau-structure-mount');
            if (outer) {
                Struct.bindStructureEditor?.(outer, catalogNodes, () => refreshStructureEditor());
                Struct.refreshStructureParcoursPreview?.(catalogNodes, draft, label, () => {
                    if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
                });
            }
        }
    }

    function refreshTreeEditor() {
        refreshStructureEditor();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function renderTemplateBateauCreationFormHtml() {
        const labelStyle = 'display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:4px;';
        const inputStyle = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;';
        return `
            <div class="ugap-template-bateau-create-form">
                <div style="display:grid;gap:14px;">
                    <div>
                        <label for="new-template-bateau-label" style="${labelStyle}">Nom du template</label>
                        <input id="new-template-bateau-label" type="text" placeholder="Ex. Zeppelin standard" style="${inputStyle}" autocomplete="off"
                            value="${escapeHtml(getTemplateBateauCreateDraft().label || '')}">
                    </div>
                    <div id="template-bateau-tree-editor-wrap">${renderTemplateBateauTreeEditorHtml()}</div>
                    <div id="template-bateau-form-feedback" hidden role="status" aria-live="polite"></div>
                </div>
            </div>
        `;
    }

    async function refreshTemplateBateauCreateDraftUi() {
        await ensureCatalogForTemplate();
        CatalogState()?.syncOptionsIndexFromPayload?.(getUgapData());
        const wrap = global.document.getElementById('template-bateau-tree-editor-wrap');
        if (wrap) wrap.innerHTML = renderTemplateBateauTreeEditorHtml();
        const labelEl = global.document.getElementById('new-template-bateau-label');
        if (labelEl && !labelEl.matches(':focus')) {
            labelEl.value = getTemplateBateauCreateDraft().label || '';
        }
        refreshStructureEditor();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function showTemplateBateauAlert(message, type) {
        if (typeof global.showAlert === 'function') {
            global.showAlert(message, type);
            return;
        }
        global.alert(String(message || ''));
    }

    function setTemplateBateauFormFeedback(message, type) {
        setStructureModalFeedback(message, type);
        const el = global.document.getElementById('template-bateau-form-feedback');
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        const colors = {
            warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
            error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
            success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
            info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }
        };
        const c = colors[type] || colors.info;
        el.hidden = false;
        el.style.cssText = `margin:0;padding:10px 12px;border-radius:6px;font-size:13px;line-height:1.45;
            background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
        el.textContent = String(message);
        el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }

    function validateDraftTree() {
        const nodes = getCatalogNodesForTemplate();
        if (!nodes.length) {
            const msg = 'Catalogue vide — créez des nœuds dans l’onglet Catalogue.';
            setTemplateBateauFormFeedback(msg, 'warning');
            showTemplateBateauAlert(msg, 'warning');
            return false;
        }
        const draft = getTemplateBateauCreateDraft();
        const included = Tree()?.normalizeIncludedCatalogNodeIds?.(draft.includedCatalogNodeIds, nodes) || [];
        if (!included.length) {
            const msg = 'Ajoutez au moins un nœud catalogue au template.';
            setTemplateBateauFormFeedback(msg, 'warning');
            showTemplateBateauAlert(msg, 'warning');
            return false;
        }
        setTemplateBateauFormFeedback('', '');
        return true;
    }

    function genTemplateVariantId() {
        return `tvar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function isStandardVariant(variant) {
        return String(variant?.label || '').trim().toLowerCase() === 'standard' || variant?.isDefault === true;
    }

    function ensureStandardVariantList(variants, snapshot) {
        const list = Array.isArray(variants) ? variants.map((v) => ({ ...v })) : [];
        let stdIdx = list.findIndex((v) => isStandardVariant(v));
        if (stdIdx < 0) {
            const legacyOrder = snapshot?.catalogNodeOrder && typeof snapshot.catalogNodeOrder === 'object'
                ? { ...snapshot.catalogNodeOrder }
                : {};
            list.unshift({
                id: genTemplateVariantId(),
                label: 'Standard',
                isDefault: true,
                catalogNodeOrder: legacyOrder,
            });
            stdIdx = 0;
        } else {
            list[stdIdx] = { ...list[stdIdx], label: 'Standard', isDefault: true };
        }
        return list.map((v, i) => ({ ...v, isDefault: i === stdIdx }));
    }

    function findStandardVariantId(variants) {
        const list = Array.isArray(variants) ? variants : [];
        const std = list.find((v) => isStandardVariant(v));
        return String(std?.id || list[0]?.id || '').trim();
    }

    function migrateTemplatesStandardVariants() {
        const getSaved = typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates : null;
        const setSaved = typeof global.setSavedBoatTemplates === 'function' ? global.setSavedBoatTemplates : null;
        if (!getSaved || !setSaved) return;
        const list = getSaved();
        let changed = false;
        const next = list.map((tpl) => {
            const variants = Array.isArray(tpl?.variants) ? tpl.variants : [];
            if (variants.some((v) => isStandardVariant(v))) return tpl;
            changed = true;
            return { ...tpl, variants: ensureStandardVariantList(variants, tpl?.snapshot) };
        });
        if (changed) setSaved(next);
    }

    async function submitCreateTemplateBateau() {
        try {
            await ensureCatalogForTemplate();
            const draft = getTemplateBateauCreateDraft();
            draft.label = String(global.document.getElementById('new-template-bateau-label')?.value || '').trim();
            const label = draft.label;
            if (!label) {
                const msg = 'Nom du template requis.';
                setTemplateBateauFormFeedback(msg, 'warning');
                showTemplateBateauAlert(msg, 'warning');
                return;
            }
            if (!validateDraftTree()) return;

            const getSaved = typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates : null;
            const setSaved = typeof global.setSavedBoatTemplates === 'function' ? global.setSavedBoatTemplates : null;
            if (!getSaved || !setSaved) {
                const msg = 'Enregistrement indisponible (rechargez la page paramétrage).';
                setTemplateBateauFormFeedback(msg, 'error');
                showTemplateBateauAlert(msg, 'warning');
                return;
            }
            const existing = getSaved();
            const editIdx = global.__templateBateauEditIndex;
            const isEdit = Number.isInteger(editIdx) && editIdx >= 0 && editIdx < existing.length;

            if (!isEdit && existing.some((t) => String(t?.label || '').trim().toLowerCase() === label.toLowerCase())) {
                const msg = 'Un template avec ce nom existe déjà.';
                setTemplateBateauFormFeedback(msg, 'info');
                showTemplateBateauAlert(msg, 'info');
                return;
            }

            const snapshot = buildSnapshotFromDraft(draft);
            const catalogue = getCatalogueCategoriesForTemplate();
            const catalogNodes = getCatalogNodesForTemplate();
            const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
            const treeForStats = buildPreviewTreeFromDraft(draft);
            const stats = Tree()
                ? Tree().countResolvedTreeStats(
                    treeForStats.length ? treeForStats : (snapshot.categoryTree || []),
                    (id) => byId.get(String(id || '').trim()) || null,
                    [],
                    { catalogNodes }
                )
                : {
                    nodes: (treeForStats.length ? treeForStats : snapshot.categoryTree || []).length,
                    groups: 0,
                };

            if (isEdit) {
                const prev = existing[editIdx];
                const variants = ensureStandardVariantList(prev.variants, prev.snapshot);
                const next = existing.slice();
                next[editIdx] = { ...prev, label, snapshot, variants };
                setSaved(next);
            } else {
                const slug = typeof global.slugifyFamilyDecisionGroupId === 'function'
                    ? global.slugifyFamilyDecisionGroupId(label)
                    : 'template';
                const id = `custom:${slug}:${Date.now()}`;
                const variantId = `tvar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                setSaved(existing.concat([{
                    id,
                    label,
                    snapshot,
                    variants: [{
                        id: variantId,
                        label: 'Standard',
                        isDefault: true,
                        catalogNodeOrder: {},
                    }],
                }]));
            }

            const afterSave = getSaved();
            const savedOk = isEdit
                ? afterSave[editIdx] && String(afterSave[editIdx].label || '').trim() === label
                : afterSave.some((t) => String(t?.label || '').trim() === label);
            if (!savedOk) {
                const msg = 'Échec de l’enregistrement local. Rechargez la page et réessayez.';
                setTemplateBateauFormFeedback(msg, 'error');
                showTemplateBateauAlert(msg, 'error');
                return;
            }

            if (typeof global.syncImportBoatTemplatesFromSaved === 'function') {
                global.syncImportBoatTemplatesFromSaved();
            }
            resetTemplateBateauCreateDraft();
            setTemplateBateauFormFeedback('', '');
            closeStructureModal();
            refreshTemplateBateauVueLC();
            const successMsg = `Template « ${label} » ${isEdit ? 'enregistré' : 'créé'} (${stats.nodes} nœud(s), ${stats.groups} choix catalogue).`;
            showTemplateBateauAlert(successMsg, 'success');
            if (!isEdit) {
                const savedIdx = getSaved().findIndex((t) => String(t?.label || '').trim() === label);
                const stdId = savedIdx >= 0 ? findStandardVariantId(getSaved()[savedIdx]?.variants) : '';
                if (savedIdx >= 0 && stdId) {
                    setTimeout(() => { void openVariantReorderModal(savedIdx, stdId); }, 80);
                }
            }
            try {
                if (typeof global.triggerUiStatePersistenceNow === 'function') {
                    await global.triggerUiStatePersistenceNow();
                }
            } catch (error) {
                showTemplateBateauAlert(`Enregistré localement (sync serveur : ${error?.message || error})`, 'warning');
            }
        } catch (error) {
            console.error('[UGAP] submitCreateTemplateBateau', error);
            const msg = `Erreur : ${error?.message || error}`;
            setTemplateBateauFormFeedback(msg, 'error');
            showTemplateBateauAlert(msg, 'error');
        }
    }

    const STRUCTURE_MODAL_ID = 'ugap-template-structure-modal';
    let structureModalSession = 0;

    function showStructureModalEl(modal) {
        if (!modal) return;
        modal.removeAttribute('hidden');
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('ugap-template-structure-open');
    }

    function hideStructureModalEl(modal) {
        if (!modal) return;
        modal.setAttribute('hidden', '');
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('ugap-template-structure-open');
    }

    function wireStructureModalChrome(modal) {
        if (!modal || modal.dataset.ugapStructureWired === '1') return;
        modal.dataset.ugapStructureWired = '1';

        modal.addEventListener('click', (ev) => {
            if (ev.target?.closest?.('#ugap-template-structure-modal-close')
                || ev.target?.closest?.('[data-ugap-tpl-cancel-structure]')) {
                ev.preventDefault();
                ev.stopPropagation();
                cancelTemplateBateauEdit();
                return;
            }
            if (ev.target?.closest?.('#template-bateau-submit-btn')
                || ev.target?.closest?.('[data-ugap-tpl-submit]')) {
                ev.preventDefault();
                ev.stopPropagation();
                void submitCreateTemplateBateau();
                return;
            }
            if (ev.target === modal) {
                cancelTemplateBateauEdit();
            }
        });

        modal.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            if (modal.hidden) return;
            ev.preventDefault();
            cancelTemplateBateauEdit();
        });
    }

    function ensureStructureModal() {
        let modal = global.document.getElementById(STRUCTURE_MODAL_ID);
        if (modal) {
            wireStructureModalChrome(modal);
            return modal;
        }
        const TB = PL().templateDeBase || {};
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${STRUCTURE_MODAL_ID}" hidden class="ugap-model-base-modal ugap-template-structure-modal"
                role="dialog" aria-modal="true" aria-labelledby="ugap-template-structure-modal-title" tabindex="-1">
                <div class="ugap-model-base-modal__panel card ugap-template-structure-modal__panel">
                    <div class="ugap-model-base-modal__head">
                        <div id="ugap-template-structure-modal-title"></div>
                        <button type="button" class="btn btn-outline" id="ugap-template-structure-modal-close"
                            onclick="cancelTemplateBateauEdit()" aria-label="Fermer">×</button>
                    </div>
                    <div id="ugap-template-structure-modal-body" class="ugap-template-structure-modal__body"></div>
                    <div class="ugap-template-structure-modal__foot">
                        <div id="ugap-template-structure-modal-feedback" hidden role="status" aria-live="polite"></div>
                        <div class="ugap-template-structure-modal__actions">
                            <button type="button" class="btn btn-outline" data-ugap-tpl-cancel-structure
                                onclick="cancelTemplateBateauEdit()">Annuler</button>
                            <button type="button" class="btn btn-success" id="template-bateau-submit-btn" data-ugap-tpl-submit>
                                ${escapeHtml(TB.create || 'Enregistrer')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
        modal = global.document.getElementById(STRUCTURE_MODAL_ID);
        wireStructureModalChrome(modal);
        return modal;
    }

    function closeStructureModal() {
        structureModalSession += 1;
        const modal = global.document.getElementById(STRUCTURE_MODAL_ID);
        const bodyEl = global.document.getElementById('ugap-template-structure-modal-body');
        if (bodyEl) bodyEl.innerHTML = '';
        hideStructureModalEl(modal);
        uiState.showCreatePanel = false;
        global.__templateBateauEditIndex = null;
    }

    function setStructureModalFeedback(message, type) {
        const el = global.document.getElementById('ugap-template-structure-modal-feedback');
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        const colors = {
            warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
            error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
            success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
            info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
        };
        const c = colors[type] || colors.info;
        el.hidden = false;
        el.style.cssText = `margin:0 0 10px;padding:10px 12px;border-radius:6px;font-size:13px;
            background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
        el.textContent = String(message);
    }

    async function openStructureModal(templateIndex) {
        const session = ++structureModalSession;
        const idx = Number.isInteger(templateIndex) ? Number(templateIndex) : null;
        const TB = PL().templateDeBase || {};
        await ensureCatalogForTemplate();
        if (session !== structureModalSession) return;

        if (idx == null) {
            resetTemplateBateauCreateDraft();
            global.__templateBateauEditIndex = null;
        } else {
            const tpl = getSavedTemplates()[idx];
            if (!tpl) {
                global.showAlert?.('Template introuvable.', 'warning');
                return;
            }
            global.__templateBateauEditIndex = idx;
            loadDraftFromTemplate(tpl);
        }
        if (session !== structureModalSession) return;

        const isEdit = Number.isInteger(global.__templateBateauEditIndex);
        const modal = ensureStructureModal();
        const titleEl = global.document.getElementById('ugap-template-structure-modal-title');
        const bodyEl = global.document.getElementById('ugap-template-structure-modal-body');
        const submitBtn = modal.querySelector('#template-bateau-submit-btn');
        if (titleEl) {
            titleEl.innerHTML = `<h3 id="ugap-template-structure-modal-title-text" style="margin:0;">
                ${isEdit ? escapeHtml(TB.editStructure || 'Modifier la structure') : escapeHtml(TB.create || 'Créer un template de base')}
            </h3>`;
        }
        if (bodyEl) {
            bodyEl.innerHTML = renderTemplateBateauCreationFormHtml();
        }
        if (submitBtn) {
            submitBtn.textContent = isEdit ? 'Enregistrer le template' : 'Créer le template';
        }
        setStructureModalFeedback('', '');
        showStructureModalEl(modal);
        modal.focus?.();

        await refreshTemplateBateauCreateDraftUi();
        if (session !== structureModalSession) return;

        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
            requestAnimationFrame(() => global.scheduleParentEmbedResize());
        }
    }

    function bindStructureModalEvents() {
        ensureStructureModal();
        if (global.document.body.dataset.ugapTemplateStructureModalBound === '1') return;
        global.document.body.dataset.ugapTemplateStructureModalBound = '1';
        global.document.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            const modal = global.document.getElementById(STRUCTURE_MODAL_ID);
            if (modal && !modal.hidden) cancelTemplateBateauEdit();
        });
    }

    const uiState = {
        searchQuery: '',
        showCreatePanel: false,
        editingVariant: null, // { templateIndex, variantId }
    };

    function getSavedTemplates() {
        return typeof global.getSavedBoatTemplates === 'function'
            ? global.getSavedBoatTemplates()
            : (BateauSt()?.getSavedBoatTemplates?.() || []);
    }

    function templateStats(tpl) {
        const snap = tpl?.snapshot || {};
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
        const resolveCategoryById = (id) => byId.get(String(id || '').trim()) || null;
        const tree = resolveSnapshotCategoryTree(snap);
        return Tree()
            ? Tree().countResolvedTreeStats(tree, resolveCategoryById, [], { catalogNodes })
            : { nodes: 0, groups: 0 };
    }

    function renderVariantsHtml(tpl, tplIndex) {
        const PP = PL().parcoursPerso || {};
        const templateId = String(tpl?.id || '').trim();
        const variants = BateauSt()?.getVariantsForTemplate?.(templateId)
            || (Array.isArray(tpl?.variants) ? tpl.variants : []);
        if (!variants.length) {
            return `<p class="ugap-template-card__variant-empty">${escapeHtml(PP.empty || 'Aucun parcours personnalisé.')}</p>`;
        }
        return variants.map((variant) => {
            const vid = String(variant?.id || '').trim();
            const label = String(variant?.label || vid).trim();
            const standard = isStandardVariant(variant);
            const defBadge = variant?.isDefault
                ? '<span class="ugap-template-card__variant-default">Par défaut</span>'
                : '';
            const nameHtml = standard
                ? `<span class="ugap-template-card__variant-name ugap-template-card__variant-name--fixed">${escapeHtml('Standard')}</span>`
                : `<input type="text" class="ugap-template-card__variant-name"
                    data-tpl-variant-rename="${tplIndex}" data-variant-id="${escapeHtml(vid)}"
                    value="${escapeHtml(label)}" title="Nom du parcours personnalisé">`;
            const reorderLabel = standard ? 'Modifier l\'ordre' : (PP.reorder || 'Réordonner');
            return `
                <div class="ugap-template-card__variant-row" data-variant-id="${escapeHtml(vid)}">
                    <div class="ugap-template-card__variant-main">
                        ${nameHtml}
                        ${defBadge}
                    </div>
                    <div class="ugap-template-card__variant-actions">
                        <button type="button" class="btn btn-primary btn-sm"
                            data-tpl-variant-reorder="${tplIndex}" data-variant-id="${escapeHtml(vid)}">
                            ${escapeHtml(reorderLabel)}
                        </button>
                        ${!variant?.isDefault ? `<button type="button" class="btn btn-outline btn-sm"
                            data-tpl-variant-default="${tplIndex}" data-variant-id="${escapeHtml(vid)}">Défaut</button>` : ''}
                        ${standard ? '' : `<button type="button" class="btn btn-outline btn-sm ugap-template-card__variant-delete"
                            data-tpl-variant-delete="${tplIndex}" data-variant-id="${escapeHtml(vid)}" title="Supprimer">×</button>`}
                    </div>
                </div>`;
        }).join('');
    }

    function renderTemplateCard(tpl, idx) {
        const stats = templateStats(tpl);
        const PP = PL().parcoursPerso || {};
        const TB = PL().templateDeBase || {};
        const variantCount = (BateauSt()?.getVariantsForTemplate?.(String(tpl?.id || '').trim()) || tpl?.variants || []).length;
        return `
            <article class="ugap-template-card card" data-template-index="${idx}">
                <header class="ugap-template-card__head">
                    <h3>${escapeHtml(String(tpl?.label || '—').trim())}</h3>
                    <div class="ugap-template-card__meta">
                        <span>${stats.nodes} nœud${stats.nodes !== 1 ? 's' : ''}</span>
                        <span>${stats.groups} choix</span>
                        <span>${variantCount} variant${variantCount !== 1 ? 's' : ''}</span>
                    </div>
                </header>
                <div class="ugap-template-card__actions">
                    <button type="button" class="btn btn-outline btn-sm" data-tpl-edit-structure="${idx}">
                        ${escapeHtml(TB.editStructure || 'Modifier la structure')}
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" data-tpl-delete="${idx}">Supprimer</button>
                </div>
                <div class="ugap-template-card__variants">
                    <div class="ugap-template-card__variants-head">
                        <strong>${escapeHtml(PP.title || 'Parcours personnalisés')}</strong>
                        <button type="button" class="btn btn-outline btn-sm" data-tpl-add-variant="${idx}">
                            + ${escapeHtml(PP.create || 'Ajouter')}
                        </button>
                    </div>
                    <div class="ugap-template-card__variant-list">${renderVariantsHtml(tpl, idx)}</div>
                </div>
            </article>`;
    }

    function renderCardsShell() {
        const TB = PL().templateDeBase || {};
        const q = String(uiState.searchQuery || '').trim().toLowerCase();
        const all = getSavedTemplates();
        const filtered = !q
            ? all
            : all.filter((t) => String(t?.label || '').toLowerCase().includes(q));
        return `
            <div class="ugap-template-cards-shell" data-ugap-template-cards="1">
                <div class="ugap-template-cards-toolbar">
                    <div>
                        <h2 style="margin:0 0 4px;">${escapeHtml(TB.title || 'Templates de base')}</h2>
                        <p style="margin:0;font-size:13px;color:#64748b;">
                            ${escapeHtml(TB.description || 'Créez la structure du parcours (nœuds catalogue), puis des parcours personnalisés par réordonnancement.')}
                        </p>
                    </div>
                    <div class="ugap-template-cards-toolbar__actions">
                        <input type="search" id="ugap-template-search" class="ugap-template-search"
                            placeholder="${escapeHtml(TB.searchPlaceholder || 'Rechercher…')}"
                            value="${escapeHtml(uiState.searchQuery)}">
                        <button type="button" class="btn btn-primary" id="ugap-template-create-btn">
                            ${escapeHtml(TB.create || 'Créer un template de base')}
                        </button>
                    </div>
                </div>
                <p class="ugap-template-cards-count">${filtered.length} template${filtered.length !== 1 ? 's' : ''}${filtered.length !== all.length ? ` / ${all.length}` : ''}</p>
                ${filtered.length
                    ? `<div class="ugap-template-cards">${filtered.map((t, i) => renderTemplateCard(t, all.indexOf(t))).join('')}</div>`
                    : `<p class="ugap-param-placeholder">${escapeHtml(TB.empty || 'Aucun template de base.')}</p>`}
            </div>`;
    }

    function ensureVariantModal() {
        let modal = global.document.getElementById('ugap-template-variant-modal');
        if (modal) return modal;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="ugap-template-variant-modal" hidden class="ugap-model-base-modal ugap-template-variant-modal"
                role="dialog" aria-modal="true" tabindex="-1">
                <div class="ugap-model-base-modal__panel card ugap-template-variant-modal__panel">
                    <div class="ugap-model-base-modal__head">
                        <div id="ugap-template-variant-modal-title"></div>
                        <button type="button" class="btn btn-outline" id="ugap-template-variant-modal-close"
                            onclick="closeUgapTemplateVariantModal()" aria-label="Fermer">×</button>
                    </div>
                    <div id="ugap-template-variant-modal-body" class="ugap-template-variant-modal__body"></div>
                    <div class="ugap-template-variant-modal__foot">
                        <button type="button" class="btn btn-primary" id="ugap-template-variant-modal-save"
                            onclick="saveUgapTemplateVariantModal()">Fermer</button>
                    </div>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
        return global.document.getElementById('ugap-template-variant-modal');
    }

    function closeVariantModal() {
        uiState.editingVariant = null;
        const modal = global.document.getElementById('ugap-template-variant-modal');
        const body = global.document.getElementById('ugap-template-variant-modal-body');
        if (body) body.innerHTML = '';
        if (modal) {
            modal.setAttribute('hidden', '');
            modal.hidden = true;
        }
        global.document.body.classList.remove('ugap-template-variant-open');
    }

    async function openVariantReorderModal(templateIndex, variantId) {
        const idx = Number(templateIndex);
        const list = getSavedTemplates();
        const tpl = list[idx];
        const vid = String(variantId || '').trim();
        if (!tpl || !vid) return;
        const variant = (BateauSt()?.getVariantsForTemplate?.(String(tpl.id || '').trim()) || tpl.variants || [])
            .find((v) => String(v?.id || '').trim() === vid);
        if (!variant) return;
        await ensureCatalogForTemplate();
        const modal = ensureVariantModal();
        const titleEl = global.document.getElementById('ugap-template-variant-modal-title');
        const bodyEl = global.document.getElementById('ugap-template-variant-modal-body');
        const PP = PL().parcoursPerso || {};
        if (titleEl) {
            titleEl.innerHTML = `<h3 style="margin:0;">${escapeHtml(PP.reorder || 'Réordonner')} — ${escapeHtml(variant.label)}</h3>
                <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Template : ${escapeHtml(tpl.label || '')}</p>`;
        }
        if (bodyEl) {
            bodyEl.innerHTML = VariantEd()?.renderVariantEditorShellHtml?.(variant.label)
                || '<p class="ugap-param-placeholder">Éditeur variant indisponible.</p>';
        }
        uiState.editingVariant = { templateIndex: idx, variantId: vid };
        modal.removeAttribute('hidden');
        modal.hidden = false;
        global.document.body.classList.add('ugap-template-variant-open');
        const mount = global.document.getElementById('template-bateau-variant-parcours-mount');
        if (mount && VariantEd()?.refreshVariantParcoursPreview) {
            VariantEd().refreshVariantParcoursPreview(tpl, variant, mount, {
                onChanged: () => refreshTemplateBateauVueLC(),
            });
        }
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    async function saveVariantModalAndClose() {
        try {
            if (typeof global.triggerUiStatePersistenceNow === 'function') {
                await global.triggerUiStatePersistenceNow();
            }
            closeVariantModal();
            refreshTemplateBateauVueLC();
            global.showAlert?.('Parcours enregistré.', 'success');
        } catch (err) {
            global.showAlert?.(err?.message || 'Erreur enregistrement', 'error');
        }
    }

    function promptVariantName(defaultName) {
        const PP = PL().parcoursPerso || {};
        const name = global.prompt(`Nom du ${PP.singular || 'parcours personnalisé'} :`, defaultName || 'Standard');
        if (name == null) return null;
        return String(name).trim() || null;
    }

    function bindCardsActions(mount) {
        if (!mount || mount.dataset.ugapTemplateCardsBound === '1') return;
        mount.dataset.ugapTemplateCardsBound = '1';

        mount.addEventListener('input', (ev) => {
            const search = ev.target.closest('#ugap-template-search');
            if (search) {
                uiState.searchQuery = search.value;
                refreshTemplateBateauVueLC();
                return;
            }
            const rename = ev.target.closest('.ugap-template-card__variant-name');
            if (!rename) return;
            const tplIdx = Number(rename.getAttribute('data-tpl-variant-rename'));
            const vid = String(rename.getAttribute('data-variant-id') || '').trim();
            const tpl = getSavedTemplates()[tplIdx];
            if (!tpl || !vid) return;
            if (rename.dataset.renameTimer) clearTimeout(Number(rename.dataset.renameTimer));
            rename.dataset.renameTimer = String(setTimeout(() => {
                BateauSt()?.renameTemplateVariant?.(String(tpl.id || '').trim(), vid, rename.value);
            }, 400));
        });

        mount.addEventListener('click', (ev) => {
            if (ev.target.closest('#ugap-template-create-btn')) {
                void openStructureModal(null);
                return;
            }
            const editBtn = ev.target.closest('[data-tpl-edit-structure]');
            if (editBtn) {
                void openStructureModal(Number(editBtn.getAttribute('data-tpl-edit-structure')));
                return;
            }
            const delBtn = ev.target.closest('[data-tpl-delete]');
            if (delBtn) {
                void deleteTemplateBateauByIndex(Number(delBtn.getAttribute('data-tpl-delete')));
                return;
            }
            const addVar = ev.target.closest('[data-tpl-add-variant]');
            if (addVar) {
                const tplIdx = Number(addVar.getAttribute('data-tpl-add-variant'));
                const tpl = getSavedTemplates()[tplIdx];
                if (!tpl) return;
                const name = promptVariantName('');
                if (!name) return;
                try {
                    const variant = BateauSt()?.createTemplateVariant?.(String(tpl.id || '').trim(), name);
                    refreshTemplateBateauVueLC();
                    if (variant?.id) void openVariantReorderModal(tplIdx, variant.id);
                    global.showAlert?.('Parcours personnalisé créé.', 'success');
                } catch (err) {
                    global.showAlert?.(err?.message || 'Erreur création variant', 'error');
                }
                return;
            }
            const reorderBtn = ev.target.closest('[data-tpl-variant-reorder]');
            if (reorderBtn) {
                void openVariantReorderModal(
                    Number(reorderBtn.getAttribute('data-tpl-variant-reorder')),
                    reorderBtn.getAttribute('data-variant-id')
                );
                return;
            }
            const defaultBtn = ev.target.closest('[data-tpl-variant-default]');
            if (defaultBtn) {
                const tplIdx = Number(defaultBtn.getAttribute('data-tpl-variant-default'));
                const tpl = getSavedTemplates()[tplIdx];
                const vid = String(defaultBtn.getAttribute('data-variant-id') || '').trim();
                if (tpl && vid) {
                    BateauSt()?.setDefaultTemplateVariant?.(String(tpl.id || '').trim(), vid);
                    refreshTemplateBateauVueLC();
                }
                return;
            }
            const delVar = ev.target.closest('[data-tpl-variant-delete]');
            if (delVar) {
                const tplIdx = Number(delVar.getAttribute('data-tpl-variant-delete'));
                const tpl = getSavedTemplates()[tplIdx];
                const vid = String(delVar.getAttribute('data-variant-id') || '').trim();
                if (!tpl || !vid) return;
                const variant = (BateauSt()?.getVariantsForTemplate?.(String(tpl.id || '').trim()) || tpl.variants || [])
                    .find((v) => String(v?.id || '').trim() === vid);
                if (isStandardVariant(variant)) return;
                if (!global.confirm('Supprimer ce parcours personnalisé ?')) return;
                BateauSt()?.deleteTemplateVariant?.(String(tpl.id || '').trim(), vid);
                refreshTemplateBateauVueLC();
            }
        });
    }

    function bindVariantModalEvents() {
        if (global.document.body.dataset.ugapTemplateVariantModalBound === '1') return;
        global.document.body.dataset.ugapTemplateVariantModalBound = '1';
        global.document.addEventListener('click', (ev) => {
            if (ev.target?.closest?.('#ugap-template-variant-modal-close')
                || ev.target?.closest?.('#ugap-template-variant-modal-save')) {
                void saveVariantModalAndClose();
                return;
            }
            const modal = global.document.getElementById('ugap-template-variant-modal');
            if (modal && !modal.hidden && ev.target === modal) closeVariantModal();
        });
        global.document.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            const modal = global.document.getElementById('ugap-template-variant-modal');
            if (modal && !modal.hidden) closeVariantModal();
        });
    }

    async function openTemplateBateauEditByIndex(index) {
        await openStructureModal(Number(index));
    }

    function cancelTemplateBateauEdit() {
        closeStructureModal();
        resetTemplateBateauCreateDraft();
        refreshTemplateBateauVueLC();
    }

    async function deleteTemplateBateauByIndex(index) {
        const idx = Number(index);
        const getSaved = typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates : () => [];
        const setSaved = typeof global.setSavedBoatTemplates === 'function' ? global.setSavedBoatTemplates : () => {};
        const list = getSaved();
        if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
        const tpl = list[idx];
        const name = String(tpl?.label || tpl?.id || '').trim();
        if (!global.confirm(`Supprimer le template « ${name} » ?`)) return;
        setSaved(list.filter((_, i) => i !== idx));
        if (typeof global.syncImportBoatTemplatesFromSaved === 'function') global.syncImportBoatTemplatesFromSaved();
        refreshTemplateBateauVueLC();
        try {
            if (typeof global.triggerUiStatePersistenceNow === 'function') await global.triggerUiStatePersistenceNow();
            global.showAlert?.('Template supprimé.', 'success');
        } catch (error) {
            global.showAlert?.(`Supprimé localement : ${error?.message || error}`, 'warning');
        }
    }

    function openTemplateBateauDetailByIndex(index) {
        openTemplateBateauEditByIndex(index);
    }

    async function refreshTemplateBateauVueLC() {
        migrateTemplatesStandardVariants();
        const mount = global.document.getElementById('ugap-template-bateau-lc-mount');
        if (!mount) return;
        const search = mount.querySelector('#ugap-template-search');
        const hadFocus = search && global.document.activeElement === search;
        const selStart = hadFocus ? search.selectionStart : null;
        const selEnd = hadFocus ? search.selectionEnd : null;
        mount.innerHTML = renderCardsShell();
        bindCardsActions(mount);
        if (hadFocus) {
            const nextSearch = mount.querySelector('#ugap-template-search');
            if (nextSearch) {
                nextSearch.focus();
                if (selStart != null && selEnd != null) {
                    try { nextSearch.setSelectionRange(selStart, selEnd); } catch (_e) { /* ignore */ }
                }
            }
        }
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function mountTemplateBateauVueLC() {
        const mount = global.document.getElementById('ugap-template-bateau-lc-mount');
        if (!mount) return;
        if (!Number.isInteger(global.__templateBateauEditIndex)) resetTemplateBateauCreateDraft();
        if (typeof global.syncImportBoatTemplatesFromSaved === 'function') global.syncImportBoatTemplatesFromSaved();
        bindVariantModalEvents();
        bindStructureModalEvents();
        void ensureCatalogForTemplate().then(() => refreshTemplateBateauVueLC());
    }

    global.mountTemplateBateauVueLC = mountTemplateBateauVueLC;
    global.refreshTemplateBateauVueLC = refreshTemplateBateauVueLC;
    global.submitCreateTemplateBateau = submitCreateTemplateBateau;
    global.deleteTemplateBateauByIndex = deleteTemplateBateauByIndex;
    global.openTemplateBateauDetailByIndex = openTemplateBateauDetailByIndex;
    global.openTemplateBateauEditByIndex = openTemplateBateauEditByIndex;
    global.cancelTemplateBateauEdit = cancelTemplateBateauEdit;
    global.closeUgapTemplateVariantModal = closeVariantModal;
    global.saveUgapTemplateVariantModal = () => { void saveVariantModalAndClose(); };
    global.toggleTemplateBateauNodeCollapsed = toggleTemplateBateauNodeCollapsed;
    global.expandAllTemplateBateauTreeNodes = expandAllTemplateBateauTreeNodes;
    global.collapseAllTemplateBateauTreeNodes = collapseAllTemplateBateauTreeNodes;
    global.resetTemplateBateauCreateDraft = resetTemplateBateauCreateDraft;
    global.getTemplateBateauCreateDraft = getTemplateBateauCreateDraft;

    global.UgapTemplateBateauTab = {
        mount: mountTemplateBateauVueLC,
        refresh: refreshTemplateBateauVueLC,
        refreshTree: refreshTemplateBateauCreateDraftUi,
    };
})(window);
