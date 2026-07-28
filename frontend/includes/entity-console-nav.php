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

function getUserWorkspaceNavSections($includeLegacy = null) {
    if ($includeLegacy === null) {
        $includeLegacy = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
    }

    $sections = [
        [
            'label' => 'Travailler',
            'items' => [
                [
                    'label' => 'Accueil',
                    'url' => url('pages/dashboard.php'),
                    'path' => '/pages/dashboard.php',
                    'icon' => '🏠',
                ],
                [
                    'label' => 'Applications',
                    'url' => url('pages/modules.php'),
                    'path' => '/pages/modules.php',
                    'alt_paths' => ['/pages/applications.php'],
                    'icon' => '📱',
                ],
                [
                    'label' => 'Annuaire',
                    'url' => url('pages/modules/annuaire.php'),
                    'path' => '/pages/modules/annuaire.php',
                    'icon' => '📇',
                ],
            ],
        ],
        [
            'label' => 'Automatiser',
            'items' => [
                [
                    'label' => 'Agents automatiques',
                    'url' => url('pages/user-agents-auto.php'),
                    'path' => '/pages/user-agents-auto.php',
                    'alt_paths' => ['/pages/user-agents.php'],
                    'icon' => '⚡',
                ],
                [
                    'label' => 'Agents assistés',
                    'url' => url('pages/user-agents-assisted.php'),
                    'path' => '/pages/user-agents-assisted.php',
                    'icon' => '🧑‍💻',
                ],
            ],
        ],
        [
            'label' => 'Mes réglages',
            'items' => [
                [
                    'label' => 'Mail & canaux',
                    'url' => url('pages/user-connecteurs.php'),
                    'path' => '/pages/user-connecteurs.php',
                    'icon' => '🔌',
                ],
                [
                    'label' => 'IA personnelle',
                    'url' => url('pages/user-structurel.php'),
                    'path' => '/pages/user-structurel.php',
                    'alt_paths' => ['/pages/modules/ia-user-config.php'],
                    'icon' => '🧠',
                ],
                [
                    'label' => 'Mon profil',
                    'url' => url('pages/account-profile.php'),
                    'path' => '/pages/account-profile.php',
                    'icon' => '👤',
                ],
                [
                    'label' => 'Notifications',
                    'url' => url('pages/account-notifications.php'),
                    'path' => '/pages/account-notifications.php',
                    'icon' => '🔔',
                ],
            ],
        ],
    ];

    if ($includeLegacy) {
        $sections[] = [
            'label' => 'Administration',
            'items' => [
                [
                    'label' => 'Ancien menu',
                    'url' => url('pages/entity-legacy.php'),
                    'path' => '/pages/entity-legacy.php',
                    'icon' => '📦',
                ],
            ],
        ];
    }

    return $sections;
}

function getUserWorkspaceNavItems() {
    $items = [];
    foreach (getUserWorkspaceNavSections() as $section) {
        foreach ($section['items'] as $item) {
            $items[] = $item;
        }
    }
    return $items;
}

/**
 * Cartes d'orientation — accueil Mon espace (utilisateur).
 */
function renderUserWorkspaceGuideCards() {
    $cards = [
        [
            'title' => 'Applications',
            'description' => 'Ouvrir vos outils métier : UGAP, GDERPI, documents…',
            'icon' => '📱',
            'url' => url('pages/modules.php'),
        ],
        [
            'title' => 'Annuaire',
            'description' => 'Clients, fournisseurs et contacts de votre entité.',
            'icon' => '📇',
            'url' => url('pages/modules/annuaire.php'),
        ],
        [
            'title' => 'Mail & canaux',
            'description' => 'Configurer votre mail, Facebook et vos connexions.',
            'icon' => '🔌',
            'url' => url('pages/user-connecteurs.php'),
        ],
        [
            'title' => 'Automatisations',
            'description' => 'Lancer les agents IA mis à disposition par votre entité.',
            'icon' => '🤖',
            'url' => url('pages/user-agents.php'),
        ],
    ];
    ?>
    <div class="user-workspace-guide">
        <p class="user-workspace-guide__lead">
            Par où commencer ? Cliquez sur une carte ou une entrée du menu à gauche.
        </p>
        <div class="hub-cards-grid user-workspace-guide__grid">
            <?php foreach ($cards as $card): ?>
            <a href="<?= htmlspecialchars($card['url']) ?>" class="card user-workspace-guide__card">
                <div class="card-icon"><?= $card['icon'] ?></div>
                <h3 class="card-title"><?= htmlspecialchars($card['title']) ?></h3>
                <p class="card-description"><?= htmlspecialchars($card['description']) ?></p>
                <span class="btn btn-primary btn-sm" style="margin-top:0.75rem;">Ouvrir</span>
            </a>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
}

