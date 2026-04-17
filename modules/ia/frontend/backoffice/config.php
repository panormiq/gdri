<?php
/**
 * Configuration IA – Liste des serveurs (ia_servers), ajout depuis presets, test, config avancée.
 * Fichier : modules/ia/frontend/backoffice/config.php
 */
require_once __DIR__ . '/bootstrap.php';

// Réservé admin GDRI : configuration des serveurs IA (Administration > Modules)
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'IA – Serveurs';
require_once GDRI_ROOT . '/frontend/includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
?>

<section class="section">
    <div class="container">
        <h1 class="mb-4">Serveurs IA</h1>
        <p class="text-muted small mb-1">Les serveurs sont enregistrés en base. Utilisez &laquo;&nbsp;Ajouter un serveur&nbsp;&raquo; pour créer un serveur depuis un preset (backendIA, Ollama local, etc.). Test et liste des modèles s’appuient sur le backend Node (proxy <code>/api</code>).</p>
        <p class="text-muted small mb-3">Le bouton &laquo;&nbsp;Tester&nbsp;&raquo; vérifie uniquement que l’URL du serveur répond. Le bouton &laquo;&nbsp;Lister les modèles&nbsp;&raquo; vérifie en plus le token (IA_SERVICE_TOKEN / clé API) et renverra 401 si le token est invalide.</p>

        <div id="serversApiMessage" class="alert alert-info small mb-3" style="display:none;"></div>
        <div class="mb-4">
            <button type="button" id="btnAddServer" class="btn btn-sm btn-outline-primary">+ Ajouter un serveur</button>
            <button type="button" id="btnRefreshServers" class="btn btn-sm btn-outline-secondary ml-2">Rafraîchir</button>
        </div>

        <div id="addServerBlock" class="border rounded p-3 mb-4" style="display:none;">
            <h3 class="h6 mb-2">Nouveau serveur (depuis un preset)</h3>
            <div class="form-group">
                <label>Preset</label>
                <select id="addPresetId" class="form-control form-control-sm" style="max-width:320px;"></select>
            </div>
            <div class="form-group">
                <label>Nom</label>
                <input type="text" id="addName" class="form-control form-control-sm" placeholder="Mon serveur IA" style="max-width:320px">
            </div>
            <div class="form-group">
                <label>URL de base</label>
                <input type="url" id="addBaseUrl" class="form-control form-control-sm" placeholder="http://127.0.0.1:8000" style="max-width:320px">
            </div>
            <div class="form-group" id="addAuthGroup">
                <label>Token / Clé API</label>
                <input type="password" id="addAuthValue" class="form-control form-control-sm" placeholder="optionnel" style="max-width:320px" autocomplete="off">
            </div>
            <div class="form-group">
                <button type="button" id="btnCreateServer" class="btn btn-sm btn-primary">Créer</button>
                <button type="button" id="btnCancelAdd" class="btn btn-sm btn-outline-secondary">Annuler</button>
            </div>
        </div>

        <ul id="serverList" class="list-unstyled mb-4"></ul>
        <div id="serverOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:1040;"></div>
    </div>
</section>

<style>
#serverList {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 320px));
    justify-content: center;
    gap: 1.2rem;
    margin-top: 0.75rem;
    padding-left: 0;
}
.server-row {
    border: 1px solid #dee2e6;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    background: #f8f9fa;
}
.server-row-head {
    padding: 16px 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: #f8f9fa;
    text-align: center;
}
.server-row-head:hover { background: #e9ecef; }
.server-row-head h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.server-row-icon { font-size: 1.8rem; }
.server-row-body {
    padding: 16px;
    background: #fff;
    border-top: 1px solid #dee2e6;
    display: none;
    position: fixed;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    max-width: 640px;
    width: 90%;
    z-index: 1050;
    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
    border-radius: 10px;
    padding-top: 28px;
}
.server-modal-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 18px;
    height: 18px;
    padding: 0;
    line-height: 18px;
    font-size: 12px;
    border-radius: 999px;
}
.server-row.open .server-row-body { display: block; }
.server-chevron { display:none; }
.server-form .form-group { margin-bottom: 12px; }
.server-form label { margin-bottom: 4px; font-weight: 500; }
.server-actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.server-models { margin-top: 12px; }
.server-models ul { margin: 0; padding-left: 20px; max-height: 160px; overflow-y: auto; }
.server-advanced { margin-top: 12px; }
.server-advanced table { font-size: 0.9rem; }
.server-advanced-table-wrapper td.endpoint-actions {
    white-space: nowrap;
}
.server-advanced-table-wrapper td.endpoint-actions .btn {
    padding: 2px 6px;
    font-size: 0.75rem;
}
.server-advanced-table-wrapper td.endpoint-actions .btn + .btn {
    margin-left: 4px;
}
.server-tabs {
    display: flex;
    width: 100%;
    border-radius: 999px;
    padding: 2px;
    background: #e9ecef;
    margin-bottom: 8px;
    overflow: hidden;
}
.server-tab-btn {
    flex: 1 1 0;
    border: none;
    background: transparent;
    padding: 6px 0;
    font-size: 0.85rem;
    cursor: pointer;
    color: #495057;
    text-align: center;
    transition: background 0.15s, color 0.15s;
}
.server-tab-btn + .server-tab-btn {
    border-left: 1px solid rgba(0,0,0,0.03);
}
.server-tab-btn.active {
    background: #fff;
    box-shadow: 0 0 0 1px rgba(13,110,253,0.12);
    color: #0d6efd;
}
.server-tab-pane { margin-top: 8px; }
</style>

