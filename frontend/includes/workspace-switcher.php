<?php
/**
 * Sélecteur de mode — sidebar (survol pour déplier les 3 options).
 */

function getGdriWorkspaceModeOptions() {
    $modes = [];
    if (canAccessPlatformConsole()) {
        $modes[] = [
            'id' => 'platform',
            'label' => canAccessDeployConsoleOnly() ? 'Déploiement' : 'Console GDRI',
            'icon' => canAccessDeployConsoleOnly() ? '🚀' : '⚡',
        ];
    }
    // DEV : pas de console entité / mon espace — uniquement déploiement
    if (canAccessDeployConsoleOnly()) {
        return $modes;
    }
    if (canAccessEntityConsole()) {
        $modes[] = [
            'id' => 'entity',
            'label' => 'Console entité',
            'icon' => '🏢',
        ];
    }
    $modes[] = [
        'id' => 'user',
        'label' => 'Mon espace',
        'icon' => '👤',
    ];
    return $modes;
}

function renderGdriSidebarModePicker($activeMode) {
    if (!canAccessEntityConsole() && !canAccessPlatformConsole()) {
        return;
    }

    $modes = getGdriWorkspaceModeOptions();
    $activeMode = in_array($activeMode, ['platform', 'entity', 'user'], true) ? $activeMode : 'user';
    $current = null;
    foreach ($modes as $mode) {
        if ($mode['id'] === $activeMode) {
            $current = $mode;
            break;
        }
    }
    if (!$current) {
        $current = end($modes);
    }
    ?>
    <div class="sidebar-mode-picker sidebar-mode-picker--<?= htmlspecialchars($activeMode) ?>">
        <div class="sidebar-mode-picker__current" tabindex="0" role="button" aria-haspopup="true">
            <span class="sidebar-mode-picker__icon"><?= $current['icon'] ?></span>
            <span class="sidebar-mode-picker__label"><?= htmlspecialchars($current['label']) ?></span>
            <span class="sidebar-mode-picker__chevron" aria-hidden="true">▾</span>
        </div>
        <div class="sidebar-mode-picker__menu" role="menu">
            <?php foreach ($modes as $mode): ?>
            <a href="<?= htmlspecialchars(gdriWorkspaceModeUrl($mode['id'])) ?>"
               class="sidebar-mode-picker__option sidebar-mode-picker__option--<?= htmlspecialchars($mode['id']) ?><?= $activeMode === $mode['id'] ? ' is-active' : '' ?>"
               role="menuitem">
                <span class="sidebar-mode-picker__option-icon"><?= $mode['icon'] ?></span>
                <span class="sidebar-mode-picker__option-text"><?= htmlspecialchars($mode['label']) ?></span>
            </a>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
}
