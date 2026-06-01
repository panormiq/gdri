/**
 * Vue LC Bateau de base — paramétrage v2.
 */
(function initUgapBateauBaseLcTab(global) {
    'use strict';

    const MOUNT_ID = 'ugap-template-bateau-lc-mount';

    async function ensureDataLoaded() {
        await global.UgapFamilleLcState?.loadFromServer?.();
        await global.UgapCategorieLcState?.loadFromServer?.();
        await global.UgapBateauBaseLcState?.loadFromServer?.();
    }

    async function mount() {
        const mountEl = global.document.getElementById(MOUNT_ID);
        if (!mountEl) return;

        try {
            await ensureDataLoaded();
        } catch (err) {
            mountEl.innerHTML = `<p class="ugap-param-placeholder">Erreur chargement : ${global.escapeHtml?.(err?.message || err) || 'inconnue'}</p>`;
            return;
        }

        if (!global.UgapTemplateBateauTab?.mount) {
            mountEl.innerHTML = '<p class="ugap-param-placeholder">Module bateau de base indisponible.</p>';
            return;
        }

        if (mountEl.querySelector('[data-ugap-vue-lc="template-bateau"]')) {
            global.UgapTemplateBateauTab.refresh?.();
            return;
        }

        global.UgapTemplateBateauTab.mount();
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    async function refresh() {
        await ensureDataLoaded();
        if (global.UgapTemplateBateauTab?.refresh) {
            global.UgapTemplateBateauTab.refresh();
        } else {
            await mount();
        }
    }

    global.UgapBateauBaseLcTab = { mount, refresh };
    global.mountUgapBateauBaseLc = mount;
})(window);
