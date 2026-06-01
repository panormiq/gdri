/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-boot.js
 * RÔLE : Démarrage module Import (liste + workflow) après chargement DOM.
 * APPELÉ PAR : import/gdri-embed.php (via init.php).
 */
(function bootUgapImportModule() {
    'use strict';

    function run() {
        if (window.UgapImportGdriActions?.bindImportGdriActions) {
            window.UgapImportGdriActions.bindImportGdriActions();
        }
        if (typeof window.initUgapImportTab === 'function') {
            window.initUgapImportTab();
        } else if (typeof window.loadImportList === 'function') {
            window.loadImportList();
        }
        if (typeof window.initImportWorkflowShell === 'function') {
            window.initImportWorkflowShell();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
