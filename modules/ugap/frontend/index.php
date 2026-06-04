<?php
/**
 * FICHIER : modules/ugap/frontend/index.php
 * RÔLE : Entrée configurateur (standalone). Import GDRI via configurateur/gdri-embed.php.
 */
require_once __DIR__ . '/includes/gdri-embed.php';

if (ugap_is_gdri_embed()) {
    require __DIR__ . '/configurateur/gdri-embed.php';
    return;
}

ugap_enqueue_style('/frontend/assets/css/variables.css');
ugap_enqueue_style('/frontend/assets/css/main.css');
ugap_enqueue_style('/modules/ugap/frontend/assets/css/ugap-layout.css');
ugap_enqueue_style('/modules/ugap/frontend/assets/css/configurateur.css');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configurateur UGAP</title>
    <?php ugap_print_enqueued_styles(); ?>
</head>
<body>
    <?php require __DIR__ . '/configurateur/partials/body.php'; ?>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-embed-layout.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-embed-layout.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-family-components.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-family-components.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-categorie-display-behavior.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-categorie-display-behavior.js') ?>"></script>
    <script src="/modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-nodes-core.js?v=<?= ugap_asset_version('/modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-nodes-core.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/boat-template-tree.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/boat-template-tree.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-group-catalog.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-group-catalog.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-group-display.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-group-display.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-option-display-name.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-option-display-name.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-model-base-options.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-model-base-options.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-option-line-kind.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-option-line-kind.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-base-adj-links.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/shared/ugap-base-adj-links.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/configurateur/configurateur-model-base-bridge.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/configurateur/configurateur-model-base-bridge.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/configurateur/configurateur-template-tree.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/configurateur/configurateur-template-tree.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/configurateur/configurateur-app.js?v=<?= ugap_asset_version('/modules/ugap/frontend/assets/js/configurateur/configurateur-app.js') ?>"></script>
</body>
</html>
