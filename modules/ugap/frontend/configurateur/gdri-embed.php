<?php
/**
 * FICHIER : modules/ugap/frontend/configurateur/gdri-embed.php
 * RÔLE : Configurateur UGAP inclus dans ugap.php (sans iframe).
 */
require_once dirname(__DIR__) . '/includes/gdri-embed.php';
ugap_set_gdri_embed(true);

ugap_enqueue_style('/frontend/assets/css/variables.css');
ugap_enqueue_style('/frontend/assets/css/main.css');
ugap_enqueue_style('/modules/ugap/frontend/assets/css/configurateur.css');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-gdri-host.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-api.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-option-line-kind.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-base-adj-links.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/boat-template-tree.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/shared/ugap-model-base-options.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/configurateur/configurateur-model-base-bridge.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/configurateur/configurateur-template-tree.js');
ugap_enqueue_script('/modules/ugap/frontend/assets/js/configurateur/configurateur-app.js');
?>
<div class="ugap-gdri-embed ugap-configurateur-embed">
    <?php require __DIR__ . '/partials/body.php'; ?>
</div>
