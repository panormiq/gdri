<?php
/**
 * Console plateforme — Agents IA (automatisations globales).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$agent_items = buildPlatformAgentHubItems();

$page_title = 'Agents IA';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Agents IA',
    'Automatisations et supervision au niveau plateforme (sauvegardes globales, suivi…). Les flows métier par société se configurent en console entité.'
);
?>

<?php renderEntityConsoleHubCards($agent_items, 'agents'); ?>

<div class="alert alert-light border small" style="margin-top: 1.25rem;" role="note">
    <strong>Agents par entité</strong> (mail, Facebook, webhooks…) :
    passez en <a href="<?= htmlspecialchars(url('auth/set-nav-mode.php?mode=entity')) ?>">console entité</a>
    → <em>Agents IA</em>.
</div>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
