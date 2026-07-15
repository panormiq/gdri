<?php
/**
 * Mon espace — Structurel (infra personnelle).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireUserWorkspaceEntityAccess();

$structural_items = buildUserStructuralHubItems();
$canManageEntity = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);

$page_title = 'IA personnelle';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'IA personnelle',
    'Vos clés API et serveurs IA personnels (ChatGPT, Claude…).'
);
?>

<?php renderEntityConsoleHubCards($structural_items, 'structurel'); ?>

<?php if ($canManageEntity): ?>
<p class="text-muted small" style="margin-top:1rem;">
    Infrastructure partagée de l'entité (sauvegarde, serveurs IA entité…) :
    <a href="<?= htmlspecialchars(url('auth/set-nav-mode.php?mode=entity')) ?>">Console entité → Structurel</a>
</p>
<?php endif; ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
