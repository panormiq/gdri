/**
 * État catégories — paramétrage v2 (sans legacy admin).
 */
(function initUgapCategorieLcState(global) {
    'use strict';

    /** @type {object|null} */
    let currentData = null;
    let loadPromise = null;

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

    function normalizeFamilyDecisionGroups(rawGroups) {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.normalizeList) return FDG.normalizeList(rawGroups);
        return Array.isArray(rawGroups) ? rawGroups : [];
    }

    function getFamiliesForAssignationTab() {
        const rows = global.UgapFamilleLcState?.getFamilies?.() || [];
        return rows.map((f, idx) => ({
            ...f,
            __idx: idx,
            uniqueChoice: !!f?.uniqueChoice,
            optionIds: Array.isArray(f.optionIds) ? f.optionIds : [],
            decisionGroups: normalizeFamilyDecisionGroups(f?.decisionGroups),
        }));
    }

    async function loadFromServer() {
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            const res = await global.apiCall('/data', { method: 'GET' });
            currentData = res?.data && typeof res.data === 'object' ? res.data : { categories: [] };
            if (!Array.isArray(currentData.categories)) currentData.categories = [];
        })().catch((err) => {
            loadPromise = null;
            throw err;
        });
        return loadPromise;
    }

    async function reload() {
        loadPromise = null;
        await loadFromServer();
    }

    function getData() {
        return currentData;
    }

    function setData(next) {
        currentData = next && typeof next === 'object' ? next : { categories: [] };
        if (!Array.isArray(currentData.categories)) currentData.categories = [];
    }

    function getCategories() {
        const all = Array.isArray(currentData?.categories) ? currentData.categories : [];
        return all.filter((cat) => !isSystemBucketCategory(cat));
    }

    async function deleteCategory(categoryId) {
        const id = String(categoryId || '').trim();
        if (!id) return;
        const all = Array.isArray(currentData?.categories) ? currentData.categories : [];
        const cat = all.find((c) => String(c?.id || '') === id);
        const optCount = Array.isArray(cat?.options) ? cat.options.length : 0;
        const label = String(cat?.name || cat?.objectName || id).trim();
        const warning = optCount > 0
            ? `Supprimer la catégorie « ${label} » ?\n\nLes ${optCount} option(s) seront conservées et déplacées dans « Non classées ».`
            : `Supprimer la catégorie « ${label} » ?`;
        if (!global.confirm(warning)) return;

        await global.apiCall(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
        global.showAlert?.(
            optCount > 0
                ? `Catégorie supprimée. ${optCount} option(s) déplacée(s) dans « Non classées ».`
                : 'Catégorie supprimée.',
            'success'
        );
        await reload();
    }

    function installGlobals() {
        global.getUgapCurrentData = () => currentData;
        global.setUgapCurrentData = (next) => setData(next);
        global.getFamiliesForAssignationTab = getFamiliesForAssignationTab;
        global.normalizeFamilyDecisionGroups = normalizeFamilyDecisionGroups;
        global.deleteCategory = deleteCategory;
    }

    installGlobals();

    global.UgapCategorieLcState = {
        loadFromServer,
        reload,
        getData,
        setData,
        getCategories,
        isSystemBucketCategory,
    };
})(window);
