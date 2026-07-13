/**
 * FICHIER : parametrage/assets/js/liaisons/liaisons-tab.js
 * RÔLE : Onglet Liaisons — navigation 3 sous-onglets + chargement données.
 */
(function initUgapLiaisonsTab(global) {
    'use strict';

    const S = () => global.UgapLiaisonsShared;
    const SUB_TABS = ['incompatibility', 'complementary', 'auto_add', 'requires'];

    function panelApi(subTab) {
        if (subTab === 'incompatibility') return global.UgapLiaisonsIncompatibilityPanel;
        if (subTab === 'complementary') return global.UgapLiaisonsComplementaryPanel;
        if (subTab === 'auto_add') return global.UgapLiaisonsAutoAddPanel;
        return global.UgapLiaisonsRequiresPanel;
    }

    function setSubTab(subTab) {
        const safe = SUB_TABS.includes(subTab) ? subTab : 'incompatibility';
        S().store.subTab = safe;
        document.querySelectorAll('.ugap-liaisons-sub-tab').forEach((btn) => {
            btn.classList.toggle('is-active', btn.getAttribute('data-liaisons-sub') === safe);
        });
        const filters = document.querySelector('.ugap-liaisons-filters');
        if (filters) filters.hidden = safe !== 'incompatibility';
        renderActivePanel();
    }

    function renderActivePanel() {
        const mount = S().byId('ugap-liaisons-panel-mount');
        const api = panelApi(S().store.subTab);
        if (mount && api?.render) api.render(mount);
    }

    async function loadLiaisons() {
        const mount = S().byId('ugap-liaisons-panel-mount');
        if (mount) mount.innerHTML = '<p class="ugap-param-placeholder">Chargement des liaisons…</p>';
        S().showSectionStatus('', 'info');
        try {
            const res = await global.apiCall('/data', { method: 'GET' });
            S().store.data = res?.data || {};
            if (typeof global.setUgapCurrentData === 'function') {
                global.setUgapCurrentData(S().store.data);
            }
            S().fillFilterSelects?.();
            renderActivePanel();
        } catch (err) {
            if (mount) mount.innerHTML = '';
            S().showSectionStatus(err?.message || 'Erreur chargement liaisons', 'error');
            global.showAlert?.(err?.message || 'Erreur chargement liaisons', 'error');
        }
    }

    function bindEvents() {
        const root = S().byId('ugap-section-liaisons');
        if (!root || root.dataset.liaisonsBound === '1') return;
        root.dataset.liaisonsBound = '1';

        root.querySelectorAll('.ugap-liaisons-sub-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                setSubTab(btn.getAttribute('data-liaisons-sub') || 'incompatibility');
            });
        });

        root.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('#ugap-liaisons-refresh')) void loadLiaisons();
        });

        S().byId('ugap-liaisons-filter-search')?.addEventListener('input', (e) => {
            S().store.filterQuery = String(e.target?.value || '');
            if (S().store.subTab === 'incompatibility') renderActivePanel();
        });
        S().byId('ugap-liaisons-filter-node')?.addEventListener('change', (e) => {
            S().store.filterCatalogNode = String(e.target?.value || '').trim();
            if (S().store.subTab === 'incompatibility') renderActivePanel();
        });
        S().byId('ugap-liaisons-filter-model')?.addEventListener('change', (e) => {
            S().store.filterModel = String(e.target?.value || '').trim();
            if (S().store.subTab === 'incompatibility') renderActivePanel();
        });
        S().byId('ugap-liaisons-filter-tag')?.addEventListener('change', (e) => {
            S().store.filterTag = String(e.target?.value || 'all');
            if (S().store.subTab === 'incompatibility') renderActivePanel();
        });
        S().byId('ugap-liaisons-filter-status')?.addEventListener('change', (e) => {
            S().store.filterStatus = String(e.target?.value || 'all');
            if (S().store.subTab === 'incompatibility') renderActivePanel();
        });

        const rerender = () => loadLiaisons();
        global.UgapLiaisonsIncompatibilityPanel?.bindPanelEvents?.(root, rerender);
        global.UgapLiaisonsComplementaryPanel?.bindPanelEvents?.(root, rerender);
        global.UgapLiaisonsAutoAddPanel?.bindPanelEvents?.(root, rerender);
        global.UgapLiaisonsRequiresPanel?.bindPanelEvents?.(root, rerender);
    }

    function mount() {
        bindEvents();
        setSubTab(S().store.subTab);
        void loadLiaisons();
    }

    global.UgapLiaisonsTab = { mount, loadLiaisons, setSubTab };
})(typeof window !== 'undefined' ? window : globalThis);
