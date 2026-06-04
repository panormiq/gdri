<?php
require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

if (!isLoggedIn()) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Doc-Hub';
require_once '../../includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
?>

<div class="container doc-hub-app">
    <header class="doc-hub-header">
        <h1>Doc-Hub</h1>
        <div class="doc-hub-header-actions">
            <button type="button" class="btn btn-outline btn-sm" id="btn-manage-tags">Gérer les tags</button>
            <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline btn-sm">← Modules</a>
        </div>
    </header>

    <p class="doc-hub-intro">
        GED par projet — photos du bien, DPE, partage sécurisé vers acheteurs et investisseurs.
    </p>

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

<style>
.doc-hub-app { max-width: 720px; margin: 1rem auto; padding: 0 1rem 3rem; }
.doc-hub-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.doc-hub-header h1 { margin: 0; font-size: 1.5rem; }
.doc-hub-header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.doc-hub-intro { color: #555; font-size: 0.95rem; margin-bottom: 1rem; }
.doc-hub-toolbar { margin-bottom: 1rem; }
.doc-hub-list { display: flex; flex-direction: column; gap: 0.5rem; }
.doc-hub-card {
    border: 1px solid #ddd; border-radius: 8px; padding: 0.85rem 1rem;
    background: #fff; cursor: pointer; text-align: left; width: 100%;
}
.doc-hub-card:hover { border-color: #0d6efd; }
.project-top { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
.project-top-titles { flex: 1; min-width: 0; }
.project-top-titles h2 { margin: 0 0 0.2rem; font-size: 1.25rem; }
.doc-hub-project-nav {
    display: flex; gap: 0; margin-bottom: 1rem;
    border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background: #f8f9fa;
}
.doc-hub-nav-btn {
    flex: 1; padding: 0.65rem 1rem; border: none; background: transparent;
    font-size: 0.95rem; font-weight: 600; cursor: pointer; color: #555;
}
.doc-hub-nav-btn.is-active { background: #fff; color: #0d6efd; box-shadow: inset 0 -2px 0 #0d6efd; }
.doc-hub-panel { animation: docHubFade 0.15s ease; }
@keyframes docHubFade { from { opacity: 0; } to { opacity: 1; } }
.section-head-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.envois-head-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.envoi-card {
    border: 1px solid #e5e5e5; border-radius: 8px; padding: 0.85rem 1rem;
    margin-bottom: 0.65rem; background: #fff;
}
.envoi-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap; }
.envoi-status {
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    padding: 0.15rem 0.45rem; border-radius: 4px;
}
.envoi-status--sent { background: #d1e7dd; color: #0f5132; }
.envoi-status--failed { background: #f8d7da; color: #842029; }
.envoi-status--revoked { background: #e2e3e5; color: #41464b; }
.envoi-status--pending { background: #fff3cd; color: #664d03; }
.envoi-meta { font-size: 0.85rem; color: #666; margin: 0.35rem 0; }
.envoi-trace { font-size: 0.8rem; color: #444; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #eee; }
.envoi-actions { margin-top: 0.5rem; }
.doc-hub-section { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #eee; }
.doc-hub-panel > .doc-hub-section:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.doc-hub-section h3 { font-size: 1.1rem; margin-bottom: 0.75rem; }
.form-row { display: flex; flex-direction: column; gap: 0.5rem; }
.doc-list-toolbar { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.doc-item {
    display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem;
    padding: 0.65rem 0; border-bottom: 1px solid #f0f0f0;
}
.doc-item-select { flex-shrink: 0; padding-top: 0.2rem; }
.doc-item-select input { width: 1rem; height: 1rem; cursor: pointer; }
.doc-item-main { flex: 1; min-width: 140px; }
.doc-date-ok { color: #0f5132; }
.doc-date-warn { color: #856404; }
.doc-item-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex-shrink: 0; }
.doc-item-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; justify-content: flex-end; }
.btn-doc-delete { color: #b42318; border-color: #e7a1a7; white-space: nowrap; }
.btn-doc-delete:hover { color: #fff; background: #b42318; border-color: #b42318; }
.tag-chip {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.8rem;
    color: #fff; background: #6c757d;
}
.tag-chip button {
    border: none; background: transparent; color: inherit; cursor: pointer;
    padding: 0 0.15rem; font-size: 1rem; line-height: 1; opacity: 0.85;
}
.btn-tag-add {
    width: 28px; height: 28px; border-radius: 50%; border: 1px dashed #aaa;
    background: #f8f9fa; cursor: pointer; font-size: 1.1rem; line-height: 1;
}
.tag-picker-pop {
    position: absolute; z-index: 100; background: #fff; border: 1px solid #ddd;
    border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.12); padding: 0.35rem;
    min-width: 160px; max-height: 200px; overflow-y: auto;
}
.tag-picker-pop button {
    display: block; width: 100%; text-align: left; border: none; background: none;
    padding: 0.4rem 0.6rem; cursor: pointer; border-radius: 4px;
}
.tag-picker-pop button:hover { background: #f0f0f0; }
.diff-picker-toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.diff-check { display: flex; align-items: center; gap: 0.5rem; font-weight: normal; cursor: pointer; }
.diff-doc-row { display: block; padding: 0.35rem 0; }
.hidden { display: none !important; }
.doc-hub-toast {
    position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%);
    background: #333; color: #fff; padding: 0.6rem 1rem; border-radius: 8px;
    z-index: 9999; max-width: 90%;
}
.doc-hub-alerts { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
.doc-hub-alert {
    display: flex; align-items: flex-start; gap: 0.5rem; justify-content: space-between;
    padding: 0.65rem 0.75rem; border-radius: 8px; font-size: 0.9rem; line-height: 1.4;
    border: 1px solid transparent;
}
.doc-hub-alert p { margin: 0; flex: 1; word-break: break-word; }
.doc-hub-alert--error { background: #fef3f2; border-color: #fecdca; color: #912018; }
.doc-hub-alert--warn { background: #fffaeb; border-color: #fedf89; color: #7a2e0e; }
.doc-hub-alert--info { background: #eff8ff; border-color: #b2ddff; color: #175cd3; }
.doc-hub-alert-close {
    flex-shrink: 0; border: none; background: transparent; cursor: pointer;
    font-size: 1.25rem; line-height: 1; opacity: 0.7; padding: 0 0.15rem;
}
.doc-hub-alert-close:hover { opacity: 1; }
.doc-hub-upload-overlay {
    position: fixed; inset: 0; z-index: 10001;
    background: rgba(255,255,255,.75); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.doc-hub-upload-card {
    background: #fff; border-radius: 12px; padding: 1.5rem 1.75rem;
    box-shadow: 0 8px 32px rgba(0,0,0,.12); width: min(360px, 92vw); text-align: center;
}
.upload-spinner {
    width: 40px; height: 40px; margin: 0 auto 1rem;
    border: 3px solid #e8e8e8; border-top-color: #0d6efd;
    border-radius: 50%; animation: docHubSpin 0.85s linear infinite;
}
@keyframes docHubSpin { to { transform: rotate(360deg); } }
.upload-progress-title { margin: 0 0 0.35rem; font-weight: 600; font-size: 1rem; }
.upload-progress-detail { margin: 0 0 0.75rem; font-size: 0.9rem; color: #444; }
.upload-progress-bar {
    height: 8px; background: #eee; border-radius: 999px; overflow: hidden; margin-bottom: 0.5rem;
}
.upload-progress-fill {
    height: 100%; width: 0%; background: #0d6efd; border-radius: 999px;
    transition: width 0.25s ease;
}
.upload-progress-count { margin: 0; }
.doc-hub-modal { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; }
.doc-hub-modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.4); }
.doc-hub-modal-panel {
    position: relative; background: #fff; border-radius: 10px; width: min(420px, 94vw);
    max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;
    box-shadow: 0 8px 32px rgba(0,0,0,.18);
}
.doc-hub-modal-panel--wide { width: min(560px, 96vw); max-height: 90vh; }
.doc-hub-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee; }
.doc-hub-modal-header h2 { margin: 0; font-size: 1.15rem; }
.doc-hub-modal-body { padding: 1rem; overflow-y: auto; flex: 1; min-height: 0; }
.doc-hub-modal-footer {
    display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem;
    padding: 0.75rem 1rem; border-top: 1px solid #eee; background: #fafafa;
}
.doc-hub-modal .form-group { margin-bottom: 0.85rem; }
.doc-hub-modal .form-group label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; font-weight: 500; }
.diff-doc-picker-box {
    max-height: min(220px, 35vh); overflow-y: auto;
    border: 1px solid #e8e8e8; border-radius: 6px; padding: 0.35rem 0.65rem;
    background: #fafafa; margin-bottom: 0.25rem;
}
.form-row--modal .form-group { margin-bottom: 0; }
.tag-form-new { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; align-items: center; }
.tag-form-new .form-control { flex: 1; min-width: 120px; }
.tags-crud-list { list-style: none; padding: 0; margin: 0; }
.tags-crud-list li {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    padding: 0.5rem 0; border-bottom: 1px solid #f0f0f0;
}
.tags-crud-swatch { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
@media (min-width: 600px) {
    .form-row { flex-direction: row; align-items: center; }
    .form-row .form-control { flex: 1; }
}
</style>

<script>
(function () {
    var API = <?= json_encode($api_base_url) ?> + '/doc-hub';
    var JWT = <?= json_encode($jwt_token) ?>;
    var UPLOAD_BATCH_SIZE = 15;

    var currentProjectId = null;
    var currentProjectTab = 'documents';
    var slotTemplates = [];
    var projectDocuments = [];
    var tagCatalog = [];

    var toast = document.getElementById('status-toast');
    var modalTags = document.getElementById('modal-tags');
    var modalEnvoi = document.getElementById('modal-envoi');
    var uploadOverlay = document.getElementById('upload-progress-overlay');
    var toastHideTimer = null;

    function toastMsg(msg, isError, persistent) {
        if (isError || persistent) {
            showPersistentAlert(msg, isError ? 'error' : 'info');
            return;
        }
        toast.textContent = msg;
        toast.style.background = '#333';
        toast.classList.remove('hidden');
        if (toastHideTimer) clearTimeout(toastHideTimer);
        toastHideTimer = setTimeout(function () { toast.classList.add('hidden'); }, 4500);
    }

    function showPersistentAlert(msg, type) {
        var box = document.getElementById('doc-hub-alerts');
        if (!box || !msg) return;
        var el = document.createElement('div');
        el.className = 'doc-hub-alert doc-hub-alert--' + (type || 'error');
        var p = document.createElement('p');
        p.textContent = msg;
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'doc-hub-alert-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
        close.addEventListener('click', function () { el.remove(); });
        el.appendChild(p);
        el.appendChild(close);
        box.appendChild(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearAlerts() {
        var box = document.getElementById('doc-hub-alerts');
        if (box) box.innerHTML = '';
    }

    function setUploadProgress(opts) {
        var title = document.getElementById('upload-progress-title');
        var detail = document.getElementById('upload-progress-detail');
        var count = document.getElementById('upload-progress-count');
        var fill = document.getElementById('upload-progress-fill');
        var bar = fill && fill.parentElement;
        if (title) title.textContent = opts.title || 'Envoi des fichiers en cours…';
        if (detail) detail.textContent = opts.detail || '';
        if (count) count.textContent = opts.count || '';
        var pct = opts.percent != null ? Math.min(100, Math.max(0, opts.percent)) : 0;
        if (fill) fill.style.width = pct + '%';
        if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    function showUploadOverlay(show) {
        if (!uploadOverlay) return;
        uploadOverlay.classList.toggle('hidden', !show);
        document.body.style.overflow = show ? 'hidden' : '';
    }

    function api(path, options) {
        options = options || {};
        var headers = options.headers || {};
        headers['Authorization'] = 'Bearer ' + JWT;
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }
        return fetch(API + path, Object.assign({}, options, { headers: headers, credentials: 'include' }))
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, json: j }; }); });
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function formatSize(n) {
        if (!n) return '';
        if (n < 1024) return n + ' o';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
        return (n / (1024 * 1024)).toFixed(1) + ' Mo';
    }

    function formatDate(d) {
        if (!d) return '—';
        try {
            var dt = new Date(d);
            return dt.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return String(d);
        }
    }

    function formatDocDates(doc) {
        var capture = doc.captureDate || (doc.metadata && doc.metadata.captureDate);
        var source = doc.dateSource || (doc.metadata && doc.metadata.dateSource);
        if (capture) {
            var label = 'Date enregistrée';
            if (source === 'exif' || source === 'exif-client') label = 'Prise de vue (EXIF conservé)';
            else if (source === 'client-file') label = 'Date originale (votre fichier)';
            else if (source === 'filesystem') label = 'Date fichier';
            return '<span class="doc-date-ok">' + label + ' : ' + formatDate(capture) + '</span>' +
                '<br><span class="text-muted">Ajouté dans Doc-Hub le ' + formatDate(doc.uploadedAt) + '</span>';
        }
        if (doc.metadata && doc.metadata.exifPresent === false && doc.mimeType && doc.mimeType.indexOf('image/') === 0) {
            return '<span class="doc-date-warn">EXIF absent</span>' +
                '<br><span class="text-muted">Ajouté le ' + formatDate(doc.uploadedAt) + '</span>';
        }
        return '<span class="text-muted">Ajouté le ' + formatDate(doc.uploadedAt) + '</span>';
    }

    function statusLabel(status) {
        var map = { sent: 'Envoyé', failed: 'Échec', revoked: 'Révoqué', pending: 'En attente' };
        return map[status] || status || '—';
    }

    function setProjectTab(tab) {
        currentProjectTab = tab;
        document.querySelectorAll('.doc-hub-nav-btn').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
        });
        document.getElementById('panel-documents').classList.toggle('hidden', tab !== 'documents');
        document.getElementById('panel-envois').classList.toggle('hidden', tab !== 'envois');
        if (tab === 'envois') {
            refreshDiffDocPicker();
            loadDiffusions();
        }
    }

    function tagByCode(code) {
        return tagCatalog.find(function (t) { return t.code === code; });
    }

    function loadTags() {
        return api('/tags').then(function (res) {
            if (res.ok && res.json.success) {
                tagCatalog = res.json.data || [];
            }
            return tagCatalog;
        });
    }

    function showList() {
        document.getElementById('view-list').classList.remove('hidden');
        document.getElementById('view-project').classList.add('hidden');
        currentProjectId = null;
        loadProjects();
    }

    function showProject(id, openTab) {
        currentProjectId = id;
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-project').classList.remove('hidden');
        loadProjectDetail();
        loadTags().then(function () {
            loadDocuments();
            if (openTab === 'envois') setProjectTab('envois');
            else setProjectTab('documents');
        });
        loadSlots();
    }

    function loadProjects() {
        var projectsList = document.getElementById('projects-list');
        projectsList.textContent = 'Chargement…';
        api('/projects?limit=50').then(function (res) {
            if (!res.ok || !res.json.success) {
                projectsList.textContent = res.json.message || 'Erreur chargement';
                return;
            }
            var items = res.json.data || [];
            if (!items.length) {
                projectsList.innerHTML = '<p class="text-muted">Aucun projet. Créez-en un.</p>';
                return;
            }
            projectsList.innerHTML = items.map(function (p) {
                return '<button type="button" class="doc-hub-card" data-id="' + p._id + '">' +
                    '<strong>' + escapeHtml(p.title) + '</strong>' +
                    '<span class="text-muted">' + escapeHtml(p.reference || p.status || '') + '</span></button>';
            }).join('');
            projectsList.querySelectorAll('.doc-hub-card').forEach(function (btn) {
                btn.addEventListener('click', function () { showProject(btn.getAttribute('data-id')); });
            });
        });
    }

    function loadSlots() {
        api('/slot-templates').then(function (res) {
            if (!res.ok) return;
            slotTemplates = res.json.data || [];
            document.getElementById('upload-slot').innerHTML = slotTemplates.map(function (s) {
                return '<option value="' + escapeHtml(s.code) + '">' + escapeHtml(s.label) + '</option>';
            }).join('');
        });
    }

    function loadProjectDetail() {
        api('/projects/' + currentProjectId).then(function (res) {
            if (!res.ok) return;
            var p = res.json.data;
            document.getElementById('project-title').textContent = p.title;
            document.getElementById('project-ref').textContent = p.reference ? 'Réf. ' + p.reference : '';
        });
    }

    function renderTagChips(doc) {
        var codes = doc.tags || [];
        return codes.map(function (code) {
            var t = tagByCode(code);
            var label = t ? t.label : code;
            var color = t ? t.color : '#6c757d';
            return '<span class="tag-chip" style="background:' + escapeHtml(color) + '">' +
                escapeHtml(label) +
                '<button type="button" data-doc="' + doc._id + '" data-code="' + escapeHtml(code) + '" title="Retirer">×</button></span>';
        }).join('');
    }

    function saveDocumentTags(docId, tags) {
        return api('/documents/' + docId + '/tags', {
            method: 'PATCH',
            body: JSON.stringify({ tags: tags })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Erreur tags', true);
                return false;
            }
            var doc = projectDocuments.find(function (d) { return String(d._id) === String(docId); });
            if (doc) doc.tags = tags;
            return true;
        });
    }

    function openTagPicker(anchorBtn, docId) {
        closeTagPicker();
        var doc = projectDocuments.find(function (d) { return String(d._id) === String(docId); });
        if (!doc) return;

        var pop = document.createElement('div');
        pop.className = 'tag-picker-pop';
        var current = new Set(doc.tags || []);

        tagCatalog.forEach(function (t) {
            if (current.has(t.code)) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = t.label;
            btn.addEventListener('click', function () {
                var next = (doc.tags || []).concat([t.code]);
                saveDocumentTags(docId, next).then(function (ok) {
                    if (ok) {
                        doc.tags = next;
                        loadDocuments();
                    }
                    closeTagPicker();
                });
            });
            pop.appendChild(btn);
        });

        if (!pop.children.length) {
            var empty = document.createElement('p');
            empty.className = 'text-muted small';
            empty.style.padding = '0.4rem';
            empty.textContent = 'Tous les tags sont déjà appliqués';
            pop.appendChild(empty);
        }

        var rect = anchorBtn.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.top = (rect.bottom + 4) + 'px';
        pop.style.left = rect.left + 'px';
        pop.id = 'active-tag-picker';
        document.body.appendChild(pop);

        setTimeout(function () {
            document.addEventListener('click', onOutsidePicker, { once: true });
        }, 0);
    }

    function closeTagPicker() {
        var el = document.getElementById('active-tag-picker');
        if (el) el.remove();
    }

    function onOutsidePicker(e) {
        if (!e.target.closest('#active-tag-picker') && !e.target.closest('.btn-tag-add')) {
            closeTagPicker();
        }
    }

    function deleteDocumentById(id) {
        return api('/documents/' + id, { method: 'DELETE' }).then(function (res) {
            return { ok: res.ok, message: res.json.message };
        });
    }

    function deleteDocumentsByIds(ids) {
        if (!ids.length) return Promise.resolve({ ok: false });
        if (ids.length === 1) {
            return deleteDocumentById(ids[0]).then(function (r) {
                return { ok: r.ok, deleted: r.ok ? 1 : 0, message: r.message };
            });
        }
        return api('/projects/' + currentProjectId + '/documents/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ documentIds: ids })
        }).then(function (res) {
            var n = res.json.data && res.json.data.deleted != null ? res.json.data.deleted : 0;
            return { ok: res.ok, deleted: n, message: res.json.message };
        });
    }

    function updateDocDeleteToolbar() {
        var toolbar = document.getElementById('doc-list-toolbar');
        var bulkBtn = document.getElementById('btn-doc-delete-selected');
        if (!toolbar || !bulkBtn) return;
        var hasDocs = projectDocuments.length > 0;
        toolbar.hidden = !hasDocs;
        var checked = document.querySelectorAll('.doc-item-check:checked');
        bulkBtn.disabled = checked.length === 0;
        bulkBtn.textContent = checked.length
            ? 'Supprimer la sélection (' + checked.length + ')'
            : 'Supprimer la sélection';
    }

    function bindDocumentDeleteHandlers(container) {
        container.querySelectorAll('.btn-doc-delete[data-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-id');
                var doc = projectDocuments.find(function (d) { return String(d._id) === String(id); });
                var name = doc && doc.filename ? doc.filename : 'ce document';
                if (!confirm('Supprimer définitivement « ' + name + ' » ?\n\nLe fichier et les liens de téléchargement associés seront retirés.')) return;
                deleteDocumentById(id).then(function (res) {
                    if (!res.ok) {
                        toastMsg(res.message || 'Suppression impossible', true);
                        return;
                    }
                    toastMsg('Document supprimé');
                    loadDocuments();
                });
            });
        });
        container.querySelectorAll('.doc-item-check').forEach(function (cb) {
            cb.addEventListener('change', updateDocDeleteToolbar);
        });
    }

    function bindDocumentTagHandlers(container) {
        container.querySelectorAll('.btn-tag-add').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openTagPicker(btn, btn.getAttribute('data-doc'));
            });
        });
        container.querySelectorAll('.tag-chip button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var docId = btn.getAttribute('data-doc');
                var code = btn.getAttribute('data-code');
                var doc = projectDocuments.find(function (d) { return String(d._id) === docId; });
                if (!doc) return;
                var next = (doc.tags || []).filter(function (c) { return c !== code; });
                saveDocumentTags(docId, next).then(function (ok) { if (ok) loadDocuments(); });
            });
        });
    }

    function refreshDiffDocPicker() {
        var picker = document.getElementById('diff-doc-picker');
        if (!projectDocuments.length) {
            picker.innerHTML = '<p class="text-muted">Aucun document. Ajoutez-en dans l’onglet Documents.</p>';
            return;
        }
        picker.innerHTML = projectDocuments.map(function (d) {
            return '<label class="diff-doc-row"><input type="checkbox" name="diff-doc" value="' + d._id + '"> ' +
                escapeHtml(d.filename) + ' <small class="text-muted">(' + escapeHtml(d.slotCode) + ')</small></label>';
        }).join('');
    }

    function loadDocuments() {
        var el = document.getElementById('documents-list');
        el.textContent = 'Chargement…';
        api('/projects/' + currentProjectId + '/documents').then(function (res) {
            if (!res.ok) {
                el.textContent = 'Erreur';
                return;
            }
            projectDocuments = res.json.data || [];
            if (!projectDocuments.length) {
                el.innerHTML = '<p class="text-muted">Aucun document.</p>';
                updateDocDeleteToolbar();
                refreshDiffDocPicker();
                return;
            }
            el.innerHTML = projectDocuments.map(function (d) {
                var dateLine = formatDocDates(d);
                return '<div class="doc-item" data-id="' + d._id + '">' +
                    '<label class="doc-item-select" title="Sélectionner pour suppression">' +
                    '<input type="checkbox" class="doc-item-check" value="' + d._id + '"></label>' +
                    '<div class="doc-item-main"><strong>' + escapeHtml(d.filename) + '</strong><br>' +
                    '<small class="text-muted">' + escapeHtml(d.slotCode) + ' · ' + formatSize(d.size) +
                    (dateLine ? '<br>' + dateLine : '') + '</small></div>' +
                    '<div class="doc-item-actions">' +
                    '<div class="doc-item-tags">' + renderTagChips(d) +
                    '<button type="button" class="btn-tag-add" data-doc="' + d._id + '" title="Ajouter un tag">+</button></div>' +
                    '<button type="button" class="btn btn-outline btn-sm btn-doc-delete" data-id="' + d._id + '" title="Supprimer ce document">Supprimer</button>' +
                    '</div></div>';
            }).join('');
            bindDocumentTagHandlers(el);
            bindDocumentDeleteHandlers(el);
            updateDocDeleteToolbar();
            refreshDiffDocPicker();
        });
    }

    function loadDiffusions() {
        var el = document.getElementById('envois-history');
        el.textContent = 'Chargement…';
        api('/projects/' + currentProjectId + '/diffusions').then(function (res) {
            if (!res.ok) {
                el.innerHTML = '<p class="text-muted">Erreur chargement.</p>';
                return;
            }
            var items = res.json.data || [];
            if (!items.length) {
                el.innerHTML = '<p class="text-muted">Aucun envoi pour ce projet.</p>';
                return;
            }
            el.innerHTML = items.map(renderEnvoiCard).join('');
            el.querySelectorAll('.btn-revoke-envoi').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-id');
                    if (!confirm('Révoquer cet envoi ? Les liens de téléchargement ne fonctionneront plus.')) return;
                    api('/diffusions/' + id + '/revoke', { method: 'POST' }).then(function (r) {
                        if (!r.ok) toastMsg(r.json.message || 'Erreur', true);
                        else {
                            toastMsg('Envoi révoqué');
                            loadDiffusions();
                        }
                    });
                });
            });
        });
    }

    function renderEnvoiCard(item) {
        var st = item.status || 'pending';
        var trace = item.trace || {};
        var files = (item.documentPreview || []).map(function (f) { return escapeHtml(f.filename); }).join(', ');
        if ((item.documentsCount || 0) > (item.documentPreview || []).length) {
            files += '… (+' + ((item.documentsCount || 0) - (item.documentPreview || []).length) + ')';
        }
        var linkMode = item.linkMode === 'bundle' ? 'Lien unique (ZIP)' : 'Liens par fichier';
        var traceLines = (trace.links || []).map(function (l, i) {
            var exp = l.expiresAt ? formatDate(l.expiresAt) : '—';
            var revoked = l.revokedAt ? ' · révoqué' : '';
            var dl = (l.downloadCount || 0) + (l.maxDownloads != null ? '/' + l.maxDownloads : '') + ' téléchargement(s)';
            var type = l.type === 'bundle' ? 'Archive' : 'Fichier';
            return type + ' ' + (i + 1) + ' — exp. ' + exp + ' — ' + dl + revoked;
        }).join('<br>');

        var revokeBtn = st !== 'revoked'
            ? '<button type="button" class="btn btn-outline btn-sm btn-revoke-envoi" data-id="' + item._id + '">Révoquer les liens</button>'
            : '';

        return '<article class="envoi-card">' +
            '<div class="envoi-card-header">' +
            '<div><strong>' + escapeHtml(item.subject || 'Sans objet') + '</strong><br>' +
            '<span class="text-muted small">→ ' + escapeHtml(item.recipientEmail) + '</span></div>' +
            '<span class="envoi-status envoi-status--' + escapeHtml(st) + '">' + escapeHtml(statusLabel(st)) + '</span></div>' +
            '<p class="envoi-meta">Envoyé : ' + formatDate(item.sentAt || item.createdAt) +
            ' · ' + (item.documentsCount || 0) + ' doc(s) · ' + linkMode +
            (item.smtpProfileLabel || item.smtpProfile
                ? ' · Expéditeur : ' + escapeHtml(item.smtpProfileLabel || item.smtpProfile)
                : '') + '</p>' +
            (files ? '<p class="envoi-meta"><strong>Fichiers :</strong> ' + files + '</p>' : '') +
            (item.error ? '<p class="envoi-meta" style="color:#b42318">' + escapeHtml(item.error) + '</p>' : '') +
            '<div class="envoi-trace"><strong>Traçabilité liens</strong><br>' + (traceLines || '—') +
            (trace.totalDownloads != null ? '<br>Total téléchargements : ' + trace.totalDownloads : '') + '</div>' +
            '<div class="envoi-actions">' + revokeBtn + '</div></article>';
    }

    function renderTagsCrudList() {
        var ul = document.getElementById('tags-crud-list');
        if (!tagCatalog.length) {
            ul.innerHTML = '<li class="text-muted">Aucun tag</li>';
            return;
        }
        ul.innerHTML = tagCatalog.map(function (t) {
            return '<li><span><span class="tags-crud-swatch" style="background:' + escapeHtml(t.color) + '"></span> ' +
                escapeHtml(t.label) + ' <small class="text-muted">(' + escapeHtml(t.code) + ')</small></span>' +
                '<button type="button" class="btn btn-outline btn-sm btn-del-tag" data-id="' + t._id + '">Supprimer</button></li>';
        }).join('');
        ul.querySelectorAll('.btn-del-tag').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Supprimer ce tag ? Il sera retiré des documents.')) return;
                api('/tags/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function (res) {
                    if (!res.ok) toastMsg(res.json.message || 'Erreur', true);
                    else {
                        toastMsg('Tag supprimé');
                        loadTags().then(function () {
                            renderTagsCrudList();
                            if (currentProjectId) loadDocuments();
                        });
                    }
                });
            });
        });
    }

    function openEnvoiModal() {
        if (!currentProjectId) {
            toastMsg('Ouvrez un projet d’abord', true);
            return;
        }
        refreshDiffDocPicker();
        document.querySelectorAll('input[name="diff-doc"]').forEach(function (cb) { cb.checked = true; });
        modalEnvoi.classList.remove('hidden');
        var emailEl = document.getElementById('diff-email');
        if (emailEl) emailEl.focus();
    }

    function closeEnvoiModal() {
        modalEnvoi.classList.add('hidden');
    }

    document.getElementById('btn-manage-tags').addEventListener('click', function () {
        loadTags().then(function () {
            renderTagsCrudList();
            modalTags.classList.remove('hidden');
        });
    });
    modalTags.querySelectorAll('[data-close-tags]').forEach(function (el) {
        el.addEventListener('click', function () { modalTags.classList.add('hidden'); });
    });

    document.getElementById('btn-new-envoi').addEventListener('click', openEnvoiModal);
    modalEnvoi.querySelectorAll('[data-close-envoi]').forEach(function (el) {
        el.addEventListener('click', closeEnvoiModal);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modalEnvoi.classList.contains('hidden')) closeEnvoiModal();
    });
    document.getElementById('form-new-tag').addEventListener('submit', function (e) {
        e.preventDefault();
        var label = document.getElementById('new-tag-label').value.trim();
        var color = document.getElementById('new-tag-color').value;
        if (!label) return;
        api('/tags', {
            method: 'POST',
            body: JSON.stringify({ label: label, color: color })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Erreur', true);
                return;
            }
            document.getElementById('new-tag-label').value = '';
            toastMsg('Tag créé');
            loadTags().then(renderTagsCrudList);
        });
    });

    document.getElementById('btn-new-project').addEventListener('click', function () {
        var title = prompt('Titre du projet :');
        if (!title || !title.trim()) return;
        var reference = prompt('Référence (optionnel) :') || '';
        api('/projects', {
            method: 'POST',
            body: JSON.stringify({ title: title.trim(), reference: reference.trim() || null })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Erreur création', true);
                return;
            }
            toastMsg('Projet créé');
            showProject(res.json.data._id);
        });
    });

    document.getElementById('btn-back-list').addEventListener('click', showList);

    document.querySelectorAll('.doc-hub-nav-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setProjectTab(btn.getAttribute('data-tab'));
        });
    });
    document.getElementById('btn-refresh-envois').addEventListener('click', loadDiffusions);

    function buildClientFileMeta(fileList) {
        var meta = [];
        for (var i = 0; i < fileList.length; i++) {
            var f = fileList[i];
            meta.push({
                originalName: f.name,
                lastModified: f.lastModified,
                size: f.size
            });
        }
        return meta;
    }

    function parseUploadResponse(r) {
        return r.text().then(function (text) {
            var j = {};
            if (text) {
                try {
                    j = JSON.parse(text);
                } catch (e) {
                    j = { success: false, message: r.ok ? 'Réponse serveur invalide' : (text.slice(0, 120) || 'Erreur ' + r.status) };
                }
            }
            return { ok: r.ok, status: r.status, json: j };
        });
    }

    function uploadBatch(fileArr, slotCode) {
        var fd = new FormData();
        fd.append('slotCode', slotCode);
        for (var i = 0; i < fileArr.length; i++) fd.append('files', fileArr[i]);
        fd.append('clientFileMeta', JSON.stringify(buildClientFileMeta(fileArr)));
        return fetch(API + '/projects/' + currentProjectId + '/documents', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + JWT },
            body: fd,
            credentials: 'include'
        }).then(parseUploadResponse);
    }

    function runBatchedUpload(fileList, slotCode) {
        var files = Array.prototype.slice.call(fileList);
        var total = files.length;
        var batches = [];
        for (var i = 0; i < total; i += UPLOAD_BATCH_SIZE) {
            batches.push(files.slice(i, i + UPLOAD_BATCH_SIZE));
        }
        var uploaded = 0;
        var errors = [];
        var missingExifTotal = 0;

        showUploadOverlay(true);
        setUploadProgress({
            title: 'Envoi des fichiers en cours…',
            detail: 'Préparation de ' + total + ' fichier(s) en ' + batches.length + ' lot(s)',
            count: '0 / ' + total,
            percent: 0
        });

        function processBatch(batchIndex) {
            if (batchIndex >= batches.length) {
                showUploadOverlay(false);
                document.getElementById('upload-files').value = '';
                loadDocuments();
                if (errors.length) {
                    showPersistentAlert(
                        'Import terminé : ' + uploaded + ' / ' + total + ' fichier(s) envoyé(s).\n\n' +
                        errors.join('\n'),
                        'error'
                    );
                } else if (missingExifTotal > 0) {
                    showPersistentAlert(
                        uploaded + ' fichier(s) importé(s). Date de prise absente sur ' + missingExifTotal + ' image(s).',
                        'warn'
                    );
                    toastMsg(uploaded + ' fichier(s) importé(s)');
                } else {
                    toastMsg(uploaded + ' fichier(s) importé(s)');
                }
                return Promise.resolve();
            }

            var batch = batches[batchIndex];
            var batchStart = batchIndex * UPLOAD_BATCH_SIZE;
            var firstName = batch[0] && batch[0].name ? batch[0].name : '…';
            var lastName = batch[batch.length - 1] && batch[batch.length - 1].name
                ? batch[batch.length - 1].name : firstName;

            setUploadProgress({
                title: 'Envoi des fichiers en cours…',
                detail: 'Lot ' + (batchIndex + 1) + ' / ' + batches.length + ' — « ' + firstName + ' »' +
                    (batch.length > 1 ? ' … « ' + lastName + ' »' : ''),
                count: uploaded + ' / ' + total + ' (ce lot : ' + batch.length + ' fichier(s))',
                percent: total ? Math.round((uploaded / total) * 100) : 0
            });

            return uploadBatch(batch, slotCode).then(function (res) {
                if (!res.ok || !res.json.success) {
                    var msg = res.json.message || ('HTTP ' + res.status);
                    errors.push('Lot ' + (batchIndex + 1) + ' (' + batch.length + ' fichier(s)) : ' + msg);
                } else {
                    var added = res.json.data || [];
                    uploaded += added.length;
                    missingExifTotal += added.filter(function (d) {
                        return d.mimeType && d.mimeType.indexOf('image/') === 0 && !d.captureDate;
                    }).length;
                }
                setUploadProgress({
                    title: 'Envoi des fichiers en cours…',
                    detail: 'Lot ' + (batchIndex + 1) + ' / ' + batches.length + ' terminé',
                    count: uploaded + ' / ' + total,
                    percent: total ? Math.round((uploaded / total) * 100) : 100
                });
                return processBatch(batchIndex + 1);
            });
        }

        return processBatch(0).catch(function (err) {
            showUploadOverlay(false);
            console.error('Doc-Hub upload:', err);
            showPersistentAlert(
                'Erreur réseau après ' + uploaded + ' / ' + total + ' fichier(s). ' +
                'Vérifiez que le serveur Node est démarré, puis réessayez.',
                'error'
            );
        });
    }

    document.getElementById('btn-upload').addEventListener('click', function () {
        var files = document.getElementById('upload-files').files;
        if (!files.length) {
            toastMsg('Choisissez au moins un fichier', true);
            return;
        }
        if (!currentProjectId) {
            toastMsg('Ouvrez un projet avant d’ajouter des documents', true);
            return;
        }
        var btn = document.getElementById('btn-upload');
        btn.disabled = true;
        btn.textContent = 'Envoi…';
        clearAlerts();

        var slotCode = document.getElementById('upload-slot').value;
        runBatchedUpload(files, slotCode).finally(function () {
            btn.disabled = false;
            btn.textContent = 'Envoyer';
        });
    });

    document.getElementById('btn-select-all-docs').addEventListener('click', function () {
        document.querySelectorAll('input[name="diff-doc"]').forEach(function (cb) { cb.checked = true; });
    });
    document.getElementById('btn-select-none-docs').addEventListener('click', function () {
        document.querySelectorAll('input[name="diff-doc"]').forEach(function (cb) { cb.checked = false; });
    });

    document.getElementById('btn-doc-select-all').addEventListener('click', function () {
        document.querySelectorAll('.doc-item-check').forEach(function (cb) { cb.checked = true; });
        updateDocDeleteToolbar();
    });
    document.getElementById('btn-doc-select-none').addEventListener('click', function () {
        document.querySelectorAll('.doc-item-check').forEach(function (cb) { cb.checked = false; });
        updateDocDeleteToolbar();
    });
    document.getElementById('btn-doc-delete-selected').addEventListener('click', function () {
        var ids = [];
        document.querySelectorAll('.doc-item-check:checked').forEach(function (cb) { ids.push(cb.value); });
        if (!ids.length) return;
        var label = ids.length === 1
            ? 'ce document'
            : ids.length + ' documents';
        if (!confirm('Supprimer définitivement ' + label + ' ?\n\nFichiers et liens de téléchargement associés seront retirés.')) return;
        var btn = document.getElementById('btn-doc-delete-selected');
        btn.disabled = true;
        deleteDocumentsByIds(ids).then(function (res) {
            if (!res.ok || !res.deleted) {
                toastMsg(res.message || 'Suppression impossible', true);
                return;
            }
            toastMsg(res.deleted + ' document(s) supprimé(s)');
            loadDocuments();
        }).finally(function () {
            updateDocDeleteToolbar();
        });
    });

    document.getElementById('btn-send-diff').addEventListener('click', function () {
        var email = document.getElementById('diff-email').value.trim();
        var subject = document.getElementById('diff-subject').value.trim();
        var message = document.getElementById('diff-message').value.trim();
        var ttl = parseInt(document.getElementById('diff-ttl').value, 10) || 7;
        var groupSingleLink = document.getElementById('diff-group-link').checked;
        var ids = [];
        document.querySelectorAll('input[name="diff-doc"]:checked').forEach(function (cb) {
            ids.push(cb.value);
        });
        if (!email || !subject) {
            toastMsg('Email et objet requis', true);
            return;
        }
        if (!ids.length) {
            toastMsg('Sélectionnez au moins un document', true);
            return;
        }
        var sendBtn = document.getElementById('btn-send-diff');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Envoi…';
        api('/projects/' + currentProjectId + '/diffusions', {
            method: 'POST',
            body: JSON.stringify({
                recipientEmail: email,
                subject: subject,
                message: message,
                documentIds: ids,
                linkTtlDays: ttl,
                groupSingleLink: groupSingleLink
            })
        }).then(function (res) {
            if (!res.ok) {
                toastMsg(res.json.message || 'Envoi échoué', true);
                return;
            }
            var mode = res.json.data.linkMode === 'bundle' ? '1 lien (archive ZIP)' : (res.json.data.linksCount + ' lien(s)');
            toastMsg('Envoi réussi — ' + mode);
            document.getElementById('diff-email').value = '';
            document.getElementById('diff-subject').value = '';
            document.getElementById('diff-message').value = '';
            closeEnvoiModal();
            setProjectTab('envois');
            loadDiffusions();
        }).finally(function () {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Envoyer le mail';
        });
    });

    loadTags();
    loadSlots();
    showList();
})();
</script>

<?php require_once '../../includes/footer.php'; ?>
