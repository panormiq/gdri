<?php
/**
 * Gestion des Modules d'une Entité - Admin GDRI
 * Fichier : pages/entity-modules.php
 * 
 * Permet d'attribuer les modules IA à une entité sur une page dédiée
 */

// Log ciblé pour diagnostiquer les erreurs 500 sur cette page
$entityModulesLogDir = __DIR__ . '/../logs';
if (!is_dir($entityModulesLogDir)) {
    @mkdir($entityModulesLogDir, 0777, true);
}
ini_set('log_errors', '1');
ini_set('display_errors', '0');
ini_set('error_log', $entityModulesLogDir . '/entity-modules-error.log');
error_reporting(E_ALL);
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error) {
        error_log('[entity-modules.php][fatal] ' . print_r($error, true));
    }
});

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';

// Seul ADMIN_GDRI peut accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$entityId = $_GET['entityId'] ?? '';
if (!preg_match('/^[a-f0-9]{24}$/i', $entityId)) {
    redirect(url('pages/entities.php'));
}

$successMessage = '';
$errorMessage = '';
$entity = null;
$services = [];
$selectedIds = [];

try {
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$token || !$apiBase) {
        throw new Exception('Session/API indisponible.');
    }
    $headers = [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ];
    $call = function($method, $url, $body = null) use ($headers) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($err) return ['ok' => false, 'message' => $err, 'data' => null];
        $decoded = json_decode((string)$raw, true);
        return ['ok' => $code >= 200 && $code < 300, 'message' => $decoded['message'] ?? null, 'data' => $decoded];
    };

    $entityResp = $call('GET', $apiBase . '/entities/' . urlencode($entityId));
    if (!$entityResp['ok']) {
        redirect(url('pages/entities.php'));
    }
    $entity = $entityResp['data']['data'] ?? null;
    if (!$entity) {
        redirect(url('pages/entities.php'));
    }

    $ctxResp = $call('GET', $apiBase . '/entities/context');
    if (!$ctxResp['ok']) {
        throw new Exception('Chargement des services impossible.');
    }
    $services = $ctxResp['data']['data']['services'] ?? [];
    usort($services, function($a, $b) {
        return strcmp($a['name'] ?? '', $b['name'] ?? '');
    });

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

    $servicesAuthorized = $entity['services_authorized'] ?? [];
    $selectedIds = array_map('strval', is_array($servicesAuthorized) ? $servicesAuthorized : []);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $submitted = $_POST['services_authorized'] ?? [];
        if (!is_array($submitted)) {
            $submitted = [];
        }
        $updateResp = $call('PUT', $apiBase . '/entities/' . urlencode($entityId) . '/services', [
            'services_authorized' => array_values($submitted)
        ]);
        if ($updateResp['ok']) {
            $successMessage = 'Modules mis à jour avec succès.';
            $entityResp = $call('GET', $apiBase . '/entities/' . urlencode($entityId));
            $entity = $entityResp['data']['data'] ?? $entity;
            $servicesAuthorized = $entity['services_authorized'] ?? [];
            $selectedIds = array_map('strval', is_array($servicesAuthorized) ? $servicesAuthorized : []);
        } else {
            $errorMessage = $updateResp['message'] ?: 'Erreur lors de la mise à jour des modules.';
        }
    }
} catch (Exception $e) {
    error_log('Erreur entity-modules.php: ' . $e->getMessage());
    $errorMessage = 'Erreur lors du chargement des modules. Veuillez réessayer.';
}

$page_title = 'Modules de l\'entité';
require_once '../includes/header.php';
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Modules de l'entité</h1>
            <p class="hero-description">
                <?= escape($entity['name'] ?? 'Entité'); ?>
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Attribuer les modules</h2>
            <a class="btn btn-outline" href="<?= url('pages/entities.php'); ?>">← Retour aux entités</a>
        </div>

        <?php if ($successMessage): ?>
            <div class="alert alert-success"><?= escape($successMessage); ?></div>
        <?php endif; ?>
        <?php if ($errorMessage): ?>
            <div class="alert alert-error"><?= escape($errorMessage); ?></div>
        <?php endif; ?>

        <form method="POST" class="modules-form">
            <?php if (empty($services)): ?>
                <div class="empty-state">
                    <p>Aucun module disponible.</p>
                </div>
            <?php else: ?>
                <div class="modules-grid">
                    <?php foreach ($services as $service): ?>
                        <?php $serviceId = (string) ($service['_id'] ?? ''); ?>
                        <label class="module-card" for="service-<?= escape($serviceId); ?>">
                            <div class="module-card-header">
                                <span class="module-icon"><?= escape($service['icon'] ?? '🧩'); ?></span>
                                <div class="module-title">
                                    <h3><?= escape($service['name'] ?? 'Module'); ?></h3>
                                    <p class="module-description"><?= escape($service['description'] ?? ''); ?></p>
                                </div>
                            </div>
                            <div class="module-toggle">
                                <input
                                    type="checkbox"
                                    id="service-<?= escape($serviceId); ?>"
                                    name="services_authorized[]"
                                    value="<?= escape($serviceId); ?>"
                                    <?= in_array($serviceId, $selectedIds, true) ? 'checked' : ''; ?>
                                >
                                <span class="toggle-label">Autorisé</span>
                            </div>
                        </label>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
        </form>
    </div>
</section>

<style>
.modules-form {
    margin-top: var(--spacing-lg);
}

.modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
}

.module-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border: 1px solid var(--color-light);
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.module-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.module-card-header {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-start;
}

.module-icon {
    font-size: 2.2rem;
}

.module-title h3 {
    margin: 0 0 var(--spacing-xs) 0;
    color: var(--color-primary);
}

.module-description {
    margin: 0;
    color: var(--color-gray);
    font-size: 0.95rem;
}

.module-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: 600;
}

.module-toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
}

.alert {
    padding: var(--spacing-md);
    border-radius: 6px;
    margin-bottom: var(--spacing-md);
}

.alert-success {
    background: #d4edda;
    color: #155724;
}

.alert-error {
    background: #f8d7da;
    color: #721c24;
}

.empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-gray);
}
</style>

<?php require_once '../includes/footer.php'; ?>

