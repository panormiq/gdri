<?php
/**
 * Point d'entrée Import bancaire Oxygène — Mon espace (layout console).
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';
require_once '../../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$_SESSION['gdri_workspace_mode'] = 'user';

$page_title = 'Import bancaire Oxygène';
$assetBase = '/modules/banque/frontend';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Import bancaire Oxygène',
    '1) Upload PDF 2) Vérification / édition du tableau 3) Export CSV Oxygène.'
);
?>

<link rel="stylesheet" href="<?= htmlspecialchars($assetBase) ?>/assets/css/banque.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/banque/frontend/assets/css/banque.css') ?>">

<div class="bank-page-wide">
    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
        <input id="pdf-file" type="file" accept="application/pdf" class="form-control" style="max-width:420px;">
        <button id="btn-extract" class="btn btn-primary">Extraire opérations</button>
        <button id="btn-add-row" class="btn btn-outline">Ajouter une ligne</button>
        <button id="btn-export" class="btn btn-success" disabled>Exporter CSV Oxygène</button>
    </div>

    <div id="status-box" class="alert alert-secondary">En attente d'un fichier PDF.</div>

    <div class="bank-layout">
        <div class="pdf-pane">
            <h3>PDF source</h3>
            <iframe id="pdf-viewer" title="Aperçu PDF"></iframe>
        </div>
        <div class="table-pane">
            <h3>Opérations détectées (éditable)</h3>
            <div style="overflow:auto; max-height: 72vh; border:1px solid #ddd;">
                <table class="table table-sm table-striped" id="ops-table">
                    <colgroup>
                        <col style="width: 90px;">
                        <col style="width: 90px;">
                        <col style="width: auto;">
                        <col style="width: 90px;">
                        <col style="width: 90px;">
                        <col style="width: 38px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="col-date">Date opération</th>
                            <th class="col-date">Date valeur</th>
                            <th>Libellé opération</th>
                            <th class="col-amount">Montant débit</th>
                            <th class="col-amount">Montant crédit</th>
                            <th class="col-action"></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
window.BANQUE_CONFIG = {
    apiBase: <?= json_encode($api_base_url, JSON_UNESCAPED_UNICODE) ?>,
    jwt: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>
};
</script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/banque-app.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/banque/frontend/assets/js/banque-app.js') ?>"></script>

<?php
renderConsoleLayoutEnd();
require_once '../../includes/footer.php';
?>
