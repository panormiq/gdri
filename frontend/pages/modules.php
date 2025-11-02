<?php
/**
 * Gestion des Modules - Admin GDRI
 * Fichier : pages/modules.php
 * 
 * Permet d'installer et gérer les modules IA
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

// Seul ADMIN_GDRI peut accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Gestion des Modules';

require_once '../includes/header.php';

// Récupérer tous les services/modules
$db = getDatabase();
$servicesCollection = $db->services;
$services = $servicesCollection->find([])->toArray();
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Gestion des Modules</h1>
            <p class="hero-description">
                Installez et configurez les modules IA disponibles sur la plateforme
            </p>
        </div>
    </div>
</section>

<!-- Section Liste des Modules -->
<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Modules disponibles</h2>
            <button class="btn btn-primary" id="installModuleBtn" disabled>+ Installer un module</button>
            <small class="text-muted">Fonctionnalité à venir</small>
        </div>
        
        <div class="modules-grid">
            <?php if (empty($services)): ?>
                <div class="empty-state">
                    <p>Aucun module disponible.</p>
                </div>
            <?php else: ?>
                <?php foreach ($services as $service): ?>
                    <div class="module-card">
                        <div class="module-icon-large">
                            <?= htmlspecialchars($service['icon']) ?>
                        </div>
                        
                        <div class="module-header">
                            <h3><?= htmlspecialchars($service['name']) ?></h3>
                            <span class="module-status <?= $service['status'] === 'active' ? 'active' : 'inactive' ?>">
                                <?= $service['status'] === 'active' ? 'Actif' : 'Inactif' ?>
                            </span>
                        </div>
                        
                        <p class="module-description">
                            <?= htmlspecialchars($service['description']) ?>
                        </p>
                        
                        <div class="module-actions">
                            <button class="btn btn-outline toggle-module" data-module-id="<?= htmlspecialchars((string) $service['_id']) ?>">
                                <?= $service['status'] === 'active' ? 'Désactiver' : 'Activer' ?>
                            </button>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</section>

<!-- Style spécifique -->
<style>
.modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-lg);
}

.module-card {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid var(--color-light);
    text-align: center;
}

.module-icon-large {
    font-size: 4rem;
    margin-bottom: var(--spacing-md);
}

.module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
}

.module-header h3 {
    margin: 0;
    color: var(--color-primary);
}

.module-status {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
}

.module-status.active {
    background: #d4edda;
    color: #155724;
}

.module-status.inactive {
    background: #f8d7da;
    color: #721c24;
}

.module-description {
    color: var(--color-gray);
    margin-bottom: var(--spacing-md);
}

.module-actions {
    margin-top: var(--spacing-md);
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page modules chargée');
    // TODO: Ajouter la logique JavaScript
});
</script>

<?php require_once '../includes/footer.php'; ?>

