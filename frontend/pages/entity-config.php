<?php
/**
 * Configuration de l'entité – Paramètres (Structurel / Connecteurs).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
    redirect(url('pages/dashboard.php'));
}

$configTabs = ['structurel', 'connecteurs'];
$activeTab = isset($_GET['tab']) ? strtolower(trim((string) $_GET['tab'])) : 'structurel';
if (!in_array($activeTab, $configTabs, true)) {
    $activeTab = 'structurel';
}

$structural_items = buildStructuralHubItems();
$connector_items = buildConnectorHubItems();

$page_title = 'Paramètres';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container" style="max-width: 1200px; margin: 2rem auto; padding: 0 1rem;">
    <div style="margin-bottom: 1.5rem;">
        <h1>Paramètres</h1>
        <p style="color: #666; font-size: 1.05em;">
            Infrastructure technique et connecteurs. Le reste est dans
            <a href="<?= url('pages/entity-legacy.php') ?>">Legacy</a> le temps de la migration.
        </p>
    </div>

    <div class="entity-config-tabs">
        <a href="<?= url('pages/entity-config.php?tab=structurel') ?>" class="entity-config-tab <?= $activeTab === 'structurel' ? 'is-active' : '' ?>">
            Structurel
        </a>
        <a href="<?= url('pages/entity-config.php?tab=connecteurs') ?>" class="entity-config-tab <?= $activeTab === 'connecteurs' ? 'is-active' : '' ?>">
            Connecteurs
        </a>
    </div>

    <?php if ($activeTab === 'structurel'): ?>
    <div class="entity-config-panel">
        <p class="entity-config-panel__intro text-muted">
            Infrastructure partagée par les applications et agents. Le service Prompt est intégré au serveur IA (aucune carte séparée).
        </p>
        <div class="hub-cards-grid">
            <?php foreach ($structural_items as $item): ?>
            <div class="card entity-config-card"
                 data-url="<?= htmlspecialchars($item['url']) ?>">
                <div class="entity-config-card__inner entity-config-card__inner--structurel">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 2.2em;"><?= $item['icon'] ?></span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem;"><?= htmlspecialchars($item['title']) ?></h2>
                            <p style="margin: 0.35rem 0 0 0; font-size: 0.9em; color: #666; line-height: 1.3em;">
                                <?= htmlspecialchars($item['description']) ?>
                            </p>
                        </div>
                    </div>
                    <p class="text-muted small" style="margin: 0.85rem 0 0;">Cliquer pour configurer</p>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php else: ?>
    <div class="entity-config-panel">
        <p class="entity-config-panel__intro text-muted">
            Canaux d'entrée et de sortie vers vos agents IA. Pour le mail : un compte = email + mot de passe + serveurs IMAP (réception) et SMTP (envoi).
        </p>
        <div class="hub-cards-grid">
            <?php foreach ($connector_items as $item): ?>
            <div class="card entity-config-card entity-config-card--<?= htmlspecialchars($item['kind'] ?? 'connector') ?>"
                 data-url="<?= htmlspecialchars($item['url']) ?>">
                <div class="entity-config-card__inner entity-config-card__inner--connecteur">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 2.2em;"><?= $item['icon'] ?></span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem;"><?= htmlspecialchars($item['title']) ?></h2>
                            <p style="margin: 0.35rem 0 0 0; font-size: 0.9em; color: #666; line-height: 1.3em;">
                                <?= htmlspecialchars($item['description']) ?>
                            </p>
                        </div>
                    </div>
                    <p class="text-muted small" style="margin: 0.85rem 0 0;">Cliquer pour configurer</p>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>
</div>

<style>
.entity-config-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 0.5rem;
}
.entity-config-tab {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: 6px 6px 0 0;
    text-decoration: none;
    color: #495057;
    font-weight: 600;
    border: 1px solid transparent;
    border-bottom: none;
    margin-bottom: -1px;
}
.entity-config-tab:hover { color: #0d6efd; background: #f8f9fa; }
.entity-config-tab.is-active {
    color: #0d6efd;
    background: #fff;
    border-color: #dee2e6;
    border-bottom-color: #fff;
}
.entity-config-panel__intro { margin-bottom: 1.25rem; }
.entity-config-empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
    background: #f8f9fa;
    border: 1px dashed #ced4da;
    border-radius: 10px;
    color: #495057;
}
.entity-config-empty p { margin: 0 0 0.75rem; }
.entity-config-card {
    cursor: pointer;
    border-radius: 10px;
    overflow: hidden;
    height: 100%;
    transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.entity-config-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
}
.entity-config-card__inner {
    background: #fff;
    border: 1px solid #e9ecef;
    padding: 1.1rem 1.25rem;
    height: 100%;
}
.entity-config-card__inner--structurel {
    border-bottom: 3px solid #3949ab;
}
.entity-config-card__inner--connecteur {
    border-bottom: 3px solid #198754;
}
</style>

<script>
(function() {
    document.querySelectorAll('.entity-config-card').forEach(function(card) {
        card.addEventListener('click', function() {
            var url = card.getAttribute('data-url');
            if (url && url !== '#') window.location.href = url;
        });
    });
})();
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
