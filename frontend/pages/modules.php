<?php
/**
 * Gestion des Modules - Admin GDRI
 * Fichier : pages/modules.php
 * 
 * Permet d'installer et gérer les modules IA
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';

// Vue client : accessible aussi par ADMIN_GDRI
if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Modules disponibles';
$userRole = getUserRole();
$services = [];

require_once '../includes/header.php';

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
            $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
        }
    }
} catch (Exception $e) {
    $services = [];
}

// Supprimer les doublons éventuels (même slug ou même nom)
$uniqueServices = [];
$seenBySlug = [];
$seenByName = [];
foreach ($services as $service) {
    $slugKey = null;
    $nameKey = null;
    if (!empty($service['slug'])) {
        $slugKey = strtolower(trim($service['slug']));
    }
    if (!empty($service['name'])) {
        $nameKey = strtolower(trim($service['name']));
        $nameKey = preg_replace('/\s+/', ' ', $nameKey);
    }

    $existingKey = null;
    if ($slugKey && isset($seenBySlug[$slugKey])) {
        $existingKey = $seenBySlug[$slugKey];
    } elseif ($nameKey && isset($seenByName[$nameKey])) {
        $existingKey = $seenByName[$nameKey];
    }

    if ($existingKey !== null) {
        $existing = $uniqueServices[$existingKey] ?? null;
        $currentStatus = $existing['status'] ?? '';
        $newStatus = $service['status'] ?? '';
        if ($existing && $newStatus === 'active' && $currentStatus !== 'active') {
            $uniqueServices[$existingKey] = $service;
        } elseif ($existing && $currentStatus === $newStatus) {
            $currentCreated = $existing['created_at'] ?? null;
            $newCreated = $service['created_at'] ?? null;
            if ($newCreated instanceof MongoDB\BSON\UTCDateTime && $currentCreated instanceof MongoDB\BSON\UTCDateTime) {
                if ($newCreated->toDateTime() > $currentCreated->toDateTime()) {
                    $uniqueServices[$existingKey] = $service;
                }
            }
        }
        continue;
    }

    $key = $slugKey ?: ($nameKey ? preg_replace('/\s+/', '-', $nameKey) : (string) ($service['_id'] ?? uniqid('service_', true)));
    $uniqueServices[$key] = $service;
    if ($slugKey) {
        $seenBySlug[$slugKey] = $key;
    }
    if ($nameKey) {
        $seenByName[$nameKey] = $key;
    }
}

$services = array_values($uniqueServices);

// Le module ServerIA est un module de paramétrage/dépendance (pas d'UI utilisateur).
// On le masque dans la page "Modules" (catalogue d'usage).
$services = array_values(array_filter($services, function ($service) {
    $slug = isset($service['slug']) ? strtolower(trim((string) $service['slug'])) : '';
    $name = isset($service['name']) ? strtolower(trim((string) $service['name'])) : '';
    if ($slug === 'ia' || $slug === 'serveria') return false;
    if (strpos($name, 'serveur ia') !== false) return false;
    if (strpos($name, 'server ia') !== false) return false;
    if (strpos($name, 'serveria') !== false) return false;
    return true;
}));
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Gestion des Modules</h1>
            <p class="hero-description">
                Consultez et configurez les modules autorisés pour votre entreprise
            </p>
        </div>
    </div>
</section>

<!-- Section Liste des Modules -->
<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Modules autorisés</h2>
        </div>

        <?php if (hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY)): ?>
        <p class="text-muted small mb-3">En tant qu’admin, la configuration de l’entité (IA, mail, etc.) se fait dans <a href="<?= url('pages/entity-config.php') ?>">Configuration</a>.</p>
        <?php endif; ?>

        <div class="modules-grid">
            <?php if (empty($services)): ?>
                <div class="empty-state">
                    <p>Aucun module disponible.</p>
                </div>
            <?php else: ?>
                <?php foreach ($services as $service): ?>
                    <?php
                    $isChatModule = (stripos($service['name'], 'chat') !== false)
                        || (isset($service['slug']) && strtolower(trim((string) $service['slug'])) === 'chat');
                    $isUgapModule = (stripos($service['name'], 'ugap') !== false)
                        || (isset($service['slug']) && strtolower(trim((string) $service['slug'])) === 'ugap');
                    ?>
                    <?php if ($isChatModule): ?>
                    <a href="<?= url('pages/modules/chat.php') ?>" class="module-card module-card--chat-link">
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
                        <div class="module-actions module-actions--hint">
                            <span class="text-muted small">Cliquer pour ouvrir le chat</span>
                        </div>
                    </a>
                    <?php elseif ($isUgapModule): ?>
                    <a href="<?= url('pages/modules/ugap.php') ?>" class="module-card module-card--chat-link">
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
                        <div class="module-actions module-actions--hint">
                            <span class="text-muted small">Cliquer pour ouvrir UGAP</span>
                        </div>
                    </a>
                    <?php else: ?>
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
                            <?php if (stripos($service['name'], 'mail') !== false): ?>
                                <!-- Liens spécifiques pour le module Mail -->
                                <div class="module-links" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                                    <a href="<?= url('pages/modules/mail-config.php') ?>" class="btn btn-primary">
                                        ⚙️ Configuration
                                    </a>
                                    <a href="<?= url('pages/modules/mail-test.php') ?>" class="btn btn-outline">
                                        🧪 Test
                                    </a>
                                </div>
                            <?php elseif (stripos($service['name'], 'workflow') !== false): ?>
                                <!-- Liens spécifiques pour le module Workflow -->
                                <div class="module-links" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                                    <a href="/modules/workflow/frontend/viewer/index.html" class="btn btn-primary">
                                        👁️ Viewer
                                    </a>
                                    <a href="/modules/workflow/frontend/builder/index.html" class="btn btn-outline">
                                        🛠️ Builder
                                    </a>
                                </div>
                            <?php elseif ((isset($service['slug']) && $service['slug'] === 'ia') || stripos($service['name'], 'serveur ia') !== false): ?>
                                <!-- Module IA : LLMs entité (serveurs = Administration > Modules) -->
                                <div class="module-links" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                                    <a href="<?= url('pages/modules/ia-llms.php') ?>" class="btn btn-primary">
                                        📋 LLMs de l'entité
                                    </a>
                                </div>
                            <?php elseif (stripos($service['name'], 'facebook') !== false): ?>
                                <!-- Liens pour le module Facebook -->
                                <div class="module-links" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                                    <a href="<?= url('pages/modules/facebook-config.php') ?>" class="btn btn-primary">
                                        🔗 Connecter Facebook
                                    </a>
                                    <a href="<?= url('pages/modules/facebook-resume.php') ?>" class="btn btn-outline">
                                        📊 Résumé
                                    </a>
                                    <a href="<?= url('pages/modules/analyse-intention-config.php') ?>" class="btn btn-outline">
                                        ⚙️ Configurer l'agent IA
                                    </a>
                                    <a href="<?= url('pages/modules/ia-llms.php') ?>" class="btn btn-outline">
                                        📋 LLMs de l'entité
                                    </a>
                                    <a href="<?= url('pages/modules/facebook-publish.php') ?>" class="btn btn-outline">
                                        📝 Publier un post
                                    </a>
                                </div>
                            <?php elseif (stripos($service['name'], 'document') !== false): ?>
                                <!-- Liens pour le module Document : V1 (ancien), V2 (externe) et V3 (intégré) -->
                                <div class="module-links" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                                    <a href="<?= url('pages/modules/document-agent/index.php') ?>" class="btn btn-outline">
                                        📄 V1 (Ancien)
                                    </a>
                                    <a href="https://www.gdri.fr/doc-template/" target="_blank" class="btn btn-outline">
                                        🚀 V2 (Externe)
                                    </a>
                                    <a href="<?= url('pages/modules/doc-template-v3/index.php') ?>" class="btn btn-primary">
                                        ✨ V3 (Intégré)
                                    </a>
                                </div>
                            <?php else: ?>
                                <button class="btn btn-outline toggle-module" data-module-id="<?= htmlspecialchars((string) $service['_id']) ?>">
                                    <?= $service['status'] === 'active' ? 'Désactiver' : 'Activer' ?>
                                </button>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php endif; ?>
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

/* Carte Chat : toute la carte ouvre le chat (pas de boutons sur la grille modules) */
a.module-card--chat-link {
    text-decoration: none;
    color: inherit;
    display: block;
    transition: box-shadow 0.2s ease, transform 0.15s ease;
}
a.module-card--chat-link:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
}
.module-card--chat-link .module-actions--hint {
    text-align: center;
    margin-top: var(--spacing-md);
}

</style>

<?php require_once '../includes/footer.php'; ?>

