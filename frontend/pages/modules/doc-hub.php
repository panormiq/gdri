<?php
/**
 * Point d'entrée Doc-Hub — Mon espace (layout console).
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

$page_title = 'Doc-Hub';
$assetBase = '/modules/doc-hub/frontend';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

ob_start();
?>
<button type="button" class="btn btn-outline btn-sm" id="btn-manage-tags">Gérer les tags</button>
<?php
$docHubActions = ob_get_clean();

require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Doc-Hub',
    'GED par projet — photos du bien, DPE, partage sécurisé vers acheteurs et investisseurs.',
    ['actions' => $docHubActions]
);
?>

<link rel="stylesheet" href="<?= htmlspecialchars($assetBase) ?>/assets/css/doc-hub.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/doc-hub/frontend/assets/css/doc-hub.css') ?>">

<div class="doc-hub-app">
    <div id="view-list">
        <div class="doc-hub-toolbar">
            <button type="button" class="btn btn-primary" id="btn-new-project">+ Nouveau projet</button>
        </div>
        <div id="projects-list" class="doc-hub-list">Chargement…</div>
    </div>

    <div id="view-project" class="hidden">
        <div class="project-top">
            <button type="button" class="btn btn-outline btn-sm" id="btn-back-list">← Projets</button>
            <div class="project-top-titles">
                <h2 id="project-title"></h2>
                <p id="project-ref" class="text-muted"></p>
            </div>
        </div>

        <nav class="doc-hub-project-nav" aria-label="Sections du projet">
            <button type="button" class="doc-hub-nav-btn is-active" data-tab="documents" id="nav-tab-documents">
                Documents
            </button>
            <button type="button" class="doc-hub-nav-btn" data-tab="envois" id="nav-tab-envois">
                Envois
            </button>
        </nav>

        <div id="panel-documents" class="doc-hub-panel">
            <section class="doc-hub-section">
                <h3>Ajouter des documents</h3>
                <div class="form-row">
                    <select id="upload-slot" class="form-control"></select>
                    <input type="file" id="upload-files" class="form-control" multiple accept="image/*,application/pdf">
                    <button type="button" class="btn btn-primary" id="btn-upload">Envoyer</button>
                </div>
                <p class="text-muted small" style="margin-top:0.5rem">
                    Fichier stocké à l’identique (octets). Téléchargement en <strong>archive ZIP</strong> :
                    après <strong>Extraire tout</strong>, vérifiez la <strong>date de modification</strong> dans Propriétés
                    (souvent la date d’origine). Sous Windows, la <em>date de création</em> peut rester celle de l’extraction.
                </p>
                <div id="doc-hub-alerts" class="doc-hub-alerts" aria-live="assertive"></div>
            </section>
            <section class="doc-hub-section">
                <div class="section-head-row">
                    <h3>Liste des documents</h3>
                    <div class="doc-list-toolbar" id="doc-list-toolbar" hidden>
                        <button type="button" class="btn btn-outline btn-sm" id="btn-doc-select-all">Tout sélectionner</button>
                        <button type="button" class="btn btn-outline btn-sm" id="btn-doc-select-none">Tout désélectionner</button>
                        <button type="button" class="btn btn-outline btn-sm btn-doc-delete" id="btn-doc-delete-selected" disabled>
                            Supprimer la sélection
                        </button>
                    </div>
                </div>
                <div id="documents-list"></div>
            </section>
        </div>

        <div id="panel-envois" class="doc-hub-panel hidden">
            <section class="doc-hub-section">
                <div class="section-head-row">
                    <h3>Historique des envois</h3>
                    <div class="envois-head-actions">
                        <button type="button" class="btn btn-primary btn-sm" id="btn-new-envoi">+ Nouvel envoi</button>
                        <button type="button" class="btn btn-outline btn-sm" id="btn-refresh-envois">Actualiser</button>
                    </div>
                </div>
                <div id="envois-history">Chargement…</div>
            </section>
        </div>
    </div>

    <div id="status-toast" class="doc-hub-toast hidden"></div>

    <div id="upload-progress-overlay" class="doc-hub-upload-overlay hidden" aria-live="polite" aria-busy="true">
        <div class="doc-hub-upload-card">
            <div class="upload-spinner" aria-hidden="true"></div>
            <p class="upload-progress-title" id="upload-progress-title">Envoi des fichiers en cours…</p>
            <p class="upload-progress-detail" id="upload-progress-detail">Préparation…</p>
            <div class="upload-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="upload-progress-fill" id="upload-progress-fill"></div>
            </div>
            <p class="upload-progress-count text-muted small" id="upload-progress-count"></p>
        </div>
    </div>
</div>

<!-- Modal nouvel envoi -->
<div id="modal-envoi" class="doc-hub-modal hidden" role="dialog" aria-labelledby="modal-envoi-title" aria-modal="true">
    <div class="doc-hub-modal-backdrop" data-close-envoi></div>
    <div class="doc-hub-modal-panel doc-hub-modal-panel--wide">
        <header class="doc-hub-modal-header">
            <h2 id="modal-envoi-title">Nouvel envoi</h2>
            <button type="button" class="btn btn-outline btn-sm" data-close-envoi aria-label="Fermer">×</button>
        </header>
        <div class="doc-hub-modal-body">
            <div class="form-group">
                <label for="diff-email">Email destinataire</label>
                <input type="email" id="diff-email" class="form-control" placeholder="acheteur@exemple.fr" autocomplete="email">
            </div>
            <div class="form-group">
                <label for="diff-subject">Objet</label>
                <input type="text" id="diff-subject" class="form-control" placeholder="Documents — pré-visite">
            </div>
            <div class="form-group">
                <label for="diff-message">Message</label>
                <textarea id="diff-message" class="form-control" rows="3" placeholder="Message accompagnant le mail…"></textarea>
            </div>
            <div class="form-row form-row--modal">
                <div class="form-group">
                    <label for="diff-ttl">Durée du lien (jours)</label>
                    <input type="number" id="diff-ttl" class="form-control" value="7" min="1" max="90">
                </div>
            </div>
            <div class="form-group">
                <label class="diff-check">
                    <input type="checkbox" id="diff-group-link" checked>
                    Un seul lien (archive ZIP — dates des fichiers conservées à l’extraction)
                </label>
            </div>
            <p class="text-muted small" style="margin-bottom:0.35rem">Documents à inclure :</p>
            <div class="diff-picker-toolbar">
                <button type="button" class="btn btn-outline btn-sm" id="btn-select-all-docs">Tout sélectionner</button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-select-none-docs">Tout désélectionner</button>
            </div>
            <div id="diff-doc-picker" class="diff-doc-picker-box"></div>
        </div>
        <footer class="doc-hub-modal-footer">
            <button type="button" class="btn btn-outline btn-sm" data-close-envoi>Annuler</button>
            <button type="button" class="btn btn-success btn-sm" id="btn-send-diff">Envoyer le mail</button>
        </footer>
    </div>
</div>

<!-- Modal gestion tags -->
<div id="modal-tags" class="doc-hub-modal hidden" role="dialog" aria-labelledby="modal-tags-title">
    <div class="doc-hub-modal-backdrop" data-close-tags></div>
    <div class="doc-hub-modal-panel">
        <header class="doc-hub-modal-header">
            <h2 id="modal-tags-title">Gérer les tags</h2>
            <button type="button" class="btn btn-outline btn-sm" data-close-tags>×</button>
        </header>
        <div class="doc-hub-modal-body">
            <form id="form-new-tag" class="tag-form-new">
                <input type="text" id="new-tag-label" class="form-control" placeholder="Nouveau tag (libellé)" required>
                <input type="color" id="new-tag-color" value="#6c757d" title="Couleur">
                <button type="submit" class="btn btn-primary btn-sm">Ajouter</button>
            </form>
            <ul id="tags-crud-list" class="tags-crud-list"></ul>
        </div>
    </div>
</div>

<script>
window.DOC_HUB_CONFIG = {
    apiBase: <?= json_encode($api_base_url, JSON_UNESCAPED_UNICODE) ?>,
    jwt: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>
};
</script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/doc-hub-app.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/doc-hub/frontend/assets/js/doc-hub-app.js') ?>"></script>

<?php
renderConsoleLayoutEnd();
require_once '../../includes/footer.php';
?>
