/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/categorie-tab.js
 * RÔLE : Onglet Catégorie — objets bateau (Vue LC + familles/groupes, aligné template bateau).
 *
 * ENTRÉES : window.currentData / getUgapCurrentData(), UgapTemplates, UgapFamilyDraftUi, apiCall
 * SORTIES : #ugap-categorie-lc-mount
 *
 * DÉPEND DE : ugap-view-templates.js, ugap-family-draft-ui.js, admin.php
 * NE PAS : vues métier (uiState.businessViews), choix unique / obligatoire UI
 *
 * APPELÉ PAR : admin.php renderActiveTab('categorie')
 */
(function initUgapCategorieTab(global) {
    'use strict';

    const PREFIX = 'categorie';

    function getUgapData() {
        if (typeof global.getUgapCurrentData === 'function') return global.getUgapCurrentData();
        return global.currentData ?? null;
    }

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isSystemBucketCategory(cat) {
        const c = cat && typeof cat === 'object' ? cat : {};
        const id = String(c.id || '').trim();
        const name = String(c.name || '').trim().toLowerCase();
        if (id === 'cat_non_classees' || id === 'cat_catalogue_import' || id === 'cat_options_de_base_import') {
            return true;
        }
        if (name === 'non classées' || name === 'non classees') return true;
        if (name === 'options import excel' || name === 'options de base (import)') return true;
        return false;
    }

    function getCategories() {
        const data = getUgapData();
        const all = Array.isArray(data?.categories) ? data.categories : [];
        return all.filter((cat) => !isSystemBucketCategory(cat));
    }

    function sanitizeDraftFamilyEntry(entry) {
        const e = entry && typeof entry === 'object' ? entry : {};
        const sourceIndex = Number(e.sourceIndex);
        const groupOrder = Array.isArray(e.groupOrder)
            ? e.groupOrder.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const selectedGroupIds = Array.isArray(e.selectedGroupIds)
            ? e.selectedGroupIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const orderedSelected = groupOrder.length
            ? groupOrder.filter((gid) => selectedGroupIds.includes(gid))
            : selectedGroupIds;
        selectedGroupIds.forEach((gid) => {
            if (!orderedSelected.includes(gid)) orderedSelected.push(gid);
        });
        return {
            familyLabel: String(e.familyLabel || '').trim(),
            objectName: String(e.objectName || '').trim(),
            sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : null,
            selectedGroupIds: orderedSelected,
            ...(groupOrder.length ? { groupOrder } : {}),
        };
    }

    function initGroupOrderForEntry(entry, catalogueFamily) {
        const groups = global.normalizeFamilyDecisionGroups
            ? global.normalizeFamilyDecisionGroups(catalogueFamily?.decisionGroups)
            : (Array.isArray(catalogueFamily?.decisionGroups) ? catalogueFamily.decisionGroups : []);
        const ids = groups.map((g) => String(g?.id || '').trim()).filter(Boolean);
        if (!Array.isArray(entry.groupOrder) || !entry.groupOrder.length) {
            entry.groupOrder = ids.slice();
        } else {
            ids.forEach((gid) => {
                if (!entry.groupOrder.includes(gid)) entry.groupOrder.push(gid);
            });
        }
    }

    function reorderGroupsInEntry(entry, fromGid, toGid, mode) {
        if (!entry) return;
        const from = String(fromGid || '').trim();
        const to = String(toGid || '').trim();
        if (!from || !to || from === to) return;
        const order = Array.isArray(entry.groupOrder) ? entry.groupOrder.slice() : [];
        entry.groupOrder = reorderArrayItem(order, from, to, mode || 'before');
        const selected = new Set(
            (Array.isArray(entry.selectedGroupIds) ? entry.selectedGroupIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        );
        entry.selectedGroupIds = entry.groupOrder.filter((gid) => selected.has(gid));
    }

    function reorderArrayItem(list, fromId, toId, mode) {
        const arr = Array.isArray(list) ? list.slice() : [];
        const from = arr.findIndex((x) => String(x) === String(fromId));
        const to = arr.findIndex((x) => String(x) === String(toId));
        if (from < 0 || to < 0 || from === to) return arr;
        const [moved] = arr.splice(from, 1);
        let insertAt = to;
        if (from < to) insertAt -= 1;
        if (mode === 'after') insertAt += 1;
        arr.splice(Math.max(0, Math.min(insertAt, arr.length)), 0, moved);
        return arr;
    }

    function getFamiliesSummary(cat) {
        const families = Array.isArray(cat?.families) ? cat.families : [];
        const labels = families
            .map((f) => String(f?.familyLabel || '').trim())
            .filter(Boolean);
        if (!labels.length) return '—';
        if (labels.length <= 2) return labels.join(', ');
        return `${labels.slice(0, 2).join(', ')} (+${labels.length - 2})`;
    }

    function getCategorieCreateDraft() {
        if (!global.__categorieCreateDraft || typeof global.__categorieCreateDraft !== 'object') {
            global.__categorieCreateDraft = { name: '', families: [] };
        }
        if (!Array.isArray(global.__categorieCreateDraft.families)) {
            global.__categorieCreateDraft.families = [];
        }
        return global.__categorieCreateDraft;
    }

    function resetCategorieCreateDraft() {
        global.__categorieCreateDraft = { name: '', families: [], subCategories: [] };
        global.__categorieEditId = null;
    }

    function closeCategorieCreatePanel() {
        const mount = global.document.getElementById('ugap-categorie-lc-mount');
        const panel = mount?.querySelector('[data-ugap-lc-create-panel="categorie"]');
        const btn = mount?.querySelector('[data-ugap-lc-create="categorie"]');
        if (panel) panel.setAttribute('hidden', '');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (global.UgapFamilyDraftUi) global.UgapFamilyDraftUi.cancelPick(PREFIX);
        if (global.UgapCategorieTabSubcategories?.cancelAddPicker) {
            global.UgapCategorieTabSubcategories.cancelAddPicker(PREFIX);
        }
    }

    function loadCategorieCreateDraftFromCategory(category, categoryId) {
        const draft = getCategorieCreateDraft();
        draft.name = String(category?.objectName || category?.name || '').trim();
        const raw = Array.isArray(category?.families) ? category.families : [];
        draft.families = raw.map(sanitizeDraftFamilyEntry).filter((f) => f.familyLabel);
        draft.families.forEach((entry) => {
            const catalogue = typeof global.getFamiliesForAssignationTab === 'function'
                ? global.getFamiliesForAssignationTab()
                : [];
            const src = catalogue.find((f) => Number(f.__idx) === Number(entry.sourceIndex))
                || catalogue.find((f) => String(f?.familyLabel || '').trim().toLowerCase()
                    === String(entry.familyLabel || '').trim().toLowerCase());
            if (src) initGroupOrderForEntry(entry, src);
        });
        if (global.UgapCategorieTabSubcategories?.loadFromCategory) {
            global.UgapCategorieTabSubcategories.loadFromCategory(category);
        } else {
            draft.subCategories = Array.isArray(category?.subCategories) ? category.subCategories.slice() : [];
        }
        global.__categorieEditId = String(categoryId || category?.id || '').trim() || null;
    }

    function buildFamiliesPayload(draft) {
        return (Array.isArray(draft.families) ? draft.families : [])
            .map(sanitizeDraftFamilyEntry)
            .filter((f) => f.familyLabel && (f.selectedGroupIds || []).length > 0);
    }

    function familyIdsFromFamilies(families) {
        return families
            .map((f) => (Number.isInteger(f.sourceIndex) ? String(f.sourceIndex) : f.familyLabel))
            .filter(Boolean);
    }

    function refreshCategorieCreateDraftUi() {
        const draft = getCategorieCreateDraft();
        const labelEl = global.document.getElementById('categorie-draft-name');
        const submitBtn = global.document.getElementById('categorie-draft-submit');
        if (labelEl) labelEl.value = draft.name || '';
        const isEdit = !!String(global.__categorieEditId || '').trim();
        if (submitBtn) {
            submitBtn.textContent = isEdit ? 'Enregistrer la catégorie' : 'Créer la catégorie';
        }
        if (global.UgapFamilyDraftUi) global.UgapFamilyDraftUi.refreshPanel(PREFIX);
        if (global.UgapCategorieTabSubcategories?.refreshPanel) {
            global.UgapCategorieTabSubcategories.refreshPanel();
        }
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function onCategorieDraftFieldInput() {
        const draft = getCategorieCreateDraft();
        draft.name = String(global.document.getElementById('categorie-draft-name')?.value || '').trim();
    }

    function bindCategorieCreateFormActions(mount) {
        const root = mount && mount.querySelector ? mount : global.document.getElementById('ugap-categorie-lc-mount');
        if (!root || root.dataset.ugapCatCreateBound === '1') return;
        root.dataset.ugapCatCreateBound = '1';
        root.addEventListener('click', (e) => {
            if (e.target.closest('[data-ugap-categorie-submit]')) {
                e.preventDefault();
                e.stopPropagation();
                submitCategorieFromDraft();
                return;
            }
            if (e.target.closest('[data-ugap-categorie-cancel]')) {
                e.preventDefault();
                resetCategorieCreateDraft();
                refreshCategorieCreateDraftUi();
                closeCategorieCreatePanel();
            }
        });
        root.addEventListener('input', (e) => {
            if (e.target?.id === 'categorie-draft-name') onCategorieDraftFieldInput();
        });
    }

    function renderCategorieCreationFormHtml() {
        const inputStyle = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;';
        const labelStyle = 'display:block; font-size:12px; color:#555; margin-bottom:4px;';
        const subListMount = global.UgapCategorieTabSubcategories?.renderListMountHtml
            ? global.UgapCategorieTabSubcategories.renderListMountHtml()
            : '';
        const familyPanel = global.UgapFamilyDraftUi
            ? global.UgapFamilyDraftUi.renderPanelHtml(PREFIX, {
                sectionTitle: 'Familles rattachées à cet objet',
                afterListHtml: subListMount,
                showSubCategoryAction: true
            })
            : '<p style="color:#b45309;">Module familles indisponible.</p>';
        return `
            <div class="ugap-categorie-create-form" style="padding:14px; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">
                <div style="display:grid; gap:14px;">
                    <div style="max-width:520px;">
                        <label for="categorie-draft-name" style="${labelStyle}">Nom de la catégorie</label>
                        <input id="categorie-draft-name" type="text" placeholder="Ex. Motorisation, Finitions…" style="${inputStyle}" autocomplete="off">
                    </div>
                    ${familyPanel}
                    <div>
                        <button type="button" class="btn btn-success" id="categorie-draft-submit" data-ugap-categorie-submit>Créer la catégorie</button>
                        <button type="button" class="btn btn-outline" style="margin-left:8px;" data-ugap-categorie-cancel>Annuler</button>
                    </div>
                </div>
            </div>
        `;
    }

    function getAllCategoriesIncludingSystem() {
        const data = getUgapData();
        return Array.isArray(data?.categories) ? data.categories : [];
    }

    function reorderCategoryIdsInData(orderedIds) {
        const data = getUgapData();
        if (!data) return;
        const all = getAllCategoriesIncludingSystem();
        const byId = new Map(all.map((c) => [String(c.id || '').trim(), c]));
        const used = new Set();
        const next = [];
        (Array.isArray(orderedIds) ? orderedIds : []).forEach((id) => {
            const key = String(id || '').trim();
            const cat = byId.get(key);
            if (cat && !used.has(key)) {
                used.add(key);
                next.push(cat);
            }
        });
        all.forEach((cat) => {
            const key = String(cat.id || '').trim();
            if (key && !used.has(key)) next.push(cat);
        });
        data.categories = next;
        if (typeof global.setUgapCurrentData === 'function') global.setUgapCurrentData(data);
    }

    async function persistCategoryOrder(orderedIds) {
        if (typeof global.apiCall !== 'function') return;
        await global.apiCall('/categories/reorder', {
            method: 'PUT',
            body: JSON.stringify({ orderedCategoryIds: orderedIds })
        });
    }

    function applyCategoryDrop(fromId, toId, mode) {
        const visible = getCategories().map((c) => String(c.id || '').trim()).filter(Boolean);
        const fromIdx = visible.indexOf(fromId);
        const toIdx = visible.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return visible;

        const next = visible.slice();
        const [moved] = next.splice(fromIdx, 1);
        let insertAt = toIdx;
        if (fromIdx < toIdx) insertAt -= 1;
        if (mode === 'after') insertAt += 1;
        if (mode === 'nest') insertAt = toIdx + 1;
        if (mode === 'before') insertAt = toIdx;
        next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, moved);
        return next;
    }

    async function reorderCategoriesByDrag(fromCategoryId, toCategoryId, mode) {
        const fromId = String(fromCategoryId || '').trim();
        const toId = String(toCategoryId || '').trim();
        if (!fromId || !toId || fromId === toId) return;
        const orderedVisible = applyCategoryDrop(fromId, toId, mode || 'before');
        const all = getAllCategoriesIncludingSystem();
        const systemIds = all
            .filter((c) => isSystemBucketCategory(c))
            .map((c) => String(c.id || '').trim())
            .filter(Boolean);
        const orderedAll = [...orderedVisible, ...systemIds];
        reorderCategoryIdsInData(orderedAll);
        refreshCategorieVueLC();
        try {
            await persistCategoryOrder(orderedAll);
            await syncCategoriesFromServer();
            refreshCategorieVueLC();
            if (typeof global.mountTemplateBateauVueLC === 'function') global.mountTemplateBateauVueLC();
        } catch (error) {
            await syncCategoriesFromServer();
            refreshCategorieVueLC();
            throw error;
        }
    }

    async function moveCategory(categoryId, direction) {
        const id = String(categoryId || '').trim();
        const visible = getCategories().map((c) => String(c.id || '').trim()).filter(Boolean);
        const index = visible.indexOf(id);
        if (index < 0) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= visible.length) return;
        const targetId = visible[newIndex];
        await reorderCategoriesByDrag(id, targetId, direction === 'up' ? 'before' : 'after');
    }

    function getCategoryStructureCounts(cat) {
        const subCount = (Array.isArray(cat?.subCategories) ? cat.subCategories : []).length;
        const famCount = Array.isArray(cat?.families) ? cat.families.length : 0;
        const Tree = global.UgapBoatTemplateTree;
        const catalogue = typeof global.getFamiliesForAssignationTab === 'function'
            ? global.getFamiliesForAssignationTab()
            : [];
        let groupCount = 0;
        let optCount = 0;
        if (Tree?.collectCategoryOptionIdsFromFamilies) {
            optCount = Tree.collectCategoryOptionIdsFromFamilies(cat, catalogue).length;
            const resolved = Tree.resolveCategoryFamiliesWithGroups
                ? Tree.resolveCategoryFamiliesWithGroups(cat, catalogue)
                : [];
            groupCount = resolved.reduce(
                (n, f) => n + (Array.isArray(f?.decisionGroups) ? f.decisionGroups.length : 0),
                0
            );
            (Array.isArray(cat?.subCategories) ? cat.subCategories : []).forEach((sc) => {
                const pseudo = { ...cat, families: Array.isArray(sc.families) ? sc.families : [] };
                const subResolved = Tree.resolveCategoryFamiliesWithGroups(pseudo, catalogue);
                groupCount += subResolved.reduce(
                    (n, f) => n + (Array.isArray(f?.decisionGroups) ? f.decisionGroups.length : 0),
                    0
                );
            });
        }
        return { famCount, subCount, groupCount, optCount };
    }

    function getCategorieRowsForLc() {
        const categories = getCategories();
        return categories.map((cat, idx) => {
            const id = String(cat.id || '');
            const { famCount, subCount, groupCount, optCount } = getCategoryStructureCounts(cat);
            const safeId = escapeHtml(id);
            return {
                __idx: idx,
                __id: id,
                name: escapeHtml(String(cat.name || 'Catégorie')),
                familiesSummary: escapeHtml(getFamiliesSummary(cat)),
                structureSummary: `${famCount} fam. · ${groupCount} grp. · ${subCount} sous-cat. · ${optCount} opt.`,
                _dragHtml: `<span class="ugap-dnd-handle" draggable="true" title="Glisser pour réordonner (haut/bas) ou au centre d'une ligne pour imbriquer après" onclick="event.stopPropagation();">⋮⋮</span>`,
                _actionsHtml: `<div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline" style="font-size:12px;padding:4px 8px;" onclick="event.stopPropagation();openCategorieEditByIndex(${idx})">Modifier</button>
                    <button type="button" class="btn btn-danger" style="font-size:12px;padding:4px 8px;" onclick="event.stopPropagation();deleteCategorieByIndex(${idx})">Supprimer</button>
                </div>`
            };
        });
    }

    function refreshCategorieVueLC() {
        const mount = global.document.getElementById('ugap-categorie-lc-mount');
        if (!mount) return;
        if (mount.querySelector('[data-ugap-vue-lc="categorie"]') && global.UgapTemplates?.refreshVueLCList) {
            global.UgapTemplates.refreshVueLCList('categorie', mount);
            return;
        }
        mountCategorieVueLC();
    }

    function applyCategoriesToCurrentData(serverCategories) {
        const data = getUgapData();
        if (!data) return;
        const list = Array.isArray(serverCategories) ? serverCategories : [];
        const nextCategories = typeof global.normalizeUgapDataContract === 'function'
            ? global.normalizeUgapDataContract({ ...data, categories: list }).categories
            : list;
        data.categories = nextCategories;
        if (typeof global.setUgapCurrentData === 'function') global.setUgapCurrentData(data);
    }

    async function syncCategoriesFromServer() {
        if (!getUgapData() || typeof global.apiCall !== 'function') return;
        try {
            const result = await global.apiCall('/categories');
            applyCategoriesToCurrentData(result?.data);
        } catch (_) {
            /* conserver le patch local */
        }
    }

    function patchCurrentDataWithNewCategory(id, name) {
        const categoryId = String(id || '').trim();
        const categoryName = String(name || '').trim();
        const data = getUgapData();
        if (!categoryId || !categoryName || !data) return;
        const cats = Array.isArray(data.categories) ? data.categories : [];
        if (cats.some((c) => String(c.id || '') === categoryId)) return;
        data.categories = [
            ...cats,
            {
                id: categoryId,
                name: categoryName,
                catalogue: true,
                families: [],
                familyIds: [],
                options: [],
                subCategories: [],
                selectionRules: { unique: false, required: false },
                businessViewIds: []
            }
        ];
        if (typeof global.setUgapCurrentData === 'function') global.setUgapCurrentData(data);
    }

    function patchCurrentDataCategory(categoryId, patch) {
        const id = String(categoryId || '').trim();
        const data = getUgapData();
        if (!id || !data || !patch || typeof patch !== 'object') return;
        const cats = Array.isArray(data.categories) ? data.categories : [];
        const idx = cats.findIndex((c) => String(c.id || '') === id);
        if (idx < 0) return;
        const next = cats.slice();
        next[idx] = { ...next[idx], ...patch };
        data.categories = next;
        if (typeof global.setUgapCurrentData === 'function') global.setUgapCurrentData(data);
    }

    function registerCategorieFamilyDraftUi() {
        if (!global.UgapFamilyDraftUi) return;
        global.UgapFamilyDraftUi.register(PREFIX, {
            enableDragReorder: true,
            enableGroupDragReorder: true,
            getDraft: getCategorieCreateDraft,
            getCatalogueFamilies: () => (
                typeof global.getFamiliesForAssignationTab === 'function'
                    ? global.getFamiliesForAssignationTab()
                    : []
            ),
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
                const draft = getCategorieCreateDraft();
                const selectedGroupIds = global.UgapFamilyDraftUi?.defaultSelectedGroupIdsForAdd
                    ? global.UgapFamilyDraftUi.defaultSelectedGroupIdsForAdd(src, draft.families)
                    : [];
                draft.families.push({
                    familyLabel,
                    objectName: String(src?.objectName || '').trim(),
                    sourceIndex,
                    selectedGroupIds
                });
                const added = draft.families[draft.families.length - 1];
                initGroupOrderForEntry(added, src);
                refreshCategorieCreateDraftUi();
            },
            reorderGroups(draftIdx, fromGid, toGid, mode) {
                const idx = Number(draftIdx);
                const draft = getCategorieCreateDraft();
                const entry = draft.families[idx];
                reorderGroupsInEntry(entry, fromGid, toGid, mode);
            },
            removeFamilyAt(draftIdx) {
                const idx = Number(draftIdx);
                const draft = getCategorieCreateDraft();
                if (!Number.isInteger(idx) || idx < 0 || idx >= draft.families.length) return;
                draft.families.splice(idx, 1);
            },
            toggleGroup(draftIdx, groupId, checked) {
                const idx = Number(draftIdx);
                const gid = String(groupId || '').trim();
                const draft = getCategorieCreateDraft();
                const entry = draft.families[idx];
                if (!entry || !gid) return;
                const list = (Array.isArray(entry.selectedGroupIds) ? entry.selectedGroupIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                if (checked) {
                    if (!list.includes(gid)) list.push(gid);
                } else {
                    entry.selectedGroupIds = list.filter((x) => x !== gid);
                    return;
                }
                entry.selectedGroupIds = list;
            },
            onRefresh() {
                if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
            }
        });
    }

    function mountCategorieVueLC() {
        registerCategorieFamilyDraftUi();
        const mount = global.document.getElementById('ugap-categorie-lc-mount');
        if (!mount) return;
        if (!global.UgapTemplates || typeof global.UgapTemplates.renderVueLC !== 'function') {
            mount.innerHTML = '<div style="padding:12px; color:#b45309;">Module <strong>UgapTemplates</strong> indisponible.</div>';
            return;
        }
        const config = {
            elementKey: 'categorie',
            elementLabel: 'catégorie',
            title: 'Objets (catégories)',
            description: 'Créer une catégorie, y rattacher familles et groupes. Glisser ⋮⋮ pour l’ordre des familles, ⋮ pour l’ordre des groupes.',
            columns: [
                { key: '_dragHtml', label: '', type: 'html' },
                { key: 'name', label: 'Objet' },
                { key: 'familiesSummary', label: 'Familles' },
                { key: 'structureSummary', label: 'Structure' },
                { key: '_actionsHtml', label: 'Actions', type: 'html' }
            ],
            getRows: getCategorieRowsForLc,
            rowReorder: {
                idKey: '__id',
                dataType: 'text/ugap-categorie-id',
                handleSelector: '.ugap-dnd-handle',
                allowNest: false,
                onDrop: reorderCategoriesByDrag
            },
            listToolbar: {
                searchKeys: ['name', 'familiesSummary', 'structureSummary'],
                searchPlaceholder: 'Rechercher une catégorie…'
            },
            countLabel: 'catégorie(s)',
            emptyMessage: 'Aucune catégorie. Cliquez sur « Créer une catégorie » pour structurer le configurateur (onglet Tableau catégories).',
            rowDblClickHandler: (idx) => openCategorieEditByIndex(idx),
            createFormHtml: renderCategorieCreationFormHtml(),
            onCreatePanelOpen: () => {
                if (!global.__categorieOpeningForEdit) resetCategorieCreateDraft();
                global.__categorieOpeningForEdit = false;
                refreshCategorieCreateDraftUi();
            }
        };
        mount.innerHTML = global.UgapTemplates.renderVueLC(config);
        global.UgapTemplates.bindVueLC(mount, config);
        bindCategorieCreateFormActions(mount);
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function openCategorieEditByIndex(idx) {
        const index = Number(idx);
        const categories = getCategories();
        if (!Number.isInteger(index) || index < 0 || index >= categories.length) return;
        const cat = categories[index];
        global.__categorieOpeningForEdit = true;
        loadCategorieCreateDraftFromCategory(cat, cat.id);
        const mount = global.document.getElementById('ugap-categorie-lc-mount');
        const panel = mount?.querySelector('[data-ugap-lc-create-panel="categorie"]');
        const btn = mount?.querySelector('[data-ugap-lc-create="categorie"]');
        if (panel) panel.removeAttribute('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        refreshCategorieCreateDraftUi();
        panel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }

    async function deleteCategorieByIndex(idx) {
        const index = Number(idx);
        const categories = getCategories();
        if (!Number.isInteger(index) || index < 0 || index >= categories.length) return;
        const cat = categories[index];
        if (typeof global.deleteCategory === 'function') {
            await global.deleteCategory(cat.id);
            refreshCategorieVueLC();
        }
    }

    async function submitCategorieFromDraft() {
        onCategorieDraftFieldInput();
        const draft = getCategorieCreateDraft();
        const name = String(draft.name || '').trim();
        if (!name) {
            global.showAlert?.('Nom de catégorie requis.', 'warning');
            return;
        }
        const families = buildFamiliesPayload(draft);
        const subCategories = global.UgapCategorieTabSubcategories?.getSubCategoriesForSave
            ? global.UgapCategorieTabSubcategories.getSubCategoriesForSave()
            : (Array.isArray(draft.subCategories) ? draft.subCategories : []).map((sc) => ({
                ...sc,
                families: buildFamiliesPayload({ families: sc.families || [] })
            }));
        const editId = String(global.__categorieEditId || '').trim();
        try {
            if (editId) {
                const cat = getCategories().find((c) => String(c.id) === editId);
                if (!cat) {
                    global.showAlert?.('Catégorie introuvable.', 'error');
                    return;
                }
                await global.apiCall(`/categories/${encodeURIComponent(editId)}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...cat,
                        catalogue: true,
                        name,
                        objectName: name,
                        families,
                        familyIds: familyIdsFromFamilies(families),
                        subCategories
                    })
                });
                patchCurrentDataCategory(editId, {
                    catalogue: true,
                    name,
                    objectName: name,
                    families,
                    familyIds: familyIdsFromFamilies(families),
                    subCategories
                });
                global.showAlert?.('Catégorie mise à jour.', 'success');
            } else {
                const postResult = await global.apiCall('/categories', {
                    method: 'POST',
                    body: JSON.stringify({ name })
                });
                const newId = String(postResult?.data?.id || '').trim();
                if (!newId) {
                    global.showAlert?.('Création impossible : identifiant manquant.', 'error');
                    return;
                }
                patchCurrentDataWithNewCategory(newId, name);
                const created = getCategories().find((c) => String(c.id || '') === newId)
                    || { id: newId, name, families: [], options: [], subCategories: [] };
                const payload = {
                    ...created,
                    catalogue: true,
                    name,
                    objectName: name,
                    families,
                    familyIds: familyIdsFromFamilies(families),
                    subCategories
                };
                await global.apiCall(`/categories/${encodeURIComponent(newId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                patchCurrentDataCategory(newId, {
                    catalogue: true,
                    name,
                    objectName: name,
                    families,
                    familyIds: familyIdsFromFamilies(families),
                    subCategories
                });
                global.showAlert?.('Catégorie créée.', 'success');
            }
            resetCategorieCreateDraft();
            closeCategorieCreatePanel();
            refreshCategorieVueLC();
            await syncCategoriesFromServer();
            refreshCategorieVueLC();
        } catch (error) {
            global.showAlert?.('Erreur : ' + (error?.message || error), 'error');
        }
    }

    registerCategorieFamilyDraftUi();

    global.getCategorieCreateDraft = getCategorieCreateDraft;
    global.onCategorieDraftFieldInput = onCategorieDraftFieldInput;
    global.submitCategorieFromDraft = submitCategorieFromDraft;
    global.openCategorieEditByIndex = openCategorieEditByIndex;
    global.deleteCategorieByIndex = deleteCategorieByIndex;
    global.resetCategorieCreateDraft = resetCategorieCreateDraft;
    global.refreshCategorieCreateDraftUi = refreshCategorieCreateDraftUi;
    global.closeCategorieCreatePanel = closeCategorieCreatePanel;
    global.mountCategorieVueLC = mountCategorieVueLC;
    global.refreshCategorieVueLC = refreshCategorieVueLC;
    global.moveCategory = moveCategory;
    global.reorderCategoriesByDrag = reorderCategoriesByDrag;

    global.UgapCategorieTab = {
        mount: mountCategorieVueLC,
        refresh: refreshCategorieVueLC,
        render: refreshCategorieVueLC
    };
})(window);
