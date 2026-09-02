<?php
/**
 * Header commun pour toutes les pages - GDRI
 * Fichier : includes/header.php
 */

// S'assurer que les fonctions sont chargÃ©es
require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/jwt-helper.php';

// VÃ©rifier si l'utilisateur est connectÃ©
$isLoggedIn = isLoggedIn();
$userRole = getUserRole();

// RÃ©cupÃ©rer l'entreprise active si connectÃ©
$currentEntreprise = null;
$userEntreprises = [];
if ($isLoggedIn) {
    $headerContextLoaded = false;
    $jwtToken = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!empty($jwtToken) && !empty($apiBase)) {
        $ch = curl_init($apiBase . '/users/me/header-context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $jwtToken,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $raw = curl_exec($ch);
        $curlErr = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$curlErr && $httpCode >= 200 && $httpCode < 300) {
            $decoded = json_decode((string)$raw, true);
            $ctx = $decoded['data'] ?? [];
            $userEntreprises = is_array($ctx['entreprises'] ?? null) ? $ctx['entreprises'] : [];
            $currentEntreprise = is_array($ctx['currentEntreprise'] ?? null) ? $ctx['currentEntreprise'] : null;
            $headerContextLoaded = true;
        }
    }

    // Pas de fallback Mongo côté PHP: source de vérité = API Node.
}

$hasEntrepriseDropdown = canOpenEntrepriseSelector($userEntreprises);
$entrepriseSelectorLabel = 'Changer entreprise';
if ($currentEntreprise) {
    $entrepriseName = $currentEntreprise['name'] ?? '';
    $siteName = defined('SITE_NAME') ? SITE_NAME : '';
    if (strcasecmp(trim($entrepriseName), trim($siteName)) !== 0) {
        $entrepriseSelectorLabel = $entrepriseName ?: 'Entreprise';
    }
}

syncGdriWorkspaceModeFromPage();
$workspaceMode = getGdriWorkspaceMode(!empty($currentEntreprise));
$showAdminSidebar = shouldShowAdminSidebar();
$gdriNavMode = getGdriAdminNavMode(!empty($currentEntreprise));
$userEmail = trim((string) ($_SESSION['user_email'] ?? ''));
$userInitials = getUserInitials();
if ($showAdminSidebar) {
    $GLOBALS['gdri_admin_shell_open'] = true;
}

$displayEntrepriseName = '';
if ($currentEntreprise) {
    $displayEntrepriseName = trim((string) ($currentEntreprise['name'] ?? ''));
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="GDR-Innovation - Simplifiez-vous la vie avec nos agents IA">
    <title><?php echo htmlspecialchars($page_title ?? 'GDR-Innovation - Simplifiez-vous la vie'); ?></title>
    
    <!-- CSS -->
    <link rel="stylesheet" href="<?php echo url('assets/css/main.css'); ?>">
    <link rel="stylesheet" href="<?php echo url('assets/css/modal.css'); ?>">
    <link rel="stylesheet" href="<?php echo url('assets/css/responsive.css'); ?>">
    <link rel="stylesheet" href="<?php echo url('assets/css/admin-shell.css'); ?>">
    <link rel="stylesheet" href="<?php echo url('assets/css/console-page.css'); ?>">
    <?php if (!empty($extra_styles) && is_array($extra_styles)): ?>
        <?php foreach ($extra_styles as $stylePath): ?>
            <link rel="stylesheet" href="<?php echo htmlspecialchars($stylePath); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="<?php echo url('assets/images/logo-gdri.png'); ?>">
    
    <!-- Variables JavaScript globales -->
    <script>
        // Configuration globale pour JavaScript (toujours définies pour éviter "undefined")
        window.BASE_URL = '<?php echo defined('BASE_URL') ? addslashes(BASE_URL) : '/'; ?>';
        window.API_BASE_URL = '<?php echo addslashes(defined('API_BASE_URL') ? API_BASE_URL : (function_exists('getApiBaseUrl') ? getApiBaseUrl() : 'http://localhost:3000/api')); ?>';
        <?php if (isLoggedIn()): ?>
        // Définir automatiquement le cookie JWT pour toutes les pages PHP authentifiées
        <?php
        require_once __DIR__ . '/jwt-helper.php';
        $jwt_token = getJWTToken();
        $api_base_url = getApiBaseUrl();
        if ($jwt_token):
        ?>
        (async function() {
            const jwtToken = <?= json_encode($jwt_token, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
            const apiBaseUrl = <?= json_encode($api_base_url, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;

            window.gdriJwtReady = (async function syncGdriJwtCookie() {
                if (!jwtToken) return false;
                try {
                    const response = await fetch(`${apiBaseUrl}/auth/set-cookie-from-gdr`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ token: jwtToken })
                    });
                    const raw = await response.text();
                    if (!response.ok) {
                        console.warn('⚠️ API Node indisponible (HTTP ' + response.status + ') — cookie JWT non synchronisé. Redémarrer le backend sur le port 3000.');
                        return false;
                    }
                    const data = raw ? JSON.parse(raw) : {};
                    if (data.success) {
                        window.GDRI_JWT = jwtToken;
                        console.log('✅ Cookie JWT synchronisé');
                        return true;
                    }
                } catch (error) {
                    console.warn('⚠️ Impossible de synchroniser le cookie JWT:', error);
                }
                return false;
            })();
        })();
        <?php endif; ?>
        <?php endif; ?>
        <?php if ($isLoggedIn): ?>
        // Debug : rôle utilisateur (session PHP)
        (function() {
            var role = <?= json_encode($userRole ?? null) ?>;
            var hasEntreprise = <?= json_encode(!empty($currentEntreprise)) ?>;
            console.log('[GDRI Debug] Rôle utilisateur:', role || '(non défini)');
            console.log('[GDRI Debug] Entité courante définie:', hasEntreprise);
        })();
        <?php endif; ?>
    </script>
