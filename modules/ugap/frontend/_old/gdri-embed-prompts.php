<?php
/**
 * FICHIER : modules/ugap/frontend/_old/gdri-embed-prompts.php
 * RÔLE : Onglet Prompts IA inclus dans ugap.php (legacy, sans iframe).
 */
require_once dirname(__DIR__) . '/includes/gdri-embed.php';
ugap_set_gdri_embed(true);

$__ugapEmbedView = 'prompts';
$__ugapFrontendRoot = dirname(__DIR__);

ugap_enqueue_style('/frontend/assets/css/variables.css');
ugap_enqueue_style('/frontend/assets/css/main.css');
ugap_enqueue_style('/modules/ugap/frontend/assets/css/ugap-templates.css');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-gdri-host.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-api.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/templates/ugap-view-templates.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/famille-state.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-family-draft-ui.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-sortable-dnd.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/categorie-tab-subcategories.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/categorie-tab.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/boat-template-tree.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/template-bateau-tab.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/admin/admin-legacy.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-api.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-models-step.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-workflow-steps.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-minorations-step.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-workflow-shell.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-list.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/tabs/famille-tab.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/admin/admin-boot.js');
?>
<style>
.ugap-legacy-prompts-embed .tabs .tab:not([data-tab="prompts"]) { display: none; }
.ugap-legacy-prompts-embed .tab-panel { display: none !important; }
.ugap-legacy-prompts-embed #tab-prompts.tab-panel { display: block !important; }
.ugap-legacy-prompts-embed #legacy-admin-hero-card,
.ugap-legacy-prompts-embed #legacy-stats-card { display: none !important; }
.ugap-legacy-prompts-embed .container-xl { max-width: none; padding: 0; }
.ugap-legacy-prompts-embed .card { box-shadow: none; margin-bottom: 0; }
</style>
<div id="ugap-legacy-prompts-embed" class="ugap-gdri-embed">
    <div id="alert-container"></div>
    <div class="card" id="legacy-backoffice-card">
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-navigation.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-import.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-famille.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-options.php'; ?>
        <?php if (is_file($__ugapFrontendRoot . '/partials/tabs/tab-categorie.php')) {
            require $__ugapFrontendRoot . '/partials/tabs/tab-categorie.php';
        } ?>
        <?php if (is_file($__ugapFrontendRoot . '/partials/tabs/tab-template-bateau.php')) {
            require $__ugapFrontendRoot . '/partials/tabs/tab-template-bateau.php';
        } ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-models.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-categories.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-structured.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-couplings.php'; ?>
        <?php require $__ugapFrontendRoot . '/partials/tabs/tab-prompts.php'; ?>
    </div>
</div>
