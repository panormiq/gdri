<?php
/**
 * Mon espace — Applications.
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$canManageEntity = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$application_items = buildApplicationHubItems($canManageEntity);

$page_title = 'Applications';
require_once '../includes/header.php';
renderConsolePageOpen(
    'Applications',
    'Cliquez sur une carte pour ouvrir un outil (UGAP, Annuaire, GDERPI…).'
);
?>

<?php if (empty($application_items)): ?>
    <div class="entity-console-empty">
        <p>Aucune application disponible pour cette entité.</p>
        <p class="text-muted small">Demandez à votre administrateur d'activer des applications pour votre entité.</p>
    </div>
<?php else: ?>
    <?php renderConsoleSearchToolbar('UGAP, GDERPI, Workflow…'); ?>
    <?php renderEntityConsoleHubCards($application_items, 'applications'); ?>
    <div id="entityConsoleNoResult" class="entity-console-empty" style="display: none; margin-top: 1rem;">
        <p>Aucune application ne correspond à votre recherche.</p>
    </div>
<?php endif; ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once '../includes/footer.php';
