/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/template-bateau-tab.js
 * RÔLE : Template bateau — ordre du parcours (miroir onglet Catalogue) + snapshot dérivé (categoryTree + catalogNodeOrder).
 * Pas d’édition famille/groupe ici : nœuds = Catalogue, options = onglet Options (catalogObjectId).
 *
 * SORTIES : snapshot { catalogNodeOrder, categoryTree[], categoryIds[], baseOptionIds[] }
 * APPELÉ PAR : admin.php renderActiveTab('template-bateau')
 */
(function initUgapTemplateBateauTab(global) {
    'use strict';

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
        if (!Tree()?.buildCategoryTreeFromCatalog || !hasCatalogNodes()) return [];
        ensureCatalogNodeOrderIfEmpty(d);
        const catalogNodes = getCatalogNodesForTemplate();
        const order = Tree().normalizeCatalogNodeOrder?.(d.catalogNodeOrder) || d.catalogNodeOrder;
        return Tree().buildCategoryTreeFromCatalog(catalogNodes, order);
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
            global.__templateBateauCreateDraft = { label: '', catalogNodeOrder: {}, categoryTree: [] };
        }
        if (!global.__templateBateauCreateDraft.catalogNodeOrder
            || typeof global.__templateBateauCreateDraft.catalogNodeOrder !== 'object') {
            global.__templateBateauCreateDraft.catalogNodeOrder = {};
        }
        if (!Array.isArray(global.__templateBateauCreateDraft.categoryTree)) {
            global.__templateBateauCreateDraft.categoryTree = [];
        }
        return global.__templateBateauCreateDraft;
    }

    function resetTemplateBateauCreateDraft() {
        global.__templateBateauCreateDraft = { label: '', catalogNodeOrder: {}, categoryTree: [] };
        global.__templateBateauEditIndex = null;
        global.__templateBateauCollapseDefaultsDone = false;
        if (global.__templateBateauCollapsedNodeIds instanceof Set) {
            global.__templateBateauCollapsedNodeIds.clear();
        }
    }

    function loadDraftFromTemplate(tpl) {
        const draft = getTemplateBateauCreateDraft();
        draft.label = String(tpl?.label || '').trim();
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
        if (Tree()) {
            const resolveCategoryById = (id) => byId.get(String(id || '').trim()) || null;
            const normalized = Tree().normalizeBoatTemplateSnapshot(snap, {
                resolveCategoryById,
                catalogNodes,
            });
            let order = Tree().normalizeCatalogNodeOrder?.(
                snap.catalogNodeOrder || normalized.catalogNodeOrder
            ) || {};
            if (!Object.keys(order).length && (normalized.categoryTree || []).length) {
                order = Tree().extractCatalogNodeOrderFromCategoryTree(
                    normalized.categoryTree,
                    catalogNodes
                );
            }
            order = sanitizeCatalogNodeOrder(order, catalogNodes);
            draft.catalogNodeOrder = catalogNodes.length
                ? Tree().mergeCatalogNodeOrder(catalogNodes, order)
                : {};
            draft.categoryTree = [];
        } else {
            draft.catalogNodeOrder = {};
            draft.categoryTree = [];
        }
    }

    function normalizeDraftTree(draft) {
        return buildPreviewTreeFromDraft(draft);
    }

    function buildSnapshotFromDraft(draft) {
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const optionById = Tree()?.buildCatalogueOptionById?.(catalogue) || new Map();
        if (!Tree()?.buildCategoryTreeFromCatalog) {
            throw new Error('Module template indisponible — rechargez la page.');
        }
        if (!catalogNodes.length) {
            throw new Error('Catalogue vide — créez des nœuds dans l’onglet Catalogue avant d’enregistrer le template.');
        }
        ensureCatalogNodeOrderIfEmpty(draft);
        const catalogNodeOrder = Tree().normalizeCatalogNodeOrder(draft.catalogNodeOrder);
        const tree = Tree().buildCategoryTreeFromCatalog(catalogNodes, catalogNodeOrder);
        Tree().syncCatalogNodeLinkedRefs(tree, catalogNodes, [], optionById);
        const snap = { categoryTree: tree, baseOptionIds: [], catalogNodeOrder };
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

    function renderTemplateBateauTreeEditorHtml() {
        const intro = hasCatalogNodes()
            ? 'Arborescence identique à l’onglet <strong>Catalogue</strong>. <strong>▼/▶</strong> pour replier, ⋮⋮ pour l’ordre du parcours. Options : onglet <strong>Options</strong> (colonne « Nœud catalogue »).'
            : 'Créez d’abord des nœuds dans l’onglet <strong>Catalogue</strong>.';
        return `
            <div class="ugap-tpl-tree-editor" style="display:grid;gap:12px;">
                <p style="margin:0;font-size:13px;color:#475569;">${intro}</p>
                <div id="template-bateau-tree-mount">${renderTemplateBateauTreeMountHtml()}</div>
            </div>`;
    }

    function refreshTreeEditor() {
        const mount = global.document.getElementById('template-bateau-tree-mount');
        if (mount) {
            delete mount.dataset.tplMirrorDndBound;
            mount.innerHTML = renderTemplateBateauTreeMountHtml();
        } else {
            const wrap = global.document.getElementById('template-bateau-tree-editor-wrap');
            if (wrap) wrap.innerHTML = renderTemplateBateauTreeEditorHtml();
        }
        bindAllTreeDragDrop();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function renderTemplateBateauCreationFormHtml() {
        const isEdit = Number.isInteger(global.__templateBateauEditIndex);
        const labelStyle = 'display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:4px;';
        const inputStyle = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;';
        return `
            <div class="ugap-template-bateau-create-form" style="padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
                <div style="display:grid;gap:14px;">
                    <div style="max-width:420px;">
                        <label for="new-template-bateau-label" style="${labelStyle}">Nom du template</label>
                        <input id="new-template-bateau-label" type="text" placeholder="Ex. Zeppelin standard" style="${inputStyle}" autocomplete="off"
                            value="${escapeHtml(getTemplateBateauCreateDraft().label || '')}">
                    </div>
                    <div id="template-bateau-tree-editor-wrap">${renderTemplateBateauTreeEditorHtml()}</div>
                    <div id="template-bateau-form-feedback" hidden role="status" aria-live="polite"></div>
                    <div>
                        <button type="button" class="btn btn-success" id="template-bateau-submit-btn" data-ugap-tpl-submit>
                            ${isEdit ? 'Enregistrer le template' : 'Créer le template'}
                        </button>
                        ${isEdit ? `<button type="button" class="btn btn-outline" style="margin-left:8px;" data-ugap-tpl-cancel
                            onclick="cancelTemplateBateauEdit()">Annuler</button>` : ''}
                    </div>
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
        wireTemplateBateauSubmitButton();
        bindAllTreeDragDrop();
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
        const roots = NodesCore()?.getRootNodes?.(nodes)
            || NodesCore()?.getChildren?.(nodes, '')
            || [];
        if (!roots.length) {
            const msg = 'Aucun nœud racine — vérifiez le champ « Parent » dans l’onglet Catalogue.';
            setTemplateBateauFormFeedback(msg, 'warning');
            showTemplateBateauAlert(msg, 'warning');
            return false;
        }
        setTemplateBateauFormFeedback('', '');
        return true;
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
                const next = existing.slice();
                next[editIdx] = { ...prev, label, snapshot };
                setSaved(next);
            } else {
                const slug = typeof global.slugifyFamilyDecisionGroupId === 'function'
                    ? global.slugifyFamilyDecisionGroupId(label)
                    : 'template';
                const id = `custom:${slug}:${Date.now()}`;
                setSaved(existing.concat([{ id, label, snapshot }]));
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
            const panel = global.document.querySelector('[data-ugap-lc-create-panel="template-bateau"]');
            const btn = global.document.querySelector('[data-ugap-lc-create="template-bateau"]');
            if (panel) panel.setAttribute('hidden', '');
            if (btn) btn.setAttribute('aria-expanded', 'false');
            refreshTemplateBateauVueLC();
            const successMsg = `Template « ${label} » ${isEdit ? 'enregistré' : 'créé'} (${stats.nodes} nœud(s), ${stats.groups} choix catalogue).`;
            showTemplateBateauAlert(successMsg, 'success');
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

    function wireTemplateBateauSubmitButton() {
        const btn = global.document.getElementById('template-bateau-submit-btn');
        if (!btn || btn.dataset.ugapTplSubmitBound === '1') return;
        btn.dataset.ugapTplSubmitBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitCreateTemplateBateau();
        });
    }

    function bindTemplateBateauCreateFormActions(mount) {
        const root = mount && mount.querySelector ? mount : global.document.getElementById('ugap-template-bateau-lc-mount');
        if (!root || root.dataset.ugapTplCreateBound === '1') return;
        root.dataset.ugapTplCreateBound = '1';
        root.addEventListener('click', (e) => {
            if (e.target.closest('[data-ugap-tpl-cancel]')) {
                e.preventDefault();
                cancelTemplateBateauEdit();
            }
        });
        wireTemplateBateauSubmitButton();
    }

    async function openTemplateBateauEditByIndex(index) {
        const idx = Number(index);
        const list = typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates() : [];
        const tpl = list[idx];
        if (!tpl) {
            global.showAlert?.('Template introuvable.', 'warning');
            return;
        }
        await ensureCatalogForTemplate();
        global.__templateBateauEditIndex = idx;
        loadDraftFromTemplate(tpl);
        const panel = global.document.querySelector('[data-ugap-lc-create-panel="template-bateau"]');
        const btn = global.document.querySelector('[data-ugap-lc-create="template-bateau"]');
        if (panel) {
            panel.innerHTML = renderTemplateBateauCreationFormHtml();
            panel.removeAttribute('hidden');
            wireTemplateBateauSubmitButton();
            bindAllTreeDragDrop();
        }
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function cancelTemplateBateauEdit() {
        resetTemplateBateauCreateDraft();
        const panel = global.document.querySelector('[data-ugap-lc-create-panel="template-bateau"]');
        const btn = global.document.querySelector('[data-ugap-lc-create="template-bateau"]');
        if (panel) panel.setAttribute('hidden', '');
        if (btn) btn.setAttribute('aria-expanded', 'false');
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

    function getTemplateBateauRowsForLc() {
        const getSaved = typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates : () => [];
        const catalogue = getCatalogueCategoriesForTemplate();
        const catalogNodes = getCatalogNodesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
        const resolveCategoryById = (id) => byId.get(String(id || '').trim()) || null;
        return getSaved().map((tpl, idx) => {
            const snap = tpl?.snapshot || {};
            const tree = resolveSnapshotCategoryTree(snap);
            const stats = Tree()
                ? Tree().countResolvedTreeStats(tree, resolveCategoryById, [], { catalogNodes })
                : { nodes: 0, groups: 0 };
            return {
                __idx: idx,
                label: String(tpl?.label || '').trim() || '—',
                categoriesCount: stats.nodes,
                familiesCount: '—',
                groupsCount: stats.groups,
                baseOptionsCount: Array.isArray(snap.baseOptionIds) ? snap.baseOptionIds.length : 0,
                _actionsHtml: `<div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline" style="font-size:12px;padding:4px 8px;" onclick="event.stopPropagation();openTemplateBateauEditByIndex(${idx})">Modifier</button>
                    <button type="button" class="btn btn-danger" style="font-size:12px;padding:4px 8px;" onclick="event.stopPropagation();deleteTemplateBateauByIndex(${idx})">Supprimer</button>
                </div>`
            };
        });
    }

    async function refreshTemplateBateauVueLC() {
        const mount = global.document.getElementById('ugap-template-bateau-lc-mount');
        if (!mount) return;
        if (mount.querySelector('[data-ugap-vue-lc="template-bateau"]') && global.UgapTemplates?.refreshVueLCList) {
            global.UgapTemplates.refreshVueLCList('template-bateau', mount);
            if (global.document.getElementById('template-bateau-tree-mount')
                || global.document.getElementById('template-bateau-tree-editor-wrap')) {
                await refreshTemplateBateauCreateDraftUi();
            }
            return;
        }
        mountTemplateBateauVueLC();
    }

    function mountTemplateBateauVueLC() {
        const mount = global.document.getElementById('ugap-template-bateau-lc-mount');
        if (!mount) return;
        if (!Number.isInteger(global.__templateBateauEditIndex)) resetTemplateBateauCreateDraft();
        if (typeof global.syncImportBoatTemplatesFromSaved === 'function') global.syncImportBoatTemplatesFromSaved();
        if (!global.UgapTemplates?.renderVueLC) {
            mount.innerHTML = '<div style="padding:12px;color:#b45309;">Module UgapTemplates indisponible.</div>';
            return;
        }
        const config = {
            elementKey: 'template-bateau',
            elementLabel: 'template bateau',
            title: 'Bateau de base',
            description: 'Réordonnez le parcours configurateur (⋮⋮) — même arbre que l’onglet Catalogue.',
            columns: [
                { key: 'label', label: 'Nom' },
                { key: 'categoriesCount', label: 'Nœuds' },
                { key: 'groupsCount', label: 'Choix catalogue' },
                { key: 'baseOptionsCount', label: 'Options de base' },
                { key: '_actionsHtml', label: 'Actions', type: 'html' }
            ],
            getRows: getTemplateBateauRowsForLc,
            listToolbar: {
                sortKey: 'label',
                searchKeys: ['label'],
                searchPlaceholder: 'Rechercher un template…'
            },
            countLabel: 'template(s)',
            emptyMessage: 'Aucun template. Créez-en un avec l’arbre ci-dessous.',
            rowDblClickHandler: (idx) => openTemplateBateauEditByIndex(idx),
            createFormHtml: renderTemplateBateauCreationFormHtml(),
            onCreatePanelOpen: () => {
                if (!Number.isInteger(global.__templateBateauEditIndex)) resetTemplateBateauCreateDraft();
                void refreshTemplateBateauCreateDraftUi();
            }
        };
        mount.innerHTML = global.UgapTemplates.renderVueLC(config);
        global.UgapTemplates.bindVueLC(mount, config);
        bindTemplateBateauCreateFormActions(mount);
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    global.mountTemplateBateauVueLC = mountTemplateBateauVueLC;
    global.refreshTemplateBateauVueLC = refreshTemplateBateauVueLC;
    global.submitCreateTemplateBateau = submitCreateTemplateBateau;
    global.deleteTemplateBateauByIndex = deleteTemplateBateauByIndex;
    global.openTemplateBateauDetailByIndex = openTemplateBateauDetailByIndex;
    global.openTemplateBateauEditByIndex = openTemplateBateauEditByIndex;
    global.cancelTemplateBateauEdit = cancelTemplateBateauEdit;
    global.toggleTemplateBateauNodeCollapsed = toggleTemplateBateauNodeCollapsed;
    global.expandAllTemplateBateauTreeNodes = expandAllTemplateBateauTreeNodes;
    global.collapseAllTemplateBateauTreeNodes = collapseAllTemplateBateauTreeNodes;
    global.resetTemplateBateauCreateDraft = resetTemplateBateauCreateDraft;

    global.UgapTemplateBateauTab = {
        mount: mountTemplateBateauVueLC,
        refresh: refreshTemplateBateauVueLC,
        refreshTree: refreshTemplateBateauCreateDraftUi,
    };
})(window);
