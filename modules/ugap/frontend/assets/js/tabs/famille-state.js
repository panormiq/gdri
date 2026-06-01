/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/famille-state.js
 * RÔLE : État persistant onglet Famille (familles validées, règles heuristiques, filtres UI, statuts options).
 *
 * ENTRÉES : currentData.uiState, mémoire locale admin (memoryStore), mode workspace import/backoffice.
 * SORTIES : getters/setters ; synchronisation ui-state serveur via scheduleUiStatePersistence.
 *
 * DÉPEND DE : install() fourni par admin.php (memoryStore, currentData, scheduleUiStatePersistence, …).
 * NE PAS : rendu HTML cartes familles, appels IA suggest, fusion review (famille-tab.js / admin legacy).
 *
 * APPELÉ PAR : admin.php, famille-tab.js, onglet Options (getFamilleChoicesForOptionTab).
 */
(function initUgapFamilleStateModule() {
    'use strict';

    const STORAGE = {
        validatedFamilies: 'ugap.famille.validatedFamilies',
        heuristicRules: 'ugap.famille.heuristicRules',
        optionStatuses: 'ugap.famille.optionStatuses',
        foundOrder: 'ugap.famille.foundOrder',
        relations: 'ugap.famille.relations',
        optionLabelCache: 'ugap.famille.optionLabelCache'
    };

    const UGAP_OPTION_FAMILY_STATUS = {
        UNASSIGNED: 'non_assigne',
        ASSIGNED: 'assigne'
    };

    /** @type {Record<string, Function>} */
    let deps = {};

    function memGet(key) {
        if (typeof deps.memoryStoreGetItem === 'function') {
            return deps.memoryStoreGetItem(key);
        }
        return null;
    }

    function memSet(key, value) {
        if (typeof deps.memoryStoreSetItem === 'function') {
            deps.memoryStoreSetItem(key, String(value ?? ''));
        }
    }

    function readJson(key, fallback) {
        try {
            const raw = memGet(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        memSet(key, JSON.stringify(value));
    }

    function getWorkspaceMode() {
        return typeof deps.getWorkspaceMode === 'function' ? deps.getWorkspaceMode() : 'backoffice';
    }

    function getCurrentData() {
        return typeof deps.getCurrentData === 'function' ? deps.getCurrentData() : null;
    }

    function ensureCurrentDataUiState() {
        let data = getCurrentData();
        if (!data || typeof data !== 'object') {
            data = {};
            if (typeof deps.setCurrentData === 'function') deps.setCurrentData(data);
        }
        if (!data.uiState || typeof data.uiState !== 'object') data.uiState = {};
        return data;
    }

    function schedulePersist() {
        if (typeof deps.scheduleUiStatePersistence === 'function') {
            deps.scheduleUiStatePersistence();
        }
    }

    function sanitizeFamilleHeuristicRulesForServer(rawRules) {
        return (Array.isArray(rawRules) ? rawRules : [])
            .map((r) => {
                const rule = r && typeof r === 'object' ? r : {};
                return {
                    familyLabel: String(rule.familyLabel || '').trim(),
                    groupLabel: String(rule.groupLabel || '').trim(),
                    keywords: String(rule.keywords || '').trim(),
                    scope: String(rule.scope || 'all').trim() || 'all'
                };
            })
            .filter((r) => r.familyLabel && r.keywords);
    }

    function sanitizeOptionFamilyStatusesForServer(rawStatuses) {
        const src = rawStatuses && typeof rawStatuses === 'object' ? rawStatuses : {};
        const out = {};
        Object.entries(src).forEach(([k, v]) => {
            const id = String(k || '').trim();
            const status = String(v || '').trim();
            if (!id) return;
            if (
                status === UGAP_OPTION_FAMILY_STATUS.ASSIGNED
                || status === UGAP_OPTION_FAMILY_STATUS.UNASSIGNED
            ) {
                out[id] = status;
            }
        });
        return out;
    }

    function getFamilleValidatedFamilies() {
        if (getWorkspaceMode() === 'import') {
            return typeof deps.getCatalogueUiStateFamilies === 'function'
                ? deps.getCatalogueUiStateFamilies()
                : [];
        }
        const data = getCurrentData();
        return Array.isArray(data?.uiState?.families) ? data.uiState.families : [];
    }

    function setFamilleValidatedFamilies(families, opts = {}) {
        if (getWorkspaceMode() === 'import') return;
        try {
            const raw = Array.isArray(families) ? families : [];
            const syncFn = deps.syncFamilyOptionsToDecisionGroups;
            const next = typeof syncFn === 'function'
                ? raw.map((f) => syncFn(f))
                : raw.slice();
            const data = ensureCurrentDataUiState();
            data.uiState.families = next;
            writeJson(STORAGE.validatedFamilies, next);
            if (opts.schedulePersist !== false) {
                schedulePersist();
            }
        } catch (_) {
            // no-op
        }
    }

    function getFamilleHeuristicRules() {
        const fromUi = getCurrentData()?.uiState?.familleHeuristicRules;
        if (Array.isArray(fromUi)) return fromUi.slice();
        const parsed = readJson(STORAGE.heuristicRules, []);
        return Array.isArray(parsed) ? parsed : [];
    }

    function setFamilleHeuristicRules(rules) {
        const next = sanitizeFamilleHeuristicRulesForServer(rules);
        const data = ensureCurrentDataUiState();
        data.uiState.familleHeuristicRules = next;
        try {
            writeJson(STORAGE.heuristicRules, next);
            schedulePersist();
        } catch (_) {
            // no-op
        }
    }

    function getOptionFamilyStatuses() {
        const fromUi = getCurrentData()?.uiState?.optionFamilyStatuses;
        if (fromUi && typeof fromUi === 'object') return { ...fromUi };
        const parsed = readJson(STORAGE.optionStatuses, {});
        return parsed && typeof parsed === 'object' ? parsed : {};
    }

    function setOptionFamilyStatuses(statuses) {
        const next = sanitizeOptionFamilyStatusesForServer(statuses);
        const data = ensureCurrentDataUiState();
        data.uiState.optionFamilyStatuses = next;
        try {
            writeJson(STORAGE.optionStatuses, next);
            schedulePersist();
        } catch (_) {
            // no-op
        }
    }

    function getOptionFamilyStatus(optionId) {
        const id = String(optionId || '').trim();
        if (!id) return UGAP_OPTION_FAMILY_STATUS.UNASSIGNED;
        const statuses = getOptionFamilyStatuses();
        const raw = String(statuses[id] || '').trim();
        if (raw === UGAP_OPTION_FAMILY_STATUS.ASSIGNED) return UGAP_OPTION_FAMILY_STATUS.ASSIGNED;
        return UGAP_OPTION_FAMILY_STATUS.UNASSIGNED;
    }

    function getFamilleFoundOrder() {
        const parsed = readJson(STORAGE.foundOrder, []);
        return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
    }

    function setFamilleFoundOrder(order) {
        const clean = Array.from(new Set(
            (Array.isArray(order) ? order : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        ));
        writeJson(STORAGE.foundOrder, clean);
    }

    function getFamilleRelations() {
        const parsed = readJson(STORAGE.relations, {});
        return parsed && typeof parsed === 'object' ? parsed : {};
    }

    function setFamilleRelations(relations) {
        try {
            writeJson(STORAGE.relations, relations || {});
        } catch (_) {
            // no-op
        }
    }

    function getFamilleUiState() {
        if (!window.__ugapFamilleUiState) {
            window.__ugapFamilleUiState = { hiddenIds: [], collapsedFamilyIds: {} };
        }
        if (!window.__ugapFamilleUiState.collapsedFamilyIds
            || typeof window.__ugapFamilleUiState.collapsedFamilyIds !== 'object') {
            window.__ugapFamilleUiState.collapsedFamilyIds = {};
        }
        return window.__ugapFamilleUiState;
    }

    function getFamilleValidatedFilterState() {
        if (!window.__ugapFamilleValidatedFilter) {
            window.__ugapFamilleValidatedFilter = {
                businessViewId: '',
                showNonAssigned: true,
                familyName: '',
                subFamilyName: ''
            };
        }
        return window.__ugapFamilleValidatedFilter;
    }

    function getFamilleRawListFilterState() {
        if (!window.__ugapFamilleRawFilter) {
            window.__ugapFamilleRawFilter = {
                search: '',
                onlyUnassigned: false
            };
        }
        return window.__ugapFamilleRawFilter;
    }

    function getFamilleMergePick() {
        if (!window.__ugapFamilleMergePick) {
            window.__ugapFamilleMergePick = { grid: new Set(), heur: new Set(), ia: new Set() };
        }
        return window.__ugapFamilleMergePick;
    }

    function install(injectedDeps) {
        deps = injectedDeps && typeof injectedDeps === 'object' ? injectedDeps : {};
    }

    const api = {
        install,
        STORAGE,
        UGAP_OPTION_FAMILY_STATUS,
        sanitizeFamilleHeuristicRulesForServer,
        sanitizeOptionFamilyStatusesForServer,
        getFamilleValidatedFamilies,
        setFamilleValidatedFamilies,
        getFamilleHeuristicRules,
        setFamilleHeuristicRules,
        getOptionFamilyStatuses,
        setOptionFamilyStatuses,
        getOptionFamilyStatus,
        getFamilleFoundOrder,
        setFamilleFoundOrder,
        getFamilleRelations,
        setFamilleRelations,
        getFamilleUiState,
        getFamilleValidatedFilterState,
        getFamilleRawListFilterState,
        getFamilleMergePick
    };

    window.UgapFamilleState = api;

    window.sanitizeFamilleHeuristicRulesForServer = sanitizeFamilleHeuristicRulesForServer;
    window.sanitizeOptionFamilyStatusesForServer = sanitizeOptionFamilyStatusesForServer;
    window.getFamilleValidatedFamilies = getFamilleValidatedFamilies;
    window.setFamilleValidatedFamilies = setFamilleValidatedFamilies;
    window.getFamilleHeuristicRules = getFamilleHeuristicRules;
    window.setFamilleHeuristicRules = setFamilleHeuristicRules;
    window.getOptionFamilyStatuses = getOptionFamilyStatuses;
    window.setOptionFamilyStatuses = setOptionFamilyStatuses;
    window.getOptionFamilyStatus = getOptionFamilyStatus;
    window.getFamilleFoundOrder = getFamilleFoundOrder;
    window.setFamilleFoundOrder = setFamilleFoundOrder;
    window.getFamilleRelations = getFamilleRelations;
    window.setFamilleRelations = setFamilleRelations;
    window.getFamilleUiState = getFamilleUiState;
    window.getFamilleValidatedFilterState = getFamilleValidatedFilterState;
    window.getFamilleRawListFilterState = getFamilleRawListFilterState;
    window.getFamilleMergePick = getFamilleMergePick;
    window.UGAP_OPTION_FAMILY_STATUS = UGAP_OPTION_FAMILY_STATUS;
})();
