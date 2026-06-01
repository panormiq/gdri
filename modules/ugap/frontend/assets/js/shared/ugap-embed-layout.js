/**
 * RÔLE | Layout iframe embarqué (hauteur parent) + modales visibles dans la zone courante
 * ENTRÉES | DOM, postMessage parent, pointer events
 * SORTIES | isEmbeddedMode, measureEmbeddedContentHeight, scheduleParentEmbedResize, resetEmbeddedDocumentHeight
 * DÉPEND DE | #ugap-parametrage-root (v2), #legacy-backoffice-card (legacy), #ugap-configurator-app
 * NE PAS | Mesurer body.scrollHeight en mode embarqué (hauteur fantôme après changement d’onglet)
 * APPELÉ PAR | admin.php, index.html, onglets import / famille
 */
(function (global) {
    'use strict';

    let resizeTimer = null;

    function isEmbeddedMode() {
        try {
            return new URLSearchParams(global.location.search || '').get('embedded') === '1';
        } catch (_) {
            return false;
        }
    }

    function elementBottom(el) {
        if (!el) return 0;
        const st = global.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') return 0;
        const rect = el.getBoundingClientRect();
        const top = rect.top + (global.scrollY || 0);
        return Math.max(
            top + (el.scrollHeight || 0),
            top + (el.offsetHeight || 0),
            top + Math.ceil(rect.height || 0)
        );
    }

    function measureParametrageEmbeddedHeight() {
        const heights = [];
        const root = document.getElementById('ugap-parametrage-root');
        const tabs = document.querySelector('.ugap-import-tabs')
            || document.querySelector('.ugap-param-sections');
        const activePanel = document.querySelector('.ugap-param-panel.is-active');
        if (tabs) heights.push(elementBottom(tabs));
        if (activePanel) heights.push(elementBottom(activePanel));
        if (root) heights.push(elementBottom(root));
        const valid = heights.filter((n) => Number.isFinite(n) && n > 0);
        return valid.length ? Math.max(...valid, 280) + 48 : 400;
    }

    function measureAdminEmbeddedHeight() {
        if (document.getElementById('ugap-parametrage-root')) {
            return measureParametrageEmbeddedHeight();
        }
        const heights = [];
        const card = document.getElementById('legacy-backoffice-card');
        const tabsRow = document.querySelector('#legacy-backoffice-card .tabs') || document.querySelector('.tabs');
        const activePanel =
            document.querySelector('#legacy-backoffice-card .tab-panel.active') ||
            document.querySelector('.tab-panel.active');

        if (tabsRow) heights.push(elementBottom(tabsRow));
        if (activePanel) {
            heights.push(elementBottom(activePanel));
            if (activePanel.id === 'tab-import') {
                ['import-workflow-section', 'import-editor-section'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null) heights.push(elementBottom(el));
                });
            }
            if (activePanel.id === 'tab-options') {
                [
                    'options-heur-panel',
                    'options-tab-catalog-status',
                    'ugap-options-table-scroll',
                    'categories-table'
                ].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null) heights.push(elementBottom(el));
                });
            }
        } else if (card) {
            heights.push(elementBottom(card));
        }

        const container = document.querySelector('.container-xl');
        if (container && !card) heights.push(elementBottom(container));

        const valid = heights.filter((n) => Number.isFinite(n) && n > 0);
        return valid.length ? Math.max(...valid, 280) + 48 : 400;
    }

    function measureConfiguratorEmbeddedHeight() {
        const heights = [];
        [
            document.getElementById('ugap-configurator-app'),
            document.querySelector('#ugap-configurator-app .step-content.active'),
            document.getElementById('ugap-category-table-root'),
            document.getElementById('ugap-excel-options-root')
        ].forEach((el) => {
            if (el) heights.push(elementBottom(el));
        });
        const valid = heights.filter((n) => Number.isFinite(n) && n > 0);
        return valid.length ? Math.max(...valid, 280) + 24 : 320;
    }

    function measureEmbeddedContentHeight() {
        if (!isEmbeddedMode()) {
            const h = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
            return Number.isFinite(h) && h > 0 ? h : 400;
        }
        if (document.getElementById('ugap-configurator-app')) {
            return measureConfiguratorEmbeddedHeight();
        }
        return measureAdminEmbeddedHeight();
    }

    function notifyParentEmbedResize() {
        if (!isEmbeddedMode() || !global.parent || global.parent === global) return;
        try {
            global.parent.postMessage(
                { type: 'ugap-embed-resize', height: measureEmbeddedContentHeight() },
                global.location.origin
            );
        } catch (_) { /* ignore */ }
    }

    function scheduleParentEmbedResize() {
        if (!isEmbeddedMode()) return;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeTimer = null;
            notifyParentEmbedResize();
        }, 50);
    }

    function forceParentEmbedResize() {
        if (!isEmbeddedMode()) return;
        notifyParentEmbedResize();
        scheduleParentEmbedResize();
        setTimeout(scheduleParentEmbedResize, 80);
        setTimeout(scheduleParentEmbedResize, 350);
    }

    function resetEmbeddedDocumentHeight() {
        if (!isEmbeddedMode()) return;
        document.documentElement.style.height = 'auto';
        document.documentElement.style.minHeight = '0';
        document.body.style.height = 'auto';
        document.body.style.minHeight = '0';
        try {
            global.scrollTo({ top: 0, behavior: 'instant' });
        } catch (_) {
            global.scrollTo(0, 0);
        }
    }

    function collectEmbedObserveTargets() {
        const targets = [
            document.getElementById('ugap-parametrage-root'),
            document.getElementById('ugap-param-panels'),
            document.querySelector('.ugap-param-panel.is-active'),
            document.querySelector('.ugap-import-tabs'),
            document.querySelector('.ugap-param-sections'),
            document.getElementById('legacy-backoffice-card'),
            document.querySelector('#legacy-backoffice-card .tab-panel.active'),
            document.querySelector('#legacy-backoffice-card .tabs'),
            document.getElementById('tab-import'),
            document.getElementById('tab-options'),
            document.getElementById('tab-famille'),
            document.getElementById('ugap-options-table-scroll'),
            document.getElementById('categories-table'),
            document.querySelector('.container-xl'),
            document.getElementById('import-workflow-section'),
            document.getElementById('import-workflow-content-models'),
            document.getElementById('import-workflow-content-families'),
            document.getElementById('import-editor-section'),
            document.getElementById('extraction-famille-content'),
            document.getElementById('ugap-configurator-app')
        ];
        document.querySelectorAll('.tab-panel.active').forEach((el) => targets.push(el));
        return targets.filter(Boolean);
    }

    function applyConfiguratorEmbeddedLayout() {
        document.documentElement.style.overflowY = 'visible';
        document.body.classList.add('ugap-embedded-mode');
        document.body.style.overflowY = 'visible';
        document.body.style.minHeight = '0';
        resetEmbeddedDocumentHeight();
        scheduleParentEmbedResize();
        if (typeof ResizeObserver !== 'undefined' && !global.__ugapConfiguratorResizeObserver) {
            global.__ugapConfiguratorResizeObserver = new ResizeObserver(() => scheduleParentEmbedResize());
            const root = document.getElementById('ugap-configurator-app');
            if (root) global.__ugapConfiguratorResizeObserver.observe(root);
        }
        installUgapModalViewportAlign();
    }

    function applyEmbeddedLayout() {
        if (!isEmbeddedMode()) return;

        if (document.getElementById('ugap-configurator-app')) {
            applyConfiguratorEmbeddedLayout();
            return;
        }

        const header = document.getElementById('header');
        if (header) header.style.display = 'none';
        const spacer = header?.nextElementSibling;
        if (spacer) spacer.style.display = 'none';

        const container = document.querySelector('.container-xl');
        if (container) container.style.paddingTop = '10px';

        ['legacy-admin-hero-card', 'legacy-stats-card'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        document.documentElement.style.overflowY = 'visible';
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowY = 'visible';
        document.body.style.overflowX = 'hidden';
        document.body.style.height = 'auto';
        document.body.style.minHeight = '0';
        document.body.style.maxWidth = '100%';
        document.body.classList.add('ugap-embedded-mode');

        resetEmbeddedDocumentHeight();
        scheduleParentEmbedResize();

        if (typeof ResizeObserver !== 'undefined' && !global.__ugapEmbedResizeObserver) {
            global.__ugapEmbedResizeObserver = new ResizeObserver(() => scheduleParentEmbedResize());
            collectEmbedObserveTargets().forEach((el) => global.__ugapEmbedResizeObserver.observe(el));
        }

        installUgapModalViewportAlign();
    }

    function alignUgapModalToViewport(modal) {
        if (!modal) return;
        const vh = global.innerHeight || 600;
        const margin = 16;
        const ptr = global.__ugapLastPointer || { clientY: Math.round(vh * 0.2) };
        let padTop = Math.max(margin, (ptr.clientY || 0) - 28);
        padTop = Math.min(padTop, Math.max(margin, vh - 72));

        modal.style.display = 'flex';
        modal.style.alignItems = 'flex-start';
        modal.style.justifyContent = 'center';
        modal.style.paddingTop = padTop + 'px';
        modal.style.paddingBottom = margin + 'px';
        modal.style.paddingLeft = '12px';
        modal.style.paddingRight = '12px';
        modal.style.overflowY = 'auto';
        modal.style.boxSizing = 'border-box';

        if (isEmbeddedMode()) {
            resetEmbeddedDocumentHeight();
            try {
                global.parent.postMessage(
                    { type: 'ugap-embed-scroll-to', offsetY: 0 },
                    global.location.origin
                );
            } catch (_) { /* ignore */ }
        }
    }

    function clearUgapModalViewportStyles(modal) {
        if (!modal) return;
        // display:flex est posé inline par alignUgapModalToViewport ; sans le retirer,
        // il écrase .modal { display:none } et laisse une coque vide en haut à gauche.
        modal.style.display = '';
        modal.style.paddingTop = '';
        modal.style.paddingBottom = '';
        modal.style.paddingLeft = '';
        modal.style.paddingRight = '';
        modal.style.alignItems = '';
        modal.style.justifyContent = '';
        modal.style.overflowY = '';
        modal.style.boxSizing = '';
    }

    function syncUgapModalViewport(modal) {
        if (!modal?.classList?.contains('modal')) return;
        if (modal.classList.contains('active')) {
            alignUgapModalToViewport(modal);
        } else {
            clearUgapModalViewportStyles(modal);
        }
    }

    function installUgapModalViewportAlign() {
        if (global.__ugapModalAlignInstalled) return;
        global.__ugapModalAlignInstalled = true;

        const vh = global.innerHeight || 600;
        global.__ugapLastPointer = { clientX: 0, clientY: Math.round(vh * 0.25) };

        document.addEventListener(
            'pointerdown',
            (e) => {
                global.__ugapLastPointer = { clientX: e.clientX, clientY: e.clientY };
            },
            true
        );

        const obs = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                const t = m.target;
                if (t?.classList?.contains('modal') && m.attributeName === 'class') {
                    syncUgapModalViewport(t);
                }
                if (m.type === 'childList') {
                    m.addedNodes.forEach((node) => {
                        if (node.nodeType !== 1) return;
                        const modals = node.classList?.contains('modal')
                            ? [node]
                            : Array.from(node.querySelectorAll?.('.modal') || []);
                        modals.forEach((modal) => {
                            obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
                            syncUgapModalViewport(modal);
                        });
                    });
                }
            });
        });

        obs.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        document.querySelectorAll('.modal').forEach((el) => {
            obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    }

    function onEmbeddedTabActivated() {
        resetEmbeddedDocumentHeight();
        forceParentEmbedResize();
        if (global.__ugapEmbedResizeObserver) {
            collectEmbedObserveTargets().forEach((el) => {
                try {
                    global.__ugapEmbedResizeObserver.observe(el);
                } catch (_) { /* déjà observé */ }
            });
        }
    }

    global.UgapEmbedLayout = {
        isEmbeddedMode,
        measureEmbeddedContentHeight,
        notifyParentEmbedResize,
        scheduleParentEmbedResize,
        forceParentEmbedResize,
        resetEmbeddedDocumentHeight,
        applyEmbeddedLayout,
        onEmbeddedTabActivated,
        installUgapModalViewportAlign,
        alignUgapModalToViewport
    };

    global.isEmbeddedMode = isEmbeddedMode;
    global.measureEmbeddedContentHeight = measureEmbeddedContentHeight;
    global.scheduleParentEmbedResize = scheduleParentEmbedResize;
    global.forceParentEmbedResize = forceParentEmbedResize;
    global.resetEmbeddedDocumentHeight = resetEmbeddedDocumentHeight;
    global.applyEmbeddedLayout = applyEmbeddedLayout;
    global.onEmbeddedTabActivated = onEmbeddedTabActivated;
})(window);
