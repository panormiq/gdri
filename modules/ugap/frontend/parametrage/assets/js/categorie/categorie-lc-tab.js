/**
 * Vue LC Catégories — paramétrage v2.
 */
(function initUgapCategorieLcTab(global) {
    'use strict';

    const MOUNT_ID = 'ugap-categorie-lc-mount';

    async function ensureDataLoaded() {
        await global.UgapFamilleLcState?.loadFromServer?.();
        await global.UgapCategorieLcState?.loadFromServer?.();
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

        if (!global.UgapCategorieTab?.mount) {
            mountEl.innerHTML = '<p class="ugap-param-placeholder">Module catégories indisponible.</p>';
            return;
        }

        if (mountEl.querySelector('[data-ugap-vue-lc="categorie"]')) {
            global.UgapCategorieTab.refresh?.();
            return;
        }

        global.UgapCategorieTab.mount();
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    async function refresh() {
        await ensureDataLoaded();
        if (global.UgapCategorieTab?.refresh) {
            global.UgapCategorieTab.refresh();
        } else {
            await mount();
        }
    }

    global.UgapCategorieLcTab = { mount, refresh };
    global.mountUgapCategorieLc = mount;
})(window);
