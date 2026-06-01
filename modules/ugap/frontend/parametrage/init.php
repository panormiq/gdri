<?php

/**
 * FICHIER : modules/ugap/frontend/parametrage/init.php
 * RÔLE : Variables communes paramétrage (standalone + import GDRI).
 */

require_once dirname(__DIR__) . '/includes/gdri-embed.php';

$__ugapParamRoot = __DIR__;
$__ugapFrontendRoot = dirname(__DIR__);

$allowedSections = ['importation', 'famille', 'options', 'categorie', 'bateau-base', 'modeles'];
$allowedImportTabs = ['detect', 'modeles', 'minoration', 'majoration', 'catalogue', 'base_option', 'pr', 'valider'];

if (!isset($__ugapParamSection)) {
    $__ugapParamSection = isset($_GET['param_section'])
        ? (string) $_GET['param_section']
        : (isset($_GET['section']) ? (string) $_GET['section'] : 'importation');
}

if (!in_array($__ugapParamSection, $allowedSections, true)) {
    $__ugapParamSection = 'importation';
}

if (!isset($__ugapParamTab)) {
    $__ugapParamTab = isset($_GET['param_tab'])
        ? (string) $_GET['param_tab']
        : (isset($_GET['tab']) ? (string) $_GET['tab'] : 'detect');
}

if (!in_array($__ugapParamTab, $allowedImportTabs, true)) {
    $__ugapParamTab = 'detect';
}

$ugapParamEnqueueAssets = static function () use ($__ugapFrontendRoot): void {

    ugap_enqueue_style('/modules/ugap/frontend/parametrage/assets/css/parametrage.css');
    ugap_enqueue_style('/modules/ugap/frontend/assets/css/ugap-templates.css');
    ugap_enqueue_style('/modules/ugap/frontend/parametrage/assets/css/famille-lc.css');

    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-gdri-host.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-api.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-option-line-kind.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-base-adj-links.js');

    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/format-price-eur.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/fetch-detection-report.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/render-detection-summary.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/render-detection-models-table.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/render-detection-minoration-table.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/render-detection-majoration-table.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/render-detection-base-option-table.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/render-detection-lines-table.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/paint-detection-report.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/detect/bind-detection-panel.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/templates/ugap-view-templates.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/famille/famille-lc-state.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/famille/famille-lc-form.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/famille/famille-lc-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/options/options-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-sortable-dnd.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-family-draft-ui.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/boat-template-tree.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/categorie/categorie-lc-state.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/categorie-tab-subcategories.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/categorie-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/categorie/categorie-lc-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/bateau-base/bateau-base-lc-state.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/template-bateau-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/bateau-base/bateau-base-lc-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-model-base-options.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/modeles/modeles-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/import/valider-tab.js');
    ugap_enqueue_script('/modules/ugap/frontend/parametrage/assets/js/parametrage-boot.js');

    if (!ugap_is_gdri_embed()) {
        ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-embed-layout.js');
    }

};
