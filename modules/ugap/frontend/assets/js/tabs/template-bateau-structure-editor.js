/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/template-bateau-structure-editor.js
 * RÔLE : Éditeur de structure — sélection des nœuds catalogue (même tableau que « Modifier l’ordre »).
 *
 * ENTRÉES : brouillon template (includedCatalogNodeIds), nœuds catalogue
 * SORTIES : tableau parcours + mutations du brouillon
 *
 * DÉPEND DE : parametrage-parcours-bridge.js, boat-template-tree.js, UgapCatalogueNodesCore
 * NE PAS : drag-and-drop, ordre parcours (→ variant Standard), persistance serveur
 *
 * APPELÉ PAR : template-bateau-tab.js
 */
(function initUgapTemplateBateauStructureEditor(global) {
    'use strict';

    const Tree = () => global.UgapBoatTemplateTree;
    const Core = () => global.UgapCatalogueNodesCore;
    const Bridge = () => global.UgapParametrageParcoursBridge;

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function getDraft() {
        if (typeof global.getTemplateBateauCreateDraft === 'function') {
            return global.getTemplateBateauCreateDraft();
        }
        return global.__templateBateauCreateDraft || {};
    }

    function ensureDraftShape(draft) {
        const d = draft || getDraft();
        if (!Array.isArray(d.includedCatalogNodeIds)) d.includedCatalogNodeIds = [];
        if (!d.catalogNodeOrder || typeof d.catalogNodeOrder !== 'object') d.catalogNodeOrder = {};
        return d;
    }

    function includedSet(draft, catalogNodes) {
        const d = ensureDraftShape(draft);
        const ids = Tree()?.normalizeIncludedCatalogNodeIds?.(d.includedCatalogNodeIds, catalogNodes)
            || d.includedCatalogNodeIds.map((x) => String(x || '').trim()).filter(Boolean);
        return new Set(ids);
    }

    function syncStructureOrderFromCatalog(draft, catalogNodes) {
        const d = ensureDraftShape(draft);
        const included = Tree()?.normalizeIncludedCatalogNodeIds?.(d.includedCatalogNodeIds, catalogNodes) || [];
        if (Tree()?.sanitizeStructureCatalogNodeOrder) {
            d.catalogNodeOrder = Tree().sanitizeStructureCatalogNodeOrder(catalogNodes, {}, included);
        }
        return d;
    }

    function orderedSiblingIds(parentId, catalogNodes, draft) {
        const d = syncStructureOrderFromCatalog(draft, catalogNodes);
        const inc = includedSet(d, catalogNodes);
        const BTree = Tree();
        if (BTree?.orderedStructureSiblingIds) {
            return BTree.orderedStructureSiblingIds(parentId, catalogNodes, d.catalogNodeOrder, inc);
        }
        return [];
    }

    function ensureOrderList(draft, parentId, catalogNodes) {
        const d = syncStructureOrderFromCatalog(draft, catalogNodes);
        const pid = String(parentId || '').trim();
        if (!Array.isArray(d.catalogNodeOrder[pid]) || !d.catalogNodeOrder[pid].length) {
            d.catalogNodeOrder[pid] = orderedSiblingIds(pid, catalogNodes, d);
        }
        return d.catalogNodeOrder[pid];
    }

    function addCatalogNodeToDraft(catalogNodeId, catalogNodes, draft) {
        const d = ensureDraftShape(draft);
        const BTree = Tree();
        const id = String(catalogNodeId || '').trim();
        if (!id) return false;
        const inc = includedSet(d, catalogNodes);
        if (inc.has(id)) return false;

        const toAdd = [id];
        (BTree?.collectCatalogAncestorIds?.(catalogNodes, id) || []).forEach((aid) => {
            if (!inc.has(aid)) toAdd.unshift(aid);
        });

        toAdd.forEach((nid) => {
            if (d.includedCatalogNodeIds.includes(nid)) return;
            d.includedCatalogNodeIds.push(nid);
            const row = Core()?.getNodeById?.(catalogNodes, nid);
            const parentId = String(row?.parentId ?? row?.parent ?? '').trim();
            const list = ensureOrderList(d, parentId, catalogNodes);
            if (!list.includes(nid)) list.push(nid);
        });
        syncStructureOrderFromCatalog(d, catalogNodes);
        return true;
    }

    function removeCatalogNodeFromDraft(catalogNodeId, catalogNodes, draft) {
        const d = ensureDraftShape(draft);
        const id = String(catalogNodeId || '').trim();
        if (!id) return false;
        const BTree = Tree();
        const removeIds = new Set([id, ...(BTree?.collectCatalogDescendantIds?.(catalogNodes, id) || [])]);
        d.includedCatalogNodeIds = d.includedCatalogNodeIds.filter((x) => !removeIds.has(String(x || '').trim()));
        Object.keys(d.catalogNodeOrder).forEach((pid) => {
            d.catalogNodeOrder[pid] = (Array.isArray(d.catalogNodeOrder[pid]) ? d.catalogNodeOrder[pid] : [])
                .filter((x) => !removeIds.has(String(x || '').trim()));
        });
        syncStructureOrderFromCatalog(d, catalogNodes);
        return true;
    }

    function renderAddNodeSelectHtml(parentCatalogId, catalogNodes, draft) {
        const pid = String(parentCatalogId || '').trim();
        const inc = includedSet(draft, catalogNodes);
        const candidates = (Core()?.getChildren?.(catalogNodes, pid) || [])
            .map((n) => ({
                id: String(n?.id || '').trim(),
                label: String(n?.label || n?.id || '').trim(),
            }))
            .filter((n) => n.id && !inc.has(n.id));
        if (!candidates.length) return '';
        const opts = candidates.map((n) => `<option value="${esc(n.id)}">${esc(n.label)}</option>`).join('');
        return `
            <select class="ugap-tpl-add-node-select" data-add-parent="${esc(pid)}" title="Ajouter un nœud catalogue">
                <option value="">+ Ajouter…</option>
                ${opts}
            </select>`;
    }

    function buildStructureActionCell(rowDef, catalogNodes, draft) {
        const cnId = String(rowDef?.catalogNodeId || '').trim();
        if (!cnId) return '<td class="ugap-tpl-structure-action-td"></td>';
        const addHtml = renderAddNodeSelectHtml(cnId, catalogNodes, draft);
        return `<td class="ugap-tpl-structure-action-td">
            <div class="ugap-tpl-structure-action-cell">
                <button type="button" class="btn btn-outline btn-sm" data-remove-catalog-node="${esc(cnId)}" title="Retirer du template">Retirer</button>
                ${addHtml}
            </div>
        </td>`;
    }

    function buildStructurePreviewTemplate(draft, catalogNodes, label) {
        const d = syncStructureOrderFromCatalog(draft, catalogNodes);
        const BTree = Tree();
        const included = BTree?.normalizeIncludedCatalogNodeIds?.(d.includedCatalogNodeIds, catalogNodes) || [];
        const order = d.catalogNodeOrder || {};
        let categoryTree = [];
        if (BTree?.buildCategoryTreeFromIncludedCatalog) {
            categoryTree = BTree.buildCategoryTreeFromIncludedCatalog(catalogNodes, order, included);
        }
        return {
            id: '__ugap_tpl_structure_preview__',
            label: String(label || 'Structure').trim() || 'Structure',
            snapshot: {
                categoryTree,
                baseOptionIds: [],
                catalogNodeOrder: order,
                includedCatalogNodeIds: included,
                catalogNodeFivePercentEnabled: d.catalogNodeFivePercentEnabled || {},
            },
        };
    }

    function structureHintText() {
        const TB = global.UgapParcoursLabels?.templateDeBase || {};
        return TB.structureHint
            || 'Ajoutez ou retirez des nœuds catalogue. L’ordre d’affichage se règle dans le parcours <strong>Standard</strong>.';
    }

    function renderStructureEditorShellHtml(catalogNodes, draft) {
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const d = ensureDraftShape(draft);
        if (!nodes.length) {
            return '<p class="ugap-param-placeholder">Aucun nœud catalogue — créez l’arborescence dans l’onglet <strong>Catalogue</strong>.</p>';
        }
        const addRoot = renderAddNodeSelectHtml('', nodes, d);
        return `
            <div class="ugap-tpl-structure-editor ugap-tpl-variant-editor">
                ${addRoot ? `<div class="ugap-tpl-structure-editor__roots-actions">${addRoot}</div>` : ''}
                <div id="template-bateau-structure-parcours-mount"></div>
            </div>`;
    }

    function refreshStructureParcoursPreview(catalogNodes, draft, label, onChanged) {
        const mount = global.document.getElementById('template-bateau-structure-parcours-mount');
        if (!mount) return;
        const bridge = Bridge();
        if (!bridge?.renderTemplateStructurePreview) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Éditeur structure indisponible.</p>';
            return;
        }
        const previewTpl = buildStructurePreviewTemplate(draft, catalogNodes, label);
        const callbacks = {
            getHint: () => structureHintText(),
            buildActionCell: (rowDef) => buildStructureActionCell(rowDef, catalogNodes, draft),
            onRefreshPreview: () => refreshStructureParcoursPreview(catalogNodes, draft, label, onChanged),
        };
        if (bridge.refreshTemplateStructureInPlace?.(previewTpl, mount, previewTpl.label, callbacks)) {
            onChanged?.();
            return;
        }
        bridge.renderTemplateStructurePreview(previewTpl, mount, previewTpl.label, callbacks);
        onChanged?.();
    }

    function bindStructureEditor(mount, catalogNodes, onChanged) {
        if (!mount || mount.dataset.tplStructureBound === '1') return;
        mount.dataset.tplStructureBound = '1';

        mount.addEventListener('change', (e) => {
            const sel = e.target?.closest?.('.ugap-tpl-add-node-select');
            if (!sel) return;
            const nodeId = String(sel.value || '').trim();
            const parentId = String(sel.getAttribute('data-add-parent') || '').trim();
            if (!nodeId) return;
            const draft = getDraft();
            if (parentId) {
                const parentIncluded = includedSet(draft, catalogNodes).has(parentId);
                if (!parentIncluded) addCatalogNodeToDraft(parentId, catalogNodes, draft);
            }
            addCatalogNodeToDraft(nodeId, catalogNodes, draft);
            sel.value = '';
            onChanged?.();
        });

        mount.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('[data-remove-catalog-node]');
            if (!btn) return;
            e.preventDefault();
            const nodeId = String(btn.getAttribute('data-remove-catalog-node') || '').trim();
            if (!nodeId) return;
            if (!global.confirm('Retirer ce nœud du template (et ses sous-nœuds) ?')) return;
            removeCatalogNodeFromDraft(nodeId, catalogNodes, getDraft());
            onChanged?.();
        });
    }

    function loadDraftStructureFromTemplate(tpl, catalogNodes) {
        const draft = ensureDraftShape(getDraft());
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const BTree = Tree();
        let included = BTree?.resolveIncludedCatalogNodeIds?.(snap, catalogNodes, snap.catalogNodeOrder) || [];
        if (!snap.includedCatalogNodeIds?.length && BTree?.collectIdsFromCatalogNodeOrder) {
            const fromOrder = BTree.collectIdsFromCatalogNodeOrder(snap.catalogNodeOrder);
            if (fromOrder.size) included = Array.from(fromOrder);
        }
        draft.includedCatalogNodeIds = included.slice();
        draft.catalogNodeOrder = BTree?.sanitizeStructureCatalogNodeOrder
            ? BTree.sanitizeStructureCatalogNodeOrder(catalogNodes, {}, included)
            : {};
        draft.catalogNodeFivePercentEnabled = BTree?.normalizeCatalogNodeFivePercentEnabled?.(
            snap.catalogNodeFivePercentEnabled
        ) || {};
        return draft;
    }

    global.UgapTemplateBateauStructureEditor = {
        ensureDraftShape,
        addCatalogNodeToDraft,
        removeCatalogNodeFromDraft,
        syncStructureOrderFromCatalog,
        renderStructureEditorShellHtml,
        refreshStructureParcoursPreview,
        bindStructureEditor,
        loadDraftStructureFromTemplate,
        orderedSiblingIds,
        includedSet,
        renderStructureEditorHtml: renderStructureEditorShellHtml,
    };
})(window);
