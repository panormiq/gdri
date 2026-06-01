/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/categorie-tab-subcategories.js
 * RÔLE : Sous-catégories hiérarchiques (drag-and-drop) + familles/groupes par sous-catégorie.
 *
 * ENTRÉES : draft partagé categorie-tab
 * SORTIES : subCategories[] avec families[], parentSubCategoryId?, ordre tableau
 *
 * DÉPEND DE : categorie-tab.js, ugap-family-draft-ui.js, ugap-sortable-dnd.js
 * APPELÉ PAR : categorie-tab.js
 */
(function initUgapCategorieTabSubcategories(global) {
    'use strict';

    const ROOT_KEY = '__root__';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function prefixForSubIndex(subIndex) {
        return `categorie-sc-${Number(subIndex)}`;
    }

    function getDraft() {
        if (typeof global.getCategorieCreateDraft === 'function') return global.getCategorieCreateDraft();
        return global.__categorieCreateDraft || {};
    }

    function sanitizeFamilyEntry(entry) {
        const e = entry && typeof entry === 'object' ? entry : {};
        const sourceIndex = Number(e.sourceIndex);
        return {
            familyLabel: String(e.familyLabel || '').trim(),
            objectName: String(e.objectName || '').trim(),
            sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : null,
            selectedGroupIds: Array.isArray(e.selectedGroupIds)
                ? e.selectedGroupIds.map((x) => String(x || '').trim()).filter(Boolean)
                : []
        };
    }

    function ensureSubCategories() {
        const draft = getDraft();
        if (!Array.isArray(draft.subCategories)) draft.subCategories = [];
        return draft;
    }

    function getSubCategoriesRaw() {
        return ensureSubCategories().subCategories;
    }

    function getSubCategoryById(subId) {
        const id = String(subId || '').trim();
        return getSubCategoriesRaw().find((sc) => String(sc?.id || '').trim() === id) || null;
    }

    function getSubCategory(subIndex) {
        const draft = ensureSubCategories();
        const idx = Number(subIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= draft.subCategories.length) return null;
        const sc = draft.subCategories[idx];
        if (!Array.isArray(sc.families)) sc.families = [];
        return sc;
    }

    function sanitizeSubCategory(raw) {
        const sc = raw && typeof raw === 'object' ? raw : {};
        const name = String(sc.name || '').trim();
        if (!name) return null;
        const families = (Array.isArray(sc.families) ? sc.families : [])
            .map(sanitizeFamilyEntry)
            .filter((f) => f.familyLabel && (f.selectedGroupIds || []).length > 0);
        const parentSubCategoryId = String(sc.parentSubCategoryId || '').trim();
        return {
            id: String(sc.id || '').trim() || `subcat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            description: String(sc.description || '').trim(),
            families,
            optionIds: Array.isArray(sc.optionIds)
                ? sc.optionIds.map((x) => String(x || '').trim()).filter(Boolean)
                : [],
            familyId: String(sc.familyId || '').trim(),
            ...(parentSubCategoryId ? { parentSubCategoryId } : {})
        };
    }

    function wouldCreateCycle(childId, parentId) {
        const child = String(childId || '').trim();
        const parent = String(parentId || '').trim();
        if (!child || !parent || child === parent) return true;
        let cursor = parent;
        const seen = new Set();
        while (cursor && !seen.has(cursor)) {
            if (cursor === child) return true;
            seen.add(cursor);
            const node = getSubCategoryById(cursor);
            cursor = String(node?.parentSubCategoryId || '').trim();
        }
        return false;
    }

    function flattenSubCategoriesDepthFirst(items) {
        const list = Array.isArray(items) ? items : [];
        const byParent = new Map();
        list.forEach((sc) => {
            const pid = String(sc?.parentSubCategoryId || '').trim() || ROOT_KEY;
            if (!byParent.has(pid)) byParent.set(pid, []);
            byParent.get(pid).push(sc);
        });
        const out = [];
        const walk = (parentKey) => {
            (byParent.get(parentKey) || []).forEach((sc) => {
                out.push(sc);
                walk(String(sc.id || '').trim());
            });
        };
        walk(ROOT_KEY);
        list.forEach((sc) => {
            const id = String(sc?.id || '').trim();
            if (id && !out.includes(sc)) out.push(sc);
        });
        return out;
    }

    function applySubCategoryDrop(fromId, toId, mode) {
        const list = getSubCategoriesRaw();
        const fromIdx = list.findIndex((sc) => String(sc?.id || '').trim() === fromId);
        const toIdx = list.findIndex((sc) => String(sc?.id || '').trim() === toId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

        const moved = { ...list[fromIdx] };
        const next = list.slice();
        next.splice(fromIdx, 1);

        if (mode === 'nest') {
            if (wouldCreateCycle(fromId, toId)) {
                global.showAlert?.('Impossible : sous-catégorie imbriquée sur elle-même ou sur un descendant.', 'warning');
                return;
            }
            moved.parentSubCategoryId = toId;
            const toFlatIdx = next.findIndex((sc) => String(sc?.id || '').trim() === toId);
            next.splice(toFlatIdx + 1, 0, moved);
        } else {
            const target = next.find((sc) => String(sc?.id || '').trim() === toId);
            const siblingParent = String(target?.parentSubCategoryId || '').trim();
            if (siblingParent) moved.parentSubCategoryId = siblingParent;
            else delete moved.parentSubCategoryId;

            let insertAt = next.findIndex((sc) => String(sc?.id || '').trim() === toId);
            if (fromIdx < toIdx) insertAt -= 1;
            if (mode === 'after') insertAt += 1;
            next.splice(Math.max(0, insertAt), 0, moved);
        }

        ensureSubCategories().subCategories = flattenSubCategoriesDepthFirst(next);
    }

    function bindSubcategoriesDragDrop() {
        const mount = global.document.getElementById('categorie-subcategories-list');
        if (!mount || !global.UgapSortableDnd?.bindSortableDnd) return;
        delete mount.dataset.ugapDndBound;
        global.UgapSortableDnd.bindSortableDnd(mount, {
            dataType: 'text/ugap-subcategory-id',
            itemSelector: '[data-ugap-dnd-item]',
            handleSelector: '.ugap-dnd-handle',
            allowNest: true,
            getItemId: (el) => el.getAttribute('data-ugap-dnd-item'),
            onDrop: (fromId, toId, mode) => {
                applySubCategoryDrop(fromId, toId, mode);
                refreshPanel();
            }
        });
    }

    function registerSubCategoryFamilyUi(subIndex) {
        const sc = getSubCategory(subIndex);
        if (!sc || !global.UgapFamilyDraftUi) return;
        const prefix = prefixForSubIndex(subIndex);
        global.UgapFamilyDraftUi.register(prefix, {
            getDraft() {
                return { families: sc.families };
            },
            getCatalogueFamilies() {
                return typeof global.getFamiliesForAssignationTab === 'function'
                    ? global.getFamiliesForAssignationTab()
                    : [];
            },
            addFamilyFromPick(raw) {
                const sourceIndex = Number(String(raw || '').trim());
                if (!Number.isInteger(sourceIndex)) return;
                const catalogue = typeof global.getFamiliesForAssignationTab === 'function'
                    ? global.getFamiliesForAssignationTab()
                    : [];
                const src = catalogue.find((f) => Number(f.__idx) === sourceIndex);
                if (!src) {
                    global.showAlert?.('Famille introuvable.', 'warning');
                    return;
                }
                const familyLabel = String(src?.familyLabel || '').trim();
                if (!familyLabel) return;
                const selectedGroupIds = global.UgapFamilyDraftUi?.defaultSelectedGroupIdsForAdd
                    ? global.UgapFamilyDraftUi.defaultSelectedGroupIdsForAdd(src, sc.families)
                    : [];
                sc.families.push({
                    familyLabel,
                    objectName: String(src?.objectName || '').trim(),
                    sourceIndex,
                    selectedGroupIds
                });
                global.UgapFamilyDraftUi.refreshPanel(prefix);
                if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
            },
            removeFamilyAt(draftIdx) {
                const idx = Number(draftIdx);
                if (!Number.isInteger(idx) || idx < 0 || idx >= sc.families.length) return;
                sc.families.splice(idx, 1);
            },
            toggleGroup(draftIdx, groupId, checked) {
                const entry = sc.families[Number(draftIdx)];
                if (!entry) return;
                const gid = String(groupId || '').trim();
                const set = new Set(
                    (Array.isArray(entry.selectedGroupIds) ? entry.selectedGroupIds : [])
                        .map((x) => String(x || '').trim())
                        .filter(Boolean)
                );
                if (checked) set.add(gid);
                else set.delete(gid);
                entry.selectedGroupIds = Array.from(set);
            },
            onRefresh() {
                if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
            },
            enableDragReorder: true
        });
    }

    function renderSubCategoryBlock(sc, subIndex, depth) {
        const name = escapeHtml(String(sc.name || ''));
        const prefix = prefixForSubIndex(subIndex);
        const subId = escapeHtml(String(sc.id || ''));
        const pad = Math.min((depth || 0) * 24, 120);
        const indentStyle = `${pad ? `margin-left:${pad}px;` : ''}padding-left:16px;border-left:3px solid #94a3b8;`;
        const familyPanel = global.UgapFamilyDraftUi
            ? global.UgapFamilyDraftUi.renderPanelHtml(prefix, { sectionTitle: 'Familles (ordre = parcours)' })
            : '';
        const parentHint = sc.parentSubCategoryId
            ? `<span style="font-size:10px;color:#64748b;margin-left:6px;">↳ enfant</span>`
            : '';
        return `
            <div class="ugap-categorie-subcategory-block" data-ugap-dnd-item="${subId}"
                style="${indentStyle}padding:12px 12px 12px 16px;margin-bottom:10px;background:#f8fafc;border-radius:0 8px 8px 0;">
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
                    <span class="ugap-dnd-handle" draggable="true" title="Glisser : haut/bas = ordre, centre = imbriquer sous" onclick="event.stopPropagation();">⋮⋮</span>
                    <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Sous-catégorie${parentHint}</span>
                    <input type="text" value="${name}" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-weight:600;"
                        onchange="renameCategorieSubCategory(${subIndex}, this.value)">
                    <button type="button" class="btn btn-outline" style="font-size:11px;padding:4px 8px;"
                        title="Remonter au niveau racine"
                        onclick="unnestCategorieSubCategory(${subIndex})">↖ Racine</button>
                    <button type="button" class="btn btn-danger" style="font-size:11px;padding:4px 8px;"
                        onclick="removeCategorieSubCategory(${subIndex})">Supprimer</button>
                </div>
                <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;">Déposez au centre d'une autre sous-catégorie pour créer un niveau enfant.</p>
                ${familyPanel}
            </div>
        `;
    }

    function buildRenderTree() {
        const flat = flattenSubCategoriesDepthFirst(getSubCategoriesRaw());
        const depthById = new Map();
        flat.forEach((sc) => {
            const id = String(sc?.id || '').trim();
            const parent = String(sc?.parentSubCategoryId || '').trim();
            const parentDepth = parent ? (depthById.get(parent) ?? 0) : -1;
            depthById.set(id, parentDepth + 1);
        });
        return flat.map((sc, flatIdx) => {
            const id = String(sc?.id || '').trim();
            const arrayIdx = getSubCategoriesRaw().findIndex((x) => String(x?.id || '').trim() === id);
            return {
                sc,
                subIndex: arrayIdx >= 0 ? arrayIdx : flatIdx,
                depth: depthById.get(id) || 0
            };
        });
    }

    function renderListHtml() {
        const tree = buildRenderTree();
        if (!tree.length) return '';
        return tree.map(({ sc, subIndex, depth }) => renderSubCategoryBlock(sc, subIndex, depth)).join('');
    }

    function renderListMountHtml() {
        return `
            <div style="margin-top:12px;padding-top:12px;border-top:1px dashed #cbd5e1;">
                <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">Sous-catégories (ordre et hiérarchie)</div>
                <div id="categorie-subcategories-list">${renderListHtml()}</div>
            </div>
        `;
    }

    function renderPanelHtml() {
        return renderListMountHtml();
    }

    function showAddPicker(prefix) {
        const p = String(prefix || 'categorie').trim();
        if (global.UgapFamilyDraftUi?.cancelPick) global.UgapFamilyDraftUi.cancelPick(p);
        const wrap = global.document.getElementById(`${p}-subcat-pick-wrap`);
        if (wrap) {
            wrap.removeAttribute('hidden');
            global.document.getElementById(`${p}-subcat-pick-name`)?.focus();
        }
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function cancelAddPicker(prefix) {
        const p = String(prefix || 'categorie').trim();
        const wrap = global.document.getElementById(`${p}-subcat-pick-wrap`);
        const input = global.document.getElementById(`${p}-subcat-pick-name`);
        if (input) input.value = '';
        if (wrap) wrap.setAttribute('hidden', '');
    }

    function confirmAddFromPicker(prefix) {
        const p = String(prefix || 'categorie').trim();
        const name = String(global.document.getElementById(`${p}-subcat-pick-name`)?.value || '').trim();
        if (!name) {
            global.showAlert?.('Nom requis.', 'warning');
            return;
        }
        getSubCategoriesRaw().push({
            id: `subcat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            families: [],
            description: '',
            optionIds: [],
            familyId: ''
        });
        ensureSubCategories().subCategories = flattenSubCategoriesDepthFirst(getSubCategoriesRaw());
        cancelAddPicker(p);
        refreshPanel();
    }

    function refreshPanel() {
        const mount = global.document.getElementById('categorie-subcategories-list');
        if (mount) {
            mount.innerHTML = renderListHtml();
            getSubCategoriesRaw().forEach((_, idx) => {
                registerSubCategoryFamilyUi(idx);
                if (global.UgapFamilyDraftUi) global.UgapFamilyDraftUi.refreshPanel(prefixForSubIndex(idx));
            });
            bindSubcategoriesDragDrop();
        }
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function addCategorieSubCategoryFromInput() {
        confirmAddFromPicker('categorie');
    }

    function renameCategorieSubCategory(subIndex, value) {
        const sc = getSubCategory(subIndex);
        if (sc) sc.name = String(value || '').trim() || sc.name;
    }

    function unnestCategorieSubCategory(index) {
        const sc = getSubCategory(index);
        if (!sc) return;
        delete sc.parentSubCategoryId;
        ensureSubCategories().subCategories = flattenSubCategoriesDepthFirst(getSubCategoriesRaw());
        refreshPanel();
    }

    function removeCategorieSubCategory(index) {
        const draft = ensureSubCategories();
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= draft.subCategories.length) return;
        const removedId = String(draft.subCategories[idx]?.id || '').trim();
        draft.subCategories.splice(idx, 1);
        draft.subCategories.forEach((sc) => {
            if (String(sc?.parentSubCategoryId || '').trim() === removedId) {
                delete sc.parentSubCategoryId;
            }
        });
        draft.subCategories = flattenSubCategoriesDepthFirst(draft.subCategories);
        refreshPanel();
    }

    function loadFromCategory(category) {
        const draft = ensureSubCategories();
        draft.subCategories = (Array.isArray(category?.subCategories) ? category.subCategories : [])
            .map((raw) => {
                const sc = raw && typeof raw === 'object' ? raw : {};
                const families = Array.isArray(sc.families)
                    ? sc.families.map(sanitizeFamilyEntry).filter((f) => f.familyLabel)
                    : [];
                return sanitizeSubCategory({
                    id: sc.id,
                    name: sc.name,
                    description: sc.description,
                    families,
                    optionIds: sc.optionIds,
                    familyId: sc.familyId,
                    parentSubCategoryId: sc.parentSubCategoryId
                });
            })
            .filter(Boolean);
        draft.subCategories = flattenSubCategoriesDepthFirst(draft.subCategories);
    }

    function getSubCategoriesForSave() {
        return flattenSubCategoriesDepthFirst(getSubCategoriesRaw())
            .map(sanitizeSubCategory)
            .filter(Boolean);
    }

    global.UgapCategorieTabSubcategories = {
        renderPanelHtml,
        renderListMountHtml,
        refreshPanel,
        showAddPicker,
        cancelAddPicker,
        confirmAddFromPicker,
        loadFromCategory,
        getSubCategoriesForSave
    };
    global.addCategorieSubCategoryFromInput = addCategorieSubCategoryFromInput;
    global.removeCategorieSubCategory = removeCategorieSubCategory;
    global.renameCategorieSubCategory = renameCategorieSubCategory;
    global.unnestCategorieSubCategory = unnestCategorieSubCategory;
    global.refreshCategorieSubcategoriesPanel = refreshPanel;
})(window);
