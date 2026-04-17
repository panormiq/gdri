<?php
/**
 * Point d'entree UGAP backoffice
 * - 2 onglets : Configurateur / Parametrage
 * - Sans administration globale pour le moment
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'UGAP';
$activeTab = $_GET['tab'] ?? 'configurateur';
if (!in_array($activeTab, ['configurateur', 'parametrage'], true)) {
    $activeTab = 'configurateur';
}
$canManageUgap = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
if ($activeTab === 'parametrage' && !$canManageUgap) {
    $activeTab = 'configurateur';
}

require_once '../../includes/header.php';
?>

<section class="section">
    <div class="container">
        <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px;">
            <h2 style="margin:0;">Module UGAP</h2>
            <a class="btn btn-secondary" href="<?= url('pages/modules.php') ?>">Retour modules</a>
        </div>

        <div class="ugap-tabs">
            <a href="<?= url('pages/modules/ugap.php?tab=configurateur') ?>" class="ugap-tab <?= $activeTab === 'configurateur' ? 'is-active' : '' ?>">
                Configurateur
            </a>
            <a href="<?= url('pages/modules/ugap.php?tab=parametrage') ?>" class="ugap-tab <?= $activeTab === 'parametrage' ? 'is-active' : '' ?>">
                Parametrage
            </a>
        </div>

        <?php
        $viewByTab = [
            'configurateur' => __DIR__ . '/ugap-tab-configurateur.php',
            'parametrage' => __DIR__ . '/ugap-tab-parametrage.php',
        ];

        $selectedView = $viewByTab[$activeTab] ?? $viewByTab['configurateur'];
        require $selectedView;
        ?>
    </div>
</section>

<style>
.ugap-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.ugap-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #d6dbe6;
    text-decoration: none;
    color: var(--color-dark);
    background: #fff;
    font-weight: 600;
}

.ugap-tab:hover {
    border-color: var(--color-primary);
}

.ugap-tab.is-active {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);
}

.ugap-panel {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    padding: 0;
}

.ugap-panel--placeholder {
    padding: 20px;
}

.ugap-panel--placeholder h3 {
    margin-top: 0;
}

</style>

<?php require_once '../../includes/footer.php'; ?>
