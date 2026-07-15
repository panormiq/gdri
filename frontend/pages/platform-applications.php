<?php
/**
 * Console plateforme — Applications (catalogue serveur, lecture seule).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$services = [];
try {
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if ($token && $apiBase) {
        $ch = curl_init($apiBase . '/entities/context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300) {
            $decoded = json_decode((string) $raw, true);
            $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
        }
    }
} catch (Exception $e) {
    $services = [];
}

$application_items = buildPlatformApplicationHubItems($services);

$page_title = 'Applications';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Applications',
    'Modules installés sur le serveur GDRI. Cette vue ne lance pas les applications : l\'activation se fait entité par entité.'
);
?>

<?php renderConsoleSearchToolbar('Nom, slug, description…', 'platformAppsSearch'); ?>

<?php renderPlatformApplicationCatalog($application_items); ?>

<div id="platformAppsNoResult" class="entity-console-empty" style="display: none; margin-top: 1rem;">
    <p>Aucune application ne correspond à votre recherche.</p>
</div>

<p class="text-muted small" style="margin-top: 1.25rem;">
    Pour autoriser une application à une société, ouvrez
    <a href="<?= htmlspecialchars(url('pages/entities.php')) ?>">Entités</a>
    puis gérez les modules de l'entité concernée.
</p>

<style>
.entity-console-card--readonly {
    cursor: default;
}
.entity-console-card--readonly:hover {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transform: none;
}
.platform-app-card__slug {
    margin: 0 0 0.5rem;
    font-size: 0.82rem;
}
.platform-app-card__slug code {
    background: var(--color-light, #f0f0f0);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
}
.badge-success { background: #d4edda; color: #155724; }
.badge-secondary { background: #e9ecef; color: #495057; }
.badge-info { background: #d1ecf1; color: #0c5460; }
</style>

<?php
renderConsolePageClose();
renderPlatformApplicationCatalogScript();
require_once __DIR__ . '/../includes/footer.php';
