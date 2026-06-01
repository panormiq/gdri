/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-gdri-host.js
 * RÔLE : Inclusion directe dans ugap.php — dock import + stubs embed (sans iframe).
 *
 * ENTRÉES : #ugap-gdri-host, #ugap-import-mino-recap-dock-host
 * SORTIES : updateImportMinorationRecap ; no-op resize embed
 *
 * DÉPEND DE : —
 * NE PAS : logique métier catalogue
 * APPELÉ PAR : gdri-embed configurateur/parametrage, import-workflow-steps.js
 */
(function (global) {
    'use strict';

    function isGdriDirectEmbed() {
        return !!document.getElementById('ugap-gdri-host')
            || document.body.classList.contains('ugap-gdri-embed');
    }

    function getRecapDockHost() {
        return document.getElementById('ugap-import-mino-recap-dock-host');
    }

    function updateImportMinorationRecap(payload) {
        const host = getRecapDockHost();
        if (!host) {
            if (global.parent && global.parent !== global) {
                try {
                    global.parent.postMessage(payload, global.location.origin);
                } catch (_) { /* ignore */ }
            }
            return;
        }
        if (!payload || !payload.visible) {
            host.hidden = true;
            host.innerHTML = '';
            return;
        }
        host.hidden = false;
        host.innerHTML = payload.html || '';
    }

    /** No-op : plus de resize iframe en inclusion directe. */
    function scheduleParentEmbedResize() { /* intentional */ }

    function applyEmbeddedLayout() {
        if (document.body) {
            document.body.classList.add('ugap-gdri-embed');
        }
    }

    function isEmbeddedMode() {
        return isGdriDirectEmbed();
    }

    function onEmbeddedTabActivated() { /* intentional */ }

    global.UgapGdriHost = {
        isGdriDirectEmbed,
        updateImportMinorationRecap
    };

    global.scheduleParentEmbedResize = scheduleParentEmbedResize;
    global.applyEmbeddedLayout = applyEmbeddedLayout;
    global.isEmbeddedMode = isEmbeddedMode;
    global.onEmbeddedTabActivated = onEmbeddedTabActivated;

    function bootGdriHost() {
        if (isGdriDirectEmbed()) {
            applyEmbeddedLayout();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootGdriHost);
    } else {
        bootGdriHost();
    }
})(window);
