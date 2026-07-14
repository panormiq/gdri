<?php
/**
 * Console entité — Applications.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireEntityConsoleAccess();

$canManageEntity = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$application_items = buildApplicationHubItems($canManageEntity);

$page_title = 'Applications';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Applications',
    'Catalogue et accès aux applications métier de votre société.'
);
?>

<?php if (empty($application_items)): ?>
    <div class="entity-console-empty">
        <p>Aucune application disponible pour cette entité.</p>
        <p class="text-muted small">Contactez l'administrateur GDRI pour activer des applications.</p>
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
require_once __DIR__ . '/../includes/footer.php';
