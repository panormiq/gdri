<?php
/**
 * Console entité — Connecteurs.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireEntityConsoleAccess();

$connector_items = buildConnectorHubItems();

$page_title = 'Connecteurs';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Connecteurs',
    'Canaux d\'entrée et de sortie partagés (mail, Facebook, HTTP…). Un compte mail = email + IMAP + SMTP.'
);
?>

<?php renderEntityConsoleHubCards($connector_items, 'connecteurs'); ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
