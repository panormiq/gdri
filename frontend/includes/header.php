<?php
/**
 * Header commun pour toutes les pages - GDRI
 * Fichier : includes/header.php
 */

// S'assurer que les fonctions sont chargées
require_once __DIR__ . '/functions.php';

// Vérifier si l'utilisateur est connecté
$isLoggedIn = isLoggedIn();
$userRole = getUserRole();
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
        // Configuration globale pour JavaScript
        window.BASE_URL = '<?php echo defined('BASE_URL') ? BASE_URL : '/'; ?>';
        <?php if (isLoggedIn()): ?>
        window.API_BASE_URL = '<?php echo defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost:3000/api'; ?>';
        <?php endif; ?>
    </script>
</head>
<body>
    <!-- Header / Navigation -->
    <header class="header" id="header">
        <div class="container">
            <div class="header-content">
                <!-- Logo -->
                <div class="logo">
                    <a href="<?php echo url('index.php'); ?>">
                        <img src="<?php echo url('assets/images/logo-gdri.png'); ?>" alt="GDR-Innovation Logo">
                        <span class="logo-text">GDR-Innovation</span>
                    </a>
                </div>

                <!-- Navigation -->
                <nav class="nav" id="nav">
                    <ul class="nav-list">
                        <?php if ($isLoggedIn): ?>
                            <?php if ($userRole === 'ADMIN_GDRI'): ?>
                                <!-- Navigation Admin GDRI -->
                                <li><a href="<?php echo url('pages/dashboard.php'); ?>" class="nav-link">Dashboard</a></li>
                                <li><a href="<?php echo url('pages/modules.php'); ?>" class="nav-link">Modules</a></li>
                                <li><a href="<?php echo url('pages/entities.php'); ?>" class="nav-link">Entités</a></li>
                                <li><a href="<?php echo url('auth/logout.php'); ?>" class="nav-link">Déconnexion</a></li>
                            <?php elseif ($userRole === 'ADMIN_ENTITY'): ?>
                                <!-- Navigation Admin Entity -->
                                <li><a href="<?php echo url('pages/dashboard.php'); ?>" class="nav-link">Dashboard</a></li>
                                <li><a href="<?php echo url('pages/users.php'); ?>" class="nav-link">Utilisateurs</a></li>
                                <li><a href="<?php echo url('auth/logout.php'); ?>" class="nav-link">Déconnexion</a></li>
                            <?php else: ?>
                                <!-- Navigation User Entity -->
                                <li><a href="<?php echo url('pages/dashboard.php'); ?>" class="nav-link">Dashboard</a></li>
                                <li><a href="<?php echo url('auth/logout.php'); ?>" class="nav-link">Déconnexion</a></li>
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

    <!-- Bandeau de développement (visible uniquement en mode dev) -->
    <?php if (ENVIRONMENT === 'development'): ?>
    <div class="dev-banner" style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #000; padding: 8px 0; text-align: center; font-size: 0.9rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; z-index: 999;">
        <div class="container" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 1.2rem;">🛠️</span>
            <span>Mode Développement - Branche: <?php 
                try {
                    $gitBranch = @shell_exec('git rev-parse --abbrev-ref HEAD 2>nul');
                    echo htmlspecialchars(trim($gitBranch) ?: 'non détecté');
                } catch (Exception $e) {
                    echo 'non détecté';
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
            </form>
        </div>
    </div>
</div>
<?php endif; ?>

