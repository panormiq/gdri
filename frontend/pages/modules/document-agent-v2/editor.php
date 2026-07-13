<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire V2 — Éditeur';
$templateNs = isset($_GET['template']) ? trim($_GET['template']) : 'ugap:devis:default';

$adv2CssPath = __DIR__ . '/assets/css/canvas-editor.css';
$extra_styles = [url('pages/modules/document-agent-v2/assets/css/canvas-editor.css') . '?v=' . (int) @filemtime($adv2CssPath)];
$adv2JsBase = __DIR__ . '/assets/js/';
$extra_scripts = [
    url('pages/modules/document-agent-v2/assets/js/api.js') . '?v=' . (int) @filemtime($adv2JsBase . 'api.js'),
    url('pages/modules/document-agent-v2/assets/js/fields-catalog.js') . '?v=' . (int) @filemtime($adv2JsBase . 'fields-catalog.js'),
    url('pages/modules/document-agent-v2/assets/js/snap-guides.js') . '?v=' . (int) @filemtime($adv2JsBase . 'snap-guides.js'),
    url('pages/modules/document-agent-v2/assets/js/canvas-editor.js') . '?v=' . (int) @filemtime($adv2JsBase . 'canvas-editor.js'),
];

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <div>
                <h1>Éditeur devis — canvas A4</h1>
                <p class="hero-description">
                    Déplacez les zones sur la page. Guides et aimants actifs (Alt pour désactiver).
                    Template : <code><?= htmlspecialchars($templateNs) ?></code>
                </p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-outline" href="<?= url('pages/modules/document-agent-v2/index.php'); ?>">← Retour</a>
                <button type="button" class="btn btn-outline" id="adv2-preview">Aperçu HTML</button>
                <button type="button" class="btn btn-primary" id="adv2-save">Enregistrer</button>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="adv2-toolbar">
            <button type="button" class="btn btn-outline btn-sm" id="adv2-reload">Recharger</button>
            <button type="button" class="btn btn-outline btn-sm" id="adv2-edit-guides">Éditer les guides</button>
            <button type="button" class="btn btn-outline btn-sm" id="adv2-toggle-guides">Masquer les guides</button>
            <span class="adv2-guide-tools" id="adv2-guide-tools" hidden>
                <button type="button" class="btn btn-outline btn-sm" id="adv2-guide-v">+ Guide vertical</button>
                <button type="button" class="btn btn-outline btn-sm" id="adv2-guide-h">+ Guide horizontal</button>
            </span>
        </div>
        <p id="adv2-guide-mode-banner" class="adv2-guide-mode-banner" hidden>
            Mode édition guides actif — glissez depuis la règle, déplacez les guides, ou saisissez la position en mm. Recliquez sur « Terminer édition guides » pour revenir à la mise en page.
        </p>
        <p id="adv2-status" class="adv2-status"></p>

        <div class="adv2-app">
            <aside class="adv2-panel">
                <div class="adv2-panel-head">
                    <h3>Arbre</h3>
                    <button type="button" class="btn btn-outline btn-sm" id="adv2-add-zone" title="Ajouter une zone libre">+ Zone</button>
                </div>
                <div id="adv2-tree"><p class="text-muted">Chargement…</p></div>
            </aside>

            <div class="adv2-canvas-wrap">
                <div class="adv2-stage-viewport">
                    <div class="adv2-stage-scaler adv2-page-zoom" id="adv2-stage-scaler" style="--adv2-zoom:0.85">
                        <div class="adv2-stage-grid">
                            <div class="adv2-ruler-corner" aria-hidden="true"></div>
                            <div class="adv2-ruler adv2-ruler-h" id="adv2-ruler-h" title="Glisser pour créer un guide vertical"></div>
                            <div class="adv2-ruler adv2-ruler-v" id="adv2-ruler-v" title="Glisser pour créer un guide horizontal"></div>
                            <div class="adv2-page" id="adv2-page"></div>
                        </div>
                    </div>
                </div>
            </div>

            <aside class="adv2-panel adv2-panel-side">
                <div class="adv2-side-tabs">
                    <button type="button" class="adv2-side-tab" data-tab="props">Propriétés</button>
                    <button type="button" class="adv2-side-tab is-active" data-tab="dim">Dim.</button>
                    <button type="button" class="adv2-side-tab" data-tab="fields">Champs</button>
                </div>
                <div id="adv2-props" class="adv2-props" hidden><p class="text-muted">Chargement…</p></div>
                <div id="adv2-dim" class="adv2-dim"></div>
                <div id="adv2-fields" hidden></div>
            </aside>
        </div>
    </div>
</section>

<script>
window.API_BASE_URL = window.API_BASE_URL || '<?= rtrim(API_BASE_URL, '/') ?>';
</script>

<?php require_once '../../../includes/footer.php'; ?>
