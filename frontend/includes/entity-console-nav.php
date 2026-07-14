<?php
/**
 * Navigation partagée — Console entité (sidebar, même modèle que la console plateforme).
 */

function getEntityConsoleNavItems() {
    return [
        [
            'label' => 'Applications',
            'url' => url('pages/entity-applications.php'),
            'path' => '/pages/entity-applications.php',
            'icon' => '📱',
        ],
        [
            'label' => 'Agents IA',
            'url' => url('pages/entity-agents.php'),
            'path' => '/pages/entity-agents.php',
            'icon' => '🤖',
        ],
        [
            'label' => 'Utilisateurs',
            'url' => url('pages/users.php'),
            'path' => '/pages/users.php',
            'icon' => '👥',
        ],
        [
            'label' => 'Rôles',
            'url' => url('pages/modules/entity-roles.php'),
            'path' => '/pages/modules/entity-roles.php',
            'icon' => '🛡️',
        ],
        [
            'label' => 'Connecteurs',
            'url' => url('pages/entity-connecteurs.php'),
            'path' => '/pages/entity-connecteurs.php',
            'icon' => '🔌',
        ],
        [
            'label' => 'Structurel',
            'url' => url('pages/entity-structurel.php'),
            'path' => '/pages/entity-structurel.php',
            'icon' => '⚙️',
        ],
    ];
}

function getUserWorkspaceNavItems() {
    return [
        [
            'label' => 'Dashboard',
            'url' => url('pages/dashboard.php'),
            'path' => '/pages/dashboard.php',
            'icon' => '🏠',
        ],
        [
            'label' => 'Applications',
            'url' => url('pages/modules.php'),
            'path' => '/pages/modules.php',
            'icon' => '📱',
        ],
        [
            'label' => 'Mes applications',
            'url' => url('pages/account-modules.php'),
            'path' => '/pages/account-modules.php',
            'icon' => '🧩',
        ],
        [
            'label' => 'Mes données',
            'url' => url('pages/account-profile.php'),
            'path' => '/pages/account-profile.php',
            'icon' => '👤',
        ],
        [
            'label' => 'Mes notifications',
            'url' => url('pages/account-notifications.php'),
            'path' => '/pages/account-notifications.php',
            'icon' => '🔔',
        ],
    ];
}

function getPlatformConsoleNavItems() {
    return [
        [
            'label' => 'Entités',
            'url' => url('pages/entities.php'),
            'path' => '/pages/entities.php',
            'icon' => '🏢',
        ],
        [
            'label' => 'Extensions',
            'url' => url('pages/admin-modules.php'),
            'path' => '/pages/admin-modules.php',
            'icon' => '🧩',
        ],
        [
            'label' => 'Suivi',
            'url' => url('pages/user-activity.php'),
            'path' => '/pages/user-activity.php',
            'icon' => '📊',
        ],
        [
            'label' => 'Utilisateurs',
            'url' => url('pages/users.php'),
            'path' => '/pages/users.php',
            'icon' => '👥',
        ],
    ];
}

function renderAdminSidebarNav($sectionLabel, array $items, $ariaLabel) {
    ?>
    <div class="admin-sidebar__section">
        <p class="admin-sidebar__section-label"><?= htmlspecialchars($sectionLabel) ?></p>
        <nav class="admin-sidebar__nav" aria-label="<?= htmlspecialchars($ariaLabel) ?>">
            <ul>
                <?php foreach ($items as $item): ?>
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
    <?php
}

function renderConsolePageHeader($title, $intro = '') {
    ?>
    <header class="console-page__header">
        <h1 class="console-page__title"><?= htmlspecialchars((string) $title) ?></h1>
        <?php if ($intro !== ''): ?>
        <p class="console-page__intro"><?= htmlspecialchars((string) $intro) ?></p>
        <?php endif; ?>
    </header>
    <?php
}

/**
 * Ouvre le shell page console (fermer avec renderConsoleLayoutEnd).
 *
 * @param array $options actions (HTML), narrow (bool), compact (bool)
 */
function renderConsoleLayoutStart($title, $intro = '', array $options = []) {
    $class = 'console-page';
    if (!empty($options['narrow'])) {
        $class .= ' console-page--narrow';
    }
    if (!empty($options['compact'])) {
        $class .= ' console-page--compact';
    }
    ?>
    <div class="<?= htmlspecialchars($class) ?>">
    <?php
    if (!empty($options['actions'])) {
        ?>
        <div class="console-page__header-row">
            <?php renderConsolePageHeader($title, $intro); ?>
            <div class="console-page__actions"><?= $options['actions'] ?></div>
        </div>
        <?php
    } else {
        renderConsolePageHeader($title, $intro);
    }
}