</head>
<body<?php echo !empty($showAdminSidebar) ? ' class="has-admin-sidebar"' : ''; ?>>
    <header class="header header--minimal" id="header">
        <div class="container header-container">
            <div class="header-content">
                <div class="header-zone header-zone--left">
                    <?php if ($showAdminSidebar): ?>
                    <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Menu">☰</button>
                    <?php endif; ?>
                    <div class="logo header-logo">
                        <a href="<?php echo htmlspecialchars(getGdriLogoHomeUrl()); ?>">
                            <img src="<?php echo url('assets/images/logo-gdri.png'); ?>" alt="GDR-Innovation Logo">
                            <span class="logo-text">GDR-Innovation</span>
                        </a>
                    </div>
                </div>

                <?php if ($isLoggedIn && $workspaceMode !== 'platform' && ($displayEntrepriseName !== '' || $hasEntrepriseDropdown)): ?>
                <div class="header-zone header-zone--center">
                    <?php if ($displayEntrepriseName !== '' && $hasEntrepriseDropdown): ?>
                        <button type="button" class="header-context-card header-context-card--clickable header-context-card--compact" id="entrepriseSelectorBtn">
                            <span class="header-context-card__label">Entité</span>
                            <span class="header-context-card__value"><?php echo htmlspecialchars($displayEntrepriseName); ?></span>
                            <span class="header-context-card__action">Changer</span>
                        </button>
                    <?php elseif ($displayEntrepriseName !== ''): ?>
                        <div class="header-context-card header-context-card--compact">
                            <span class="header-context-card__label">Entité</span>
                            <span class="header-context-card__value"><?php echo htmlspecialchars($displayEntrepriseName); ?></span>
                        </div>
                    <?php elseif ($hasEntrepriseDropdown): ?>
                        <button type="button" class="header-context-card header-context-card--clickable header-context-card--compact" id="entrepriseSelectorBtn">
                            <span class="header-context-card__label">Entité</span>
                            <span class="header-context-card__value">Choisir</span>
                            <span class="header-context-card__action">Changer</span>
                        </button>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <div class="header-zone header-zone--right">
                    <?php if ($isLoggedIn): ?>
                    <div class="dropdown user-panel">
                        <button class="user-panel-btn dropdown-toggle" id="userPanelDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                            <span class="user-avatar"><?php echo htmlspecialchars($userInitials); ?></span>
                            <?php if ($userEmail !== ''): ?>
                            <span class="user-panel-email"><?php echo htmlspecialchars($userEmail); ?></span>
                            <?php endif; ?>
                        </button>
                        <ul class="dropdown-menu dropdown-menu--right" id="userPanelDropdownMenu">
                            <li><a href="<?php echo url('pages/account-profile.php'); ?>" class="dropdown-item">Mes données</a></li>
                            <li><a href="<?php echo url('pages/account-notifications.php'); ?>" class="dropdown-item">Mes notifications</a></li>
                            <li><a href="<?php echo url('auth/logout.php'); ?>" class="dropdown-item">Déconnexion</a></li>
                        </ul>
                    </div>
                    <?php else: ?>
                    <nav class="nav nav--public" id="nav">
                        <ul class="nav-list">
                            <li><a href="<?php echo url('index.php'); ?>" class="nav-link">Accueil</a></li>
                            <li><a href="<?php echo url('pages/agents.php'); ?>" class="nav-link">Nos Agents</a></li>
                            <li><a href="<?php echo url('pages/contact.php'); ?>" class="nav-link">Contact</a></li>
                            <li><button id="loginBtn" class="btn btn-primary">Connexion</button></li>
                        </ul>
                    </nav>
                    <button class="menu-toggle" id="menuToggle" aria-label="Menu">
                        <span></span><span></span><span></span>
                    </button>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </header>

    <!-- Espace pour le header fixe -->
    <div class="header-spacer"></div>

    <!-- Bandeau de developpement (visible uniquement en mode dev) -->
    <?php if (ENVIRONMENT === 'development'): ?>
    <div class="dev-banner" style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #000; padding: 8px 0; text-align: center; font-size: 0.9rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; z-index: 999;">
        <div class="container" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 1.2rem;">[DEV]</span>
            <span>Mode Developpement - Branche: <?php 
                try {
                    $gitBranch = @shell_exec('git rev-parse --abbrev-ref HEAD 2>nul');
                    echo htmlspecialchars(trim($gitBranch) ?: 'non detecte');
                } catch (Exception $e) {
                    echo 'non detecte';
                }
            ?></span>
        </div>
    </div>
    <?php endif; ?>

