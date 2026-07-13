<?php
/**
 * Sidebar admin : menu entité (bleu) ou plateforme GDRI (violet).
 */

$gdriNavMode = getGdriAdminNavMode(!empty($currentEntreprise));
$isPlatformMode = hasRole(ROLE_ADMIN_GDRI) && $gdriNavMode === 'platform';
$canSwitchMode = hasRole(ROLE_ADMIN_GDRI);

$entityNavItems = [
    ['label' => 'Applications', 'url' => url('pages/modules.php'), 'path' => '/pages/modules.php', 'icon' => '📱'],
    ['label' => 'Agents IA', 'url' => url('pages/entity-agents.php'), 'path' => '/pages/entity-agents.php', 'icon' => '🎯'],
    ['label' => 'Paramètres', 'url' => url('pages/entity-config.php'), 'path' => '/pages/entity-config.php', 'icon' => '⚙️'],
    ['label' => 'Legacy', 'url' => url('pages/entity-legacy.php'), 'path' => '/pages/entity-legacy.php', 'icon' => '📦'],
    ['label' => 'Utilisateurs', 'url' => url('pages/users.php'), 'path' => '/pages/users.php', 'icon' => '👥'],
    ['label' => 'Rôles', 'url' => url('pages/modules/entity-roles.php'), 'path' => '/entity-roles.php', 'icon' => '🛡️'],
];

$platformNavItems = [
    ['label' => 'Entités', 'url' => url('pages/entities.php'), 'path' => '/pages/entities.php', 'icon' => '🏢'],
    ['label' => 'Extensions', 'url' => url('pages/admin-modules.php'), 'path' => '/pages/admin-modules.php', 'icon' => '🧩'],
    ['label' => 'Suivi', 'url' => url('pages/user-activity.php'), 'path' => '/pages/user-activity.php', 'icon' => '📊'],
    ['label' => 'Utilisateurs', 'url' => url('pages/users.php'), 'path' => '/pages/users.php', 'icon' => '👥'],
];
?>
<aside class="admin-sidebar<?= $isPlatformMode ? ' admin-sidebar--platform' : ' admin-sidebar--entity' ?>" id="adminSidebar">
    <?php if ($canSwitchMode): ?>
    <div class="admin-sidebar__switch">
        <?php if ($isPlatformMode): ?>
            <a class="admin-sidebar__switch-btn admin-sidebar__switch-btn--to-entity"
               href="<?= url('auth/set-nav-mode.php?mode=entity') ?>"
               title="Revenir au menu entité">
                <span class="admin-sidebar__switch-icon">↩</span>
                <span>Mode entité</span>
            </a>
        <?php else: ?>
            <a class="admin-sidebar__switch-btn admin-sidebar__switch-btn--to-platform"
               href="<?= url('auth/set-nav-mode.php?mode=platform') ?>"
               title="Ouvrir la console plateforme GDRI">
                <span class="admin-sidebar__switch-icon">⚡</span>
                <span>Console plateforme</span>
            </a>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <?php if ($isPlatformMode): ?>
    <div class="admin-sidebar__section">
        <p class="admin-sidebar__section-label">Plateforme GDRI</p>
        <nav class="admin-sidebar__nav" aria-label="Navigation plateforme">
            <ul>
                <?php foreach ($platformNavItems as $item): ?>
                <li>
                    <a href="<?= htmlspecialchars($item['url']) ?>"
                       class="admin-sidebar__link<?= gdriNavIsActive($item['path']) ? ' is-active' : '' ?>">
                        <span class="admin-sidebar__link-icon"><?= $item['icon'] ?></span>
                        <span><?= htmlspecialchars($item['label']) ?></span>
                    </a>
                </li>
                <?php endforeach; ?>
            </ul>
        </nav>
    </div>
    <?php else: ?>
    <div class="admin-sidebar__section">
        <p class="admin-sidebar__section-label">Entité</p>
        <?php if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntreprise)): ?>
        <p class="admin-sidebar__hint">Sélectionnez une entité pour accéder à son espace.</p>
        <?php if ($hasEntrepriseDropdown): ?>
        <button type="button" class="admin-sidebar__hint-btn" id="sidebarEntrepriseBtn">Choisir une entité</button>
        <?php endif; ?>
        <?php else: ?>
        <nav class="admin-sidebar__nav" aria-label="Navigation entité">
            <ul>
                <?php foreach ($entityNavItems as $item): ?>
                <li>
                    <a href="<?= htmlspecialchars($item['url']) ?>"
                       class="admin-sidebar__link<?= gdriNavIsActive($item['path']) ? ' is-active' : '' ?>">
                        <span class="admin-sidebar__link-icon"><?= $item['icon'] ?></span>
                        <span><?= htmlspecialchars($item['label']) ?></span>
                    </a>
                </li>
                <?php endforeach; ?>
            </ul>
        </nav>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</aside>
<div class="admin-sidebar-backdrop" id="adminSidebarBackdrop" hidden></div>
