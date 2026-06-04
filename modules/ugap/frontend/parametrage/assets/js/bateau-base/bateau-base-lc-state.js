/**
 * État templates bateau (ui-state.boatTemplates) — paramétrage v2.
 */
(function initUgapBateauBaseLcState(global) {
    'use strict';

    /** @type {object|null} */
    let currentData = null;
    /** @type {Array<object>} */
    let boatTemplates = [];
    /** @type {Record<string, Record<string, string>>} */
    let modelBaseSlotPicks = {};
    let loadPromise = null;
    let persistTimer = null;
    let persistInFlight = false;
    let persistPending = false;
    let suppressPersist = false;

    function sanitizeBoatTemplates(list) {
        return (Array.isArray(list) ? list : [])
            .filter((t) => t && typeof t === 'object' && String(t.id || '').trim());
    }

    function setData(next) {
        currentData = next && typeof next === 'object' ? next : { categories: [] };
        if (!Array.isArray(currentData.categories)) currentData.categories = [];
        patchCurrentDataUiState();
    }

    function getData() {
        return currentData;
    }

    function patchCurrentDataUiState() {
        if (!currentData || typeof currentData !== 'object') return;
        currentData.uiState = {
            ...(currentData.uiState || {}),
            boatTemplates: boatTemplates.slice(),
            modelBaseSlotPicks: { ...modelBaseSlotPicks },
        };
    }

    function getSavedBoatTemplates() {
        return boatTemplates.slice();
    }

    function setSavedBoatTemplates(list) {
        boatTemplates = sanitizeBoatTemplates(list);
        patchCurrentDataUiState();
        if (!suppressPersist) schedulePersist();
        return boatTemplates.slice();
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
                    boatTemplates: boatTemplates.slice(),
                    modelBaseSlotPicks: { ...modelBaseSlotPicks },
                }),
            });
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde template bateau', 'error');
            throw error;
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

    async function loadFromServer(force = false) {
        if (typeof global.apiCall !== 'function') return;
        if (loadPromise && !force) return loadPromise;

        const run = async () => {
            try {
                const [dataRes, uiRes] = await Promise.all([
                    global.apiCall('/data', { method: 'GET' }),
                    global.apiCall('/ui-state', { method: 'GET' }),
                ]);
                const data = dataRes?.data && typeof dataRes.data === 'object' ? dataRes.data : {};
                const ui = uiRes?.data && typeof uiRes.data === 'object' ? uiRes.data : {};
                data.uiState = { ...(data.uiState || {}), ...ui };

                suppressPersist = true;
                boatTemplates = sanitizeBoatTemplates(ui.boatTemplates || data.uiState?.boatTemplates);
                modelBaseSlotPicks = (ui.modelBaseSlotPicks && typeof ui.modelBaseSlotPicks === 'object')
                    ? { ...ui.modelBaseSlotPicks }
                    : (data.uiState?.modelBaseSlotPicks && typeof data.uiState.modelBaseSlotPicks === 'object'
                        ? { ...data.uiState.modelBaseSlotPicks }
                        : {});

                setData(data);
            } catch (error) {
                global.showAlert?.(error?.message || 'Erreur chargement bateau de base', 'warning');
            } finally {
                suppressPersist = false;
            }
        };

        loadPromise = run().finally(() => {
            loadPromise = null;
        });
        return loadPromise;
    }

    async function reload() {
        loadPromise = null;
        await loadFromServer(true);
    }

    function installGlobals() {
        global.getSavedBoatTemplates = getSavedBoatTemplates;
        global.setSavedBoatTemplates = setSavedBoatTemplates;
        global.syncImportBoatTemplatesFromSaved = () => {};
        global.triggerUiStatePersistenceNow = persistToServer;
        global.getUgapCurrentData = getData;
        global.setUgapCurrentData = setData;
    }

    installGlobals();

    function getModelBaseSlotPicks() {
        return { ...modelBaseSlotPicks };
    }

    function setSuppressPersist(value) {
        suppressPersist = !!value;
        if (suppressPersist && persistTimer) {
            clearTimeout(persistTimer);
            persistTimer = null;
        }
    }

    function setModelBaseSlotPick(modelId, slotKey, optionIdOrIds) {
        const mid = String(modelId || '').trim();
        const key = String(slotKey || '').trim();
        if (!mid || !key) return;
        const next = { ...modelBaseSlotPicks };
        if (!next[mid] || typeof next[mid] !== 'object') next[mid] = {};
        const row = { ...next[mid] };
        if (Array.isArray(optionIdOrIds)) {
            const ids = optionIdOrIds.map((x) => String(x || '').trim()).filter(Boolean);
            if (!ids.length) delete row[key];
            else row[key] = ids.length === 1 ? ids[0] : ids;
        } else {
            const oid = String(optionIdOrIds || '').trim();
            if (!oid) delete row[key];
            else row[key] = oid;
        }
        next[mid] = row;
        modelBaseSlotPicks = next;
        patchCurrentDataUiState();
        if (!suppressPersist) schedulePersist();
    }

    async function persistModelBaseSlotPicksOnly() {
        if (suppressPersist || typeof global.apiCall !== 'function') return false;
        try {
            const result = await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({ modelBaseSlotPicks: { ...modelBaseSlotPicks } }),
            });
            const serverPicks = result?.data?.modelBaseSlotPicks;
            if (serverPicks && typeof serverPicks === 'object' && !Array.isArray(serverPicks)) {
                modelBaseSlotPicks = { ...serverPicks };
                patchCurrentDataUiState();
            }
            return true;
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde des choix options de base', 'error');
            return false;
        }
    }

    global.UgapBateauBaseLcState = {
        loadFromServer,
        reload,
        getData,
        setData,
        getSavedBoatTemplates,
        setSavedBoatTemplates,
        persistToServer,
        getModelBaseSlotPicks,
        setModelBaseSlotPick,
        setSuppressPersist,
        persistModelBaseSlotPicksOnly,
    };
})(window);
