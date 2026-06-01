/**
 * État local onglet Famille v2 (paramétrage) — sans legacy admin.
 */
(function initUgapFamilleLcState(global) {
    'use strict';

    const STORAGE_GROUP_TYPES = 'ugap.param.famille.customGroupTypes';

    /** @type {Array<object>} */
    let families = [];

    let createDraft = null;
    let hasLoadedFromServer = false;
    let loadPromise = null;
    let persistTimer = null;
    let persistInFlight = false;
    let persistPending = false;
    let suppressPersist = false;

    function readJson(key, fallback) {
        try {
            const raw = global.localStorage?.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            global.localStorage?.setItem(key, JSON.stringify(value));
        } catch (_) { /* ignore */ }
    }

    function defaultCreateGroups() {
        const FDG = global.UgapFamilyDecisionGroup;
        const rows = [
            {
                id: 'model',
                label: 'Modèle',
                type: 'model',
                decisionMode: 'single_choice',
                priceMode: 'option',
                keywords: '',
            },
            {
                id: 'option_catalogue',
                label: 'Option catalogue de base',
                type: 'option',
                decisionMode: 'multi_choice',
                priceMode: 'option',
                keywords: '',
            },
        ];
        return FDG?.normalizeList ? FDG.normalizeList(rows) : rows;
    }

    function newCreateDraft() {
        return {
            familyLabel: '',
            familyKeyword: '',
            defaultDecisionGroupId: 'option_catalogue',
            groups: defaultCreateGroups(),
        };
    }

    /** Groupe cible pour les options non assignées (une seule case cochée par famille). */
    function resolveDefaultDecisionGroupId(groups, preferredId) {
        const list = Array.isArray(groups) ? groups : [];
        const ids = list.map((g) => String(g?.id || '').trim()).filter(Boolean);
        const pref = String(preferredId || '').trim();
        if (pref && ids.includes(pref)) return pref;
        const optionGroup = list.find((g) => String(g?.type || '') === 'option');
        if (optionGroup?.id) return String(optionGroup.id).trim();
        return ids[0] || null;
    }

    function getFamilies() {
        return families.slice();
    }

    function sanitizeFamiliesForServer(list) {
        return (Array.isArray(list) ? list : []).map((f) => {
            const row = f && typeof f === 'object' ? { ...f } : {};
            delete row.__idx;
            return row;
        });
    }

    function setFamilies(list, options = {}) {
        families = Array.isArray(list) ? list.slice() : [];
        if (options.persist !== false) schedulePersist();
    }

    function addFamily(entry) {
        families.push({ ...entry, __idx: families.length });
        schedulePersist();
    }

    function updateFamily(index, entry) {
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= families.length) return false;
        families[idx] = { ...families[idx], ...entry, __idx: idx };
        schedulePersist();
        return true;
    }

    function getCreateDraft() {
        if (!createDraft) createDraft = newCreateDraft();
        return createDraft;
    }

    function resetCreateDraft() {
        createDraft = newCreateDraft();
    }

    function getCustomGroupTypes() {
        return readJson(STORAGE_GROUP_TYPES, []);
    }

    function setCustomGroupTypes(types, options = {}) {
        writeJson(STORAGE_GROUP_TYPES, Array.isArray(types) ? types : []);
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.setCatalogGroupTypes) {
            FDG.setCatalogGroupTypes(getCustomGroupTypes());
        }
        if (options.persist !== false) schedulePersist();
    }

    function syncGroupTypesCatalog() {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.setCatalogGroupTypes) {
            FDG.setCatalogGroupTypes(getCustomGroupTypes());
        }
    }

    function generateGroupId(existingIds) {
        const set = new Set((existingIds || []).map((x) => String(x).trim()).filter(Boolean));
        let n = 1;
        while (set.has(`groupe_${n}`)) n += 1;
        return `groupe_${n}`;
    }

    async function persistToServer() {
        if (suppressPersist || typeof global.apiCall !== 'function') return;
        if (persistInFlight) {
            persistPending = true;
            return;
        }
        persistInFlight = true;
        try {
            await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({
                    families: sanitizeFamiliesForServer(families),
                    familyGroupTypes: getCustomGroupTypes()
                })
            });
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde familles', 'error');
        } finally {
            persistInFlight = false;
            if (persistPending) {
                persistPending = false;
                schedulePersist();
            }
        }
    }

    function schedulePersist() {
        if (suppressPersist) return;
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            void persistToServer();
        }, 250);
    }

    function resolveUiStateFamilies(payload) {
        const src = payload && typeof payload === 'object' ? payload : {};
        if (Object.prototype.hasOwnProperty.call(src, 'families')) {
            return Array.isArray(src.families) ? src.families : [];
        }
        if (Array.isArray(src.validatedFamilies)) return src.validatedFamilies;
        return [];
    }

    async function loadFromServer(force = false) {
        if (typeof global.apiCall !== 'function') return;
        if (hasLoadedFromServer && !force) return;
        if (loadPromise && !force) return loadPromise;

        const run = async () => {
            try {
                const result = await global.apiCall('/ui-state', { method: 'GET' });
                const data = result?.data && typeof result.data === 'object' ? result.data : {};
                suppressPersist = true;
                setFamilies(resolveUiStateFamilies(data), { persist: false });
                setCustomGroupTypes(Array.isArray(data.familyGroupTypes) ? data.familyGroupTypes : [], { persist: false });
                hasLoadedFromServer = true;
            } catch (error) {
                global.showAlert?.(error?.message || 'Erreur chargement familles', 'warning');
            } finally {
                suppressPersist = false;
            }
        };

        loadPromise = run().finally(() => {
            loadPromise = null;
        });
        return loadPromise;
    }

    global.UgapFamilleLcState = {
        getFamilies,
        setFamilies,
        addFamily,
        updateFamily,
        getCreateDraft,
        resetCreateDraft,
        defaultCreateGroups,
        getCustomGroupTypes,
        setCustomGroupTypes,
        syncGroupTypesCatalog,
        generateGroupId,
        resolveDefaultDecisionGroupId,
        loadFromServer,
    };
})(window);
