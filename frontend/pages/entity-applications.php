<?php
/**
 * Console entité — Applications (catalogue autorisé, lecture seule).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireEntityConsoleAccess();

$canManageEntity = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$application_items = buildEntityApplicationCatalogItems($canManageEntity);

$page_title = 'Applications';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Applications',
    'Applications autorisées pour cette entité. Cette vue ne lance pas les apps : utilisation quotidienne via Mon espace.'
);
?>

<div class="alert alert-light border small" style="margin-bottom: 1.25rem;" role="note">
    Catalogue admin uniquement. Pour <strong>ouvrir</strong> une application, basculez en
    <a href="<?= htmlspecialchars(url('auth/set-nav-mode.php?mode=user')) ?>">Mon espace</a>
    → <em>Applications</em>.
    <?php if (hasRole(ROLE_ADMIN_GDRI)): ?>
    Pour activer ou retirer une app, utilisez
    <a href="<?= htmlspecialchars(url('pages/entities.php')) ?>">Entités</a>
    (modules autorisés).
    <?php else: ?>
    Pour demander une nouvelle application, contactez l'administrateur GDRI.
    <?php endif; ?>
</div>

<?php if (empty($application_items)): ?>
    <div class="entity-console-empty">
        <p>Aucune application autorisée pour cette entité.</p>
        <p class="text-muted small">Contactez l'administrateur GDRI pour activer des applications.</p>
    </div>
<?php else: ?>
    <?php renderConsoleSearchToolbar('UGAP, GDERPI, Workflow…', 'entityAppsSearch'); ?>
    <?php renderApplicationCatalogReadonly($application_items, [
        'hint' => 'Autorisée pour cette entité — ouverture depuis Mon espace',
    ]); ?>
    <div id="entityAppsNoResult" class="entity-console-empty" style="display: none; margin-top: 1rem;">
        <p>Aucune application ne correspond à votre recherche.</p>
    </div>
<?php endif; ?>

<style>
.entity-console-card--readonly { cursor: default; }
.entity-console-card--readonly:hover {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transform: none;
}
.app-catalog-card__slug { margin: 0 0 0.5rem; font-size: 0.82rem; }
.app-catalog-card__slug code {
    background: var(--color-light, #f0f0f0);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
}
.badge-success { background: #d4edda; color: #155724; }
.badge-secondary { background: #e9ecef; color: #495057; }
.badge-info { background: #d1ecf1; color: #0c5460; }
</style>

<?php
renderConsolePageClose();
renderApplicationCatalogReadonlyScript([
    'search_id' => 'entityAppsSearch',
    'no_result_id' => 'entityAppsNoResult',
    'card_selector' => '.app-catalog-card',
]);
require_once __DIR__ . '/../includes/footer.php';
