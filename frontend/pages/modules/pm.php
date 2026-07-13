<?php
/**
 * Point d'entrée PM — tableau Kanban + inbox mail.
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'PM';
$pmAssetBase = '/modules/pm/frontend';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

require_once '../../includes/header.php';
?>

<link rel="stylesheet" href="<?= htmlspecialchars($pmAssetBase) ?>/assets/css/pm.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/pm/frontend/assets/css/pm.css') ?>">

<div class="pm-shell">
    <div class="pm-topbar">
        <h1>PM — Gestion de projet</h1>
        <div class="pm-topbar-actions">
            <span id="pm-gderpi-badge" class="pm-compat-badge pm-compat-badge--off">GDERPI …</span>
            <span id="pm-annuaire-badge" class="pm-compat-badge pm-compat-badge--off">Annuaire …</span>
            <button type="button" class="btn btn-outline btn-sm" id="pm-btn-refresh">Actualiser</button>
            <button type="button" class="btn btn-primary btn-sm" id="pm-btn-poll">Récupérer les e-mails</button>
            <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline btn-sm">← Applications</a>
        </div>
    </div>

    <div class="pm-settings-bar">
        <label for="pm-settings-boutique">Boutique GDERPI par défaut (création devis) :</label>
        <select id="pm-settings-boutique" class="form-control form-control-sm d-inline-block" style="width:280px;margin:0 0.5rem;">
            <option value="">— Chargement… —</option>
        </select>
        <button type="button" class="btn btn-outline btn-sm" id="pm-btn-settings-save">Enregistrer</button>
        <span class="text-muted ms-2">Configurer la boîte mail via <a href="<?= url('pages/modules/mail-config.php') ?>">Mail → module PM</a> (ou héritage module mail).</span>
    </div>

    <div id="pm-board" class="pm-board">
        <div class="pm-empty">Chargement du tableau…</div>
    </div>
</div>

<div id="pm-detail-overlay" class="pm-detail-overlay" hidden>
    <div id="pm-detail-panel" class="pm-detail-panel"></div>
</div>

<div id="pm-link-devis-modal" class="pm-modal" hidden>
    <div class="pm-modal__backdrop" id="pm-link-devis-backdrop"></div>
    <div class="pm-modal__dialog">
        <header class="pm-modal__header">
            <h3 class="pm-modal__title">Lier un devis GDERPI</h3>
            <button type="button" class="btn btn-outline btn-sm" id="pm-link-devis-close">Fermer</button>
        </header>
        <div class="pm-modal__body">
            <input type="search" id="pm-link-devis-search" class="form-control" placeholder="Rechercher par numéro, objet, contact…">
            <ul id="pm-link-devis-list" class="pm-link-devis-list"></ul>
        </div>
    </div>
</div>

<script>
window.PM_CONFIG = {
    apiBase: <?= json_encode($api_base_url, JSON_UNESCAPED_UNICODE) ?>,
    apiBaseUrl: <?= json_encode($api_base_url, JSON_UNESCAPED_UNICODE) ?>,
    jwt: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>,
    jwtToken: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>,
    gderpiUrl: <?= json_encode(url('pages/modules/gderpi.php'), JSON_UNESCAPED_UNICODE) ?>,
    annuaireUrl: <?= json_encode(url('pages/modules/annuaire.php'), JSON_UNESCAPED_UNICODE) ?>
};
function pmGderpiDevisUrl(devisId) {
    var base = (window.PM_CONFIG || {}).gderpiUrl || '';
    if (!devisId) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'devis=' + encodeURIComponent(devisId);
}
</script>
<script src="<?= htmlspecialchars($pmAssetBase) ?>/assets/js/apiCall.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/pm/frontend/assets/js/apiCall.js') ?>"></script>
<script src="<?= htmlspecialchars($pmAssetBase) ?>/assets/js/pm-app.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/pm/frontend/assets/js/pm-app.js') ?>"></script>

<?php require_once '../../includes/footer.php'; ?>
