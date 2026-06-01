<?php
/**
 * Point d'entree UGAP backoffice
 * - Onglets : Configurateur / Parametrage / Prompts IA (import v2 = sous-onglets Paramétrage)
 * - Sans administration globale pour le moment
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'UGAP';
$canManageUgap = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$ugapTopTabs = ['configurateur', 'parametrage'];
if ($canManageUgap) {
    $ugapTopTabs[] = 'prompts-ia';
}
$activeTab = $_GET['tab'] ?? 'configurateur';
/* Import v2 = section Importation sous Paramétrage */
if ($activeTab === 'import') {
    $activeTab = 'parametrage';
    if (!isset($_GET['param_section'])) {
        $_GET['param_section'] = 'importation';
    }
}
if (!in_array($activeTab, $ugapTopTabs, true)) {
    $activeTab = 'configurateur';
}
if (($activeTab === 'parametrage' || $activeTab === 'prompts-ia') && !$canManageUgap) {
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
            <?php if ($canManageUgap): ?>
            <a href="<?= url('pages/modules/ugap.php?tab=prompts-ia') ?>" class="ugap-tab <?= $activeTab === 'prompts-ia' ? 'is-active' : '' ?>">
                Prompts IA
            </a>
            <?php endif; ?>
        </div>

        <div id="ugap-gdri-host" class="ugap-gdri-page" data-active-tab="<?= htmlspecialchars($activeTab, ENT_QUOTES, 'UTF-8') ?>">
        <?php
        $viewByTab = [
            'configurateur' => __DIR__ . '/ugap-tab-configurateur.php',
            'parametrage' => __DIR__ . '/ugap-tab-parametrage.php',
            'prompts-ia' => __DIR__ . '/ugap-tab-prompts-ia.php',
        ];

        $selectedView = $viewByTab[$activeTab] ?? $viewByTab['configurateur'];
        require $selectedView;
        ?>
        </div>
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
    overflow: visible;
    padding: 0;
}

/* Configurateur : une seule carte (page GDRI), pas de double cadre */
.ugap-panel--configurateur-embed {
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    padding: 0;
}

.ugap-panel--parametrage {
    padding: 0;
    overflow: visible;
}

.ugap-panel--placeholder {
    padding: 20px;
}

.ugap-panel--placeholder h3 {
    margin-top: 0;
}

/* Paramétrage + colonne rappel import (sticky au scroll de la page). */
.ugap-module-layout,
.ugap-import-embed-layout {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 14px;
    width: 100%;
    max-width: 100%;
    overflow: visible;
    position: relative;
    box-sizing: border-box;
}

.ugap-module-layout > .ugap-panel,
.ugap-import-embed-layout > .ugap-panel {
    position: relative;
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
}

#ugap-import-mino-recap-dock-host.ugap-mino-recap-dock {
    --ugap-recap-sticky-top: calc(var(--header-height, 120px) + 20px);
    --ugap-recap-dock-width: 280px;
    position: sticky;
    top: var(--ugap-recap-sticky-top);
    align-self: flex-start;
    flex: 0 0 var(--ugap-recap-dock-width);
    width: var(--ugap-recap-dock-width);
    max-width: min(var(--ugap-recap-dock-width), calc(100vw - 24px));
    z-index: 5;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #dbe3ea;
    border-radius: 10px;
    background: #f8fafc;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
    font-size: 13px;
    box-sizing: border-box;
    max-height: calc(100vh - var(--header-height, 120px) - 28px);
}

#ugap-import-mino-recap-dock-host[hidden] {
    display: none !important;
}

#ugap-import-mino-recap-dock-host .ugap-mino-recap-head {
    flex: 0 0 auto;
    position: sticky;
    top: 0;
    z-index: 3;
    padding: 14px 14px 10px;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
}

#ugap-import-mino-recap-dock-host .ugap-mino-recap-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 14px 14px;
    -webkit-overflow-scrolling: touch;
}

#ugap-import-mino-recap-dock-host .ugap-mino-recap-poste-title {
    display: block;
    margin: 0 0 6px;
    padding: 0 0 4px;
    font-size: 13px;
}

section.section:has(#ugap-import-embed-root),
section.section:has(#ugap-import-embed-root) .container {
    overflow: visible;
}

@media (max-width: 1100px) {
    .ugap-module-layout,
    .ugap-import-embed-layout {
        flex-wrap: wrap;
    }
    #ugap-import-mino-recap-dock-host.ugap-mino-recap-dock {
        flex: 1 1 100%;
        width: 100%;
        max-width: 100%;
        position: static;
        max-height: none;
    }
}

</style>

<?php
require_once __DIR__ . '/../../../modules/ugap/frontend/includes/gdri-embed.php';
ugap_print_enqueued_styles();
ugap_print_enqueued_scripts();
?>

<?php require_once '../../includes/footer.php'; ?>