function renderAdminSidebarNavSections(array $sections, $ariaLabelPrefix = 'Navigation') {
    foreach ($sections as $index => $section) {
        $label = (string) ($section['label'] ?? '');
        $items = is_array($section['items'] ?? null) ? $section['items'] : [];
        if ($items === []) {
            continue;
        }
        renderAdminSidebarNav(
            $label,
            $items,
            $ariaLabelPrefix . ($label !== '' ? ' — ' . $label : '')
        );
    }
}

function getPlatformConsoleNavItems() {
    $deployItem = [
        'label' => 'Déploiement',
        'url' => url('pages/platform-deploy.php'),
        'path' => '/pages/platform-deploy.php',
        'icon' => '🚀',
    ];

    // Rôle DEV : uniquement la console de déploiement TEST
    if (function_exists('canAccessDeployConsoleOnly') && canAccessDeployConsoleOnly()) {
        return [$deployItem];
    }

    return [
        [
            'label' => 'Entités',
            'url' => url('pages/entities.php'),
            'path' => '/pages/entities.php',
            'icon' => '🏢',
        ],
        [
            'label' => 'Utilisateurs',
            'url' => url('pages/platform-users.php'),
            'path' => '/pages/platform-users.php',
            'icon' => '👥',
        ],
        [
            'label' => 'Applications',
            'url' => url('pages/platform-applications.php'),
            'path' => '/pages/platform-applications.php',
            'icon' => '📱',
        ],
        [
            'label' => 'Agents IA',
            'url' => url('pages/platform-agents.php'),
            'path' => '/pages/platform-agents.php',
            'icon' => '🤖',
        ],
        [
            'label' => 'Connecteurs',
            'url' => url('pages/platform-connecteurs.php'),
            'path' => '/pages/platform-connecteurs.php',
            'icon' => '🔌',
        ],
        [
            'label' => 'Structurel',
            'url' => url('pages/platform-structurel.php'),
            'path' => '/pages/platform-structurel.php',
            'icon' => '⚙️',
        ],
        $deployItem,
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
                       class="admin-sidebar__link<?= gdriSidebarNavIsActive($item) ? ' is-active' : '' ?>"
                       title="<?= htmlspecialchars($item['label']) ?>">
                        <span class="admin-sidebar__link-icon"><?= $item['icon'] ?></span>
                        <span class="admin-sidebar__link-text"><?= htmlspecialchars($item['label']) ?></span>
                    </a>
                </li>
                <?php endforeach; ?>
            </ul>
        </nav>
    </div>
    <?php
}

function gdriSidebarNavIsActive(array $item) {
    $path = (string) ($item['path'] ?? '');
    $paths = array_values(array_filter(array_merge(
        $path !== '' ? [$path] : [],
        is_array($item['alt_paths'] ?? null) ? $item['alt_paths'] : []
    )));
    if ($paths === []) {
        return false;
    }
    $isPathActive = false;
    foreach ($paths as $candidate) {
        if (gdriNavIsActive((string) $candidate)) {
            $isPathActive = true;
            break;
        }
    }
    if (!$isPathActive) {
        return false;
    }
    if (isset($item['tab'])) {
        return strtolower(trim((string) ($_GET['tab'] ?? ''))) === strtolower(trim((string) $item['tab']));
    }
    if (isset($item['defaultTab'])) {
        $currentTab = strtolower(trim((string) ($_GET['tab'] ?? '')));
        if ($currentTab === '') {
            $currentTab = strtolower(trim((string) $item['defaultTab']));
        }
        return $currentTab === strtolower(trim((string) $item['defaultTab']));
    }
    return true;
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

function requirePlatformConsoleAccess() {
    if (!hasRole(ROLE_ADMIN_GDRI)) {
        // DEV : uniquement la page déploiement
        if (hasRole(ROLE_DEV)) {
            redirect(url('pages/platform-deploy.php'));
        }
        redirect(url('pages/dashboard.php'));
    }
}

function requireDeployConsoleAccess() {
    if (!canAccessDeployConsole()) {
        redirect(url('pages/dashboard.php'));
    }
}

function requireUserWorkspaceEntityAccess() {
    if (!isLoggedIn()) {
        redirect(url('index.php'));
    }
    if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
        redirect(url('pages/dashboard.php'));
    }
    $currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
    if (empty($currentEntrepriseId)) {
        redirect(url('pages/dashboard.php'));
    }
}

function renderApplicationCatalogReadonly(array $items, array $options = []) {
    $hint = (string) ($options['hint'] ?? 'Installé sur le serveur — activation par entité');
    $cardClass = (string) ($options['card_class'] ?? 'app-catalog-card');
    if (empty($items)) {
        echo '<div class="entity-console-empty"><p>Aucune application disponible.</p></div>';
        return;
    }
    ?>
    <div class="hub-cards-grid entity-console-grid app-catalog-readonly">
        <?php foreach ($items as $item): ?>
        <?php
            $searchText = mb_strtolower(
                ($item['title'] ?? '') . ' ' . ($item['description'] ?? '') . ' ' . ($item['slug'] ?? '')
            );
            $isActive = ($item['status'] ?? 'active') === 'active';
            $typeLabel = ($item['catalog_type'] ?? 'app') === 'extension' ? 'Extension' : 'Application';
        ?>
        <div class="card entity-console-card entity-console-card--readonly <?= htmlspecialchars($cardClass) ?>"
             data-search="<?= htmlspecialchars($searchText) ?>">
            <div class="entity-console-card__inner entity-console-card__inner--applications">
                <div class="entity-console-card__head">
                    <span class="entity-console-card__icon"><?= $item['icon'] ?? '📱' ?></span>
                    <div>
                        <h2 class="entity-console-card__title"><?= htmlspecialchars($item['title'] ?? '') ?></h2>
                        <div style="margin-top:0.35rem;display:flex;gap:0.35rem;flex-wrap:wrap;">
                            <span class="badge <?= $isActive ? 'badge-success' : 'badge-secondary' ?>">
                                <?= $isActive ? 'Actif' : 'Inactif' ?>
                            </span>
                            <span class="badge badge-info"><?= htmlspecialchars($typeLabel) ?></span>
                        </div>
                    </div>
                </div>
                <?php if (!empty($item['slug'])): ?>
                <p class="app-catalog-card__slug"><code><?= htmlspecialchars($item['slug']) ?></code></p>
                <?php endif; ?>
                <p class="entity-console-card__description"><?= htmlspecialchars($item['description'] ?? '') ?></p>
                <p class="entity-console-card__hint text-muted small"><?= htmlspecialchars($hint) ?></p>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php
}

function renderPlatformApplicationCatalog(array $items) {
    renderApplicationCatalogReadonly($items, [
        'hint' => 'Installé sur le serveur — activation par entité',
    ]);
}

function renderApplicationCatalogReadonlyScript(array $options = []) {
    $searchId = (string) ($options['search_id'] ?? 'appCatalogSearch');
    $noResultId = (string) ($options['no_result_id'] ?? 'appCatalogNoResult');
    $cardSelector = (string) ($options['card_selector'] ?? '.app-catalog-card');
    ?>
    <script>
    (function() {
        var searchEl = document.getElementById(<?= json_encode($searchId) ?>);
        var cards = document.querySelectorAll(<?= json_encode($cardSelector) ?> + '[data-search]');
        var noResult = document.getElementById(<?= json_encode($noResultId) ?>);
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

function renderPlatformApplicationCatalogScript() {
    renderApplicationCatalogReadonlyScript([
        'search_id' => 'platformAppsSearch',
        'no_result_id' => 'platformAppsNoResult',
        'card_selector' => '.app-catalog-card',
    ]);
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
