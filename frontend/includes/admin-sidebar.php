<?php
/**
 * Sidebar : sélecteur de mode (haut) + navigation du mode actif (bas).
 */

require_once __DIR__ . '/entity-console-nav.php';
require_once __DIR__ . '/workspace-switcher.php';

$workspaceMode = getGdriWorkspaceMode(!empty($currentEntreprise));
$isPlatformMode = $workspaceMode === 'platform';
$isUserMode = $workspaceMode === 'user';

$entityNavItems = array_merge(getEntityConsoleNavItems(), [
    ['label' => 'Legacy', 'url' => url('pages/entity-legacy.php'), 'path' => '/pages/entity-legacy.php', 'icon' => '📦'],
]);
?>
<aside class="admin-sidebar admin-sidebar--mode-<?= htmlspecialchars($workspaceMode) ?><?= $isPlatformMode ? ' admin-sidebar--platform' : '' ?>" id="adminSidebar">
    <?php renderGdriSidebarModePicker($workspaceMode); ?>

    <?php if ($isUserMode): ?>
        <?php renderAdminSidebarNav('Mon espace', getUserWorkspaceNavItems(), 'Navigation utilisateur'); ?>
    <?php elseif ($isPlatformMode): ?>
        <?php renderAdminSidebarNav('Plateforme GDRI', getPlatformConsoleNavItems(), 'Navigation plateforme'); ?>
    <?php else: ?>
        <?php if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntreprise)): ?>
        <div class="admin-sidebar__section">
            <p class="admin-sidebar__section-label">Console entité</p>
            <p class="admin-sidebar__hint">Sélectionnez une entité pour accéder à son espace.</p>
            <?php if ($hasEntrepriseDropdown): ?>
            <button type="button" class="admin-sidebar__hint-btn" id="sidebarEntrepriseBtn">Choisir une entité</button>
            <?php endif; ?>
        </div>
        <?php else: ?>
        <?php renderAdminSidebarNav('Console entité', $entityNavItems, 'Navigation entité'); ?>
        <?php endif; ?>
    <?php endif; ?>
</aside>
<div class="admin-sidebar-backdrop" id="adminSidebarBackdrop" hidden></div>
