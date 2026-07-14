<?php
/**
 * Console entité — Structurel.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireEntityConsoleAccess();

$structural_items = buildStructuralHubItems();

$page_title = 'Structurel';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Structurel',
    'Infrastructure partagée par les applications et agents de l\'entité.'
);
?>

<?php renderEntityConsoleHubCards($structural_items, 'structurel'); ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
