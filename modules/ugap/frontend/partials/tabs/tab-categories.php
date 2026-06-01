<?php
/**
 * FICHIER : modules/ugap/frontend/partials/tabs/tab-categories.php
 * RÔLE : Panneau admin — vues métier (Vue LC) et assignation familles → vues.
 *
 * ENTRÉES : aucune (markup statique)
 * SORTIES : #tab-categories, #ugap-vue-metier-lc-mount, #subcategories-accordion
 *
 * DÉPEND DE : ugap-view-templates.js, admin.php (JS legacy)
 * NE PAS : template bateau (tab-template-bateau.php)
 *
 * APPELÉ PAR : admin.php
 */
?>
<div id="tab-categories" class="tab-panel">
    <div id="ugap-vue-metier-lc-mount"></div>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px;">Assignation familles → vues métier</h3>
        <div style="margin-bottom: 12px;">
            <button type="button" id="btn-detect-subcategories" class="btn btn-primary">🤖 Assigner automatiquement les familles</button>
        </div>
        <div id="subcategories-accordion">
            <p style="color: #666;">Chargement des vues métier et des familles…</p>
        </div>
    </div>
</div>