function renderConsoleLayoutEnd() {
    echo '</div>';
}

function renderConsolePageOpen($title, $intro = '', array $options = []) {
    renderConsoleLayoutStart($title, $intro, $options);
}

function renderConsolePageClose() {
    renderConsoleLayoutEnd();
}

function renderConsoleSearchToolbar($placeholder = 'Rechercher…', $id = 'entityConsoleSearch', $label = 'Rechercher') {
    ?>
    <div class="console-page__toolbar form-group">
        <label for="<?= htmlspecialchars($id) ?>" class="small"><?= htmlspecialchars($label) ?></label>
        <input type="text"
               id="<?= htmlspecialchars($id) ?>"
               class="form-control"
               placeholder="<?= htmlspecialchars($placeholder) ?>"
               autocomplete="off" />
    </div>
    <?php
}

function renderConsoleBackLink($label, $url) {
    ?>
    <p class="console-page__back">
        <a href="<?= htmlspecialchars($url) ?>" class="btn btn-outline btn-sm">← <?= htmlspecialchars($label) ?></a>
    </p>
    <?php
}

function renderEntityConsoleStyles() {
    // Styles déplacés dans assets/css/console-page.css
}

function requireEntityConsoleAccess() {
    if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
        redirect(url('pages/dashboard.php'));
    }
    $currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
    if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
        redirect(url('pages/dashboard.php'));
    }
}

function renderEntityConsoleHubCards(array $items, $variant = 'applications') {
    if (empty($items)) {
        echo '<div class="entity-console-empty"><p>Aucun élément disponible.</p></div>';
        return;
    }
    ?>
    <div class="hub-cards-grid entity-console-grid">
        <?php foreach ($items as $item): ?>
        <?php
            $links = is_array($item['links'] ?? null) ? $item['links'] : [];
            $hasMultipleLinks = count($links) > 1;
            $searchText = mb_strtolower(($item['title'] ?? '') . ' ' . ($item['description'] ?? ''));
        ?>
        <div class="card entity-console-card"
             data-search="<?= htmlspecialchars($searchText) ?>"
             data-url="<?= htmlspecialchars($item['url'] ?? '#') ?>"
             data-multi="<?= $hasMultipleLinks ? '1' : '0' ?>">
            <div class="entity-console-card__inner entity-console-card__inner--<?= htmlspecialchars($variant) ?>">
                <div class="entity-console-card__head">
                    <span class="entity-console-card__icon"><?= $item['icon'] ?? '🧩' ?></span>
                    <div>
                        <h2 class="entity-console-card__title"><?= htmlspecialchars($item['title'] ?? '') ?></h2>
                        <?php if (($item['status'] ?? '') === 'inactive'): ?>
                            <span class="badge badge-secondary" style="margin-top:0.35rem;">Inactif</span>
                        <?php endif; ?>
                    </div>
                </div>
                <p class="entity-console-card__description"><?= htmlspecialchars($item['description'] ?? '') ?></p>
                <?php if ($hasMultipleLinks): ?>
                    <div class="entity-console-card__actions">
                        <?php foreach ($links as $link): ?>
                            <a href="<?= htmlspecialchars($link['url']) ?>"
                               class="btn <?= !empty($link['primary']) ? 'btn-primary' : 'btn-outline' ?> btn-sm"
                               onclick="event.stopPropagation();">
                                <?= htmlspecialchars($link['label']) ?>
                            </a>
                        <?php endforeach; ?>
                    </div>
                <?php else: ?>
                    <p class="entity-console-card__hint text-muted small">Cliquer pour ouvrir</p>
                <?php endif; ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php
}

function renderEntityConsoleCardScript() {
    ?>
    <script>
    (function() {
        document.querySelectorAll('.entity-console-card').forEach(function(card) {
            card.addEventListener('click', function() {
                if (card.getAttribute('data-multi') === '1') return;
                var url = card.getAttribute('data-url');
                if (url && url !== '#') window.location.href = url;
            });
        });

        var searchEl = document.getElementById('entityConsoleSearch');
        var cards = document.querySelectorAll('.entity-console-card[data-search]');
        var noResult = document.getElementById('entityConsoleNoResult');
        if (!searchEl || !cards.length) return;

        function filter() {
            var q = (searchEl.value || '').trim().toLowerCase();
            var visible = 0;
            cards.forEach(function(card) {
                var text = (card.getAttribute('data-search') || '').toLowerCase();
                var show = !q || text.indexOf(q) !== -1;
                card.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            if (noResult) noResult.style.display = visible === 0 ? 'block' : 'none';
        }

        searchEl.addEventListener('input', filter);
        searchEl.addEventListener('keyup', filter);
    })();
    </script>
    <?php
}