<?php if (!$isLoggedIn): ?>
<!-- Modal de connexion -->
<div class="modal-overlay" id="loginModal">
    <div class="modal-content">
        <button class="modal-close" id="closeModal" aria-label="Fermer">
            <span>&times;</span>
        </button>
        
        <div class="modal-header">
            <h2>Connexion</h2>
        </div>
        
        <div class="modal-body">
            <form id="loginForm" method="POST">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autocomplete="email">
                </div>
                
                <div class="form-group">
                    <label for="password">Mot de passe</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password">
                </div>
                
                <div class="form-error" id="formError"></div>
                <div class="form-success" id="formSuccess"></div>
                
                <button type="submit" class="btn btn-primary btn-full">Se connecter</button>
                <div style="margin-top: 12px; text-align: center;">
                    <a href="<?php echo url('pages/first-connection.php'); ?>" style="color: #666; text-decoration: none;">Première connexion ?</a>
                    <span style="margin: 0 6px;">•</span>
                    <a href="<?php echo url('pages/forgot-password.php'); ?>" style="color: #666; text-decoration: none;">Mot de passe oublié</a>
                </div>
            </form>
        </div>
    </div>
</div>
<?php endif; ?>

<?php if ($hasEntrepriseDropdown): ?>
<!-- Modal selection entreprise -->
<!-- Le modal ne doit PAS avoir la classe 'active' par défaut - il s'ouvre uniquement via JavaScript -->
<div class="modal-overlay" id="entrepriseModal"<?php echo (!empty($currentEntreprise)) ? ' style="display: none;"' : ''; ?>>
    <div class="modal">
        <div class="modal-header">
            <h3 class="modal-title">Choisir une entreprise</h3>
            <button class="modal-close" id="entrepriseModalClose" aria-label="Fermer">&times;</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label" for="entrepriseSearch">Rechercher</label>
                <input id="entrepriseSearch" class="form-input" type="text" placeholder="Tapez un nom d'entreprise">
            </div>
            <ul class="entreprise-list" id="entrepriseList">
                <?php foreach ($userEntreprises as $entreprise): ?>
                    <?php
                    $isActive = isset($currentEntreprise['_id']) &&
                               (string) $entreprise['_id'] === (string) $currentEntreprise['_id'];
                    ?>
                    <li>
                        <button
                            type="button"
                            class="entreprise-list-item <?php echo $isActive ? 'active' : ''; ?>"
                            data-entreprise-id="<?php echo htmlspecialchars((string) $entreprise['_id']); ?>"
                            data-entreprise-name="<?php echo htmlspecialchars(strtolower($entreprise['name'] ?? '')); ?>"
                        >
                            <?php if (!empty($entreprise['logo'])): ?>
                                <img src="<?php echo htmlspecialchars($entreprise['logo']); ?>"
                                     alt="<?php echo htmlspecialchars($entreprise['name'] ?? ''); ?>"
                                     class="entreprise-list-logo">
                            <?php else: ?>
                                <span class="entreprise-list-placeholder">
                                    <?php echo htmlspecialchars(mb_substr($entreprise['name'] ?? 'E', 0, 1)); ?>
                                </span>
                            <?php endif; ?>
                            <span class="entreprise-list-name"><?php echo htmlspecialchars($entreprise['name'] ?? 'Entreprise'); ?></span>
                            <?php if ($isActive): ?>
                                <span class="entreprise-list-check">OK</span>
                            <?php endif; ?>
                        </button>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- Script pour gerer le changement d'entreprise -->
