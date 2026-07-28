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
require_once '../includes/jwt-helper.php';

// Vérifier si l'utilisateur est connecté
if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Accueil';
$userRole = getUserRole();
$workspaceMode = getGdriWorkspaceMode();

// Rôle DEV (prod) : console déploiement uniquement
if ($userRole === ROLE_DEV || $userRole === 'DEV') {
    redirect(url('pages/platform-deploy.php'));
}

if ($workspaceMode === 'user') {
    require_once '../includes/entity-console-nav.php';
    require_once '../includes/header.php';
    renderConsoleLayoutStart(
        'Accueil',
        'Bienvenue. Le menu à gauche regroupe tout — ou utilisez les raccourcis ci-dessous.'
    );
    renderUserWorkspaceGuideCards();
    renderConsoleLayoutEnd();
    require_once '../includes/footer.php';
    exit;
}

$page_title = 'Dashboard';

require_once '../includes/header.php';

// Charger les modules autorisés pour l'entreprise active
$authorizedServices = [];
if ($userRole !== 'ADMIN_GDRI') {
    try {
        $token = getJWTToken();
        $apiBase = rtrim(getApiBaseUrl(), '/');
        if ($token && $apiBase) {
            $ch = curl_init($apiBase . '/users/me/services-context');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);
            $raw = curl_exec($ch);
            $err = curl_error($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if (!$err && $code >= 200 && $code < 300) {
                $decoded = json_decode((string)$raw, true);
                $authorizedServices = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
                $authorizedServices = filterCatalogApplications($authorizedServices);
            }
        }
    } catch (Exception $e) {
        $authorizedServices = [];
    }
}

function renderModuleLinks($service, $userRole) {
    $name = strtolower(trim($service['name'] ?? ''));

    if (strpos($name, 'mail') !== false) {
        return '<div style="display:flex; gap: var(--spacing-sm); flex-wrap: wrap; margin-top: var(--spacing-md);">
            <a class="btn btn-primary" href="' . url('pages/modules/mail-config.php') . '">⚙️ Configuration</a>
            <a class="btn btn-outline" href="' . url('pages/modules/mail-test.php') . '">🧪 Test</a>
        </div>';
    }

    if (strpos($name, 'workflow') !== false) {
        return '<div style="display:flex; gap: var(--spacing-sm); flex-wrap: wrap; margin-top: var(--spacing-md);">
            <a class="btn btn-primary" href="/modules/workflow/frontend/viewer/index.html">👁️ Viewer</a>
            <a class="btn btn-outline" href="/modules/workflow/frontend/builder/index.html">🛠️ Builder</a>
        </div>';
    }

    if (strpos($name, 'facebook') !== false) {
        return '<div style="margin-top: var(--spacing-md);">
            <a class="btn btn-primary" href="' . url('pages/modules/analyse-intention-config.php') . '">⚙️ Configurer</a>
        </div>';
    }

    if (strpos($name, 'ugap') !== false) {
        return '<div style="margin-top: var(--spacing-md);">
            <a class="btn btn-primary" href="' . url('pages/modules/ugap.php') . '">🚀 Ouvrir UGAP</a>
        </div>';
    }

    if (strpos($name, 'chat') !== false) {
        return '<div style="margin-top: var(--spacing-md);">
            <a class="btn btn-primary" href="' . url('pages/modules/chat.php') . '">💬 Discuter</a>
        </div>';
    }

    if (strpos($name, 'document') !== false) {
        return '<div style="display:flex; gap: var(--spacing-sm); flex-wrap: wrap; margin-top: var(--spacing-md);">
            <a class="btn btn-outline" href="' . url('pages/modules/document-agent/index.php') . '">📄 V1 (Ancien)</a>
            <a class="btn btn-outline" href="https://www.gdri.fr/doc-template/" target="_blank">🚀 V2 (Externe)</a>
            <a class="btn btn-primary" href="' . url('pages/modules/doc-template-v3/index.php') . '">✨ V3 (Intégré)</a>
        </div>';
    }

    return '<div style="margin-top: var(--spacing-md);">
        <a class="btn btn-primary" href="' . url('pages/modules.php') . '">Accéder</a>
    </div>';
}

