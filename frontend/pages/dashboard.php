<?php
/**
 * Dashboard utilisateur - GDRI
 * Fichier : pages/dashboard.php
 * 
 * Page protégée - Nécessite authentification
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

// Vérifier si l'utilisateur est connecté
if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Dashboard';
$userRole = getUserRole();

require_once '../includes/header.php';
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Bienvenue sur votre Dashboard</h1>
            <p class="hero-description">
                <?php 
                    switch ($userRole) {
                        case 'ADMIN_GDRI':
                            echo 'Vous êtes connecté en tant qu\'Administrateur GDRI';
                            break;
                        case 'ADMIN_ENTITY':
                            echo 'Vous êtes connecté en tant qu\'Administrateur d\'Entité';
                            break;
                        case 'USER_ENTITY':
                            echo 'Vous êtes connecté en tant qu\'Utilisateur';
                            break;
                        default:
                            echo 'Bienvenue sur votre espace personnel';
                    }
                ?>
            </p>
        </div>
    </div>
</section>

<!-- Section Dashboard -->
<section class="section">
    <div class="container">
        <?php if ($userRole === 'ADMIN_GDRI'): ?>
            <!-- Dashboard Admin GDRI -->
            <div class="section-title">
                <h2>Gestion des Entités</h2>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-icon">🏢</div>
                    <h3 class="card-title">Entités</h3>
                    <p class="card-description">
                        Gérer les entreprises et entités inscrites sur la plateforme
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Gérer les entités
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">🔧</div>
                    <h3 class="card-title">Services</h3>
                    <p class="card-description">
                        Configurer les services disponibles et leurs autorisations
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Gérer les services
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">👥</div>
                    <h3 class="card-title">Utilisateurs</h3>
                    <p class="card-description">
                        Voir tous les utilisateurs de la plateforme
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Voir les utilisateurs
                    </button>
                </div>
            </div>
            
        <?php elseif ($userRole === 'ADMIN_ENTITY'): ?>
            <!-- Dashboard Admin Entité -->
            <div class="section-title">
                <h2>Gestion de votre Entité</h2>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-icon">👥</div>
                    <h3 class="card-title">Utilisateurs</h3>
                    <p class="card-description">
                        Gérer les utilisateurs de votre entité
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Gérer les utilisateurs
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">🔧</div>
                    <h3 class="card-title">Services autorisés</h3>
                    <p class="card-description">
                        Voir les services disponibles pour votre entité
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Voir les services
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">⚙️</div>
                    <h3 class="card-title">Paramètres</h3>
                    <p class="card-description">
                        Configurer les paramètres de votre entité
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Paramètres
                    </button>
                </div>
            </div>
            
        <?php else: ?>
            <!-- Dashboard Utilisateur -->
            <div class="section-title">
                <h2>Vos Services</h2>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-icon">🎯</div>
                    <h3 class="card-title">Agent Analyse d'intention</h3>
                    <p class="card-description">
                        Accéder à l'agent d'analyse d'intention
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Accéder
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">✉️</div>
                    <h3 class="card-title">Agent Mail</h3>
                    <p class="card-description">
                        Accéder à l'agent de gestion des emails
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Accéder
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">📄</div>
                    <h3 class="card-title">Agent Documentaire</h3>
                    <p class="card-description">
                        Accéder à l'agent documentaire
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Accéder
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-icon">📱</div>
                    <h3 class="card-title">Agent Facebook</h3>
                    <p class="card-description">
                        Accéder à l'agent Facebook
                    </p>
                    <button class="btn btn-primary" style="margin-top: var(--spacing-md);">
                        Accéder
                    </button>
                </div>
            </div>
        <?php endif; ?>
        
        <!-- Informations du compte -->
        <div style="margin-top: var(--spacing-xxl);">
            <div class="section-title">
                <h2>Informations du compte</h2>
            </div>
            
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
                    <p><strong>Email :</strong> <?php echo escape($_SESSION['user_email']); ?></p>
                    <p><strong>Rôle :</strong> 
                        <?php 
                            switch ($userRole) {
                                case 'ADMIN_GDRI':
                                    echo 'Administrateur GDRI';
                                    break;
                                case 'ADMIN_ENTITY':
                                    echo 'Administrateur d\'Entité';
                                    break;
                                case 'USER_ENTITY':
                                    echo 'Utilisateur';
                                    break;
                            }
                        ?>
                    </p>
                </div>
            </div>
        </div>
    </div>
</section>

<?php require_once '../includes/footer.php'; ?>