<?php if ($isLoggedIn): ?>
<script>
// Fonction pour changer l'entreprise active
async function changeEntreprise(entrepriseId) {
    try {
        // 1. Mettre a jour dans MongoDB via l'API
        const apiUrl = window.API_BASE_URL + '/users/me/current-entreprise';
        const jwtToken = <?php echo json_encode(getJWTToken()); ?>;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ entrepriseId: entrepriseId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 2. Synchroniser la session PHP (+ JWT frais)
            const syncUrl = '<?php echo url('auth/sync-entreprise.php'); ?>';
            const syncRes = await fetch(syncUrl, {
                method: 'GET',
                credentials: 'include'
            });
            const syncData = await syncRes.json().catch(() => ({}));

            // 3. Aligner le cookie HttpOnly (prioritaire côté API Node)
            const tokenToSet = syncData.jwt || data.data?.token || null;
            if (tokenToSet) {
                await fetch(window.API_BASE_URL + '/auth/set-cookie-from-gdr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ token: tokenToSet })
                });
            }

            // 4. Rechargement complet (évite le cache navigateur / bfcache)
            const url = new URL(window.location.href);
            url.searchParams.set('_ent', String(Date.now()));
            window.location.replace(url.toString());
        } else {
            alert('Erreur lors du changement d\'entreprise: ' + (data.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Erreur lors du changement d\'entreprise:', error);
        alert('Erreur reseau lors du changement d\'entreprise');
    }
}

