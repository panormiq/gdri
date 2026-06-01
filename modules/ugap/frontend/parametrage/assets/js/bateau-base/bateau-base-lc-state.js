/**
 * État templates bateau (ui-state.boatTemplates) — paramétrage v2.
 */
(function initUgapBateauBaseLcState(global) {
    'use strict';

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

    function sanitizeFamiliesForServer(list) {
        return (Array.isArray(list) ? list : []).map((f) => {
            const row = f && typeof f === 'object' ? { ...f } : {};
            delete row.__idx;
            return row;
        });
    }

    function patchCurrentDataUiState() {
        if (typeof global.setUgapCurrentData !== 'function') return;
        const data = typeof global.getUgapCurrentData === 'function'
            ? global.getUgapCurrentData()
            : null;
        if (!data || typeof data !== 'object') return;
        data.uiState = {
            ...(data.uiState || {}),
            boatTemplates: boatTemplates.slice(),
            modelBaseSlotPicks: { ...modelBaseSlotPicks },
        };
        global.setUgapCurrentData(data);
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
            const families = global.UgapFamilleLcState?.getFamilies?.() || [];
            const familyGroupTypes = global.UgapFamilleLcState?.getCustomGroupTypes?.() || [];
            await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({
                    families: sanitizeFamiliesForServer(families),
                    familyGroupTypes,
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

                if (global.UgapCategorieLcState?.setData) {
                    global.UgapCategorieLcState.setData(data);
                } else if (typeof global.setUgapCurrentData === 'function') {
                    global.setUgapCurrentData(data);
                }
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
    }

    installGlobals();

    function getModelBaseSlotPicks() {
        return { ...modelBaseSlotPicks };
    }

    function setModelBaseSlotPick(modelId, slotKey, optionId) {
        const mid = String(modelId || '').trim();
        const key = String(slotKey || '').trim();
        const oid = String(optionId || '').trim();
        if (!mid || !key || !oid) return;
        const next = { ...modelBaseSlotPicks };
        if (!next[mid] || typeof next[mid] !== 'object') next[mid] = {};
        next[mid] = { ...next[mid], [key]: oid };
        modelBaseSlotPicks = next;
        patchCurrentDataUiState();
        if (!suppressPersist) schedulePersist();
    }

    global.UgapBateauBaseLcState = {
        loadFromServer,
        reload,
        getSavedBoatTemplates,
        setSavedBoatTemplates,
        persistToServer,
        getModelBaseSlotPicks,
        setModelBaseSlotPick,
    };
})(window);
