/**
 * FICHIER : modules/ugap/frontend/assets/js/admin/admin-boot.js
 * RÔLE : Demarrage onglet Import apres chargement du DOM.
 * APPELÉ PAR : admin.php (apres admin-legacy et import-list.js).
 */
(function bootUgapImportTab() {
    function run() {
        if (typeof initUgapImportTab === 'function') initUgapImportTab();
        else if (typeof loadImportList === 'function') loadImportList();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();