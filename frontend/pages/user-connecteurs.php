<?php
/**
 * Mon espace — Connecteurs (mail, Facebook, réglages perso).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireUserWorkspaceEntityAccess();

$connector_items = buildUserConnectorHubItems();

$page_title = 'Mail & canaux';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Mail & canaux',
    'Votre mail, Facebook et les réglages de vos applications.'
);
?>

<?php renderEntityConsoleHubCards($connector_items, 'connecteurs'); ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