<script>
(function() {
    const API_BASE = '<?= addslashes($api_base_url) ?>/ia';
    const JWT = '<?= addslashes($jwt_token) ?>';
    const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JWT });

    let servers = [];
    let presets = [];

    function parseJson(r) {
        return r.text().then(function(t) {
            if (!t || !t.trim()) return null;
            try { return JSON.parse(t); } catch (_) { return null; }
        });
    }
    function escapeHtml(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
    function setMsg(el, text, type) {
        if (!el) return;
        el.textContent = text || '';
        el.className = 'small mt-2 ' + (type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-muted');
    }

    function buildServerList() {
        const ul = document.getElementById('serverList');
        ul.innerHTML = '';
        servers.forEach(function(s) {
            const id = s._id;
            const li = document.createElement('li');
            li.className = 'server-row';
            li.dataset.serverId = id;
            li.innerHTML =
                '<div class="server-row-head">' +
                '  <span class="server-row-icon">🖥️</span>' +
                '  <h3>' + escapeHtml(s.name || s.provider || id) + '</h3>' +
                '</div>' +
                '<div class="server-row-body">' +
                '  <button type="button" class="btn btn-sm btn-light server-modal-close" title="Fermer">✕</button>' +
                '  <div class="server-tabs mb-2">' +
                '    <button type="button" class="server-tab-btn active" data-tab="params">Serveur</button>' +
                '    <button type="button" class="server-tab-btn" data-tab="advanced">Avancé</button>' +
                '    <button type="button" class="server-tab-btn" data-tab="llm">LLM</button>' +
                '    <button type="button" class="server-tab-btn" data-tab="entities">Entités</button>' +
                '  </div>' +
                '  <div class="server-tab-pane server-tab-params">' +
                '    <div class="server-form" data-server-id="' + escapeHtml(id) + '"></div>' +
                '    <div class="server-actions"></div>' +
                '    <div class="server-msg small mt-2"></div>' +
                '  </div>' +
                '  <div class="server-tab-pane server-tab-advanced" style="display:none;">' +
                '    <div class="server-advanced"></div>' +
                '    <div class="server-advanced-actions mt-2 d-flex justify-content-end">' +
                '      <button type="button" class="btn btn-sm btn-primary btn-save-advanced">Enregistrer</button>' +
                '    </div>' +
                '  </div>' +
                '  <div class="server-tab-pane server-tab-llm" style="display:none;">' +
                '    <div class="server-models"></div>' +
                '  </div>' +
                '  <div class="server-tab-pane server-tab-entities" style="display:none;">' +
                '    <div class="server-entities"></div>' +
                '  </div>' +
                '</div>';
            ul.appendChild(li);
        });
        document.querySelectorAll('.server-row').forEach(function(row) {
            row.querySelector('.server-row-head').onclick = function() {
                row.classList.toggle('open');
                if (row.classList.contains('open')) renderServerForm(row.dataset.serverId);
                updateOverlayVisibility();
            };
        });
    }

    function updateOverlayVisibility() {
        var anyOpen = !!document.querySelector('.server-row.open');
        var overlay = document.getElementById('serverOverlay');
        if (overlay) {
            overlay.style.display = anyOpen ? 'block' : 'none';
        }
    }

    function closeAllServerModals() {
        document.querySelectorAll('.server-row.open').forEach(function(row) {
            row.classList.remove('open');
        });
        updateOverlayVisibility();
    }

    // fermer en cliquant sur l'overlay
    (function bindOverlayClose() {
        var overlay = document.getElementById('serverOverlay');
        if (!overlay) return;
        overlay.addEventListener('click', function() {
            closeAllServerModals();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeAllServerModals();
        });
    })();

    function renderServerForm(serverId) {
        const s = servers.find(function(x) { return x._id === serverId; });
        if (!s) return;
        const row = document.querySelector('.server-row[data-server-id="' + serverId + '"]');
        if (!row) return;

        // Empêcher les clics dans le modal de "rebondir" sur la carte
        var body = row.querySelector('.server-row-body');
        if (body) {
            body.addEventListener('click', function(e) { e.stopPropagation(); }, { once: true });
        }

        const formDiv = row.querySelector('.server-form');
        const actionsDiv = row.querySelector('.server-actions');
        const advancedDiv = row.querySelector('.server-advanced');
        const modelsDiv = row.querySelector('.server-models');
        const entitiesDiv = row.querySelector('.server-entities');
        const msgDiv = row.querySelector('.server-msg');
        if (!formDiv || !actionsDiv || !advancedDiv || !modelsDiv || !msgDiv) return;

        formDiv.innerHTML =
            '<div class="form-group"><label>Nom</label><input type="text" class="form-control form-control-sm server-name" value="' + escapeHtml(s.name || '') + '" style="max-width:320px"></div>' +
            '<div class="form-group"><label>URL de base</label><input type="url" class="form-control form-control-sm server-baseUrl" value="' + escapeHtml(s.baseUrl || '') + '" placeholder="http://..." style="max-width:320px"></div>' +
            (s.auth && (s.auth.serviceToken !== undefined || s.auth.apiKey !== undefined)
                ? '<div class="form-group"><label>Token / Clé</label><input type="password" class="form-control form-control-sm server-auth" placeholder="' + (s.auth.serviceToken || s.auth.apiKey ? '••••••••' : '') + '" style="max-width:320px" autocomplete="off"></div>'
                : '<div class="form-group"><label>Token / Clé</label><input type="password" class="form-control form-control-sm server-auth" placeholder="optionnel" style="max-width:320px" autocomplete="off"></div>') +
            '<div class="form-group"><label>Modèle par défaut</label><input type="text" class="form-control form-control-sm server-defaultModel" value="' + escapeHtml(s.defaultModel || '') + '" placeholder="mistral:latest" style="max-width:320px"></div>';

        var endpoints = s.endpoints || {};
        var baseKeys = ['prompt','health','models','modelsAdd','modelsDelete'];
        var advHtml = '' +
            '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '  <strong>Config avancée (endpoints)</strong>' +
            '  <button type="button" class="btn btn-sm btn-outline-primary" id="btnAddEndpoint">+ Ajouter un endpoint</button>' +
            '</div>' +
            '<div class="server-advanced-table-wrapper">' +
            '<table class="table table-sm table-bordered mt-1">' +
            '<thead><tr><th style="width:35%;">Clé*</th><th>Chemin (optionnel)</th><th style="width:110px;text-align:center;">Actions</th></tr></thead><tbody id="endpointTableBody">';
        baseKeys.forEach(function(k) {
            var path = endpoints[k] || '';
            var isPrompt = (k === 'prompt');
            advHtml += '<tr data-endpoint-row="1" data-key="' + escapeHtml(k) + '" data-path="' + escapeHtml(path) + '">' +
                       '<td><span class="endpoint-key-label fw-semibold">' + escapeHtml(k) + '</span></td>' +
                       '<td><span class="endpoint-path-label">' + escapeHtml(path) + '</span></td>' +
                       '<td class="text-center endpoint-actions">' +
                       '  <button type="button" class="btn btn-outline-secondary endpoint-edit">Modifier</button>' +
                       (isPrompt
                           ? '  <button type="button" class="btn btn-outline-secondary" disabled title="Cet endpoint ne peut pas être supprimé">Supprimer</button>'
                           : '  <button type="button" class="btn btn-outline-danger endpoint-delete" title="Supprimer endpoint">Supprimer</button>') +
                       '</td>' +
                       '</tr>';
        });
        // lignes existantes non standard
        Object.keys(endpoints).forEach(function(k) {
            if (baseKeys.indexOf(k) !== -1) return;
            var path = endpoints[k] || '';
            advHtml += '<tr data-endpoint-row="1" data-key="' + escapeHtml(k) + '" data-path="' + escapeHtml(path) + '">' +
                       '<td><span class="endpoint-key-label fw-semibold">' + escapeHtml(k) + '</span></td>' +
                       '<td><span class="endpoint-path-label">' + escapeHtml(path) + '</span></td>' +
                       '<td class="text-center endpoint-actions">' +
                       '  <button type="button" class="btn btn-outline-secondary endpoint-edit">Modifier</button>' +
                       '  <button type="button" class="btn btn-outline-danger endpoint-delete" title="Supprimer endpoint">Supprimer</button>' +
                       '</td>' +
                       '</tr>';
        });
        advHtml += '</tbody></table></div>' +
                   '<div class="endpoint-edit-modal" style="display:none;margin-top:10px;padding:12px;border-radius:8px;border:1px solid #dee2e6;background:#f8f9fa;">' +
                   '  <div class="mb-2"><strong>Modifier l’endpoint</strong></div>' +
                   '  <div class="form-row" style="display:flex;gap:8px;flex-wrap:wrap;">' +
                   '    <div style="flex:1 1 140px;min-width:140px;"><label class="small mb-1">Clé*</label><input type="text" class="form-control form-control-sm endpoint-edit-key"></div>' +
                   '    <div style="flex:2 1 220px;min-width:180px;"><label class="small mb-1">Chemin</label><input type="text" class="form-control form-control-sm endpoint-edit-path" placeholder="/chemin/optionnel"></div>' +
                   '  </div>' +
                   '  <div class="mt-2 d-flex justify-content-end" style="gap:6px;">' +
                   '    <button type="button" class="btn btn-sm btn-light endpoint-edit-cancel">Annuler</button>' +
                   '    <button type="button" class="btn btn-sm btn-primary endpoint-edit-save">Enregistrer</button>' +
                   '  </div>' +
                   '</div>';
        advancedDiv.innerHTML = advHtml;

        var isOllama = s.provider === 'ollama_server' || s.provider === 'ollama_direct';
        actionsDiv.innerHTML =
            '<button type="button" class="btn btn-sm btn-outline btn-test">Tester</button>' +
            '<button type="button" class="btn btn-sm btn-primary btn-save">Enregistrer</button>' +
            '<button type="button" class="btn btn-sm btn-outline-danger btn-delete">Supprimer</button>';

        modelsDiv.innerHTML = '<p class="text-muted small mb-2">Chargement des modèles disponibles…</p>';
        if (entitiesDiv) entitiesDiv.innerHTML = '';

        var btnTest = row.querySelector('.btn-test');
        var btnSave = row.querySelector('.btn-save');
        var btnDel = row.querySelector('.btn-delete');
        var btnSaveAdvanced = row.querySelector('.btn-save-advanced');
        var btnAddEndpoint = row.querySelector('#btnAddEndpoint');
        var btnClose = row.querySelector('.server-modal-close');
        var editModal = row.querySelector('.endpoint-edit-modal');
        var editKeyInput = editModal ? editModal.querySelector('.endpoint-edit-key') : null;
        var editPathInput = editModal ? editModal.querySelector('.endpoint-edit-path') : null;
        var editSaveBtn = editModal ? editModal.querySelector('.endpoint-edit-save') : null;
        var editCancelBtn = editModal ? editModal.querySelector('.endpoint-edit-cancel') : null;
        var editingTr = null;
        if (btnTest) btnTest.onclick = function() { doTest(serverId, msgDiv); };
        if (btnSave) btnSave.onclick = function() { doSave(serverId, row, msgDiv); };
        if (btnSaveAdvanced) btnSaveAdvanced.onclick = function(e) {
            e.stopPropagation();
            doSave(serverId, row, msgDiv);
        };
        if (btnDel) btnDel.onclick = function() { doDelete(serverId, msgDiv); };
        if (btnClose) btnClose.onclick = function(e) { e.stopPropagation(); closeAllServerModals(); };
        if (btnAddEndpoint) btnAddEndpoint.onclick = function(e) {
            e.stopPropagation();
            var tbody = row.querySelector('#endpointTableBody');
            if (!tbody) return;
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td><span class="endpoint-key-label fw-semibold"></span></td>' +
                '<td><span class="endpoint-path-label"></span></td>' +
                '<td class="text-center endpoint-actions">' +
                '  <button type="button" class="btn btn-outline-secondary endpoint-edit">Modifier</button>' +
                '  <button type="button" class="btn btn-outline-danger endpoint-delete" title="Supprimer endpoint">Supprimer</button>' +
                '</td>';
            tr.setAttribute('data-endpoint-row', '1');
            tr.setAttribute('data-key', '');
            tr.setAttribute('data-path', '');
            tbody.appendChild(tr);
        };

        // ouvrir le modal d'édition
        function openEditModal(tr) {
            if (!editModal || !editKeyInput || !editPathInput) return;
            editingTr = tr;
            var key = (tr.getAttribute('data-key') || '').trim();
            var path = (tr.getAttribute('data-path') || '').trim();
            editKeyInput.value = key;
            editPathInput.value = path;
            // clé non modifiable pour les endpoints de base
            var isBase = baseKeys.indexOf(key) !== -1;
            editKeyInput.readOnly = isBase;
            editKeyInput.classList.toggle('bg-light', isBase);
            editModal.style.display = 'block';
        }
        function closeEditModal() {
            if (!editModal) return;
            editModal.style.display = 'none';
            editingTr = null;
        }
        if (editCancelBtn) {
            editCancelBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeEditModal();
            });
        }
        if (editSaveBtn) {
            editSaveBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!editingTr) return;
                var key = (editKeyInput.value || '').trim();
                var path = (editPathInput.value || '').trim();
                if (!key) {
                    alert('La clé est obligatoire.');
                    return;
                }
                editingTr.setAttribute('data-key', key);
                editingTr.setAttribute('data-path', path);
                var keyLabel = editingTr.querySelector('.endpoint-key-label');
                var pathLabel = editingTr.querySelector('.endpoint-path-label');
                if (keyLabel) keyLabel.textContent = key;
                if (pathLabel) pathLabel.textContent = path;
                closeEditModal();
            });
        }

        // wiring des boutons Modifier / Supprimer sur les lignes existantes
        row.querySelectorAll('.endpoint-edit').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var tr = btn.closest('tr');
                if (!tr) return;
                openEditModal(tr);
            });
        });
        // suppression d'un endpoint (sauf ceux de base)
        row.querySelectorAll('.endpoint-delete').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var tr = btn.closest('tr');
                if (!tr) return;
                var key = (tr.getAttribute('data-key') || '').trim();
                if (key === 'prompt') {
                    return; // prompt non supprimable
                }
                tr.parentNode.removeChild(tr);
            });
        });

        // Précharger la liste des modèles dès l'ouverture du modal (pour avoir les infos LLM prêtes)
        if (modelsDiv && !modelsDiv.dataset.loaded) {
            doListModels(serverId, modelsDiv, msgDiv);
        }

        // Onglet Entités : autoriser les entités à ajouter des LLM (réglage plateforme)
        function renderEntitiesTab() {
            if (!entitiesDiv) return;
            if (s.scope !== 'global') {
                entitiesDiv.innerHTML = '<p class="text-muted small mb-0">Disponible uniquement pour les serveurs globaux (offerts par GDRI).</p>';
                return;
            }
            var owner = s.owner_entity_id || '';
            var mode = s.mode || 'mutualized';
            var allowed = Array.isArray(s.allowed_entity_ids) ? s.allowed_entity_ids.map(String) : [];
            var allowOwnerAdd = s.allow_owner_add_llm === true;
            var dedicatedModuleIds = Array.isArray(s.dedicated_module_ids)
                ? s.dedicated_module_ids.map(String)
                : (s.dedicated_module_id ? [String(s.dedicated_module_id)] : []);

            entitiesDiv.innerHTML =
                '<div class="mb-2"><strong>Configuration (mode + accès)</strong></div>' +
                '<p class="text-muted small mb-3">Mutualisé : pas d’owner. Privé : owner possible. Dédié : serveur attaché à un module (app).</p>' +
                '<div class="form-row" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">' +
                '  <div class="form-group" style="min-width:180px;flex:0 0 180px;">' +
                '    <label class="small mb-1">Mode</label>' +
                '    <select class="form-control form-control-sm sel-mode">' +
                '      <option value="mutualized">Mutualisé</option>' +
                '      <option value="private">Privé</option>' +
                '      <option value="dedicated">Dédié</option>' +
                '    </select>' +
                '  </div>' +
                '  <div class="form-group owner-wrap" style="min-width:240px;flex:1 1 240px;display:none;">' +
                '    <label class="small mb-1">Owner (entité)</label>' +
                '    <select class="form-control form-control-sm sel-owner"></select>' +
                '  </div>' +
                '  <div class="form-group allow-owner-wrap" style="min-width:260px;flex:1 1 260px;display:none;">' +
                '    <label class="d-flex align-items-center gap-2 mb-0 small">' +
                '      <input type="checkbox" class="form-check-input chk-allow-owner-add">' +
                '      <span>Autoriser l’owner à ajouter des LLM</span>' +
                '    </label>' +
                '  </div>' +
                '</div>' +
                '<div class="row mt-2 mode-layout">' +
                '  <div class="col-md-6 entities-left">' +
                '    <div class="d-flex justify-content-between align-items-center" style="gap:10px;flex-wrap:wrap;">' +
                '      <strong>Entités autorisées (accès)</strong>' +
                '      <div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                '        <button type="button" class="btn btn-sm btn-outline-secondary btn-all-entities" style="display:none;">Toutes les entités</button>' +
                '        <button type="button" class="btn btn-sm btn-outline-secondary btn-reload-entities">Rafraîchir</button>' +
                '      </div>' +
                '    </div>' +
                '    <div class="text-muted small mt-1">Cochez les entités qui peuvent utiliser ce serveur.</div>' +
                '    <input type="text" class="form-control form-control-sm entities-search mt-2" placeholder="Rechercher une entité…">' +
                '    <div class="border rounded p-2 mt-2 entities-list" style="max-height:240px;overflow-y:auto;background:#fff;"></div>' +
                '  </div>' +
                '  <div class="col-md-6 modules-right dedicated-wrap" style="display:none;">' +
                '    <div class="d-flex justify-content-between align-items-center" style="gap:10px;flex-wrap:wrap;">' +
                '      <strong>Modules dédiés</strong>' +
                '      <button type="button" class="btn btn-sm btn-outline-secondary btn-reload-modules">Rafraîchir</button>' +
                '    </div>' +
                '    <input type="text" class="form-control form-control-sm modules-search mt-2" placeholder="Rechercher un module…">' +
                '    <div class="border rounded p-2 mt-2 modules-list" style="max-height:240px;overflow-y:auto;background:#fff;"></div>' +
                '    <div class="text-muted small mt-1">Vous pouvez dédier le serveur à plusieurs modules.</div>' +
                '  </div>' +
                '  <div class="col-md-6 entities-right mutualized-hint" style="display:none;">' +
                '    <div class="border rounded p-3 bg-light">' +
                '      <strong>Mutualisé</strong>' +
                '      <div class="text-muted small mt-1">Pas d’owner. Utilisez la liste à gauche (ou “Toutes les entités”).</div>' +
                '    </div>' +
                '  </div>' +
                '</div>' +
                '<div class="mt-2">' +
                '  <button type="button" class="btn btn-sm btn-primary btn-save-entities">Enregistrer</button>' +
                '  <span class="small ml-2 text-muted entities-msg"></span>' +
                '</div>';

            var selOwner = entitiesDiv.querySelector('.sel-owner');
            var selMode = entitiesDiv.querySelector('.sel-mode');
            var chkAllowOwnerAdd = entitiesDiv.querySelector('.chk-allow-owner-add');
            var ownerWrap = entitiesDiv.querySelector('.owner-wrap');
            var allowOwnerWrap = entitiesDiv.querySelector('.allow-owner-wrap');
            var dedicatedWrap = entitiesDiv.querySelector('.dedicated-wrap');
            var modulesSearch = entitiesDiv.querySelector('.modules-search');
            var modulesList = entitiesDiv.querySelector('.modules-list');
            var btnReloadModules = entitiesDiv.querySelector('.btn-reload-modules');
            var entitiesSearch = entitiesDiv.querySelector('.entities-search');
            var listWrap = entitiesDiv.querySelector('.entities-list');
            var msg = entitiesDiv.querySelector('.entities-msg');
            var btnSave = entitiesDiv.querySelector('.btn-save-entities');
            var btnReload = entitiesDiv.querySelector('.btn-reload-entities');
            var btnAll = entitiesDiv.querySelector('.btn-all-entities');
            var mutualizedHint = entitiesDiv.querySelector('.mutualized-hint');
            var allModules = [];
            var allEntities = [];
            var controlsInitialized = false;

            function setEntitiesMsg(text, type) {
                if (!msg) return;
                msg.textContent = text || '';
                msg.className = 'small ml-2 ' + (type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-muted') + ' entities-msg';
            }

            function renderModulesList() {
                if (!modulesList) return;
                var q = (modulesSearch && modulesSearch.value ? modulesSearch.value : '').trim().toLowerCase();
                var visible = allModules.filter(function(m) {
                    var label = ((m.name || '') + ' ' + (m.id || '')).toLowerCase();
                    return !q || label.indexOf(q) !== -1;
                });
                modulesList.innerHTML = '';
                if (!visible.length) {
                    modulesList.innerHTML = '<div class="text-muted small">Aucun module.</div>';
                    return;
                }
                var selected = new Set(dedicatedModuleIds.map(String));
                visible.forEach(function(m) {
                    var id = String(m.id);
                    var chkId = 'dedmod_' + serverId + '_' + id;
                    var checked = selected.has(id) ? ' checked' : '';
                    modulesList.innerHTML +=
                        '<div class="form-check small">' +
                        '  <input class="form-check-input dedicated-module-cb" type="checkbox" id="' + escapeHtml(chkId) + '" value="' + escapeHtml(id) + '"' + checked + '>' +
                        '  <label class="form-check-label" for="' + escapeHtml(chkId) + '">' + escapeHtml(m.name || m.id) + '</label>' +
                        '</div>';
                });
            }

            function loadModules() {
                if (!modulesList) return Promise.resolve();
                modulesList.innerHTML = '<div class="text-muted small">Chargement…</div>';
                return fetch(API_BASE + '/admin/modules', { headers: headers() })
                    .then(function(r) { return r.ok ? r.json() : {}; })
                    .then(function(data) {
                        if (data && data.success && Array.isArray(data.modules)) {
                            allModules = data.modules;
                            renderModulesList();
                        } else {
                            modulesList.innerHTML = '<div class="text-muted small">(modules indisponibles)</div>';
                        }
                    })
                    .catch(function() { modulesList.innerHTML = '<div class="text-muted small">(modules indisponibles)</div>'; });
            }

            function renderEntitiesList(entities) {
                if (!selOwner || !listWrap) return;
                allEntities = entities || [];
                var currentOwnerValue = selOwner.value || owner || '';
                var currentModeValue = selMode ? (selMode.value || mode || 'mutualized') : (mode || 'mutualized');
                var currentAllowOwnerAdd = chkAllowOwnerAdd ? chkAllowOwnerAdd.checked : (allowOwnerAdd === true);
                var options = '<option value="">— Aucun —</option>';
                allEntities.forEach(function(e) {
                    options += '<option value="' + escapeHtml(e._id) + '">' + escapeHtml(e.name || e._id) + '</option>';
                });
                selOwner.innerHTML = options;
                selOwner.value = currentOwnerValue;
                if (selMode) selMode.value = (currentModeValue === 'private' ? 'private' : currentModeValue === 'dedicated' ? 'dedicated' : 'mutualized');
                if (chkAllowOwnerAdd) chkAllowOwnerAdd.checked = !!currentAllowOwnerAdd;

                function refreshModeUi() {
                    var m = selMode ? selMode.value : 'mutualized';
                    // mutualisé : pas d’owner
                    if (ownerWrap) ownerWrap.style.display = (m === 'private') ? 'block' : 'none';
                    if (allowOwnerWrap) allowOwnerWrap.style.display = (m === 'private') ? 'block' : 'none';
                    if (dedicatedWrap) dedicatedWrap.style.display = (m === 'dedicated') ? 'block' : 'none';
                    if (mutualizedHint) mutualizedHint.style.display = (m === 'mutualized') ? 'block' : 'none';
                    if (btnAll) btnAll.style.display = (m === 'mutualized') ? 'inline-block' : 'none';
                    if (m === 'mutualized') {
                        owner = '';
                        if (selOwner) selOwner.value = '';
                        if (chkAllowOwnerAdd) chkAllowOwnerAdd.checked = false;
                    }
                    if (m !== 'dedicated') {
                        dedicatedModuleIds = [];
                    } else {
                        loadModules();
                    }
                }
                if (selMode && !controlsInitialized) selMode.onchange = refreshModeUi;
                refreshModeUi();
                controlsInitialized = true;

                var allowedSet = new Set(allowed.map(String));
                listWrap.innerHTML = '';
                var q = (entitiesSearch && entitiesSearch.value ? entitiesSearch.value : '').trim().toLowerCase();
                var visible = allEntities.filter(function(e) {
                    var label = String(e.name || e._id || '').toLowerCase();
                    return !q || label.indexOf(q) !== -1;
                });
                if (!visible.length) {
                    listWrap.innerHTML = '<div class="text-muted small">Aucune entité.</div>';
                    return;
                }
                visible.forEach(function(e) {
                    var id = 'ent_' + serverId + '_' + e._id;
                    var checked = allowedSet.has(String(e._id)) ? ' checked' : '';
                    listWrap.innerHTML +=
                        '<div class="form-check small">' +
                        '  <input class="form-check-input chk-entity" type="checkbox" value="' + escapeHtml(e._id) + '" id="' + escapeHtml(id) + '"' + checked + '>' +
                        '  <label class="form-check-label" for="' + escapeHtml(id) + '">' + escapeHtml(e.name || e._id) + '</label>' +
                        '</div>';
                });
            }

            function loadEntities() {
                setEntitiesMsg('Chargement…', 'muted');
                return fetch(API_BASE + '/admin/entities', { headers: headers() })
                    .then(function(r) {
                        return parseJson(r).then(function(data) {
                            return { ok: r.ok, status: r.status, data: data || {} };
                        });
                    })
                    .then(function(data) {
                        if (data && data.ok && data.data && data.data.success && Array.isArray(data.data.entities)) {
                            renderEntitiesList(data.data.entities);
                            setEntitiesMsg('', 'muted');
                        } else {
                            var msg = (data && data.data && data.data.message) ? data.data.message : 'Impossible de charger les entités';
                            var hint = (data && data.status) ? (' (HTTP ' + data.status + ')') : '';
                            setEntitiesMsg(msg + hint, 'error');
                        }
                    })
                    .catch(function(e) { setEntitiesMsg('Erreur: ' + (e.message || e), 'error'); });
            }

            if (btnReload) btnReload.onclick = function(e) { e.stopPropagation(); loadEntities(); };
            if (btnReloadModules) btnReloadModules.onclick = function(e) { e.stopPropagation(); loadModules(); };
            if (modulesSearch) modulesSearch.addEventListener('input', renderModulesList);
            if (entitiesSearch) entitiesSearch.addEventListener('input', function() { renderEntitiesList(allEntities); });
            if (btnAll) {
                btnAll.onclick = function(e) {
                    e.stopPropagation();
                    // Mutualisé "toutes entités" = on met allowed_entity_ids = ['*']
                    if (listWrap) {
                        listWrap.querySelectorAll('.chk-entity').forEach(function(inp) { inp.checked = false; });
                    }
                    setEntitiesMsg('Toutes les entités seront autorisées (mutualisé).', 'muted');
                };
            }

            if (btnSave) {
                btnSave.onclick = function(e) {
                    e.stopPropagation();
                    var newOwner = selOwner ? selOwner.value : '';
                    var newMode = selMode ? selMode.value : 'mutualized';
                    var newDedicatedModules = [].slice.call(entitiesDiv.querySelectorAll('.dedicated-module-cb:checked')).map(function(inp) { return inp.value; });
                    var newAllowed = [].slice.call(listWrap.querySelectorAll('.chk-entity:checked')).map(function(inp) { return inp.value; });
                    // Mutualisé "toutes entités" : on envoie ['*'] si aucun checkbox coché
                    if (newMode === 'mutualized' && (!newAllowed || newAllowed.length === 0)) {
                        newAllowed = ['*'];
                    }
                    setEntitiesMsg('Enregistrement…', 'muted');
                    fetch(API_BASE + '/servers/' + serverId, {
                        method: 'PUT',
                        headers: headers(),
                        body: JSON.stringify({
                            owner_entity_id: (newMode === 'private' ? (newOwner || null) : null),
                            mode: newMode || null,
                            allowed_entity_ids: newAllowed,
                            allow_owner_add_llm: (newMode === 'private' ? (chkAllowOwnerAdd && chkAllowOwnerAdd.checked) : false),
                            dedicated_module_ids: (newMode === 'dedicated' ? newDedicatedModules : [])
                        })
                    })
                        .then(function(r) { return parseJson(r); })
                        .then(function(res) {
                            if (res && res.success && res.server) {
                                s.owner_entity_id = res.server.owner_entity_id || null;
                                s.mode = res.server.mode || null;
                                s.allowed_entity_ids = Array.isArray(res.server.allowed_entity_ids) ? res.server.allowed_entity_ids : [];
                                s.allow_owner_add_llm = res.server.allow_owner_add_llm === true;
                                s.dedicated_module_id = res.server.dedicated_module_id || null;
                                s.dedicated_module_ids = Array.isArray(res.server.dedicated_module_ids) ? res.server.dedicated_module_ids : [];
                                owner = s.owner_entity_id || '';
                                mode = s.mode || 'mutualized';
                                allowed = (s.allowed_entity_ids || []).map(String);
                                allowOwnerAdd = s.allow_owner_add_llm === true;
                                dedicatedModuleIds = (s.dedicated_module_ids || []).map(String);
                                setEntitiesMsg('Enregistré.', 'success');
                                loadServers();
                            } else {
                                setEntitiesMsg((res && res.message) || 'Erreur', 'error');
                            }
                        })
                        .catch(function(err) { setEntitiesMsg('Erreur: ' + (err.message || err), 'error'); });
                };
            }

            loadEntities();
        }

        // gestion des onglets
        var tabs = row.querySelectorAll('.server-tab-btn');
        function showTab(tab) {
            row.querySelectorAll('.server-tab-pane').forEach(function(pane) {
                pane.style.display = 'none';
            });
            if (tab === 'params') {
                var p = row.querySelector('.server-tab-params');
                if (p) p.style.display = 'block';
            } else if (tab === 'advanced') {
                var a = row.querySelector('.server-tab-advanced');
                if (a) a.style.display = 'block';
            } else if (tab === 'llm') {
                var l = row.querySelector('.server-tab-llm');
                if (l) {
                    l.style.display = 'block';
                    // charger les modèles à l'ouverture de l'onglet LLM si pas déjà fait
                    if (!l.dataset.loaded) {
                        doListModels(serverId, l, msgDiv);
                    }
                }
            } else if (tab === 'entities') {
                var e = row.querySelector('.server-tab-entities');
                if (e) {
                    e.style.display = 'block';
                    if (!e.dataset.loaded) {
                        renderEntitiesTab();
                        e.dataset.loaded = '1';
                    }
                }
            }
            tabs.forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });
        }
        tabs.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                showTab(btn.dataset.tab || 'params');
            });
        });
        showTab('params');
    }

    function doTest(serverId, msgEl) {
        setMsg(msgEl, 'Test…', 'muted');
        fetch(API_BASE + '/servers/' + serverId + '/test', { method: 'POST', headers: headers() })
            .then(function(r) {
                if (!r.ok) return parseJson(r).then(function(d) { return d || { success: false, message: 'API ' + r.status }; });
                return parseJson(r);
            })
            .then(function(data) {
                if (data && data.success && data.server) {
                    setMsg(msgEl, 'Serveur connecté.', 'success');
                } else {
                    setMsg(msgEl, (data && data.message) || 'Échec', 'error');
                }
            })
            .catch(function(e) {
                setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error');
            });
    }

    function doListModels(serverId, modelsDiv, msgEl) {
        setMsg(msgEl, 'Chargement…', 'muted');
        if (modelsDiv) {
            modelsDiv.innerHTML = '<p class="text-muted small mb-2">Chargement des modèles disponibles…</p>';
            delete modelsDiv.dataset.loaded;
        }
        fetch(API_BASE + '/servers/' + serverId + '/models', { headers: headers() })
            .then(function(r) {
                if (!r.ok) return { success: false, models: [], message: 'API ' + r.status };
                return parseJson(r);
            })
            .then(function(data) {
                if (data && data.success && Array.isArray(data.models)) {
                    setMsg(msgEl, data.models.length > 0 ? (data.models.length + ' modèle(s).') : 'Aucun modèle. Utilisez « + Ajouter » pour en installer.', data.models.length > 0 ? 'success' : 'muted');
                    if (modelsDiv) {
                        modelsDiv.style.display = 'block';
                        var s = servers.find(function(x) { return x._id === serverId; }) || {};
                        var enabled = s.enabledModels || [];
                        if (s.defaultModel && enabled.indexOf(s.defaultModel) === -1) {
                            enabled = enabled.concat([s.defaultModel]);
                        }
                        var enabledSet = new Set((enabled || []).map(function(x){ return String(x); }));
                        var html = '' +
                            '<div class="d-flex justify-content-between align-items-center mb-2">' +
                            '  <strong>Modèles disponibles</strong>' +
                            '  <div class="btn-group btn-group-sm" role="group">' +
                            '    <button type="button" class="btn btn-outline-secondary btn-add-llm">+ Ajouter</button>' +
                            '    <button type="button" class="btn btn-outline-danger btn-open-remove-llm">Supprimer…</button>' +
                            '  </div>' +
                            '</div>';
                        html += '<div class="border rounded p-2" style="max-height:220px;overflow-y:auto;">';
                        (data.models || []).forEach(function(m) {
                            var name = (typeof m === 'object' ? (m.name || m.id || m) : m) || '';
                            if (!name) return;
                            var checked = enabledSet.has(String(name)) ? 'checked' : '';
                            html += '<div class="form-check small llm-row" data-custom="0">' +
                                    '  <input class="form-check-input llm-model-checkbox" type="checkbox" value="' + escapeHtml(name) + '" id="llm_' + escapeHtml(serverId + '_' + name) + '" ' + checked + '>' +
                                    '  <label class="form-check-label" for="llm_' + escapeHtml(serverId + '_' + name) + '">' + escapeHtml(name) + '</label>' +
                                    '</div>';
                        });
                        html += '</div>';
                        html += '<div class="mt-2 d-flex justify-content-end">' +
                                '  <button type="button" class="btn btn-sm btn-primary btn-save-models">Enregistrer la sélection</button>' +
                                '</div>' +
                                '<div class="llm-msg small mt-2"></div>';
                        html += '' +
                            '<div class="llm-remove-modal" style="display:none;margin-top:10px;padding:12px;border-radius:8px;border:1px solid #dee2e6;background:#f8f9fa;">' +
                            '  <div class="d-flex justify-content-between align-items-center mb-2" style="gap:10px;">' +
                            '    <strong>Supprimer des modèles</strong>' +
                            '    <button type="button" class="btn btn-sm btn-light llm-remove-close" title="Fermer">✕</button>' +
                            '  </div>' +
                            '  <div class="text-muted small mb-2">Sélectionnez les modèles à retirer de la sélection, puis validez.</div>' +
                            '  <div class="border rounded p-2 llm-remove-list" style="max-height:180px;overflow-y:auto;background:#fff;"></div>' +
                            '  <div class="mt-2 d-flex justify-content-end" style="gap:6px;">' +
                            '    <button type="button" class="btn btn-sm btn-light llm-remove-cancel">Annuler</button>' +
                            '    <button type="button" class="btn btn-sm btn-danger llm-remove-confirm">Retirer</button>' +
                            '  </div>' +
                            '</div>';
                        modelsDiv.innerHTML = html;
                        modelsDiv.dataset.loaded = '1';

                        var llmMsg = modelsDiv.querySelector('.llm-msg');
                        var saveBtn = modelsDiv.querySelector('.btn-save-models');
                        if (saveBtn) {
                            saveBtn.addEventListener('click', function(e) {
                                e.stopPropagation();
                                doSaveModels(serverId, modelsDiv, llmMsg, msgEl);
                            });
                        }
                        var addBtn = modelsDiv.querySelector('.btn-add-llm');
                        if (addBtn) {
                            addBtn.addEventListener('click', function(e) {
                                e.stopPropagation();
                                var name = prompt('Nom du modèle à installer (ex: mistral:latest) :');
                                if (!name) return;
                                name = name.trim();
                                if (!name) return;
                                setMsg(llmMsg, 'Démarrage de l\'installation…', 'muted');
                                fetch(API_BASE + '/servers/' + serverId + '/models', {
                                    method: 'POST',
                                    headers: headers(),
                                    body: JSON.stringify({ model: name })
                                })
                                    .then(function(r) { return r.json().then(function(data) { return { status: r.status, data: data }; }); })
                                    .then(function(result) {
                                        var res = result.data;
                                        if (res && res.success && (res.started || result.status === 202)) {
                                            var pollInterval = null;
                                            function formatMo(n) { return (n / 1024 / 1024).toFixed(1) + ' Mo'; }
                                            function stopPoll() { if (pollInterval) clearInterval(pollInterval); pollInterval = null; }
                                            function poll() {
                                                fetch(API_BASE + '/servers/' + serverId + '/models/install-status?model=' + encodeURIComponent(name), { headers: headers() })
                                                    .then(function(r) { return r.ok ? r.json() : { success: false, status: 'error' }; })
                                                    .then(function(st) {
                                                        if (!st.success) return;
                                                        var status = st.status || 'idle';
                                                        var completed = st.completed != null ? st.completed : 0;
                                                        var total = st.total != null ? st.total : 0;
                                                        if (status === 'downloading') {
                                                            var txt = total > 0 ? (formatMo(completed) + ' / ' + formatMo(total)) : (st.message || 'Chargement…');
                                                            setMsg(llmMsg, 'Installation en cours… ' + txt, 'muted');
                                                        } else if (status === 'completed') {
                                                            stopPoll();
                                                            setMsg(llmMsg, 'Modèle installé.', 'success');
                                                            doListModels(serverId, modelsDiv, msgEl);
                                                        } else if (status === 'error') {
                                                            stopPoll();
                                                            setMsg(llmMsg, (st.message || 'Erreur installation'), 'error');
                                                        }
                                                    });
                                            }
                                            poll();
                                            pollInterval = setInterval(poll, 2000);
                                        } else if (res && res.success) {
                                            setMsg(llmMsg, 'Modèle installé.', 'success');
                                            doListModels(serverId, modelsDiv, msgEl);
                                        } else {
                                            setMsg(llmMsg, (res && res.message) || 'Erreur installation', 'error');
                                        }
                                    })
                                    .catch(function(err) {
                                        setMsg(llmMsg, 'Erreur: ' + (err.message || err), 'error');
                                    });
                            });
                        }

                        // Suppression : ouvrir un modal de sélection (plus clair et moins risqué)
                        var openRemoveBtn = modelsDiv.querySelector('.btn-open-remove-llm');
                        var removeModal = modelsDiv.querySelector('.llm-remove-modal');
                        var removeList = modelsDiv.querySelector('.llm-remove-list');
                        function closeRemoveModal() {
                            if (removeModal) removeModal.style.display = 'none';
                            if (removeList) removeList.innerHTML = '';
                        }
                        function openRemoveModal() {
                            if (!removeModal || !removeList) return;
                            removeList.innerHTML = '';
                            var allModels = [].slice.call(modelsDiv.querySelectorAll('.llm-model-checkbox')).map(function(inp) { return inp.value; });
                            if (!allModels.length) {
                                removeList.innerHTML = '<div class="text-muted small">Aucun modèle trouvé.</div>';
                            } else {
                                allModels.forEach(function(name) {
                                    var id = 'rm_' + serverId + '_' + name;
                                    removeList.innerHTML += '' +
                                        '<div class="form-check small">' +
                                        '  <input class="form-check-input llm-remove-checkbox" type="checkbox" value="' + escapeHtml(name) + '" id="' + escapeHtml(id) + '">' +
                                        '  <label class="form-check-label" for="' + escapeHtml(id) + '">' + escapeHtml(name) + '</label>' +
                                        '</div>';
                                });
                            }
                            removeModal.style.display = 'block';
                        }
                        if (openRemoveBtn) {
                            openRemoveBtn.addEventListener('click', function(e) {
                                e.stopPropagation();
                                openRemoveModal();
                            });
                        }
                        var closeBtn = modelsDiv.querySelector('.llm-remove-close');
                        if (closeBtn) closeBtn.addEventListener('click', function(e) { e.stopPropagation(); closeRemoveModal(); });
                        var cancelBtn = modelsDiv.querySelector('.llm-remove-cancel');
                        if (cancelBtn) cancelBtn.addEventListener('click', function(e) { e.stopPropagation(); closeRemoveModal(); });
                        var confirmBtn = modelsDiv.querySelector('.llm-remove-confirm');
                        if (confirmBtn) {
                            confirmBtn.addEventListener('click', function(e) {
                                e.stopPropagation();
                                var toRemove = [].slice.call(modelsDiv.querySelectorAll('.llm-remove-checkbox:checked')).map(function(inp) { return inp.value; });
                                if (!toRemove.length) { closeRemoveModal(); return; }
                                setMsg(llmMsg, 'Suppression…', 'muted');
                                fetch(API_BASE + '/servers/' + serverId + '/models', {
                                    method: 'DELETE',
                                    headers: headers(),
                                    body: JSON.stringify({ models: toRemove })
                                })
                                    .then(function(r) { return parseJson(r); })
                                    .then(function(res) {
                                        if (res && res.success) {
                                            setMsg(llmMsg, 'Modèles supprimés.', 'success');
                                        } else {
                                            setMsg(llmMsg, (res && res.message) || 'Suppression partielle/échec', 'error');
                                        }
                                        closeRemoveModal();
                                        doListModels(serverId, modelsDiv, msgEl);
                                    })
                                    .catch(function(err) {
                                        setMsg(llmMsg, 'Erreur: ' + (err.message || err), 'error');
                                    });
                            });
                        }
                    }
                } else {
                    var errMsg = (data && data.message) || 'Aucun modèle ou erreur';
                    setMsg(msgEl, errMsg, 'error');
                    if (modelsDiv) {
                        modelsDiv.innerHTML =
                            '<div class="border rounded p-3 bg-light">' +
                            '  <p class="text-danger small mb-2">' + escapeHtml(errMsg) + '</p>' +
                            '  <button type="button" class="btn btn-sm btn-outline-primary btn-llm-retry">Réessayer</button>' +
                            '</div>';
                        modelsDiv.style.display = 'block';
                        var retryBtn = modelsDiv.querySelector('.btn-llm-retry');
                        if (retryBtn) retryBtn.addEventListener('click', function() { doListModels(serverId, modelsDiv, msgEl); });
                    }
                }
            })
            .catch(function(e) {
                var errMsg = 'Erreur: ' + (e.message || e);
                setMsg(msgEl, errMsg, 'error');
                if (modelsDiv) {
                    modelsDiv.innerHTML =
                        '<div class="border rounded p-3 bg-light">' +
                        '  <p class="text-danger small mb-2">' + escapeHtml(errMsg) + '</p>' +
                        '  <button type="button" class="btn btn-sm btn-outline-primary btn-llm-retry">Réessayer</button>' +
                        '</div>';
                    modelsDiv.style.display = 'block';
                    var retryBtn = modelsDiv.querySelector('.btn-llm-retry');
                    if (retryBtn) retryBtn.addEventListener('click', function() { doListModels(serverId, modelsDiv, msgEl); });
                }
            });
    }

    function doSaveModels(serverId, modelsDiv, llmMsgEl, fallbackMsgEl) {
        if (!modelsDiv) return;
        var checked = [].slice.call(modelsDiv.querySelectorAll('.llm-model-checkbox:checked')).map(function(inp) {
            return inp.value;
        });
        setMsg(llmMsgEl || fallbackMsgEl, 'Enregistrement des modèles…', 'muted');
        fetch(API_BASE + '/servers/' + serverId + '/models/enabled', {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({ models: checked })
        })
            .then(function(r) {
                if (!r.ok) {
                    return parseJson(r).then(function(d) {
                        var message = (d && d.message) ? d.message : ('API ' + r.status);
                        return { success: false, message: message };
                    });
                }
                return parseJson(r);
            })
            .then(function(res) {
                if (res && res.success) {
                    setMsg(llmMsgEl || fallbackMsgEl, 'Modèles mis à jour.', 'success');
                    // mettre à jour la copie locale
                    var idx = servers.findIndex(function(x) { return x._id === serverId; });
                    if (idx >= 0) {
                        servers[idx].enabledModels = checked;
                    }
                } else {
                    setMsg(llmMsgEl || fallbackMsgEl, (res && res.message) || 'Erreur lors de la mise à jour des modèles', 'error');
                }
            })
            .catch(function(e) {
                setMsg(llmMsgEl || fallbackMsgEl, 'Erreur: ' + (e.message || e), 'error');
            });
    }

    function getServerFormData(row) {
        var data = {};
        if (row) {
            var nameInp = row.querySelector('.server-name');
            var baseInp = row.querySelector('.server-baseUrl');
            var authInp = row.querySelector('.server-auth');
            var modelInp = row.querySelector('.server-defaultModel');
            if (nameInp) data.name = nameInp.value.trim();
            if (baseInp) data.baseUrl = baseInp.value.trim();
            if (authInp && authInp.value.trim()) {
                var s = servers.find(function(x) { return x._id === row.dataset.serverId; });
                data.auth = s && s.auth ? { type: s.auth.type || 'bearer' } : { type: 'bearer' };
                if (s && s.provider === 'ollama_server') data.auth.serviceToken = authInp.value.trim();
                else if (s && ['openai','anthropic','deepseek'].indexOf(s.provider) >= 0) data.auth.apiKey = authInp.value.trim();
                else data.auth.serviceToken = authInp.value.trim();
            }
            if (modelInp) data.defaultModel = modelInp.value.trim();
            var endpoints = {};
            row.querySelectorAll('tr[data-endpoint-row="1"]').forEach(function(tr) {
                var key = (tr.getAttribute('data-key') || '').trim();
                var val = (tr.getAttribute('data-path') || '').trim();
                // On conserve la clé même si le chemin est vide,
                // pour permettre aux endpoints par défaut (ex: /api/models) de fonctionner.
                if (key) {
                    endpoints[key] = val;
                }
            });
            data.endpoints = endpoints;
        }
        return data;
    }

    function doSave(serverId, row, msgEl) {
        var data = getServerFormData(row);
        setMsg(msgEl, 'Enregistrement…', 'muted');
        fetch(API_BASE + '/servers/' + serverId, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify(data)
        })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (res && res.success) {
                    setMsg(msgEl, 'Enregistré.', 'success');
                    loadServers();
                    closeAllServerModals();
                } else {
                    setMsg(msgEl, (res && res.message) || 'Erreur', 'error');
                }
            })
            .catch(function(e) {
                setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error');
            });
    }

    function doDelete(serverId, msgEl) {
        if (!confirm('Supprimer ce serveur ?')) return;
        setMsg(msgEl, 'Suppression…', 'muted');
        fetch(API_BASE + '/servers/' + serverId, { method: 'DELETE', headers: headers() })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (res && res.success) {
                    setMsg(msgEl, 'Supprimé.', 'success');
                    loadServers();
                    closeAllServerModals();
                } else {
                    setMsg(msgEl, (res && res.message) || 'Erreur', 'error');
                }
            })
            .catch(function(e) {
                setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error');
            });
    }

    function loadServers() {
        var msgEl = document.getElementById('serversApiMessage');
        if (msgEl) { msgEl.style.display = 'none'; msgEl.className = 'alert alert-info small mb-3'; }
        fetch(API_BASE + '/servers', { headers: headers() })
            .then(function(r) {
                if (r.status === 404) {
                    servers = [];
                    buildServerList();
                    if (msgEl) {
                        msgEl.textContent = 'Les routes « serveurs IA » ne sont pas disponibles (404). Déployez la dernière version du backend Node.js (modules/ia) et redémarrez le serveur.';
                        msgEl.classList.add('alert-warning');
                        msgEl.style.display = 'block';
                    }
                    return null;
                }
                return parseJson(r);
            })
            .then(function(data) {
                if (!data) return;
                if (data && data.success && data.servers) {
                    servers = data.servers;
                    buildServerList();
                }
            })
            .catch(function() {
                if (msgEl) {
                    msgEl.textContent = 'Impossible de charger la liste des serveurs (réseau ou backend).';
                    msgEl.classList.add('alert-danger');
                    msgEl.style.display = 'block';
                }
            });
    }

    function loadPresets() {
        fetch(API_BASE + '/servers/presets', { headers: headers() })
            .then(function(r) { return parseJson(r); })
            .then(function(data) {
                if (data && data.success && data.presets) {
                    presets = data.presets;
                    var sel = document.getElementById('addPresetId');
                    sel.innerHTML = '<option value="">-- Choisir un preset --</option>';
                    presets.forEach(function(p) {
                        var opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.label || p.id;
                        opt.dataset.baseUrl = (p.defaults && p.defaults.baseUrl) || '';
                        sel.appendChild(opt);
                    });
                }
            });
    }

    document.getElementById('btnAddServer').onclick = function() {
        document.getElementById('addServerBlock').style.display = 'block';
        document.getElementById('addName').value = '';
        document.getElementById('addBaseUrl').value = '';
        document.getElementById('addAuthValue').value = '';
        loadPresets();
    };
    document.getElementById('btnCancelAdd').onclick = function() {
        document.getElementById('addServerBlock').style.display = 'none';
    };
    document.getElementById('addPresetId').onchange = function() {
        var presetId = this.value;
        var preset = presets.find(function(p) { return p.id === presetId; });
        if (preset && preset.defaults && preset.defaults.baseUrl) {
            document.getElementById('addBaseUrl').value = preset.defaults.baseUrl;
            document.getElementById('addBaseUrl').placeholder = preset.defaults.baseUrl;
        }
    };
    document.getElementById('btnCreateServer').onclick = function() {
        var presetId = document.getElementById('addPresetId').value.trim();
        var name = document.getElementById('addName').value.trim();
        var baseUrl = document.getElementById('addBaseUrl').value.trim();
        var authValue = document.getElementById('addAuthValue').value.trim();
        if (!presetId) { alert('Choisissez un preset'); return; }
        var preset = presets.find(function(p) { return p.id === presetId; });
        var body = { presetId: presetId, name: name || (preset && preset.label) || presetId, baseUrl: baseUrl || (preset && preset.defaults && preset.defaults.baseUrl) || '' };
        if (authValue) {
            body.auth = preset && ['openai','anthropic','deepseek'].indexOf(preset.provider) >= 0
                ? { type: 'bearer', apiKey: authValue }
                : { type: 'bearer', serviceToken: authValue };
        }
        fetch(API_BASE + '/servers', { method: 'POST', headers: headers(), body: JSON.stringify(body) })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (res && res.success) {
                    document.getElementById('addServerBlock').style.display = 'none';
                    loadServers();
                } else {
                    alert((res && res.message) || 'Erreur création');
                }
            })
            .catch(function(e) { alert('Erreur: ' + (e.message || e)); });
    };
    document.getElementById('btnRefreshServers').onclick = function() { loadServers(); };

    loadServers();
})();
</script>

<?php require_once GDRI_ROOT . '/frontend/includes/footer.php'; ?>
