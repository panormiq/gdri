<?php
/**
 * LEGACY — ancien back-office UGAP (monolithe admin-legacy.js).
 * Ne plus étendre. Référence : modules/ugap/docs/onglet-parametrage/PLAN.md
 * Entrée v2 : /modules/ugap/frontend/parametrage/index.php
 */
$__ugapEmbedView = isset($_GET['ugapView']) && $_GET['ugapView'] === 'prompts' ? 'prompts' : 'parametrage';
$__ugapFrontendRoot = dirname(__DIR__);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>UGAP Admin (legacy) — Gestion des données</title>
    <link rel="stylesheet" href="/frontend/assets/css/variables.css">
    <link rel="stylesheet" href="/frontend/assets/css/main.css">
    <link rel="stylesheet" href="/modules/ugap/frontend/assets/css/ugap-templates.css?v=5">
    <style>
        body { background-color: #f5f7fa; }
        .container-xl { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 20px; }
        .btn { padding: 10px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s; }
        .btn-primary { background: var(--primary-color, #007bff); color: white; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-outline { background: transparent; border: 1px solid #ddd; }
        .btn-success { background: #28a745; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert-info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #eee; padding: 8px 10px; font-size: 14px; text-align: left; }
        th { background: #f7f7f7; font-weight: 600; }
        .badge { display: inline-block; padding: 4px 8px; background: #eef; color: #334; border-radius: 4px; font-size: 12px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; }
        .stat-card h3 { margin: 0 0 5px 0; font-size: 24px; color: var(--primary-color, #007bff); }
        .stat-card p { margin: 0; color: #666; font-size: 14px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #eee; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
        .tab.active { border-bottom-color: var(--primary-color, #007bff); color: var(--primary-color, #007bff); font-weight: 600; }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        body.ugap-embedded-mode #legacy-backoffice-card { min-height: 0; overflow: visible; }
        body.ugap-embedded-mode .tab-panel.active { min-height: 0; overflow: visible; padding-bottom: 48px; }
        .ugap-options-table-scroll {
            max-height: min(72vh, 900px);
            overflow-x: auto;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            background: #fff;
        }
        body.ugap-embedded-mode .ugap-options-table-scroll {
            max-height: min(70vh, calc(100vh - 220px));
        }
        .ugap-options-table-scroll #categories-table { margin-bottom: 0; }
        .ugap-options-table-scroll thead th {
            position: sticky;
            top: 0;
            z-index: 2;
            background: #f8f9fa;
            box-shadow: 0 1px 0 #dee2e6;
        }
        body.ugap-embedded-mode #import-workflow-section,
        body.ugap-embedded-mode #import-editor-section,
        body.ugap-embedded-mode .ugap-import-mino-wrap { overflow: visible; }
        #legacy-backoffice-card .tab-panel.active { overflow: visible; padding-bottom: 48px; }
        #import-workflow-section { overflow: visible; }
        .subtabs { display: flex; gap: 8px; margin: 0 0 14px 0; border-bottom: 1px solid #eee; padding-bottom: 8px; flex-wrap: wrap; }
        .subtab-btn { padding: 8px 14px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .subtab-btn.active { border-color: var(--primary-color, #007bff); color: #fff; background: var(--primary-color, #007bff); }
        .subtab-panel { display: none; }
        .subtab-panel.active { display: block; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; box-sizing: border-box; }
        .modal.active { display: flex; align-items: flex-start; justify-content: center; padding: 16px; overflow-y: auto; }
        .modal-content { background: white; border-radius: 8px; padding: 30px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header h2 { margin: 0; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .image-upload-area { border: 2px dashed #ddd; border-radius: 8px; padding: 40px; text-align: center; cursor: pointer; margin-top: 10px; }
        .image-upload-area:hover { border-color: var(--primary-color, #007bff); }
        .image-preview { max-width: 100%; max-height: 200px; border-radius: 6px; margin-top: 10px; }
        .config-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 10px; }
        .config-item:hover { background: #f9f9f9; }
        .color-picker { width: 100px; height: 40px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; }
        .color-preview { width: 40px; height: 40px; border: 2px solid #ddd; border-radius: 4px; display: inline-block; vertical-align: middle; margin-left: 10px; }
        .accordion { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
        .accordion-header { background: #f8f9fa; padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; transition: background 0.2s; }
        .accordion-header:hover { background: #e9ecef; }
        .accordion-header.active { background: #007bff; color: white; }
        .accordion-content { display: none; padding: 0; }
        .accordion-content.active { display: block; }
        .accordion-icon { transition: transform 0.3s; }
        .accordion-icon.rotated { transform: rotate(180deg); }
        .steps-container { display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap; }
        .step { flex: 1; min-width: 150px; padding: 12px; border-radius: 6px; text-align: center; cursor: pointer; transition: all 0.3s; border: 2px solid #ddd; }
        .step.disabled { background: #e9ecef; color: #6c757d; cursor: not-allowed; border-color: #dee2e6; }
        .step.completed { background: #28a745; color: white; border-color: #28a745; cursor: pointer; }
        .step.active { background: #007bff; color: white; border-color: #007bff; cursor: pointer; }
        .step:hover:not(.disabled) { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .step.completed:hover { background: #218838; box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3); }
        .step-number { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
        .step-label { font-size: 13px; }
        .ugap-legacy-banner {
            background: #fff3cd;
            color: #664d03;
            border: 1px solid #ffecb5;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .ugap-legacy-banner a { color: #0d6efd; font-weight: 600; }
        body.ugap-embedded-mode .ugap-legacy-banner--standalone { display: none; }
    </style>
</head>
<body>
    <header class="header" id="header">
        <div class="container">
            <div class="header-content">
                <div class="logo">
                    <a href="/frontend/pages/dashboard.php">
                        <img src="/frontend/assets/images/logo-gdri.png" alt="GDR-Innovation Logo">
                        <span class="logo-text">GDR-Innovation</span>
                    </a>
                </div>
                <nav class="nav" id="nav">
                    <ul class="nav-list">
                        <li><a href="/frontend/pages/dashboard.php" class="nav-link">Dashboard</a></li>
                        <li><a href="/frontend/pages/modules.php" class="nav-link">Modules</a></li>
                        <li><a href="/frontend/auth/logout.php" class="nav-link">Déconnexion</a></li>
                    </ul>
                </nav>
            </div>
        </div>
    </header>
    <div style="height: var(--header-height);"></div>

    <div class="container-xl">
        <div class="ugap-legacy-banner ugap-legacy-banner--standalone" role="status">
            <strong>Ancienne version</strong> — ce back-office est figé (legacy).
            <a href="/modules/ugap/frontend/parametrage/index.php">Ouvrir le paramétrage v2</a>
            ou
            <a href="/frontend/pages/modules/ugap.php?tab=parametrage">retour module UGAP</a>.
        </div>
        <div class="card" id="legacy-admin-hero-card" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <h1>UGAP Admin</h1>
                <p style="color: #666; margin: 0;">Gestion des modèles, configurations et options</p>
            </div>
            <div>
                <a href="/modules/ugap/frontend/index.html" class="btn btn-outline">Voir Configurateur</a>
                <button id="btn-import-mode" class="btn btn-outline">Mode import</button>
                <button id="btn-refresh" class="btn btn-primary">Rafraîchir</button>
            </div>
        </div>

        <div id="alert-container"></div>
        <div class="card" id="legacy-stats-card">
            <div class="stats" id="stats-container">
                <div class="stat-card">
                    <h3 id="stat-models">0</h3>
                    <p>Modèles</p>
                </div>
                <div class="stat-card">
                    <h3 id="stat-categories">0</h3>
                    <p>Vue métier</p>
                </div>
                <div class="stat-card">
                    <h3 id="stat-options">0</h3>
                    <p>Options</p>
                </div>
            </div>
        </div>

        <div class="card" id="legacy-backoffice-card">
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-navigation.php'; ?>

            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-import.php'; ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-famille.php'; ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-options.php'; ?>
            <?php if (is_file($__ugapFrontendRoot . '/partials/tabs/tab-categorie.php')) {
                require $__ugapFrontendRoot . '/partials/tabs/tab-categorie.php';
            } ?>
            <?php if (is_file($__ugapFrontendRoot . '/partials/tabs/tab-template-bateau.php')) {
                require $__ugapFrontendRoot . '/partials/tabs/tab-template-bateau.php';
            } ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-models.php'; ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-categories.php'; ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-structured.php'; ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-couplings.php'; ?>
            <?php require $__ugapFrontendRoot . '/partials/tabs/tab-prompts.php'; ?>
        </div>


    </div>

    <?php
    $ugapAssetV = static function (string $rel) use ($__ugapFrontendRoot): int {
        $path = $__ugapFrontendRoot . $rel;
        return is_file($path) ? (int) filemtime($path) : (int) time();
    };
    ?>
    <script src="/modules/ugap/frontend/assets/js/templates/ugap-view-templates.js?v=<?= $ugapAssetV('/assets/js/templates/ugap-view-templates.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/tabs/famille-state.js?v=<?= $ugapAssetV('/assets/js/tabs/famille-state.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js?v=<?= $ugapAssetV('/assets/js/shared/ugap-family-decision-group.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-family-draft-ui.js?v=<?= $ugapAssetV('/assets/js/shared/ugap-family-draft-ui.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-sortable-dnd.js?v=<?= $ugapAssetV('/assets/js/shared/ugap-sortable-dnd.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/tabs/categorie-tab-subcategories.js?v=<?= $ugapAssetV('/assets/js/tabs/categorie-tab-subcategories.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/tabs/categorie-tab.js?v=<?= $ugapAssetV('/assets/js/tabs/categorie-tab.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/boat-template-tree.js?v=<?= $ugapAssetV('/assets/js/shared/boat-template-tree.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/tabs/template-bateau-tab.js?v=<?= $ugapAssetV('/assets/js/tabs/template-bateau-tab.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-embed-layout.js?v=<?= $ugapAssetV('/assets/js/shared/ugap-embed-layout.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/admin/admin-legacy.js?v=<?= $ugapAssetV('/assets/js/admin/admin-legacy.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/shared/ugap-api.js?v=<?= $ugapAssetV('/assets/js/shared/ugap-api.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/import/import-models-step.js?v=<?= $ugapAssetV('/assets/js/import/import-models-step.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/import/import-workflow-steps.js?v=<?= $ugapAssetV('/assets/js/import/import-workflow-steps.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/import/import-minorations-step.js?v=<?= $ugapAssetV('/assets/js/import/import-minorations-step.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/import/import-validate-step.js?v=<?= $ugapAssetV('/assets/js/import/import-validate-step.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/import/import-workflow-shell.js?v=<?= $ugapAssetV('/assets/js/import/import-workflow-shell.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/import/import-list.js?v=<?= $ugapAssetV('/assets/js/import/import-list.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/tabs/famille-tab.js?v=<?= $ugapAssetV('/assets/js/tabs/famille-tab.js') ?>"></script>
    <script src="/modules/ugap/frontend/assets/js/admin/admin-boot.js?v=<?= $ugapAssetV('/assets/js/admin/admin-boot.js') ?>"></script>
</body>
</html>