// Token JWT pour les appels API
$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();
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
                <h2>Console plateforme GDRI</h2>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-icon">🏢</div>
                    <h3 class="card-title">Entités</h3>
                    <p class="card-description">
                        Gérer les entreprises clientes et leurs modules autorisés
                    </p>
                    <a class="btn btn-primary" style="margin-top: var(--spacing-md);" href="<?php echo url('pages/entities.php'); ?>">
                        Gérer les entités
                    </a>
                </div>

                <div class="card">
                    <div class="card-icon">📱</div>
                    <h3 class="card-title">Applications</h3>
                    <p class="card-description">
                        Catalogue global des applications disponibles sur la plateforme
                    </p>
                    <a class="btn btn-primary" style="margin-top: var(--spacing-md);" href="<?php echo url('pages/platform-applications.php'); ?>">
                        Voir le catalogue
                    </a>
                </div>

                <div class="card">
                    <div class="card-icon">🔌</div>
                    <h3 class="card-title">Connecteurs</h3>
                    <p class="card-description">
                        Presets mail, Facebook et autres canaux globaux
                    </p>
                    <a class="btn btn-primary" style="margin-top: var(--spacing-md);" href="<?php echo url('pages/platform-connecteurs.php'); ?>">
                        Ouvrir les connecteurs
                    </a>
                </div>

                <div class="card">
                    <div class="card-icon">⚙️</div>
                    <h3 class="card-title">Structurel</h3>
                    <p class="card-description">
                        Serveurs IA plateforme, sauvegardes globales et infra partagée
                    </p>
                    <a class="btn btn-primary" style="margin-top: var(--spacing-md);" href="<?php echo url('pages/platform-structurel.php'); ?>">
                        Ouvrir le structurel
                    </a>
                </div>
                
                <div class="card">
                    <div class="card-icon">👥</div>
                    <h3 class="card-title">Utilisateurs</h3>
                    <p class="card-description">
                        Vue globale de tous les comptes plateforme
                    </p>
                    <a class="btn btn-primary" style="margin-top: var(--spacing-md);" href="<?php echo url('pages/platform-users.php'); ?>">
                        Voir les utilisateurs
                    </a>
                </div>
            </div>
            
        <?php elseif ($userRole === 'ADMIN_ENTITY'): ?>
            <!-- Dashboard Admin Entité -->
            <div class="section-title">
                <h2>Gestion de votre Entité</h2>
            </div>
            
            <div class="hub-cards-grid">
                <div class="card">
                    <div class="card-icon">🏢</div>
                    <h3 class="card-title">Console entité</h3>
                    <p class="card-description">
                        Applications, agents, utilisateurs, connecteurs et infrastructure partagée
                    </p>
                    <a class="btn btn-primary" style="margin-top: var(--spacing-md);" href="<?php echo url('pages/entity-applications.php'); ?>">
                        Ouvrir la console
                    </a>
                </div>
            </div>

            <div class="section-title" style="margin-top: var(--spacing-xxl);">
                <h2>Applications autorisées</h2>
            </div>

            <div class="hub-cards-grid">
                <?php if (empty($authorizedServices)): ?>
                    <div class="card">
                        <div class="card-icon">🧩</div>
                        <h3 class="card-title">Aucune application autorisée</h3>
                        <p class="card-description">
                            Contactez l'administrateur GDRI pour activer des applications.
                        </p>
                    </div>
                <?php else: ?>
                    <?php foreach ($authorizedServices as $service): ?>
                        <div class="card">
                            <div class="card-icon"><?php echo escape($service['icon'] ?? '🧩'); ?></div>
                            <h3 class="card-title"><?php echo escape($service['name'] ?? 'Module'); ?></h3>
                            <p class="card-description">
                                <?php echo escape($service['description'] ?? ''); ?>
                            </p>
                            <?php echo renderModuleLinks($service, $userRole); ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
            
        <?php else: ?>
            <!-- Dashboard Utilisateur -->
            <div class="section-title">
                <h2>Vos Services</h2>
            </div>
            
            <div class="hub-cards-grid">
                <?php if (empty($authorizedServices)): ?>
                    <div class="card">
                        <div class="card-icon">🧩</div>
                        <h3 class="card-title">Aucun module autorisé</h3>
                        <p class="card-description">
                            Contactez votre administrateur pour activer des modules.
                        </p>
                    </div>
                <?php else: ?>
                    <?php foreach ($authorizedServices as $service): ?>
                        <div class="card">
                            <div class="card-icon"><?php echo escape($service['icon'] ?? '🧩'); ?></div>
                            <h3 class="card-title"><?php echo escape($service['name'] ?? 'Module'); ?></h3>
                            <p class="card-description">
                                <?php echo escape($service['description'] ?? ''); ?>
                            </p>
                            <?php echo renderModuleLinks($service, $userRole); ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
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

<!-- Modal de configuration des services -->
<?php require_once '../includes/modals/service-setup-modal.php'; ?>

<!-- Scripts -->
<script>
    // Variables globales pour le modal
    window.API_BASE_URL = '<?php echo $api_base_url; ?>';
    window.JWT_TOKEN = '<?php echo $jwt_token; ?>';
</script>
<script src="<?php echo url('assets/js/service-setup-modal.js'); ?>"></script>
<script>
    // Vérifier et afficher le modal au chargement de la page
    document.addEventListener('DOMContentLoaded', function() {
        // Attendre que le modal soit initialisé
        setTimeout(() => {
            if (window.serviceSetupModal) {
                window.serviceSetupModal.show();
            }
        }, 500); // Petit délai pour s'assurer que tout est chargé
    });
</script>

<?php require_once '../includes/footer.php'; ?>





