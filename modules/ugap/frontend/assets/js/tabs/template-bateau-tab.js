/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/template-bateau-tab.js
 * RÔLE : Template bateau — éditeur d’arbre categoryTree + refs groupes de décision.
 *
 * SORTIES : snapshot { categoryTree[], categoryIds[], baseOptionIds[] }
 * APPELÉ PAR : admin.php renderActiveTab('template-bateau')
 */
(function initUgapTemplateBateauTab(global) {
    'use strict';

    const Tree = () => global.UgapBoatTemplateTree;

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeGroups(raw) {
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return Array.isArray(raw) ? raw : [];
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

    function getCatalogueFamilies() {
        if (typeof global.getFamiliesForAssignationTab === 'function') {
            return global.getFamiliesForAssignationTab();
        }
        if (typeof global.getFamilleValidatedFamilies === 'function') {
            return global.getFamilleValidatedFamilies();
        }
        return [];
    }

    function resolveCategoryFamiliesWithGroups(cat) {
        if (Tree()) {
            return Tree().resolveCategoryFamiliesWithGroups(cat, getCatalogueFamilies());
        }
        return [];
    }

    function getBoatTemplateSnapshotCategories(tpl) {
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogue = getCatalogueCategoriesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));

        if (Tree()) {
            const normalized = Tree().normalizeBoatTemplateSnapshot(snap, {
                resolveCategoryById: (id) => byId.get(String(id || '').trim()) || null
            });
            return (normalized.categoryTree || []).map((node) => {
                const refId = String(node.categoryRefId || '').trim();
                const cat = refId ? byId.get(refId) : null;
                const families = cat ? resolveCategoryFamiliesWithGroups(cat) : [];
                const name = String(node.label || cat?.objectName || cat?.name || refId).trim() || '—';
                return {
                    id: node.id,
                    name,
                    objectName: name,
                    families,
                    missing: refId && !cat
                };
            });
        }

        const ids = Array.isArray(snap.categoryIds) ? snap.categoryIds : [];
        return ids.map((id) => {
            const cat = byId.get(id);
            const name = String(cat?.objectName || cat?.name || id).trim() || '—';
            return {
                id,
                name,
                objectName: name,
                families: cat ? resolveCategoryFamiliesWithGroups(cat) : [],
                missing: !cat
            };
        });
    }

    global.getBoatTemplateSnapshotCategories = getBoatTemplateSnapshotCategories;

    function getTemplateBateauCreateDraft() {
        if (!global.__templateBateauCreateDraft || typeof global.__templateBateauCreateDraft !== 'object') {
            global.__templateBateauCreateDraft = { label: '', categoryTree: [] };
        }
        if (!Array.isArray(global.__templateBateauCreateDraft.categoryTree)) {
            global.__templateBateauCreateDraft.categoryTree = [];
        }
        return global.__templateBateauCreateDraft;
    }

    function resetTemplateBateauCreateDraft() {
        global.__templateBateauCreateDraft = { label: '', categoryTree: [] };
        global.__templateBateauEditIndex = null;
    }

    function loadDraftFromTemplate(tpl) {
        const draft = getTemplateBateauCreateDraft();
        draft.label = String(tpl?.label || '').trim();
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogue = getCatalogueCategoriesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
        if (Tree()) {
            const normalized = Tree().normalizeBoatTemplateSnapshot(snap, {
                resolveCategoryById: (id) => byId.get(String(id || '').trim()) || null
            });
            draft.categoryTree = JSON.parse(JSON.stringify(normalized.categoryTree || []));
        } else {
            draft.categoryTree = [];
        }
    }

    function normalizeDraftTree(draft) {
        if (!Tree()) return draft.categoryTree || [];
        return Tree().normalizeCategoryTree(draft.categoryTree);
    }

    function buildSnapshotFromDraft(draft) {
        const tree = normalizeDraftTree(draft);
        const catalogue = getCatalogueCategoriesForTemplate();
        const byId = new Map(catalogue.map((c) => [String(c.id || '').trim(), c]));
        if (Tree()) {
            return Tree().normalizeBoatTemplateSnapshot(
                { categoryTree: tree, baseOptionIds: [] },
                { resolveCategoryById: (id) => byId.get(String(id || '').trim()) || null }
            );
        }
        return { categoryTree: tree, categoryIds: [], baseOptionIds: [] };
    }

    function listAvailableGroupRefs() {
        const refs = [];
        getCatalogueCategoriesForTemplate().forEach((cat) => {
            resolveCategoryFamiliesWithGroups(cat).forEach((fam) => {
                (fam.decisionGroups || []).forEach((g) => {
                    const groupId = String(g.id || '').trim();
                    const familyLabel = String(fam.familyLabel || '').trim();
                    if (!groupId || !familyLabel) return;
                    refs.push({
                        familyLabel,
                        groupId,
                        sourceIndex: fam.sourceIndex,
                        label: String(g.label || groupId).trim(),
                        decisionMode: g.decisionMode || 'single_choice',
                        categoryName: String(cat.objectName || cat.name || '').trim()
                    });
                });
            });
        });
        return refs;
    }

    function pathKeyToDomId(pathKey) {
        return String(pathKey || '').replace(/\./g, '-');
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

    function walkTreePaths(nodes, prefix, cb) {
        (Array.isArray(nodes) ? nodes : []).forEach((node, i) => {
            const path = prefix === '' ? String(i) : `${prefix}.${i}`;
            cb(path, node);
            if (!String(node?.subCategoryRefId || '').trim() && Array.isArray(node?.children)) {
                walkTreePaths(node.children, path, cb);
            }
        });
    }

    function reorderRootCategoryNodes(fromIdx, toIdx, mode) {
        const draft = getTemplateBateauCreateDraft();
        draft.categoryTree = reorderArrayByIndex(draft.categoryTree, fromIdx, toIdx, mode);
    }

    function reorderGroupRefs(pathKey, fromIdx, toIdx, mode) {
        const { node } = getNodeByPath(pathKey);
        if (!node || !Array.isArray(node.decisionGroupRefs)) return;
        node.decisionGroupRefs = reorderArrayByIndex(node.decisionGroupRefs, fromIdx, toIdx, mode);
    }

    function bindRootTreeDragDrop() {
        const mount = global.document.getElementById('template-bateau-tree-mount');
        if (!mount || !global.UgapSortableDnd?.bindSortableDnd) return;
        delete mount.dataset.ugapDndBound;
        global.UgapSortableDnd.bindSortableDnd(mount, {
            dataType: 'text/ugap-tpl-cat-node',
            itemSelector: '[data-tpl-tree-root]',
            handleSelector: '.ugap-dnd-handle-cat',
            allowNest: false,
            getItemId: (el) => el.getAttribute('data-tpl-tree-root'),
            onDrop: (fromId, toId, mode) => {
                reorderRootCategoryNodes(Number(fromId), Number(toId), mode);
                refreshTreeEditor();
            },
        });
    }

    function bindGroupRefsDragDrop(pathKey) {
        if (!global.UgapSortableDnd?.bindSortableDnd) return;
        const domId = pathKeyToDomId(pathKey);
        const listEl = global.document.getElementById(`template-bateau-grp-list-${domId}`);
        if (!listEl) return;
        delete listEl.dataset.ugapDndBound;
        global.UgapSortableDnd.bindSortableDnd(listEl, {
            dataType: `text/ugap-tpl-grp-${domId}`,
            itemSelector: '[data-tpl-grp-ref]',
            handleSelector: '.ugap-dnd-handle-group',
            allowNest: false,
            getItemId: (el) => el.getAttribute('data-tpl-grp-ref'),
            onDrop: (fromId, toId, mode) => {
                reorderGroupRefs(pathKey, Number(fromId), Number(toId), mode);
                refreshTreeEditor();
            },
        });
    }

    function bindAllTreeDragDrop() {
        bindRootTreeDragDrop();
        const draft = getTemplateBateauCreateDraft();
        walkTreePaths(normalizeDraftTree(draft), '', (pathKey, node) => {
            if (String(node?.subCategoryRefId || '').trim()) return;
            bindGroupRefsDragDrop(pathKey);
        });
    }

    function renderGroupRefsHtml(node, pathKey) {
        const refs = Array.isArray(node.decisionGroupRefs) ? node.decisionGroupRefs : [];
        const domId = pathKeyToDomId(pathKey);
        if (!refs.length) {
            return '<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Aucun groupe — l’ordre vient de la catégorie catalogue ou ajoutez via « + Groupe ».</p>';
        }
        return `<ul id="template-bateau-grp-list-${domId}" data-ugap-dnd-root
            style="margin:6px 0 0;padding:0;list-style:none;font-size:12px;color:#475569;display:flex;flex-direction:column;gap:4px;">
            ${refs.map((r, ri) => {
                const fl = escapeHtml(r.familyLabel);
                const gid = escapeHtml(r.groupId);
                const label = escapeHtml(String(r.label || r.groupId || '').trim() || r.groupId);
                return `<li data-tpl-grp-ref="${ri}" style="margin:0;display:flex;align-items:center;gap:8px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;">
                    <span class="ugap-dnd-handle ugap-dnd-handle-group" draggable="true" title="Glisser pour réordonner le groupe">⋮</span>
                    <span style="flex:1;"><strong>${label}</strong> <span style="color:#64748b;">(${fl} · ${gid})</span></span>
                    <button type="button" class="btn btn-outline" style="font-size:11px;padding:2px 6px;"
                        onclick="removeTemplateBateauGroupRef('${pathKey}',${ri})">Retirer</button>
                </li>`;
            }).join('')}
        </ul>`;
    }

    function renderTreeNodeHtml(node, pathKey, depth) {
        const n = node && typeof node === 'object' ? node : {};
        const label = escapeHtml(n.label || 'Catégorie');
        const isSub = !!String(n.subCategoryRefId || '').trim();
        const pad = Math.min(depth * 14, 56);
        const children = isSub ? [] : (Array.isArray(n.children) ? n.children : []);
        const rootDrag = depth === 0 && !isSub
            ? `<span class="ugap-dnd-handle ugap-dnd-handle-cat" draggable="true" title="Glisser pour réordonner les catégories">⋮⋮</span>`
            : '';
        const rootAttr = depth === 0 && !isSub ? ` data-tpl-tree-root="${escapeHtml(pathKey)}"` : '';
        const actions = isSub
            ? `<button type="button" class="btn btn-danger" style="font-size:12px;padding:4px 8px;"
                    onclick="deleteTemplateBateauNode('${pathKey}')">Suppr.</button>`
            : `<button type="button" class="btn btn-outline" style="font-size:12px;padding:4px 8px;"
                    onclick="openTemplateBateauAddGroupRef('${pathKey}')">+ Groupe</button>
                <button type="button" class="btn btn-danger" style="font-size:12px;padding:4px 8px;"
                    onclick="deleteTemplateBateauNode('${pathKey}')">Suppr.</button>`;
        return `
            <div class="ugap-tpl-tree-node" data-path="${escapeHtml(pathKey)}"${rootAttr}
                style="margin-left:${pad}px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:${isSub ? '#fff' : '#fafafa'};margin-bottom:8px;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    ${rootDrag}
                    <input type="text" value="${label}" style="flex:1;min-width:160px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-weight:600;"
                        onchange="updateTemplateBateauNodeLabel('${pathKey}', this.value)" ${isSub ? '' : ''}>
                    ${actions}
                </div>
                ${isSub ? '' : renderGroupRefsHtml(n, pathKey)}
                ${children.map((child, ci) => renderTreeNodeHtml(child, `${pathKey}.${ci}`, depth + 1)).join('')}
            </div>
        `;
    }

    function renderTemplateBateauTreeEditorHtml() {
        const draft = getTemplateBateauCreateDraft();
        const tree = normalizeDraftTree(draft);
        const cats = getCatalogueCategoriesForTemplate();
        const catOptions = cats.map((c) => {
            const id = String(c.id || '').trim();
            const name = escapeHtml(String(c.objectName || c.name || id));
            return `<option value="${escapeHtml(id)}">${name}</option>`;
        }).join('');

        return `
            <div class="ugap-tpl-tree-editor" style="display:grid;gap:12px;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                    <div style="flex:1;min-width:200px;">
                        <label style="display:block;font-size:12px;color:#555;margin-bottom:4px;">Ajouter depuis le catalogue</label>
                        <select id="template-bateau-add-catalogue" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                            <option value="">— Choisir une catégorie —</option>
                            ${catOptions}
                        </select>
                    </div>
                    <button type="button" class="btn btn-outline" onclick="addTemplateBateauRootFromCatalogue()">Ajouter catégorie</button>
                </div>
                <div id="template-bateau-tree-mount" data-ugap-dnd-root>
                    ${tree.length
                        ? tree.map((node, i) => renderTreeNodeHtml(node, String(i), 0)).join('')
                        : '<p style="margin:0;color:#64748b;font-size:13px;">Arbre vide — ajoutez une catégorie racine.</p>'}
                </div>
                <p style="margin:0;font-size:12px;color:#64748b;">Ordre du parcours : ⋮⋮ sur une catégorie, ⋮ sur chaque groupe.</p>
            </div>
        `;
    }

    function refreshTreeEditor() {
        const mount = global.document.getElementById('template-bateau-tree-mount');
        const draft = getTemplateBateauCreateDraft();
        const tree = normalizeDraftTree(draft);
        if (mount) {
            mount.innerHTML = tree.length
                ? tree.map((node, i) => renderTreeNodeHtml(node, String(i), 0)).join('')
                : '<p style="margin:0;color:#64748b;font-size:13px;">Arbre vide — ajoutez une catégorie racine.</p>';
        } else {
            const wrap = global.document.getElementById('template-bateau-tree-editor-wrap');
            if (wrap) wrap.innerHTML = renderTemplateBateauTreeEditorHtml();
        }
        bindAllTreeDragDrop();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function getNodeByPath(pathKey) {
        const draft = getTemplateBateauCreateDraft();
        const parts = String(pathKey || '').split('.').map((x) => Number(x));
        let list = draft.categoryTree;
        let node = null;
        parts.forEach((idx, i) => {
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            node = list[idx];
            if (i < parts.length - 1) list = Array.isArray(node.children) ? node.children : [];
        });
        return { node, list, index: parts[parts.length - 1] };
    }

    function addTemplateBateauRootFromCatalogue() {
        const catId = String(global.document.getElementById('template-bateau-add-catalogue')?.value || '').trim();
        if (!catId) {
            global.showAlert?.('Choisissez une catégorie catalogue.', 'warning');
            return;
        }
        const cat = getCatalogueCategoriesForTemplate().find((c) => String(c.id) === catId);
        if (!cat) return;
        const families = resolveCategoryFamiliesWithGroups(cat);
        const children = Tree()?.buildTemplateChildNodesFromCategory
            ? Tree().buildTemplateChildNodesFromCategory(cat)
            : [];
        const draft = getTemplateBateauCreateDraft();
        const node = Tree()
            ? Tree().normalizeTreeNode({
                id: Tree().newNodeId('tplcat'),
                label: String(cat.objectName || cat.name || '').trim() || catId,
                categoryRefId: catId,
                decisionGroupRefs: Tree().buildRefsFromCategoryFamilies(families),
                children
            })
            : { id: `tplcat_${Date.now()}`, label: catId, categoryRefId: catId, decisionGroupRefs: [], children };
        draft.categoryTree.push(node);
        refreshTreeEditor();
    }

    function updateTemplateBateauNodeLabel(pathKey, value) {
        const { node } = getNodeByPath(pathKey);
        if (node) node.label = String(value || '').trim() || 'Catégorie';
    }

    function deleteTemplateBateauNode(pathKey) {
        const parts = String(pathKey || '').split('.').map((x) => Number(x));
        const draft = getTemplateBateauCreateDraft();
        if (parts.length === 1) {
            draft.categoryTree.splice(parts[0], 1);
        } else {
            const parentPath = parts.slice(0, -1).join('.');
            const { node: parent } = getNodeByPath(parentPath);
            if (parent && Array.isArray(parent.children)) {
                parent.children.splice(parts[parts.length - 1], 1);
            }
        }
        refreshTreeEditor();
    }

    function removeTemplateBateauGroupRef(pathKey, refIndex) {
        const { node } = getNodeByPath(pathKey);
        if (!node || !Array.isArray(node.decisionGroupRefs)) return;
        node.decisionGroupRefs.splice(Number(refIndex), 1);
        refreshTreeEditor();
    }

    function ensureTemplateBateauGroupPickerModal() {
        let modal = global.document.getElementById('template-bateau-group-picker-modal');
        if (modal) return modal;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="template-bateau-group-picker-modal" hidden
                style="display:none;position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px;">
                <div style="background:#fff;border-radius:10px;padding:20px;max-width:520px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.15);">
                    <h3 style="margin:0 0 12px;font-size:16px;">Ajouter un groupe de décision</h3>
                    <p style="margin:0 0 12px;font-size:13px;color:#64748b;">Une option côté configurateur = un groupe (choix unique ou multiple).</p>
                    <div id="template-bateau-group-picker-list"></div>
                    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                        <button type="button" class="btn btn-outline" id="template-bateau-group-picker-cancel">Annuler</button>
                        <button type="button" class="btn btn-success" id="template-bateau-group-picker-confirm">Ajouter</button>
                    </div>
                </div>
            </div>
        `;
        modal = wrap.firstElementChild;
        global.document.body.appendChild(modal);
        global.document.getElementById('template-bateau-group-picker-cancel')?.addEventListener('click', closeTemplateBateauGroupPicker);
        global.document.getElementById('template-bateau-group-picker-confirm')?.addEventListener('click', confirmTemplateBateauGroupPick);
        return modal;
    }

    function openTemplateBateauAddGroupRef(pathKey) {
        const { node } = getNodeByPath(pathKey);
        if (!node) return;
        const available = listAvailableGroupRefs();
        if (!available.length) {
            global.showAlert?.('Aucun groupe disponible : créez des familles (onglet Famille) puis rattachez-les via le catalogue / template.', 'warning');
            return;
        }
        const existing = new Set(
            (node.decisionGroupRefs || []).map((r) => `${r.familyLabel}:${r.groupId}`)
        );
        const choices = available.filter((a) => !existing.has(`${a.familyLabel}:${a.groupId}`));
        if (!choices.length) {
            global.showAlert?.('Tous les groupes catalogue sont déjà sur ce nœud.', 'info');
            return;
        }
        global.__templateBateauGroupPickPath = pathKey;
        const modal = ensureTemplateBateauGroupPickerModal();
        const listEl = global.document.getElementById('template-bateau-group-picker-list');
        if (!listEl || !modal) {
            global.showAlert?.('Panneau groupe indisponible — rechargez la page.', 'warning');
            return;
        }
        listEl.innerHTML = choices.map((a, i) => {
            const mode = a.decisionMode === 'multi_choice' ? 'multiple' : 'unique';
            return `<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px;cursor:pointer;">
                <input type="radio" name="tpl-group-pick" value="${i}" style="margin-top:3px;">
                <span>
                    <strong>${escapeHtml(a.label)}</strong>
                    <span style="display:block;font-size:12px;color:#64748b;">
                        ${escapeHtml(a.categoryName)} · ${escapeHtml(a.familyLabel)} · choix ${mode}
                    </span>
                </span>
            </label>`;
        }).join('');
        modal.removeAttribute('hidden');
        modal.style.display = 'flex';
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function closeTemplateBateauGroupPicker() {
        const modal = global.document.getElementById('template-bateau-group-picker-modal');
        if (modal) {
            modal.setAttribute('hidden', '');
            modal.style.display = 'none';
        }
        global.__templateBateauGroupPickPath = null;
    }

    function confirmTemplateBateauGroupPick() {
        const pathKey = global.__templateBateauGroupPickPath;
        const { node } = getNodeByPath(pathKey);
        if (!node) {
            closeTemplateBateauGroupPicker();
            return;
        }
        const available = listAvailableGroupRefs();
        const existing = new Set(
            (node.decisionGroupRefs || []).map((r) => `${r.familyLabel}:${r.groupId}`)
        );
        const choices = available.filter((a) => !existing.has(`${a.familyLabel}:${a.groupId}`));
        const picked = global.document.querySelector('input[name="tpl-group-pick"]:checked');
        const idx = Number(picked?.value);
        if (!Number.isInteger(idx) || idx < 0 || idx >= choices.length) {
            global.showAlert?.('Sélectionnez un groupe dans la liste.', 'warning');
            return;
        }
        const chosen = choices[idx];
        if (!Array.isArray(node.decisionGroupRefs)) node.decisionGroupRefs = [];
        node.decisionGroupRefs.push({
            familyLabel: chosen.familyLabel,
            groupId: chosen.groupId,
            sourceIndex: chosen.sourceIndex,
            label: chosen.label,
        });
        closeTemplateBateauGroupPicker();
        refreshTreeEditor();
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

    function refreshTemplateBateauCreateDraftUi() {
        const wrap = global.document.getElementById('template-bateau-tree-editor-wrap');
        if (wrap) wrap.innerHTML = renderTemplateBateauTreeEditorHtml();
        const labelEl = global.document.getElementById('new-template-bateau-label');
        if (labelEl && !labelEl.matches(':focus')) {
            labelEl.value = getTemplateBateauCreateDraft().label || '';
        }
        wireTemplateBateauSubmitButton();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function showTemplateBateauAlert(message, type) {
        if (typeof global.showAlert === 'function') {
            global.showAlert(message, type);
            return;
        }
        global.alert(String(message || ''));
    }

    function treeHasSubCategoryNodes(nodes) {
        const walk = (list) => {
            for (const n of Array.isArray(list) ? list : []) {
                if (String(n?.subCategoryRefId || '').trim() && String(n?.categoryRefId || '').trim()) {
                    return true;
                }
                if (walk(n.children)) return true;
            }
            return false;
        };
        return walk(nodes);
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

    function validateDraftTree(draft) {
        const tree = normalizeDraftTree(draft);
        if (!tree.length) {
            const msg = 'Ajoutez au moins une catégorie racine à l’arbre.';
            setTemplateBateauFormFeedback(msg, 'warning');
            showTemplateBateauAlert(msg, 'warning');
            return false;
        }
        const stats = Tree() ? Tree().countTreeStats(tree) : { groups: 0 };
        if (stats.groups > 0) {
            setTemplateBateauFormFeedback('', '');
            return true;
        }
        if (treeHasSubCategoryNodes(tree)) {
            setTemplateBateauFormFeedback('', '');
            return true;
        }
        if (tree.some((n) => String(n?.categoryRefId || '').trim())) {
            setTemplateBateauFormFeedback('', '');
            return true;
        }
        const msg = 'Rattachez des familles avec groupes cochés (catalogue) ou ajoutez des groupes (+ Groupe) sur un nœud du template.';
        setTemplateBateauFormFeedback(msg, 'warning');
        showTemplateBateauAlert(msg, 'warning');
        return false;
    }

    async function submitCreateTemplateBateau() {
        try {
            const draft = getTemplateBateauCreateDraft();
            draft.label = String(global.document.getElementById('new-template-bateau-label')?.value || '').trim();
            const label = draft.label;
            if (!label) {
                const msg = 'Nom du template requis.';
                setTemplateBateauFormFeedback(msg, 'warning');
                showTemplateBateauAlert(msg, 'warning');
                return;
            }
            if (!validateDraftTree(draft)) return;

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
            const stats = Tree()
                ? Tree().countTreeStats(snapshot.categoryTree)
                : { nodes: snapshot.categoryTree?.length || 0, groups: 0 };

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
            const successMsg = `Template « ${label} » ${isEdit ? 'enregistré' : 'créé'} (${stats.nodes} nœud(s), ${stats.groups} groupe(s)).`;
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

    function openTemplateBateauEditByIndex(index) {
        const idx = Number(index);
        const list = typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates() : [];
        const tpl = list[idx];
        if (!tpl) {
            global.showAlert?.('Template introuvable.', 'warning');
            return;
        }
        global.__templateBateauEditIndex = idx;
        loadDraftFromTemplate(tpl);
        const panel = global.document.querySelector('[data-ugap-lc-create-panel="template-bateau"]');
        const btn = global.document.querySelector('[data-ugap-lc-create="template-bateau"]');
        if (panel) {
            panel.innerHTML = renderTemplateBateauCreationFormHtml();
            panel.removeAttribute('hidden');
            wireTemplateBateauSubmitButton();
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
        return getSaved().map((tpl, idx) => {
            const snap = tpl?.snapshot || {};
            const tree = Tree() ? Tree().normalizeCategoryTree(snap.categoryTree) : [];
            const stats = Tree() ? Tree().countTreeStats(tree) : { nodes: 0, groups: 0 };
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

    function refreshTemplateBateauVueLC() {
        const mount = global.document.getElementById('ugap-template-bateau-lc-mount');
        if (!mount) return;
        if (mount.querySelector('[data-ugap-vue-lc="template-bateau"]') && global.UgapTemplates?.refreshVueLCList) {
            global.UgapTemplates.refreshVueLCList('template-bateau', mount);
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
            description: 'Choisissez les catégories catalogue et ordonnez catégories (⋮⋮) et groupes (⋮) pour le parcours configurateur.',
            columns: [
                { key: 'label', label: 'Nom' },
                { key: 'categoriesCount', label: 'Nœuds' },
                { key: 'groupsCount', label: 'Groupes' },
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
                refreshTemplateBateauCreateDraftUi();
            }
        };
        mount.innerHTML = global.UgapTemplates.renderVueLC(config);
        global.UgapTemplates.bindVueLC(mount, config);
        ensureTemplateBateauGroupPickerModal();
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
    global.addTemplateBateauRootFromCatalogue = addTemplateBateauRootFromCatalogue;
    global.updateTemplateBateauNodeLabel = updateTemplateBateauNodeLabel;
    global.deleteTemplateBateauNode = deleteTemplateBateauNode;
    global.removeTemplateBateauGroupRef = removeTemplateBateauGroupRef;
    global.openTemplateBateauAddGroupRef = openTemplateBateauAddGroupRef;
    global.closeTemplateBateauGroupPicker = closeTemplateBateauGroupPicker;
    global.confirmTemplateBateauGroupPick = confirmTemplateBateauGroupPick;
    global.resetTemplateBateauCreateDraft = resetTemplateBateauCreateDraft;

    global.UgapTemplateBateauTab = { mount: mountTemplateBateauVueLC, refresh: refreshTemplateBateauVueLC };
})(window);
