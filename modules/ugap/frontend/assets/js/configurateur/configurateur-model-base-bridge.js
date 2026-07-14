/**
 * Pont configurateur → UgapModelBaseOptions (contexte isolé, sans écraser le paramétrage).
 */
(function initUgapConfiguratorModelBaseBridge(global) {
    'use strict';

    function groupToModelBaseSlot(groupOrSlot) {
        const g = groupOrSlot && typeof groupOrSlot === 'object' ? groupOrSlot : {};
        const catalogNodeId = String(g.catalogNodeId || '').trim();
        const groupId = String(g.groupId || '').trim();
        const slot = {
            familyLabel: String(g.familyLabel || '').trim(),
            groupId,
            groupLabel: String(g.groupLabel || g.label || groupId || '').trim(),
            categoryName: String(g.categoryName || g.familyLabel || '').trim(),
        };
        if (catalogNodeId) slot.catalogNodeId = catalogNodeId;
        const mode = String(g.decisionMode || '').trim().toLowerCase();
        if (mode) slot.decisionMode = mode;
        const nodeId = String(g.nodeId || '').trim();
        if (nodeId) slot.nodeId = nodeId;
        if (g.__idx != null && g.__idx !== '') slot.__idx = g.__idx;
        return slot;
    }

    function syncConfiguratorModelBaseBridge(state) {
        const MBO = global.UgapModelBaseOptions;
        if (!MBO?.setConfiguratorContext || !state) {
            MBO?.clearConfiguratorContext?.();
            return;
        }

        MBO.setConfiguratorContext({
            getData: () => ({
                models: Array.isArray(state.models) ? state.models : [],
                categories: Array.isArray(state.categories) ? state.categories : [],
                importBaseProducts: Array.isArray(state.importBaseProducts) ? state.importBaseProducts : [],
                uiState: state.uiState && typeof state.uiState === 'object' ? state.uiState : {},
            }),
            getFamilies: () => {
                if (typeof state.getValidatedFamilies === 'function') {
                    return state.getValidatedFamilies();
                }
                const ui = state.uiState;
                return Array.isArray(ui?.families) ? ui.families : [];
            },
            getTemplates: () => {
                const ui = state.uiState;
                if (Array.isArray(ui?.boatTemplates) && ui.boatTemplates.length) {
                    return ui.boatTemplates;
                }
                try {
                    const raw = global.localStorage.getItem('ugap.templateBateau.saved');
                    const parsed = raw ? JSON.parse(raw) : [];
                    return Array.isArray(parsed) ? parsed : [];
                } catch (_) {
                    return [];
                }
            },
            getModelBaseSlotPicks: () => {
                const picks = state.uiState?.modelBaseSlotPicks;
                const all = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {};
                const mid = String(state.selectedModel?.id || '').trim();
                if (!mid) return all;
                const baseRow = all[mid] && typeof all[mid] === 'object' ? { ...all[mid] } : {};
                const cfgId = String(state.selectedConfig?.id || '').trim();
                const cfgPicks = state.selectedConfig?.slotPicks;
                if (cfgId && cfgId !== 'default-config' && cfgPicks && typeof cfgPicks === 'object') {
                    return { ...all, [mid]: { ...baseRow, ...cfgPicks } };
                }
                if (Object.keys(baseRow).length) {
                    return { ...all, [mid]: baseRow };
                }
                return all;
            },
            isOptionCompatible: (opt, modelId) => {
                const mid = String(modelId || state.selectedModel?.id || '').trim();
                if (!mid) return true;
                // compatibleModels stricte quand renseignée ; vide = tous les modèles.
                const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
                if (comp.length) return comp.includes(mid);
                return true;
            },
            getActiveSelectedOptionIds: () => {
                const out = new Set();
                (state.selectedOptions || []).forEach((id) => {
                    const oid = String(id || '').trim();
                    if (oid) out.add(oid);
                });
                (state.fivePercentOptions || []).forEach((id) => {
                    const oid = String(id || '').trim();
                    if (oid) out.add(oid);
                });
                return Array.from(out);
            },
        });

        // Configurateur : picks preset en complément des options de base, pas en remplacement exclusif.
        MBO.setPresetEditContext?.('', '');
    }

    function clearConfiguratorModelBaseBridge() {
        global.UgapModelBaseOptions?.clearConfiguratorContext?.();
    }

    global.UgapConfiguratorModelBaseBridge = {
        sync: syncConfiguratorModelBaseBridge,
        clear: clearConfiguratorModelBaseBridge,
        groupToSlot: groupToModelBaseSlot,
    };
})(window);
