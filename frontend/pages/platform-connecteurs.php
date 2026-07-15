<?php
/**
 * Console plateforme — Connecteurs.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$connector_items = buildPlatformConnectorHubItems();

$page_title = 'Connecteurs';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Connecteurs',
    'Presets globaux des canaux (mail, Facebook…). Pas d\'instances ici : les comptes et pages se configurent en console entité → Connecteurs.'
);
?>

<div class="alert alert-light border small" style="margin-bottom: 1.25rem;" role="note">
    Cette section ne contient que des <strong>connecteurs</strong> (presets partagés).
    L'infrastructure (IA, sauvegarde…) est dans <a href="<?= htmlspecialchars(url('pages/platform-structurel.php')) ?>">Structurel</a>,
    les automatisations globales dans <a href="<?= htmlspecialchars(url('pages/platform-agents.php')) ?>">Agents IA</a>.
</div>

<?php renderEntityConsoleHubCards($connector_items, 'connecteurs'); ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
