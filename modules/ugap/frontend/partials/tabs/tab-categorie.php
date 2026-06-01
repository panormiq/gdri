<?php
/**
 * FICHIER : modules/ugap/frontend/partials/tabs/tab-categorie.php
 * RÔLE : Panneau admin — objets bateau / catégories paramétrage (Vue LC, aligné template bateau).
 *
 * ENTRÉES : aucune (markup statique)
 * SORTIES : #tab-categorie, #ugap-categorie-lc-mount
 *
 * DÉPEND DE : ugap-view-templates.js, assets/js/tabs/categorie-tab.js
 * NE PAS : vues métier (tab-categories.php), liste des options (tab-options.php)
 *
 * APPELÉ PAR : admin.php
 */
?>
<div id="tab-categorie" class="tab-panel">
    <div id="ugap-categorie-lc-mount"></div>
    <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <button type="button" id="btn-improve-categorization" class="btn btn-primary">🤖 Améliorer catégorisation (IA)</button>
        <button type="button" id="btn-clear-categories" class="btn btn-danger">🧹 Réinitialiser les catégories</button>
    </div>
</div>
