<?php
/**
 * Sidebar : sélecteur de mode (haut) + navigation du mode actif (bas).
 */

require_once __DIR__ . '/entity-console-nav.php';
require_once __DIR__ . '/workspace-switcher.php';

$canSwitchWorkspace = canAccessEntityConsole() || canAccessPlatformConsole();
$workspaceMode = getGdriWorkspaceMode(!empty($currentEntreprise));
if (!$canSwitchWorkspace) {
    $workspaceMode = 'user';
}
$isPlatformMode = $workspaceMode === 'platform';
$isUserMode = $workspaceMode === 'user';

$entityNavItems = getEntityConsoleNavItems();
?>
<aside class="admin-sidebar admin-sidebar--mode-<?= htmlspecialchars($workspaceMode) ?><?= $isPlatformMode ? ' admin-sidebar--platform' : '' ?>" id="adminSidebar">
    <?php if ($canSwitchWorkspace): ?>
        <?php renderGdriSidebarModePicker($workspaceMode); ?>
    <?php else: ?>
    <div class="sidebar-mode-picker sidebar-mode-picker--user">
        <div class="sidebar-mode-picker__current">
            <span class="sidebar-mode-picker__icon">👤</span>
            <span class="sidebar-mode-picker__label">Mon espace</span>
        </div>
    </div>
    <?php endif; ?>

    <?php if ($isUserMode): ?>
        <p class="admin-sidebar__user-hint">Travailler (apps, contacts) · Automatiser · Mes réglages (mail, profil)</p>
        <?php renderAdminSidebarNavSections(getUserWorkspaceNavSections(), 'Mon espace'); ?>
    <?php elseif ($isPlatformMode): ?>
        <?php
        $platformNavItems = array_merge(getPlatformConsoleNavItems(), [
            ['label' => 'Suivi', 'url' => url('pages/user-activity.php'), 'path' => '/pages/user-activity.php', 'icon' => '📊'],
        ]);
        renderAdminSidebarNav('Plateforme GDRI', $platformNavItems, 'Navigation plateforme');
        ?>
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

    <button type="button"
            class="admin-sidebar__collapse-btn"
            id="adminSidebarCollapse"
            aria-expanded="true"
            title="Réduire le menu">
        <span class="admin-sidebar__collapse-icon" aria-hidden="true">◀</span>
        <span class="admin-sidebar__collapse-label">Réduire</span>
    </button>
</aside>
<div class="admin-sidebar-backdrop" id="adminSidebarBackdrop" hidden></div>
