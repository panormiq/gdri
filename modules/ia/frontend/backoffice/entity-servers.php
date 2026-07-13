<?php
/**
 * IA – Serveurs : grille + modal.
 * - Mode entité : serveurs GDRI = politique (qui, limites) ; serveurs propres entité = infra complète.
 * - Mode console GDRI : voir config.php (infra, distribution).
 * - Mode utilisateur ($iaServersUiMode = 'user') : serveurs personnels + clés.
 */
require_once __DIR__ . '/bootstrap.php';

$iaServersUiMode = isset($iaServersUiMode) && $iaServersUiMode === 'user' ? 'user' : 'entity';

if ($iaServersUiMode === 'user') {
    if (!isLoggedIn()) {
        redirect(url('index.php'));
    }
} else {
    if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
        redirect(url('pages/dashboard.php'));
    }
}

$page_title = $iaServersUiMode === 'user' ? 'IA – Mon compte' : 'IA – Configuration entité';
require_once GDRI_ROOT . '/frontend/includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (empty($currentEntrepriseId) && isset($currentEntreprise) && !empty($currentEntreprise['_id'])) {
    $currentEntrepriseId = (string) $currentEntreprise['_id'];
}
$isAdminGdri = hasRole(ROLE_ADMIN_GDRI);
$currentUserId = isset($_SESSION['user_id']) ? (string) $_SESSION['user_id'] : '';
$isEntityMode = ($iaServersUiMode === 'entity');
?>

