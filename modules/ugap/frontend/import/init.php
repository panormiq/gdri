<?php

/**
 * FICHIER : modules/ugap/frontend/import/init.php
 * RÔLE : Assets module Import — workflow staging uniquement (pas la détection Excel).
 */

require_once dirname(__DIR__) . '/includes/gdri-embed.php';

$__ugapImportRoot = __DIR__;
$__ugapFrontendRoot = dirname(__DIR__);

$ugapImportEnqueueAssets = static function (): void {
    ugap_enqueue_style('/frontend/assets/css/variables.css');
    ugap_enqueue_style('/frontend/assets/css/main.css');
    ugap_enqueue_style('/modules/ugap/frontend/assets/css/ugap-layout.css');
    ugap_enqueue_style('/modules/ugap/frontend/assets/css/ugap-templates.css');
    ugap_enqueue_style('/modules/ugap/frontend/import/assets/css/import.css');

    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-gdri-host.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-api.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-embed-layout.js');

    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-models-step.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-workflow-steps.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-minorations-step.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-validate-step.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-workflow-shell.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-list.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-gdri-actions.js');
    ugap_enqueue_script('/modules/ugap/frontend/assets/js/import/import-boot.js');
};