// Gestion des menus header
document.addEventListener('DOMContentLoaded', function() {
    const dropdownPairs = [
        { buttonId: 'userPanelDropdown', menuId: 'userPanelDropdownMenu' }
    ];

    dropdownPairs.forEach(({ buttonId, menuId }) => {
        const dropdown = document.getElementById(buttonId);
        const dropdownMenu = document.getElementById(menuId);
        if (!dropdown || !dropdownMenu) return;

        dropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = dropdownMenu.classList.toggle('show');
            dropdown.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    document.addEventListener('click', function() {
        dropdownPairs.forEach(({ buttonId, menuId }) => {
            const dropdown = document.getElementById(buttonId);
            const dropdownMenu = document.getElementById(menuId);
            if (dropdownMenu) dropdownMenu.classList.remove('show');
            if (dropdown) dropdown.setAttribute('aria-expanded', 'false');
        });
    });

    const sidebar = document.getElementById('adminSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarBackdrop = document.getElementById('adminSidebarBackdrop');

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('is-open');
        if (sidebarBackdrop) sidebarBackdrop.hidden = true;
    }

    function openSidebar() {
        if (sidebar) sidebar.classList.add('is-open');
        if (sidebarBackdrop) sidebarBackdrop.hidden = false;
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            if (appShell && isDesktopSidebar() && appShell.classList.contains('sidebar-collapsed')) {
                applySidebarCollapsed(false);
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
                return;
            }
            if (sidebar && sidebar.classList.contains('is-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    const appShell = document.getElementById('appShell');
    const sidebarCollapseBtn = document.getElementById('adminSidebarCollapse');
    const SIDEBAR_COLLAPSED_KEY = 'gdri_sidebar_collapsed';
    const desktopSidebarMq = window.matchMedia('(min-width: 993px)');

    function isDesktopSidebar() {
        return desktopSidebarMq.matches;
    }

    function applySidebarCollapsed(collapsed) {
        if (!appShell) return;
        appShell.classList.toggle('sidebar-collapsed', collapsed);
        if (sidebarCollapseBtn) {
            sidebarCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            const icon = sidebarCollapseBtn.querySelector('.admin-sidebar__collapse-icon');
            const label = sidebarCollapseBtn.querySelector('.admin-sidebar__collapse-label');
            if (icon) icon.textContent = collapsed ? '▶' : '◀';
            if (label) label.textContent = collapsed ? 'Menu' : 'Réduire';
            sidebarCollapseBtn.title = collapsed ? 'Développer le menu' : 'Réduire le menu';
        }
    }

    function loadSidebarCollapsedPreference() {
        if (!appShell || !isDesktopSidebar()) {
            if (appShell) appShell.classList.remove('sidebar-collapsed');
            return;
        }
        applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    }

    loadSidebarCollapsedPreference();

    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', function() {
            if (!appShell) return;
            if (!isDesktopSidebar()) {
                openSidebar();
                return;
            }
            const next = !appShell.classList.contains('sidebar-collapsed');
            applySidebarCollapsed(next);
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
        });
    }

    if (typeof desktopSidebarMq.addEventListener === 'function') {
        desktopSidebarMq.addEventListener('change', loadSidebarCollapsedPreference);
    } else if (typeof desktopSidebarMq.addListener === 'function') {
        desktopSidebarMq.addListener(loadSidebarCollapsedPreference);
    }

    const sidebarEntrepriseBtn = document.getElementById('sidebarEntrepriseBtn');
    const entrepriseBtn = document.getElementById('entrepriseSelectorBtn');
    const entrepriseModal = document.getElementById('entrepriseModal');
    const entrepriseModalClose = document.getElementById('entrepriseModalClose');
    const entrepriseSearch = document.getElementById('entrepriseSearch');
    const entrepriseList = document.getElementById('entrepriseList');

    // S'assurer que le modal est fermé au chargement si une entreprise est sélectionnée
    <?php if (!empty($currentEntreprise)): ?>
    if (entrepriseModal) {
        entrepriseModal.classList.remove('active');
        entrepriseModal.style.display = 'none';
    }
    <?php endif; ?>

    function openEntrepriseModal() {
        if (!entrepriseModal) return;
        entrepriseModal.style.display = 'flex';
        entrepriseModal.classList.add('active');
        if (entrepriseSearch) {
            entrepriseSearch.value = '';
            entrepriseSearch.focus();
        }
        filterEntrepriseList('');
    }

    function closeEntrepriseModal() {
        if (!entrepriseModal) return;
        entrepriseModal.classList.remove('active');
        entrepriseModal.style.display = 'none';
    }

    function filterEntrepriseList(query) {
        if (!entrepriseList) return;
        const normalized = (query || '').toLowerCase().trim();
        entrepriseList.querySelectorAll('.entreprise-list-item').forEach(item => {
            const name = item.getAttribute('data-entreprise-name') || '';
            const matches = !normalized || name.includes(normalized);
            item.closest('li').style.display = matches ? '' : 'none';
        });
    }

    if (entrepriseBtn) {
        entrepriseBtn.addEventListener('click', openEntrepriseModal);
    }
    if (sidebarEntrepriseBtn) {
        sidebarEntrepriseBtn.addEventListener('click', openEntrepriseModal);
    }
    if (entrepriseModal) {
        entrepriseModal.addEventListener('click', function(event) {
            if (event.target === entrepriseModal) {
                closeEntrepriseModal();
            }
        });
    }
    if (entrepriseModalClose) {
        entrepriseModalClose.addEventListener('click', closeEntrepriseModal);
    }
    if (entrepriseSearch) {
        entrepriseSearch.addEventListener('input', function(event) {
            filterEntrepriseList(event.target.value);
        });
    }
    if (entrepriseList) {
        entrepriseList.addEventListener('click', function(event) {
            const button = event.target.closest('.entreprise-list-item');
            if (!button) return;
            const entrepriseId = button.getAttribute('data-entreprise-id');
            if (entrepriseId) {
                closeEntrepriseModal();
                changeEntreprise(entrepriseId);
            }
        });
    }
});
</script>
<?php endif; ?>

<?php if (!empty($showAdminSidebar)): ?>
<div class="app-shell" id="appShell">
    <?php require __DIR__ . '/admin-sidebar.php'; ?>
    <main class="app-main">
<?php endif; ?>
