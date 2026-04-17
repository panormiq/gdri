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

$hasEntrepriseDropdown = ($isLoggedIn && count($userEntreprises) > 1);
$entrepriseSelectorLabel = 'Changer entreprise';
if ($currentEntreprise) {
    $entrepriseName = $currentEntreprise['name'] ?? '';
    $siteName = defined('SITE_NAME') ? SITE_NAME : '';
    if (strcasecmp(trim($entrepriseName), trim($siteName)) !== 0) {
        $entrepriseSelectorLabel = $entrepriseName ?: 'Entreprise';
    }
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
            
            if (jwtToken) {
                try {
                    const response = await fetch(`${apiBaseUrl}/auth/set-cookie-from-gdr`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ token: jwtToken })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        console.log('✅ Cookie JWT défini automatiquement par GDRI');
                    }
                } catch (error) {
                    console.warn('⚠️ Impossible de définir le cookie JWT automatiquement:', error);
                }
            }
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
<body>
    <!-- Header / Navigation -->
    <header class="header" id="header">
        <div class="container">
            <div class="header-content">
                <!-- Logo GDRI -->
                <div class="logo">
                    <a href="<?php echo url('index.php'); ?>">
                        <img src="<?php echo url('assets/images/logo-gdri.png'); ?>" alt="GDR-Innovation Logo">
                        <span class="logo-text">GDR-Innovation</span>
                    </a>
                </div>
                
                <!-- Logo Entreprise Active (si connectÃ©) -->
                <?php if ($isLoggedIn && $currentEntreprise && strtolower(trim($currentEntreprise['name'] ?? '')) !== strtolower(trim(defined('SITE_NAME') ? SITE_NAME : ''))): ?>
                <div class="entreprise-logo">
                    <?php if (!empty($currentEntreprise['logo'])): ?>
                        <img src="<?php echo htmlspecialchars($currentEntreprise['logo']); ?>" 
                             alt="<?php echo htmlspecialchars($currentEntreprise['name'] ?? 'Entreprise'); ?>" 
                             class="entreprise-logo-img">
                    <?php else: ?>
                        <div class="entreprise-logo-placeholder">
                            <?php echo htmlspecialchars(mb_substr($currentEntreprise['name'] ?? 'E', 0, 1)); ?>
                        </div>
                    <?php endif; ?>
                    <?php if (empty($hasEntrepriseDropdown)): ?>
                    <span class="entreprise-name"><?php echo htmlspecialchars($currentEntreprise['name'] ?? 'Entreprise'); ?></span>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <?php if ($hasEntrepriseDropdown): ?>
                <div class="entreprise-selector">
                    <button class="entreprise-selector-btn" id="entrepriseSelectorBtn" type="button">
                        <span class="entreprise-selector-label"><?php echo htmlspecialchars($entrepriseSelectorLabel); ?></span>
                        <span class="entreprise-selector-action">Changer</span>
                    </button>
                </div>
                <?php endif; ?>

                <!-- Navigation -->
                <nav class="nav" id="nav">
                    <ul class="nav-list">
                        <?php if ($isLoggedIn): ?>
                            <?php if ($userRole === 'ADMIN_GDRI'): ?>
                                <!-- Navigation Admin GDRI : Modules = usage user, Configuration (entité) = sous-menu Modules / Utilisateurs, Administration = plateforme -->
                                <li><a href="<?php echo url('pages/dashboard.php'); ?>" class="nav-link">Accueil</a></li>
                                <li><a href="<?php echo url('pages/modules.php'); ?>" class="nav-link">Modules</a></li>
                                <?php if (!empty($currentEntreprise)): ?>
                                <li class="nav-item-dropdown">
                                    <div class="dropdown">
                                        <button class="dropdown-toggle" id="configMenuDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                                            <span class="dropdown-text">Configuration</span>
                                            <span class="dropdown-arrow">v</span>
                                        </button>
                                        <ul class="dropdown-menu" id="configMenuDropdownMenu">
                                            <li><a href="<?php echo url('pages/entity-config.php'); ?>" class="dropdown-item">Modules</a></li>
                                            <li><a href="<?php echo url('pages/users.php'); ?>" class="dropdown-item">Utilisateurs</a></li>
                                            <li><a href="<?php echo url('pages/modules/entity-roles.php'); ?>" class="dropdown-item">Roles</a></li>
                                        </ul>
                                    </div>
                                </li>
                                <?php endif; ?>
                                <li class="nav-item-dropdown">
                                    <div class="dropdown">
                                        <button class="dropdown-toggle" id="adminMenuDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                                            <span class="dropdown-text">Administration</span>
                                            <span class="dropdown-arrow">v</span>
                                        </button>
                                        <ul class="dropdown-menu" id="adminMenuDropdownMenu">
                                            <li><a href="<?php echo url('pages/entities.php'); ?>" class="dropdown-item">Entites</a></li>
                                            <li><a href="<?php echo url('pages/users.php'); ?>" class="dropdown-item">Utilisateurs</a></li>
                                            <li><a href="<?php echo url('pages/user-activity.php'); ?>" class="dropdown-item">Suivi utilisateurs</a></li>
                                            <li><a href="<?php echo url('pages/admin-modules.php'); ?>" class="dropdown-item">Modules</a></li>
                                        </ul>
                                    </div>
                                </li>
                                <li class="nav-item-dropdown">
                                    <div class="dropdown">
                                        <button class="dropdown-toggle" id="accountMenuDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                                            <span class="dropdown-text">Mon compte</span>
                                            <span class="dropdown-arrow">v</span>
                                        </button>
                                        <ul class="dropdown-menu" id="accountMenuDropdownMenu">
                                            <li><a href="<?php echo url('pages/account-modules.php'); ?>" class="dropdown-item">Configurer mes modules</a></li>
                                            <li><a href="<?php echo url('pages/account-profile.php'); ?>" class="dropdown-item">Mes données</a></li>
                                            <li><a href="<?php echo url('pages/account-notifications.php'); ?>" class="dropdown-item">Mes notifications</a></li>
                                        </ul>
                                    </div>
                                </li>
                                <li><a href="<?php echo url('auth/logout.php'); ?>" class="nav-link">Deconnexion</a></li>
                            <?php elseif ($userRole === 'ADMIN_ENTITY'): ?>
                                <!-- Navigation Admin Entity : Modules = usage user, Configuration = sous-menu Modules / Utilisateurs -->
                                <li><a href="<?php echo url('pages/dashboard.php'); ?>" class="nav-link">Accueil</a></li>
                                <li><a href="<?php echo url('pages/modules.php'); ?>" class="nav-link">Modules</a></li>
                                <li class="nav-item-dropdown">
                                    <div class="dropdown">
                                        <button class="dropdown-toggle" id="configMenuDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                                            <span class="dropdown-text">Configuration</span>
                                            <span class="dropdown-arrow">v</span>
                                        </button>
                                        <ul class="dropdown-menu" id="configMenuDropdownMenu">
                                            <li><a href="<?php echo url('pages/entity-config.php'); ?>" class="dropdown-item">Modules</a></li>
                                            <li><a href="<?php echo url('pages/users.php'); ?>" class="dropdown-item">Utilisateurs</a></li>
                                            <li><a href="<?php echo url('pages/modules/entity-roles.php'); ?>" class="dropdown-item">Roles</a></li>
                                        </ul>
                                    </div>
                                </li>
                                <li class="nav-item-dropdown">
                                    <div class="dropdown">
                                        <button class="dropdown-toggle" id="accountMenuDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                                            <span class="dropdown-text">Mon compte</span>
                                            <span class="dropdown-arrow">v</span>
                                        </button>
                                        <ul class="dropdown-menu" id="accountMenuDropdownMenu">
                                            <li><a href="<?php echo url('pages/account-modules.php'); ?>" class="dropdown-item">Configurer mes modules</a></li>
                                            <li><a href="<?php echo url('pages/account-profile.php'); ?>" class="dropdown-item">Mes données</a></li>
                                            <li><a href="<?php echo url('pages/account-notifications.php'); ?>" class="dropdown-item">Mes notifications</a></li>
                                        </ul>
                                    </div>
                                </li>
                                <li><a href="<?php echo url('auth/logout.php'); ?>" class="nav-link">Deconnexion</a></li>
                            <?php else: ?>
                                <!-- Navigation User Entity -->
                                <li><a href="<?php echo url('pages/dashboard.php'); ?>" class="nav-link">Accueil</a></li>
                                <li><a href="<?php echo url('pages/modules.php'); ?>" class="nav-link">Modules</a></li>
                                <li class="nav-item-dropdown">
                                    <div class="dropdown">
                                        <button class="dropdown-toggle" id="accountMenuDropdown" type="button" aria-haspopup="true" aria-expanded="false">
                                            <span class="dropdown-text">Mon compte</span>
                                            <span class="dropdown-arrow">v</span>
                                        </button>
                                        <ul class="dropdown-menu" id="accountMenuDropdownMenu">
                                            <li><a href="<?php echo url('pages/account-modules.php'); ?>" class="dropdown-item">Configurer mes modules</a></li>
                                            <li><a href="<?php echo url('pages/account-profile.php'); ?>" class="dropdown-item">Mes données</a></li>
                                            <li><a href="<?php echo url('pages/account-notifications.php'); ?>" class="dropdown-item">Mes notifications</a></li>
                                        </ul>
                                    </div>
                                </li>
                                <li><a href="<?php echo url('auth/logout.php'); ?>" class="nav-link">Deconnexion</a></li>
                            <?php endif; ?>
                        <?php else: ?>
                            <!-- Navigation publique -->
                            <li><a href="<?php echo url('index.php'); ?>" class="nav-link">Accueil</a></li>
                            <li><a href="<?php echo url('pages/agents.php'); ?>" class="nav-link">Nos Agents</a></li>
                            <li><a href="<?php echo url('pages/contact.php'); ?>" class="nav-link">Contact</a></li>
                            <li><button id="loginBtn" class="btn btn-primary">Connexion</button></li>
                        <?php endif; ?>
                    </ul>
                </nav>

                <!-- Menu Toggle (Mobile) -->
                <button class="menu-toggle" id="menuToggle" aria-label="Menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </div>
    </header>

    <!-- Espace pour le header fixe -->
    <div style="height: var(--header-height);"></div>

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
            // 2. Synchroniser la session PHP
            const syncUrl = '<?php echo url('auth/sync-entreprise.php'); ?>';
            await fetch(syncUrl, {
                method: 'GET',
                credentials: 'include'
            });
            
            // 3. Recharger la page pour mettre a jour l'affichage
            window.location.reload();
        } else {
            alert('Erreur lors du changement d\'entreprise: ' + (data.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Erreur lors du changement d\'entreprise:', error);
        alert('Erreur reseau lors du changement d\'entreprise');
    }
}

// Gestion du menu deroulant
document.addEventListener('DOMContentLoaded', function() {
    const dropdownPairs = [
        { buttonId: 'adminMenuDropdown', menuId: 'adminMenuDropdownMenu' },
        { buttonId: 'configMenuDropdown', menuId: 'configMenuDropdownMenu' },
        { buttonId: 'accountMenuDropdown', menuId: 'accountMenuDropdownMenu' }
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

    // Fermer les menus si on clique ailleurs
    document.addEventListener('click', function() {
        dropdownPairs.forEach(({ buttonId, menuId }) => {
            const dropdown = document.getElementById(buttonId);
            const dropdownMenu = document.getElementById(menuId);
            if (dropdownMenu) dropdownMenu.classList.remove('show');
            if (dropdown) dropdown.setAttribute('aria-expanded', 'false');
        });
    });

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
