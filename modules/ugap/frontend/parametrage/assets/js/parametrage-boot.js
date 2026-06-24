/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/parametrage-boot.js
 * RÔLE : Navigation sections paramétrage + sous-onglets Importation.
 */
(function bootUgapParametrage() {
    'use strict';

    const SECTIONS = [
        'importation', 'catalogue', 'options', 'bateau-base', 'modeles',
    ];

    const IMPORT_TABS = [
        'detect', 'modeles', 'minoration', 'majoration',
        'catalogue', 'base_option', 'pr', 'valider',
    ];

    const app = document.getElementById('ugap-parametrage-app');
    if (!app) return;

    const initialSection = app.getAttribute('data-initial-section') || 'importation';
    const initialTab = app.getAttribute('data-initial-tab') || 'detect';

    const sectionButtons = Array.from(app.querySelectorAll('.ugap-param-section-tab'));
    const sectionPanels = Array.from(app.querySelectorAll('[data-section-panel]'));
    const importRoot = document.getElementById('ugap-section-importation');
    const importTabButtons = importRoot
        ? Array.from(importRoot.querySelectorAll('.ugap-import-tab'))
        : [];
    const importPanels = importRoot
        ? Array.from(importRoot.querySelectorAll('.ugap-param-panel'))
        : [];

    function inGdri() {
        return !!document.getElementById('ugap-gdri-host');
    }

    function normalizeSection(sectionId) {
        if (sectionId === 'categorie') return 'catalogue';
        return SECTIONS.includes(sectionId) ? sectionId : 'importation';
    }

    function syncUrl(sectionId, tabId) {
        try {
            const url = new URL(window.location.href);
            if (inGdri()) {
                url.searchParams.set('param_section', sectionId);
                if (sectionId === 'importation' && tabId) {
                    url.searchParams.set('param_tab', tabId);
                } else {
                    url.searchParams.delete('param_tab');
                }
            } else {
                url.searchParams.set('section', sectionId);
                if (sectionId === 'importation' && tabId) {
                    url.searchParams.set('tab', tabId);
                } else {
                    url.searchParams.delete('tab');
                }
            }
            window.history.replaceState({}, '', url.toString());
        } catch (e) { /* ignore */ }
    }

    function setActiveSection(sectionId) {
        sectionButtons.forEach((btn) => {
            btn.classList.toggle('is-active', btn.getAttribute('data-section') === sectionId);
        });
        sectionPanels.forEach((panel) => {
            const active = panel.getAttribute('data-section-panel') === sectionId;
            panel.classList.toggle('is-active', active);
            panel.hidden = !active;
        });
    }

    function setActiveImportTab(tabId) {
        const safeTab = IMPORT_TABS.includes(tabId) ? tabId : 'detect';
        importTabButtons.forEach((btn) => {
            btn.classList.toggle('is-active', btn.getAttribute('data-tab') === safeTab);
        });
        importPanels.forEach((panel) => {
            const active = panel.getAttribute('data-panel') === safeTab;
            panel.classList.toggle('is-active', active);
            panel.hidden = !active;
        });
        return safeTab;
    }

    function getCurrentImportTab() {
        const current = importTabButtons.find((b) => b.classList.contains('is-active'));
        return current ? current.getAttribute('data-tab') : 'detect';
    }

    function activate(sectionId, tabId) {
        const section = normalizeSection(sectionId);
        setActiveSection(section);
        const activeTab = section === 'importation'
            ? setActiveImportTab(tabId || getCurrentImportTab())
            : null;
        syncUrl(section, activeTab);
        if (section === 'importation' && activeTab === 'valider' && window.UgapImportValiderTab?.refreshStaging) {
            window.UgapImportValiderTab.refreshStaging();
        }
        if (section === 'importation' && activeTab === 'base_option' && window.UgapBaseOptionEditor?.refreshFromStaging) {
            void window.UgapBaseOptionEditor.refreshFromStaging();
        }
        if (section === 'importation' && activeTab === 'minoration' && window.__ugapDetectionReport && window.UgapDetectPaint?.paintDetectionReport) {
            window.UgapDetectPaint.paintDetectionReport(window.__ugapDetectionReport);
        }
        if (section === 'catalogue' && typeof window.mountUgapCatalogue === 'function') {
            window.mountUgapCatalogue();
        }
        if (section === 'modeles' && window.UgapModelesTab?.mount) {
            window.UgapModelesTab.mount();
        }
        if (section === 'options' && window.UgapOptionsTab?.mount) {
            window.UgapOptionsTab.mount();
        }
        if (section === 'bateau-base') {
            const run = window.UgapBateauBaseLcTab?.refresh || window.UgapBateauBaseLcTab?.mount;
            if (run) void run();
        }
        if (typeof window.onEmbeddedTabActivated === 'function') {
            window.onEmbeddedTabActivated();
        }
    }

    sectionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-section') || 'importation';
            const tab = section === 'importation' ? getCurrentImportTab() : null;
            activate(section, tab);
        });
    });

    importTabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            activate('importation', btn.getAttribute('data-tab') || 'detect');
        });
    });

    const bootSection = normalizeSection(initialSection);
    const bootTab = IMPORT_TABS.includes(initialTab) ? initialTab : 'detect';
    activate(bootSection, bootSection === 'importation' ? bootTab : null);

    function onReady() {
        const gdriDirect = window.UgapGdriHost && window.UgapGdriHost.isGdriDirectEmbed();
        if (!gdriDirect && typeof window.applyEmbeddedLayout === 'function') {
            window.applyEmbeddedLayout();
        }
        if (window.UgapDetectBind) {
            window.UgapDetectBind.bindDetectionPanel();
        }
        if (window.UgapCatalogueLcState?.loadFromServer) {
            void window.UgapCatalogueLcState.loadFromServer(true);
        }
        if (window.UgapBateauBaseLcState?.loadFromServer) {
            void window.UgapBateauBaseLcState.loadFromServer();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
