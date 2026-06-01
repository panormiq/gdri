/**
 * Pont configurateur → UgapModelBaseOptions (contexte isolé, sans écraser le paramétrage).
 */
(function initUgapConfiguratorModelBaseBridge(global) {
    'use strict';

    function groupToModelBaseSlot(group) {
        const g = group && typeof group === 'object' ? group : {};
        return {
            familyLabel: String(g.familyLabel || '').trim(),
            groupId: String(g.groupId || '').trim(),
            groupLabel: String(g.label || g.groupId || '').trim(),
            categoryName: String(g.categoryName || g.familyLabel || '').trim(),
        };
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
                return picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {};
            },
        });
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
