<?php
/**
 * Tests agent Facebook — dataset intentions
 * Fichier : pages/modules/facebook-agent-tests.php
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Tests agent Facebook';
require_once '../../includes/header.php';

if (!hasRole(ROLE_ADMIN_GDRI) && empty($currentEntreprise)) {
    echo '<script>
        alert("Veuillez sélectionner une entreprise avant d\'accéder à cette page.");
        window.location.href = "' . url('pages/dashboard.php') . '";
    </script>';
    exit;
}

$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();
?>

<link rel="stylesheet" href="<?= url('assets/css/facebook-dataset-tests.css') ?>">

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Tests de détection d'intention</h1>
            <p class="hero-description">
                Validez la configuration de l'agent Facebook sur le dataset de 1000 emails (aucun mail envoyé).
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="card">
            <div class="card-body">
                <div class="form-group">
                    <label for="facebookPageSelect">Page Facebook (config agent)</label>
                    <select id="facebookPageSelect" name="facebookPage" class="form-control" style="max-width: 400px;">
                        <option value="">Configuration par défaut (entreprise)</option>
                    </select>
                    <small class="form-text text-muted">
                        Le test utilise le prompt et les intentions de la page sélectionnée.
                    </small>
                </div>

                <div class="form-group dataset-test-section">
                    <h3>Dataset de test</h3>
                    <p class="form-text text-muted" style="margin-bottom: 12px;">
                        Les 10 emails rapides sont les <strong>10 premiers</strong> du dataset.
                        Le bouton aléatoire tire 10 emails parmi les 1000.
                    </p>
                    <div id="datasetTestProgressWrap" class="dataset-test-progress" style="display: none;">
                        <div class="dataset-test-progress-bar">
                            <div id="datasetTestProgressBar" class="dataset-test-progress-fill"></div>
                        </div>
                        <p id="datasetTestProgressText" class="dataset-test-progress-text">0 / 0</p>
                    </div>
                    <div id="datasetTestStatsWrap" class="dataset-test-stats" style="display: none;">
                        <p id="datasetTestStatsText" class="dataset-test-stats-text"></p>
                    </div>
                    <div id="datasetTestFailuresWrap" class="dataset-test-failures" style="display: none;">
                        <h4 id="datasetTestFailuresTitle" class="dataset-test-failures-title"></h4>
                        <div id="datasetTestFailuresList" class="dataset-test-failures-list"></div>
                    </div>
                    <div class="form-actions" style="margin-top: 0;">
                        <button type="button" class="btn btn-outline" id="testDataset10Btn">🧪 Tester 10 emails</button>
                        <button type="button" class="btn btn-outline" id="testDataset10RandomBtn">🎲 Tester 10 aléatoires</button>
                        <button type="button" class="btn btn-outline" id="testDatasetBtn">📧 Tester 1000 emails</button>
                        <button type="button" class="btn btn-primary" id="downloadDatasetResultsBtn" style="display: none;">⬇️ Télécharger les résultats JSON</button>
                        <button type="button" class="btn btn-outline" id="testConnectionBtn">🔌 Tester la connexion IA</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<script>
window.FB_DATASET_TESTS_CONFIG = {
    apiBaseUrl: <?= json_encode($api_base_url) ?>,
    jwtToken: <?= json_encode($jwt_token) ?>
};
</script>
<script src="<?= url('assets/js/facebook/dataset-tests.js') ?>"></script>

<?php require_once '../../includes/footer.php'; ?>