<section class="section">
    <div class="container">
        <h1 class="mb-3"><?= $iaServersUiMode === 'user' ? 'IA – Mes serveurs &amp; clés' : 'Serveurs IA – Entité' ?></h1>
        <?php if ($isEntityMode): ?>
        <p class="text-muted small mb-2">
            <strong>Serveurs GDRI mutualisés</strong> : accès aux modèles et limites de tokens.
            <strong>Votre serveur GDRI dédié / privé</strong> : modèles installés, accès utilisateurs et limites.
            Vous pouvez aussi <strong>ajouter vos propres clés</strong> (Anthropic, OpenAI…).
            Qui peut <strong>ajouter des LLM</strong> : page <a href="<?= url('pages/users.php') ?>">Utilisateurs &amp; Permissions</a> (admin du service IA).
        </p>
        <?php if ($isAdminGdri): ?>
        <p class="text-muted small mb-4">
            Infra des serveurs distribués plateforme :
            <a href="<?= url('pages/modules/ia-config.php') ?>">Console GDRI → Serveurs IA</a>
        </p>
        <?php else: ?>
        <p class="text-muted small mb-4">Cliquez sur un serveur GDRI pour autorisations et limites ; sur un serveur entité pour paramètres et clés.</p>
        <?php endif; ?>
        <?php else: ?>
        <p class="text-muted small mb-4"><?= $iaServersUiMode === 'user'
            ? 'Serveurs auxquels vous avez accès (entité ou personnels). Pour GPT / Claude / DeepSeek, ajoutez un serveur via le preset du fournisseur et votre clé API. Cliquez sur une carte pour paramètres, endpoints et modèles.'
            : 'Cliquez sur un serveur pour ouvrir le modal et gérer : paramètres, LLM, autorisations d’ajout et droits utilisateurs.' ?></p>
        <?php endif; ?>

        <div>
            <div id="serversApiMessage" class="alert alert-info small mb-3" style="display:none;"></div>
            <div class="mb-4">
                <button type="button" id="btnAddServer" class="btn btn-sm btn-outline-primary">+ Ajouter un serveur</button>
                <button type="button" id="btnRefreshServers" class="btn btn-sm btn-outline-secondary ml-2">Rafraîchir</button>
            </div>
            <?php if ($isEntityMode): ?>
            <div class="alert alert-light border small mb-4" role="status">
                <strong>Clés propres (Anthropic, OpenAI, DeepSeek…)</strong> : « + Ajouter un serveur », choisissez le preset du fournisseur, collez votre clé API.
                Le serveur est rattaché à votre entité (<code>scope entité</code>).
            </div>
            <?php elseif ($iaServersUiMode === 'user'): ?>
            <div class="alert alert-light border small mb-4" role="status">
                <strong>Vos clés (Anthropic, OpenAI, DeepSeek…)</strong> : ajoutez un serveur personnel via « + Ajouter un serveur ».
                Les serveurs mutualisés de l’entité sont visibles en lecture seule — la politique d’accès est gérée par votre administrateur.
            </div>
            <?php endif; ?>
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
.server-row { border: 1px solid #dee2e6; border-radius: 10px; overflow: hidden; cursor: pointer; background: #f8f9fa; }
.server-row-head { padding: 16px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8f9fa; text-align: left; }
.server-row-head:hover { background: #e9ecef; }
.server-row-head-main { display: flex; align-items: center; justify-content: center; gap: 10px; flex: 1; min-width: 0; }
.server-row-head h3 { margin: 0; font-size: 1rem; font-weight: 600; text-align: center; }
.server-head-delete { flex-shrink: 0; }
.server-row-icon { font-size: 1.8rem; }
.server-row-body {
    padding: 16px; background: #fff; border-top: 1px solid #dee2e6; display: none;
    position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
    max-width: 640px; width: 90%; z-index: 1050;
    box-shadow: 0 12px 30px rgba(0,0,0,0.25); border-radius: 10px; padding-top: 28px;
}
.server-modal-close { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; padding: 0; line-height: 18px; font-size: 12px; border-radius: 999px; }
.server-row.open .server-row-body { display: block; }
.server-chevron { display:none; }
.server-form .form-group { margin-bottom: 12px; }
.server-form label { margin-bottom: 4px; font-weight: 500; }
.server-actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.server-models { margin-top: 12px; }
.server-models ul { margin: 0; padding-left: 20px; max-height: 160px; overflow-y: auto; }
.server-advanced { margin-top: 12px; }
.server-advanced table { font-size: 0.9rem; }
.server-tabs { display: flex; width: 100%; border-radius: 999px; padding: 2px; background: #e9ecef; margin-bottom: 8px; overflow: hidden; }
.server-tab-btn { flex: 1 1 0; border: none; background: transparent; padding: 6px 0; font-size: 0.85rem; cursor: pointer; color: #495057; text-align: center; }
.server-tab-btn.active { background: #fff; box-shadow: 0 0 0 1px rgba(13,110,253,0.12); color: #0d6efd; }
.server-tab-pane { margin-top: 8px; }
.entityAddLlmRolesList .form-check,
.entityAddLlmUsersList .form-check,
.server-users-rights .form-check {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    margin-bottom: 6px;
}
.entityAddLlmRolesList .form-check-input,
.entityAddLlmUsersList .form-check-input,
.server-users-rights .form-check-input {
    position: static;
    width: 20px;
    min-width: 20px;
    max-width: 20px;
    margin-top: 0;
    margin-left: 6px;
    flex: 0 0 auto;
}
.entityAddLlmRolesList .form-check-label,
.entityAddLlmUsersList .form-check-label,
.server-users-rights .form-check-label {
    line-height: 1.1;
    flex: 0 1 auto;
    margin-right: 4px;
}
.server-users-layout { display: grid; grid-template-columns: 260px 1fr; gap: 12px; }
.server-users-list { border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; background: #fff; }
.server-users-list .list-group-item { cursor: pointer; }
.server-users-list .list-group-item.active { background: #0d6efd; color: #fff; }
.server-users-rights { border: 1px solid #dee2e6; border-radius: 8px; background: #fff; padding: 10px; }
.server-users-rights .llm-list { max-height: 260px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 6px; padding: 8px; }
.default-model-wrap { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; max-width: 320px; }
.default-model-wrap .server-defaultModel { flex: 1 1 200px; min-width: 0; }
.default-model-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #fff; border: 1px solid #dee2e6; border-radius: 6px; box-shadow: 0 6px 16px rgba(0,0,0,0.15); z-index: 1060; padding: 8px; max-height: 280px; display: flex; flex-direction: column; }
.default-model-search { margin-bottom: 6px; }
.default-model-list { overflow-y: auto; max-height: 220px; }
.default-model-list-item { padding: 6px 10px; cursor: pointer; border-radius: 4px; font-size: 0.9rem; }
.default-model-list-item:hover { background: #e9ecef; }
.default-model-list-item.empty { color: #6c757d; cursor: default; }
</style>

<script>
(function() {
    const API_BASE = '<?= addslashes($api_base_url) ?>/ia';
    const JWT = '<?= addslashes($jwt_token) ?>';
    const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JWT });
    const CURRENT_ENTITY_ID = '<?= addslashes((string)($currentEntrepriseId ?? '')) ?>';
    const IS_ADMIN_GDRI = <?= $isAdminGdri ? 'true' : 'false' ?>;
    const IA_SERVERS_UI_MODE = <?= json_encode($iaServersUiMode) ?>;
    const CURRENT_USER_ID = '<?= addslashes((string)$currentUserId) ?>';

    const IA_SERVERS_ENTITY_MODE = <?= $isEntityMode ? 'true' : 'false' ?>;

    function isPlatformServer(s) {
        return !!(s && s.scope === 'global');
    }

    function isEntityOwnedGdriServer(s) {
        return !!(isPlatformServer(s) && CURRENT_ENTITY_ID && s.owner_entity_id
            && String(s.owner_entity_id) === String(CURRENT_ENTITY_ID));
    }

    /** Serveur GDRI acheté / dédié : console entité (modèles, droits) sans infra technique. */
    function isEntityConsoleServer(s) {
        if (!IA_SERVERS_ENTITY_MODE || !isEntityOwnedGdriServer(s)) return false;
        var mode = s.mode || '';
        return mode === 'private' || mode === 'dedicated';
    }

    /** Serveur GDRI mutualisé ou non owner : politique seule (qui, limites). */
    function isPolicyOnlyServer(s) {
        return IA_SERVERS_ENTITY_MODE && isPlatformServer(s) && !isEntityConsoleServer(s);
    }

    function withEntityQuery(path) {
        if (IS_ADMIN_GDRI && CURRENT_ENTITY_ID) {
            var sep = path.indexOf('?') === -1 ? '?' : '&';
            return path + sep + 'entity_id=' + encodeURIComponent(CURRENT_ENTITY_ID);
        }
        return path;
    }
    function fetchJsonWithStatus(url) {
        return fetch(url, { headers: headers() })
            .then(function(r) {
                return parseJson(r).then(function(data) {
                    return { ok: r.ok, status: r.status, data: data || {} };
                });
            });
    }

    // ========== ONGLET SERVEURS (style config.php) ==========
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

    function isMutualizedPlatformServer(s) {
        if (!s || s.scope !== 'global') return false;
        var mode = s.mode ? String(s.mode).trim() : '';
        if (mode === 'mutualized') return true;
        var hasOwner = !!(s.owner_entity_id && String(s.owner_entity_id).trim());
        if (!hasOwner && mode !== 'private' && mode !== 'dedicated') return true;
        return false;
    }

    function canDeleteServer(s) {
        if (!s || isMutualizedPlatformServer(s)) return false;
        return canManageServer(s);
    }

    function canManageServer(s) {
        if (!s) return false;
        if (IS_ADMIN_GDRI) return true;
        if (IA_SERVERS_UI_MODE === 'user') {
            if (s.scope === 'user') return true;
            if (s.owner_user_id && String(s.owner_user_id) === String(CURRENT_USER_ID)) return true;
            return false;
        }
        if (s.scope === 'entity' && CURRENT_ENTITY_ID && s.entity_id && String(s.entity_id) === String(CURRENT_ENTITY_ID)) {
            return true;
        }
        // Serveurs GDRI owner : console entité (modèles), pas édition infra / suppression
        if (isEntityConsoleServer(s)) return false;
        if (CURRENT_ENTITY_ID && s.owner_entity_id && String(s.owner_entity_id) === String(CURRENT_ENTITY_ID)) {
            return true;
        }
        if (s.owner_user_id && CURRENT_USER_ID && String(s.owner_user_id) === String(CURRENT_USER_ID)) {
            return true;
        }
        return false;
    }

    function buildServerList() {
        const ul = document.getElementById('serverList');
        if (!ul) return;
        ul.innerHTML = '';
        servers.forEach(function(s) {
            const id = s._id;
            const li = document.createElement('li');
            li.className = 'server-row';
            li.dataset.serverId = id;
            const ownedGdri = isEntityOwnedGdriServer(s);
            const scopeLabel = ownedGdri
                ? (' (votre serveur GDRI – ' + escapeHtml(s.mode || 'dédié') + ')')
                : (s.scope === 'global' ? ' (offert par GDRI)' : (s.scope === 'entity' ? ' (entité)' : ' (perso)'));
            var policyOnly = isPolicyOnlyServer(s);
            var entityConsole = isEntityConsoleServer(s);
            var userReadOnlyGdri = (IA_SERVERS_UI_MODE === 'user' && isPlatformServer(s));
            var extraTabs = '';
            var extraPanes = '';
            if (userReadOnlyGdri) {
                extraTabs =
                    '    <button type="button" class="server-tab-btn active" data-tab="overview">Aperçu</button>';
                extraPanes =
                    '  <div class="server-tab-pane server-tab-overview">' +
                    '    <div class="server-overview small text-muted"></div>' +
                    '  </div>';
            } else if (policyOnly) {
                extraTabs =
                    '    <button type="button" class="server-tab-btn active" data-tab="overview">Aperçu</button>' +
                    '    <button type="button" class="server-tab-btn" data-tab="users">Accès aux modèles</button>' +
                    '    <button type="button" class="server-tab-btn" data-tab="limits">Limites</button>';
                extraPanes =
                    '  <div class="server-tab-pane server-tab-overview">' +
                    '    <div class="server-overview small text-muted"></div>' +
                    '  </div>' +
                    '  <div class="server-tab-pane server-tab-users" style="display:none;"></div>' +
                    '  <div class="server-tab-pane server-tab-limits" style="display:none;"></div>';
            } else if (entityConsole) {
                extraTabs =
                    '    <button type="button" class="server-tab-btn active" data-tab="overview">Aperçu</button>' +
                    '    <button type="button" class="server-tab-btn" data-tab="llm">Modèles installés</button>' +
                    '    <button type="button" class="server-tab-btn" data-tab="users">Accès aux modèles</button>' +
                    '    <button type="button" class="server-tab-btn" data-tab="limits">Limites</button>';
                extraPanes =
                    '  <div class="server-tab-pane server-tab-overview">' +
                    '    <div class="server-overview small text-muted"></div>' +
                    '  </div>' +
                    '  <div class="server-tab-pane server-tab-llm" style="display:none;">' +
                    '    <div class="server-models"></div>' +
                    '    <div class="server-msg small mt-2"></div>' +
                    '  </div>' +
                    '  <div class="server-tab-pane server-tab-users" style="display:none;"></div>' +
                    '  <div class="server-tab-pane server-tab-limits" style="display:none;"></div>';
            } else if (IA_SERVERS_UI_MODE === 'entity') {
                extraTabs =
                    '    <button type="button" class="server-tab-btn" data-tab="users">Accès aux modèles</button>';
                extraPanes =
                    '  <div class="server-tab-pane server-tab-users" style="display:none;"></div>';
            }
            var paramsTabActive = (policyOnly || entityConsole || userReadOnlyGdri) ? '' : ' active';
            var paramsPaneStyle = (policyOnly || entityConsole || userReadOnlyGdri) ? ' style="display:none;"' : '';
            li.innerHTML =
                '<div class="server-row-head">' +
                '  <div class="server-row-head-main">' +
                '    <span class="server-row-icon">🖥️</span>' +
                '    <h3>' + escapeHtml(s.name || s.provider || id) + scopeLabel + '</h3>' +
                '  </div>' +
                (canDeleteServer(s)
                    ? '<button type="button" class="btn btn-sm btn-outline-danger server-head-delete" title="Supprimer ce serveur">Supprimer</button>'
                    : '') +
                '</div>' +
                '<div class="server-row-body">' +
                '  <button type="button" class="btn btn-sm btn-light server-modal-close" title="Fermer">✕</button>' +
                '  <div class="server-tabs mb-2">' +
                (policyOnly || entityConsole || userReadOnlyGdri
                    ? ''
                    : '    <button type="button" class="server-tab-btn' + paramsTabActive + '" data-tab="params">Serveur</button>' +
                      '    <button type="button" class="server-tab-btn" data-tab="advanced">Avancé</button>' +
                      '    <button type="button" class="server-tab-btn" data-tab="llm">LLM</button>') +
                extraTabs +
                '  </div>' +
                (policyOnly || entityConsole || userReadOnlyGdri
                    ? ''
                    : '  <div class="server-tab-pane server-tab-params"' + paramsPaneStyle + '>' +
                      '    <div class="server-form" data-server-id="' + escapeHtml(id) + '"></div>' +
                      '    <div class="server-actions"></div>' +
                      '    <div class="server-msg small mt-2"></div>' +
                      '  </div>' +
                      '  <div class="server-tab-pane server-tab-advanced" style="display:none;">' +
                      '    <div class="server-advanced"></div>' +
                      '  </div>' +
                      '  <div class="server-tab-pane server-tab-llm" style="display:none;">' +
                      '    <div class="server-models"></div>' +
                      '  </div>') +
                extraPanes +
                '</div>';
            ul.appendChild(li);
        });
        document.querySelectorAll('#serverList .server-row').forEach(function(row) {
            var serverId = row.dataset.serverId;
            var headDelete = row.querySelector('.server-head-delete');
            if (headDelete) {
                headDelete.onclick = function(e) {
                    e.stopPropagation();
                    var msgEl = document.getElementById('serversApiMessage');
                    if (msgEl) {
                        msgEl.style.display = 'block';
                        msgEl.className = 'alert alert-info small mb-3';
                    }
                    doDelete(serverId, msgEl);
                };
            }
            row.querySelector('.server-row-head').onclick = function(e) {
                if (e.target && e.target.closest('.server-head-delete')) return;
                row.classList.toggle('open');
                if (row.classList.contains('open')) renderServerForm(row.dataset.serverId);
                updateOverlayVisibility();
            };
        });
    }

    function updateOverlayVisibility() {
        var anyOpen = !!document.querySelector('#serverList .server-row.open');
        var overlay = document.getElementById('serverOverlay');
        if (overlay) overlay.style.display = anyOpen ? 'block' : 'none';
    }
    function closeAllServerModals() {
        document.querySelectorAll('#serverList .server-row.open').forEach(function(row) { row.classList.remove('open'); });
        updateOverlayVisibility();
    }
    (function bindOverlayClose() {
        var overlay = document.getElementById('serverOverlay');
        if (overlay) overlay.addEventListener('click', function() { closeAllServerModals(); });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeAllServerModals(); });
    })();

    function renderLimitsPane(row, serverId) {
        const limitsPane = row.querySelector('.server-tab-limits');
        if (!limitsPane) return;
        limitsPane.innerHTML = '<p class="text-muted small">Chargement des limites…</p>';
        fetch(withEntityQuery(API_BASE + '/servers/' + encodeURIComponent(serverId) + '/entity-policy'), { headers: headers() })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (!res || !res.success) {
                    limitsPane.innerHTML = '<p class="text-danger small">Impossible de charger les limites.</p>';
                    return;
                }
                var p = res.policy || {};
                var usageLine = '';
                if (p.tokens_used_this_month != null) {
                    usageLine = '<p class="text-muted small">Consommation ce mois (' + escapeHtml(p.usage_month || '') + ') : <strong>' +
                        escapeHtml(String(p.tokens_used_this_month)) + '</strong>' +
                        (p.max_tokens_per_month != null ? ' / ' + escapeHtml(String(p.max_tokens_per_month)) : '') +
                        ' tokens estimés</p>';
                }
                limitsPane.innerHTML =
                    '<div class="mb-2"><strong>Limites de consommation (entité)</strong></div>' +
                    '<p class="text-muted small">Plafonds appliqués aux utilisateurs de votre entité sur ce serveur.</p>' +
                    usageLine +
                    '<div class="form-group mb-2">' +
                    '  <label class="d-flex align-items-center gap-2">' +
                    '    <input type="checkbox" class="form-check-input policy-enabled" ' + (p.enabled !== false ? 'checked' : '') + '>' +
                    '    <span>Serveur activé pour l\'entité</span>' +
                    '  </label>' +
                    '</div>' +
                    '<div class="form-group">' +
                    '  <label class="small">Tokens max / mois (vide = illimité)</label>' +
                    '  <input type="number" min="0" step="1000" class="form-control form-control-sm policy-max-month" style="max-width:240px" value="' + (p.max_tokens_per_month != null ? escapeHtml(String(p.max_tokens_per_month)) : '') + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                    '  <label class="small">Tokens max / requête (vide = défaut modèle)</label>' +
                    '  <input type="number" min="0" step="100" class="form-control form-control-sm policy-max-request" style="max-width:240px" value="' + (p.max_tokens_per_request != null ? escapeHtml(String(p.max_tokens_per_request)) : '') + '">' +
                    '</div>' +
                    '<button type="button" class="btn btn-sm btn-primary btn-save-policy">Enregistrer les limites</button>' +
                    '<div class="policy-msg small mt-2 text-muted"></div>';
                var saveBtn = limitsPane.querySelector('.btn-save-policy');
                var msgEl = limitsPane.querySelector('.policy-msg');
                if (saveBtn) {
                    saveBtn.onclick = function() {
                        var body = {
                            enabled: !!limitsPane.querySelector('.policy-enabled')?.checked,
                            max_tokens_per_month: limitsPane.querySelector('.policy-max-month')?.value.trim() || null,
                            max_tokens_per_request: limitsPane.querySelector('.policy-max-request')?.value.trim() || null
                        };
                        setMsg(msgEl, 'Enregistrement…', 'muted');
                        fetch(withEntityQuery(API_BASE + '/servers/' + encodeURIComponent(serverId) + '/entity-policy'), {
                            method: 'PUT',
                            headers: headers(),
                            body: JSON.stringify(body)
                        })
                            .then(function(r) { return parseJson(r); })
                            .then(function(saveRes) {
                                if (saveRes && saveRes.success) setMsg(msgEl, 'Limites enregistrées.', 'success');
                                else setMsg(msgEl, (saveRes && saveRes.message) || 'Erreur', 'error');
                            })
                            .catch(function(e) { setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error'); });
                    };
                }
            })
            .catch(function() {
                limitsPane.innerHTML = '<p class="text-danger small">Erreur réseau.</p>';
            });
    }

    function renderServerForm(serverId) {
        const s = servers.find(function(x) { return x._id === serverId; });
        if (!s) return;
        const row = document.querySelector('#serverList .server-row[data-server-id="' + serverId + '"]');
        if (!row) return;
        const body = row.querySelector('.server-row-body');
        if (body) body.addEventListener('click', function(e) { e.stopPropagation(); }, { once: true });

        var policyOnly = isPolicyOnlyServer(s);
        var entityConsole = isEntityConsoleServer(s);
        var userReadOnlyGdri = (IA_SERVERS_UI_MODE === 'user' && isPlatformServer(s));

        if (policyOnly || entityConsole || userReadOnlyGdri) {
            const overviewPane = row.querySelector('.server-tab-overview');
            if (overviewPane) {
                const ov = overviewPane.querySelector('.server-overview');
                if (ov) {
                    var dedicatedMods = Array.isArray(s.dedicated_module_ids) ? s.dedicated_module_ids : (s.dedicated_module_id ? [s.dedicated_module_id] : []);
                    ov.innerHTML =
                        '<p><strong>' + escapeHtml(s.name || s.provider || serverId) + '</strong></p>' +
                        (userReadOnlyGdri
                            ? '<p class="text-muted small">Serveur géré par votre entité / GDRI. Contactez un administrateur pour les droits d’accès aux modèles.</p>'
                            : ('<p>Mode : <strong>' + escapeHtml(s.mode || '—') + '</strong> — infra maintenue par GDRI</p>')) +
                        '<p>Fournisseur : ' + escapeHtml(s.provider || '—') + '</p>' +
                        (entityConsole ? '<p class="text-muted small">Utilisez l’onglet <strong>Modèles installés</strong> pour gérer les LLM, et <strong>Accès aux modèles</strong> pour les droits utilisateurs.</p>' : '') +
                        (policyOnly ? '<p class="text-muted small">Qui peut ajouter des LLM : page <strong>Utilisateurs &amp; Permissions</strong> (admin du service IA).</p>' : '') +
                        (dedicatedMods.length ? '<p>Apps liées : ' + dedicatedMods.map(escapeHtml).join(', ') + '</p>' : '') +
                        '<p class="mb-0">Modèle par défaut : ' + escapeHtml(s.defaultModel || '—') + '</p>';
                }
            }
            row.querySelectorAll('.server-tab-pane').forEach(function(p) { p.style.display = 'none'; });
            var overviewPaneFirst = row.querySelector('.server-tab-overview');
            if (overviewPaneFirst) overviewPaneFirst.style.display = 'block';
            row.querySelectorAll('.server-tab-btn').forEach(function(b) {
                b.classList.toggle('active', (b.dataset.tab || '') === 'overview');
            });
            renderLimitsPane(row, serverId);
        }

        const formDiv = row.querySelector('.server-form');
        const actionsDiv = row.querySelector('.server-actions');
        const advancedDiv = row.querySelector('.server-advanced');
        const modelsDiv = row.querySelector('.server-models');
        const msgDiv = row.querySelector('.server-msg') || row.querySelector('.server-tab-llm .server-msg');
        if (!policyOnly && !entityConsole && !userReadOnlyGdri && (!formDiv || !actionsDiv || !advancedDiv || !modelsDiv || !msgDiv)) return;
        if ((policyOnly || entityConsole || userReadOnlyGdri) && !formDiv) {
            // autorisations / utilisateurs / limites (+ modèles si console entité)
        } else if (!formDiv) {
            return;
        }

        var readOnly = !canManageServer(s);
        if (formDiv) {
        formDiv.innerHTML =
            '<div class="form-group"><label>Nom</label><input type="text" class="form-control form-control-sm server-name" value="' + escapeHtml(s.name || '') + '" style="max-width:320px" ' + (readOnly ? 'readonly' : '') + '></div>' +
            '<div class="form-group"><label>URL de base</label><input type="url" class="form-control form-control-sm server-baseUrl" value="' + escapeHtml(s.baseUrl || '') + '" style="max-width:320px" ' + (readOnly ? 'readonly' : '') + '></div>' +
            '<div class="form-group"><label>Token / Clé</label><input type="password" class="form-control form-control-sm server-auth" placeholder="' + (s.auth && (s.auth.serviceToken || s.auth.apiKey) ? '••••••••' : 'optionnel') + '" style="max-width:320px" autocomplete="off" ' + (readOnly ? 'readonly' : '') + '></div>' +
            '<div class="form-group default-model-form-group"><label>Modèle par défaut</label>' +
            '<div class="default-model-wrap">' +
            '<input type="text" class="form-control form-control-sm server-defaultModel" value="' + escapeHtml(s.defaultModel || '') + '" style="max-width:320px" ' + (readOnly ? 'readonly' : '') + ' placeholder="Saisir ou choisir…">' +
            (readOnly ? '' : '<button type="button" class="btn btn-sm btn-outline-secondary default-model-btn-choose" title="Choisir dans la liste">Choisir…</button>') +
            '<div class="default-model-dropdown" style="display:none;">' +
            '<input type="text" class="form-control form-control-sm default-model-search" placeholder="Rechercher…" autocomplete="off">' +
            '<div class="default-model-list"></div>' +
            '</div></div></div>';

        var endpoints = s.endpoints || {};
        var advHtml = '<strong>Config avancée (endpoints)</strong><table class="table table-sm table-bordered mt-1"><thead><tr><th>Clé</th><th>Chemin</th></tr></thead><tbody>';
        ['prompt','health','models','modelsAdd','modelsDelete'].forEach(function(k) {
            advHtml += '<tr><td>' + escapeHtml(k) + '</td><td><input type="text" class="form-control form-control-sm endpoint-val" data-key="' + escapeHtml(k) + '" value="' + escapeHtml(endpoints[k] || '') + '" style="min-width:200px" ' + (readOnly ? 'readonly' : '') + '></td></tr>';
        });
        advHtml += '</tbody></table>';
        if (advancedDiv) advancedDiv.innerHTML = advHtml;

        var isOllama = s.provider === 'ollama_server' || s.provider === 'ollama_direct';
        var actionsHtml = '<button type="button" class="btn btn-sm btn-outline btn-test">Tester</button>';
        if (isOllama) actionsHtml += '<button type="button" class="btn btn-sm btn-outline btn-list-models">Lister les modèles</button>';
        if (!readOnly) {
            actionsHtml += '<button type="button" class="btn btn-sm btn-primary btn-save">Enregistrer</button>';
            if (canDeleteServer(s)) {
                actionsHtml += '<button type="button" class="btn btn-sm btn-outline-danger btn-delete">Supprimer</button>';
            }
        }
        if (actionsDiv) actionsDiv.innerHTML = actionsHtml;

        if (modelsDiv) {
        modelsDiv.style.display = 'none';
        modelsDiv.innerHTML = '<p class="text-muted small mb-2">Chargement des modèles…</p>';
        }
        }

        // Pane Accès aux modèles (admin entité)
        const usersPane = row.querySelector('.server-tab-users');
        if (usersPane) {
            usersPane.innerHTML =
                '<div class="mb-2"><strong>Accès aux modèles</strong></div>' +
                '<div class="text-muted small mb-2">Sélectionnez un rôle ou un utilisateur, puis cochez les modèles autorisés sur ce serveur.</div>' +
                '<div class="row" style="margin:0 -6px;">' +
                '  <div class="col-md-3" style="padding:0 6px;">' +
                '    <div class="server-users-list">' +
                '      <div class="p-2 border-bottom"><input type="text" class="form-control form-control-sm server-role-search" placeholder="Rechercher un rôle…"></div>' +
                '      <ul class="list-group list-group-flush server-role-list"><li class="list-group-item">Chargement…</li></ul>' +
                '    </div>' +
                '  </div>' +
                '  <div class="col-md-3" style="padding:0 6px;">' +
                '    <div class="server-users-list">' +
                '      <div class="p-2 border-bottom"><input type="text" class="form-control form-control-sm server-user-search" placeholder="Rechercher un utilisateur…"></div>' +
                '      <ul class="list-group list-group-flush server-user-list"><li class="list-group-item">Chargement…</li></ul>' +
                '    </div>' +
                '  </div>' +
                '  <div class="col-md-6" style="padding:0 6px;">' +
                '    <div class="server-users-rights">' +
                '      <div class="text-muted small server-user-placeholder">Sélectionnez un rôle ou un utilisateur.</div>' +
                '      <div class="server-user-rights d-none">' +
                '        <div class="d-flex justify-content-between align-items-center mb-2" style="gap:10px;">' +
                '          <strong class="server-user-title"></strong>' +
                '          <div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                '            <button type="button" class="btn btn-sm btn-outline-secondary btn-assign-all-rights">Tout assigner</button>' +
                '            <button type="button" class="btn btn-sm btn-primary btn-save-user-rights">Enregistrer</button>' +
                '          </div>' +
                '        </div>' +
                '        <div class="llm-list mb-2"></div>' +
                '        <div class="small server-user-msg text-muted" style="min-height:1.2rem;\"></div>' +
                '      </div>' +
                '    </div>' +
                '  </div>' +
                '</div>';
        }

        var btnClose = row.querySelector('.server-modal-close');
        if (btnClose) btnClose.onclick = function(e) { e.stopPropagation(); closeAllServerModals(); };
        if (row.querySelector('.btn-test') && msgDiv) row.querySelector('.btn-test').onclick = function() { doTest(serverId, msgDiv); };
        if (row.querySelector('.btn-list-models') && modelsDiv && msgDiv) row.querySelector('.btn-list-models').onclick = function() { doListModels(serverId, modelsDiv, msgDiv); };
        if (row.querySelector('.btn-save') && msgDiv) row.querySelector('.btn-save').onclick = function() { doSave(serverId, row, msgDiv); };
        if (row.querySelector('.btn-delete') && msgDiv) row.querySelector('.btn-delete').onclick = function() { doDelete(serverId, msgDiv); };

        if (modelsDiv && msgDiv && !modelsDiv.dataset.loaded) {
            doListModels(serverId, modelsDiv, msgDiv);
            modelsDiv.dataset.loaded = '1';
        }

        // Onglets dans le modal
        row.querySelectorAll('.server-tab-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var t = btn.dataset.tab || 'params';
                row.querySelectorAll('.server-tab-pane').forEach(function(p) { p.style.display = 'none'; });
                if (t === 'params') { var pp = row.querySelector('.server-tab-params'); if (pp) pp.style.display = 'block'; }
                else if (t === 'advanced') { var ad = row.querySelector('.server-tab-advanced'); if (ad) ad.style.display = 'block'; }
                else if (t === 'llm') { var lp = row.querySelector('.server-tab-llm'); if (lp) lp.style.display = 'block'; }
                else if (t === 'overview') { var op = row.querySelector('.server-tab-overview'); if (op) op.style.display = 'block'; }
                else if (t === 'auth') { var ap = row.querySelector('.server-tab-auth'); if (ap) ap.style.display = 'block'; }
                else if (t === 'users') { var up = row.querySelector('.server-tab-users'); if (up) up.style.display = 'block'; }
                else if (t === 'limits') { var lp2 = row.querySelector('.server-tab-limits'); if (lp2) lp2.style.display = 'block'; }
                row.querySelectorAll('.server-tab-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === t); });
            };
        });

        // Modèle par défaut : liste avec recherche
        var btnChoose = row.querySelector('.default-model-btn-choose');
        var dropWrap = row.querySelector('.default-model-wrap');
        var dropdown = row.querySelector('.default-model-dropdown');
        var searchInput = row.querySelector('.default-model-search');
        var listEl = row.querySelector('.default-model-list');
        var defaultModelInput = row.querySelector('.server-defaultModel');
        if (btnChoose && dropdown && listEl && defaultModelInput) {
            var currentModelsList = [];
            function renderModelList(filter) {
                var q = (filter || '').trim().toLowerCase();
                var filtered = q ? currentModelsList.filter(function(n) { return n.toLowerCase().indexOf(q) !== -1; }) : currentModelsList;
                listEl.innerHTML = '';
                if (filtered.length === 0) {
                    listEl.innerHTML = '<div class="default-model-list-item empty">' + (currentModelsList.length ? 'Aucun modèle ne correspond' : 'Chargement…') + '</div>';
                    return;
                }
                filtered.forEach(function(name) {
                    var div = document.createElement('div');
                    div.className = 'default-model-list-item';
                    div.textContent = name;
                    div.onclick = function(e) {
                        e.stopPropagation();
                        defaultModelInput.value = name;
                        dropdown.style.display = 'none';
                        defaultModelInput.focus();
                    };
                    listEl.appendChild(div);
                });
            }
            btnChoose.onclick = function(e) {
                e.stopPropagation();
                if (dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                    return;
                }
                dropdown.style.display = 'block';
                searchInput.value = '';
                searchInput.focus();
                if (currentModelsList.length === 0) {
                    renderModelList('');
                    fetchModelsForServer(serverId).then(function(names) {
                        currentModelsList = names;
                        renderModelList(searchInput.value);
                    });
                } else {
                    renderModelList(searchInput.value);
                }
                var closeHandler = function(ev) {
                    if (!dropWrap.contains(ev.target)) {
                        dropdown.style.display = 'none';
                        document.removeEventListener('click', closeHandler);
                    }
                };
                setTimeout(function() { document.addEventListener('click', closeHandler); }, 0);
            };
            searchInput.oninput = function() { renderModelList(this.value); };
            searchInput.onkeydown = function(e) {
                if (e.key === 'Escape') { dropdown.style.display = 'none'; this.blur(); }
            };
        }

        if (IA_SERVERS_UI_MODE === 'entity') { (function bindUsersTab() {
            var usersPane = row.querySelector('.server-tab-users');
            if (!usersPane) return;
            var roleListEl = usersPane.querySelector('.server-role-list');
            var roleSearchEl = usersPane.querySelector('.server-role-search');
            var listEl = usersPane.querySelector('.server-user-list');
            var userSearchEl = usersPane.querySelector('.server-user-search');
            var placeholder = usersPane.querySelector('.server-user-placeholder');
            var rightsBox = usersPane.querySelector('.server-user-rights');
            var titleEl = usersPane.querySelector('.server-user-title');
            var llmListEl = usersPane.querySelector('.llm-list');
            var msgEl = usersPane.querySelector('.server-user-msg');
            var btnSave = usersPane.querySelector('.btn-save-user-rights');
            var btnAssignAll = usersPane.querySelector('.btn-assign-all-rights');

            var currentSelectionType = null; // 'role' | 'user'
            var currentSelectionId = null;
            var users = [];
            var entityRoles = [];
            var modelsForServer = [];
            var serversById = {};
            var currentAllowedAll = []; // noms de modèles accordés pour la sélection courante

            function setUserMsg(text, isError) {
                if (!msgEl) return;
                msgEl.textContent = text || '';
                msgEl.className = 'small server-user-msg ' + (isError ? 'text-danger' : 'text-muted');
            }

            function renderLlmCheckboxes(allowedSet) {
                if (!llmListEl) return;
                if (!modelsForServer.length) {
                    llmListEl.innerHTML = '<div class="text-muted small">Aucun LLM trouvé pour ce serveur.</div>';
                    return;
                }
                var html = '';
                var titleSrv = (serversById[String(serverId)] && (serversById[String(serverId)].name || serversById[String(serverId)].provider)) || 'Serveur';
                html += '<div class="border rounded p-2 mb-2">';
                html += '<div class="small fw-semibold mb-1">' + escapeHtml(titleSrv) + '</div>';
                modelsForServer.forEach(function(modelName, idx) {
                    var id = 'usrllm_' + serverId + '_' + idx;
                    var checked = allowedSet.has(String(modelName)) ? ' checked' : '';
                    html += '<div class="form-check small mb-1">' +
                        '<input class="form-check-input srv-llm-cb" type="checkbox" id="' + escapeHtml(id) + '" value="' + escapeHtml(modelName) + '"' + checked + '>' +
                        '<label class="form-check-label" for="' + escapeHtml(id) + '">' + escapeHtml(modelName) + '</label>' +
                        '</div>';
                });
                html += '</div>';
                llmListEl.innerHTML = html;
            }

            function loadRightsForSelection(type, id, label) {
                currentSelectionType = type;
                currentSelectionId = id;
                if (placeholder) placeholder.classList.add('d-none');
                if (rightsBox) rightsBox.classList.remove('d-none');
                if (titleEl) titleEl.textContent = label;
                setUserMsg('Chargement des droits…', false);
                var url = (type === 'role')
                    ? withEntityQuery(API_BASE + '/rights/server/role/' + encodeURIComponent(id) + '/' + encodeURIComponent(serverId))
                    : withEntityQuery(API_BASE + '/rights/server/user/' + encodeURIComponent(id) + '/' + encodeURIComponent(serverId));
                fetch(url, { headers: headers() })
                    .then(function(r) { return r.ok ? r.json() : {}; })
                    .then(function(rdata) {
                        currentAllowedAll = (rdata && rdata.model_names) ? rdata.model_names.map(String) : [];
                        renderLlmCheckboxes(new Set(currentAllowedAll));
                        setUserMsg('', false);
                    })
                    .catch(function(e) { setUserMsg('Erreur: ' + (e.message || e), true); });
            }

            function formatUserRolesLabel(user) {
                if (!user) return '';
                var parts = [];
                if (Array.isArray(user.entity_roles) && user.entity_roles.length) {
                    user.entity_roles.forEach(function(key) {
                        var found = entityRoles.find(function(r) { return String(r.key) === String(key); });
                        parts.push(found ? found.label : key);
                    });
                } else if (user.membership_role || user.role) {
                    var mk = String(user.membership_role || user.role);
                    var foundM = entityRoles.find(function(r) { return String(r.key) === mk; });
                    parts.push(foundM ? foundM.label : (mk === 'admin' ? 'Administrateur' : (mk === 'user' ? 'Utilisateur' : mk)));
                }
                return parts.length ? parts.join(', ') : 'Utilisateur';
            }

            function renderRolesList() {
                if (!roleListEl) return;
                var q = (roleSearchEl && roleSearchEl.value ? roleSearchEl.value : '').trim().toLowerCase();
                var visible = entityRoles.filter(function(r) {
                    var label = (r.label || r.key || '').toLowerCase();
                    var key = (r.key || '').toLowerCase();
                    return !q || label.indexOf(q) !== -1 || key.indexOf(q) !== -1;
                });
                roleListEl.innerHTML = '';
                if (!visible.length) {
                    roleListEl.innerHTML = '<li class="list-group-item">Aucun rôle métier.</li>';
                    return;
                }
                visible.forEach(function(roleDef) {
                    var roleKey = String(roleDef.key);
                    var li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.textContent = roleDef.label || roleKey;
                    li.onclick = function() {
                        if (listEl) listEl.querySelectorAll('.list-group-item').forEach(function(x) { x.classList.remove('active'); });
                        roleListEl.querySelectorAll('.list-group-item').forEach(function(x) { x.classList.remove('active'); });
                        li.classList.add('active');
                        loadRightsForSelection('role', roleKey, 'Rôle : ' + (roleDef.label || roleKey));
                    };
                    roleListEl.appendChild(li);
                });
            }

            function renderUsersList() {
                if (!listEl) return;
                var q = (userSearchEl && userSearchEl.value ? userSearchEl.value : '').trim().toLowerCase();
                var visible = users.filter(function(u) {
                    var txt = ((u.name || '') + ' ' + (u.email || '') + ' ' + formatUserRolesLabel(u)).toLowerCase();
                    return !q || txt.indexOf(q) !== -1;
                });
                listEl.innerHTML = '';
                if (!visible.length) {
                    listEl.innerHTML = '<li class="list-group-item">Aucun utilisateur.</li>';
                    return;
                }
                visible.forEach(function(user) {
                    var li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.dataset.uid = user._id;
                    li.textContent = (user.name || user.email || user._id) + ' (' + formatUserRolesLabel(user) + ')';
                    li.onclick = function() {
                        if (roleListEl) roleListEl.querySelectorAll('.list-group-item').forEach(function(x) { x.classList.remove('active'); });
                        listEl.querySelectorAll('.list-group-item').forEach(function(x) { x.classList.remove('active'); });
                        li.classList.add('active');
                        loadRightsForSelection('user', user._id, (user.name || user.email || user._id));
                    };
                    listEl.appendChild(li);
                });
            }

            function normalizeModels(models) {
                if (!Array.isArray(models)) return [];
                var out = [];
                models.forEach(function(m) {
                    if (m == null) return;
                    var name = (typeof m === 'object') ? (m.name || m.id || m.model || '') : m;
                    name = String(name || '').trim();
                    if (name) out.push(name);
                });
                return Array.from(new Set(out));
            }

            function loadUsersAndLlms() {
                if (listEl) listEl.innerHTML = '<li class="list-group-item">Chargement…</li>';
                return Promise.all([
                    fetchJsonWithStatus(withEntityQuery(API_BASE + '/entity-users')),
                    fetchJsonWithStatus(withEntityQuery(API_BASE + '/servers/' + encodeURIComponent(serverId) + '/models')),
                    fetchJsonWithStatus(withEntityQuery(API_BASE + '/servers'))
                ]).then(function(results) {
                    var u = results[0];
                    var m = results[1];
                    var sres = results[2];
                    users = (u && u.ok && u.data && u.data.success && Array.isArray(u.data.users)) ? u.data.users : [];
                    entityRoles = (u && u.ok && u.data && u.data.success && Array.isArray(u.data.entity_roles)) ? u.data.entity_roles : [];
                    if (!entityRoles.length) {
                        entityRoles = [
                            { key: 'admin', label: 'Administrateur' },
                            { key: 'user', label: 'Utilisateur' }
                        ];
                    }
                    modelsForServer = (m && m.ok && m.data && m.data.success && Array.isArray(m.data.models)) ? normalizeModels(m.data.models) : [];
                    var srv = (sres && sres.ok && sres.data && sres.data.success && Array.isArray(sres.data.servers)) ? sres.data.servers : [];
                    serversById = {};
                    srv.forEach(function(x) { serversById[String(x._id)] = x; });

                    // Important: on n'affiche que les modèles "enabled" côté admin (models/enabled).
                    // Sinon, l'UI laisse croire qu'un modèle est autorisable alors qu'il ne l'est pas.
                    var enabled = (serversById[String(serverId)] && Array.isArray(serversById[String(serverId)].enabledModels))
                        ? serversById[String(serverId)].enabledModels
                        : [];
                    var def = (serversById[String(serverId)] && serversById[String(serverId)].defaultModel) ? String(serversById[String(serverId)].defaultModel).trim() : '';
                    if (def && !enabled.map(String).includes(def)) enabled = enabled.concat([def]);
                    var enabledSet = new Set((enabled || []).map(function(x) { return String(x); }).filter(Boolean));
                    if (enabledSet.size) {
                        modelsForServer = modelsForServer.filter(function(name) { return enabledSet.has(String(name)); });
                    }

                    if ((!modelsForServer || modelsForServer.length === 0) && msgEl) {
                        setUserMsg('Aucun LLM trouvé pour ce serveur.', true);
                    }
                    renderRolesList();
                    renderUsersList();
                });
            }
            if (roleSearchEl) roleSearchEl.addEventListener('input', renderRolesList);
            if (userSearchEl) userSearchEl.addEventListener('input', renderUsersList);
            if (btnAssignAll) {
                btnAssignAll.onclick = function(e) {
                    e.stopPropagation();
                    usersPane.querySelectorAll('.srv-llm-cb').forEach(function(cb) { cb.checked = true; });
                };
            }

            if (btnSave) {
                btnSave.onclick = function(e) {
                    e.stopPropagation();
                    if (!currentSelectionType || !currentSelectionId) return;
                    setUserMsg('Enregistrement…', false);
                    var selected = [].slice.call(usersPane.querySelectorAll('.srv-llm-cb:checked')).map(function(inp) { return String(inp.value); });
                    var saveUrl = (currentSelectionType === 'role')
                        ? withEntityQuery(API_BASE + '/rights/server/role/' + encodeURIComponent(currentSelectionId) + '/' + encodeURIComponent(serverId))
                        : withEntityQuery(API_BASE + '/rights/server/user/' + encodeURIComponent(currentSelectionId) + '/' + encodeURIComponent(serverId));
                    fetch(saveUrl, {
                        method: 'PUT',
                        headers: headers(),
                        body: JSON.stringify({ model_names: selected })
                    }).then(function(r) { return r.ok ? r.json() : {}; })
                      .then(function(res) {
                        if (res && res.success) {
                            currentAllowedAll = selected;
                            setUserMsg('Enregistré.', false);
                        } else {
                            setUserMsg((res && res.message) || 'Erreur', true);
                        }
                      }).catch(function(err) { setUserMsg('Erreur: ' + (err.message || err), true); });
                };
            }

            loadUsersAndLlms();
        })(); }
    }

    function doTest(serverId, msgEl) {
        setMsg(msgEl, 'Test…', 'muted');
        fetch(API_BASE + '/servers/' + serverId + '/test', { method: 'POST', headers: headers() })
            .then(function(r) { if (!r.ok) return parseJson(r).then(function(d) { return d || { success: false }; }); return parseJson(r); })
            .then(function(data) {
                if (data && data.success && data.server) setMsg(msgEl, 'Serveur connecté.', 'success');
                else setMsg(msgEl, (data && data.message) || 'Échec', 'error');
            })
            .catch(function(e) { setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error'); });
    }
    /** Retourne une Promise avec la liste des noms de modèles du serveur (pour le sélecteur) */
    function fetchModelsForServer(serverId) {
        return fetch(API_BASE + '/servers/' + serverId + '/models', { headers: headers() })
            .then(function(r) { return r.ok ? parseJson(r) : { success: false, models: [] }; })
            .then(function(data) {
                if (!data || !data.success || !Array.isArray(data.models)) return [];
                var names = data.models.map(function(m) {
                    var name = (typeof m === 'object' ? (m.name || m.id || m) : m) || '';
                    return String(name).trim();
                }).filter(Boolean);

                // Filtrer par enabledModels si la liste admin est disponible dans `servers`.
                // (Pour ne montrer que les modèles autorisés quand l'admin a décoché le reste)
                var srv = servers.find(function(x) { return String(x._id) === String(serverId); }) || {};
                var enabled = (Array.isArray(srv.enabledModels)) ? srv.enabledModels : [];
                var def = srv.defaultModel ? String(srv.defaultModel).trim() : '';
                if (def && !enabled.map(String).includes(def)) enabled = enabled.concat([def]);
                var enabledSet = new Set((enabled || []).map(function(x) { return String(x); }).filter(Boolean));
                if (enabledSet.size) {
                    names = names.filter(function(n) { return enabledSet.has(String(n)); });
                }

                return names;
            })
            .catch(function() { return []; });
    }

    function doListModels(serverId, modelsDiv, msgEl) {
        setMsg(msgEl, 'Chargement…', 'muted');
        fetch(API_BASE + '/servers/' + serverId + '/models', { headers: headers() })
            .then(function(r) { return r.ok ? parseJson(r) : { success: false, models: [] }; })
            .then(function(data) {
                if (data && data.success && data.models && data.models.length) {
                    // Dans l'onglet LLM côté entité, on ne doit afficher que les modèles "autorisés"
                    // (ceux cochés en admin via `enabledModels`), pas tous les modèles installés.
                    var srv = servers.find(function(x) { return String(x._id) === String(serverId); }) || {};
                    var enabled = (srv.enabledModels || []);
                    if (srv.defaultModel && enabled.indexOf(srv.defaultModel) === -1) enabled = enabled.concat([srv.defaultModel]);
                    var enabledSet = new Set((enabled || []).map(function(x) { return String(x); }).filter(Boolean));

                    function getModelName(m) {
                        return (typeof m === 'object') ? (m.name || m.id || m.model || '') : m;
                    }

                    var filtered = data.models.filter(function(m) {
                        var name = getModelName(m);
                        return enabledSet.has(String(name));
                    });

                    setMsg(msgEl, filtered.length + ' modèle(s) autorisé(s).', filtered.length ? 'success' : 'muted');
                    if (modelsDiv) {
                        modelsDiv.style.display = 'block';
                        var ul = '<strong>Modèles</strong><ul>';
                        filtered.forEach(function(m) {
                            var name = getModelName(m) || '';
                            if (name) ul += '<li>' + escapeHtml(name) + '</li>';
                        });
                        ul += '</ul>';
                        modelsDiv.innerHTML = ul;
                    }
                } else setMsg(msgEl, (data && data.message) || 'Aucun modèle', 'error');
            })
            .catch(function(e) { setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error'); });
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
            var canAddInp = row.querySelector('.server-canAddLlm');
            if (canAddInp) data.canAddLlm = canAddInp.checked;
            var endpoints = {};
            row.querySelectorAll('.endpoint-val').forEach(function(inp) {
                if (inp.dataset.key && inp.value.trim()) endpoints[inp.dataset.key] = inp.value.trim();
            });
            data.endpoints = endpoints;
        }
        return data;
    }
    function doSave(serverId, row, msgEl) {
        var data = getServerFormData(row);
        setMsg(msgEl, 'Enregistrement…', 'muted');
        fetch(API_BASE + '/servers/' + serverId, { method: 'PUT', headers: headers(), body: JSON.stringify(data) })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (res && res.success) { setMsg(msgEl, 'Enregistré.', 'success'); loadServers(); closeAllServerModals(); }
                else setMsg(msgEl, (res && res.message) || 'Erreur', 'error');
            })
            .catch(function(e) { setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error'); });
    }
    function doDelete(serverId, msgEl) {
        var s = servers.find(function(x) { return String(x._id) === String(serverId); });
        if (s && isMutualizedPlatformServer(s)) {
            setMsg(msgEl, 'Ce serveur mutualisé GDRI ne peut pas être supprimé.', 'error');
            if (msgEl && msgEl.classList) {
                msgEl.style.display = 'block';
                msgEl.className = 'alert alert-danger small mb-3';
            }
            return;
        }
        if (!confirm('Supprimer ce serveur ? Cette action est irréversible.')) return;
        setMsg(msgEl, 'Suppression…', 'muted');
        if (msgEl && msgEl.classList) {
            msgEl.style.display = 'block';
            msgEl.className = 'alert alert-info small mb-3';
        }
        fetch(API_BASE + '/servers/' + serverId, { method: 'DELETE', headers: headers() })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (res && res.success) {
                    setMsg(msgEl, 'Serveur supprimé.', 'success');
                    if (msgEl && msgEl.classList) msgEl.className = 'alert alert-success small mb-3';
                    loadServers();
                    closeAllServerModals();
                } else {
                    setMsg(msgEl, (res && res.message) || 'Erreur', 'error');
                    if (msgEl && msgEl.classList) msgEl.className = 'alert alert-danger small mb-3';
                }
            })
            .catch(function(e) {
                setMsg(msgEl, 'Erreur: ' + (e.message || e), 'error');
                if (msgEl && msgEl.classList) msgEl.className = 'alert alert-danger small mb-3';
            });
    }
    function loadServers() {
        var msgEl = document.getElementById('serversApiMessage');
        if (msgEl) { msgEl.style.display = 'none'; msgEl.className = 'alert alert-info small mb-3'; }
        fetch(API_BASE + '/servers', { headers: headers() })
            .then(function(r) {
                if (r.status === 404) { servers = []; buildServerList(); if (msgEl) { msgEl.textContent = 'Routes serveurs IA non disponibles (404).'; msgEl.classList.add('alert-warning'); msgEl.style.display = 'block'; } return null; }
                return parseJson(r);
            })
            .then(function(data) {
                if (!data) return;
                if (data && data.success && data.servers) { servers = data.servers; buildServerList(); }
            })
            .catch(function() {
                if (msgEl) { msgEl.textContent = 'Impossible de charger les serveurs.'; msgEl.classList.add('alert-danger'); msgEl.style.display = 'block'; }
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
    var btnAddServer = document.getElementById('btnAddServer');
    if (btnAddServer) btnAddServer.onclick = function() {
        document.getElementById('addServerBlock').style.display = 'block';
        document.getElementById('addName').value = '';
        document.getElementById('addBaseUrl').value = '';
        document.getElementById('addAuthValue').value = '';
        loadPresets();
    };
    var btnCancelAdd = document.getElementById('btnCancelAdd');
    if (btnCancelAdd) btnCancelAdd.onclick = function() { document.getElementById('addServerBlock').style.display = 'none'; };
    var addPresetId = document.getElementById('addPresetId');
    if (addPresetId) addPresetId.onchange = function() {
        var presetId = this.value;
        var preset = presets.find(function(p) { return p.id === presetId; });
        if (preset && preset.defaults && preset.defaults.baseUrl) {
            document.getElementById('addBaseUrl').value = preset.defaults.baseUrl;
            document.getElementById('addBaseUrl').placeholder = preset.defaults.baseUrl;
        }
    };
    var btnCreateServer = document.getElementById('btnCreateServer');
    if (btnCreateServer) btnCreateServer.onclick = function() {
        var presetId = document.getElementById('addPresetId').value.trim();
        var name = document.getElementById('addName').value.trim();
        var baseUrl = document.getElementById('addBaseUrl').value.trim();
        var authValue = document.getElementById('addAuthValue').value.trim();
        if (!presetId) { alert('Choisissez un preset'); return; }
        var preset = presets.find(function(p) { return p.id === presetId; });
        var body = { presetId: presetId, name: name || (preset && preset.label) || presetId, baseUrl: baseUrl || (preset && preset.defaults && preset.defaults.baseUrl) || '' };
        if (authValue) body.auth = preset && ['openai','anthropic','deepseek'].indexOf(preset.provider) >= 0 ? { type: 'bearer', apiKey: authValue } : { type: 'bearer', serviceToken: authValue };
        if (IA_SERVERS_UI_MODE === 'user') body.scope = 'user';
        else if (IA_SERVERS_ENTITY_MODE) body.scope = 'entity';
        fetch(API_BASE + '/servers', { method: 'POST', headers: headers(), body: JSON.stringify(body) })
            .then(function(r) { return parseJson(r); })
            .then(function(res) {
                if (res && res.success) { document.getElementById('addServerBlock').style.display = 'none'; loadServers(); }
                else alert((res && res.message) || 'Erreur création');
            })
            .catch(function(e) { alert('Erreur: ' + (e.message || e)); });
    };
    document.getElementById('btnRefreshServers').onclick = loadServers;

    loadServers();
})();
</script>

<?php require_once GDRI_ROOT . '/frontend/includes/footer.php'; ?>
