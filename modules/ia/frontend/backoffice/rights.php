<?php
/**
 * Backoffice IA – Droits LLM par utilisateur
 * Fichier : modules/ia/frontend/backoffice/rights.php
 */
require_once __DIR__ . '/bootstrap.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'IA – Droits LLM par utilisateur';
require_once GDRI_ROOT . '/frontend/includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
$isAdminGdri = hasRole(ROLE_ADMIN_GDRI);

$ia_entity_current_tab = 'rights';
require_once __DIR__ . '/entity-tabs.php';
?>

<section class="section">
    <div class="container">
        <h1 class="mb-4">Droits LLM par utilisateur</h1>
        <p class="text-muted small mb-4">
            Sélectionnez un utilisateur, puis pour chaque serveur IA cochez les modèles (LLMs) qu’il peut utiliser.
        </p>

        <div id="rightsMessage" class="alert alert-info small mb-3" style="display:none;"></div>

        <div class="row">
            <div class="col-md-4 col-lg-3 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h2 class="h6 mb-0">Utilisateurs</h2>
                    </div>
                    <div class="card-body p-0">
                        <ul id="userList" class="list-group list-group-flush">
                            <li class="list-group-item">Chargement…</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-md-8 col-lg-9">
                <div id="rightsPanel" class="d-none">
                    <p id="rightsHelp" class="text-muted small mb-3">Cochez les serveurs et modèles autorisés pour cet utilisateur, puis enregistrez.</p>
                    <form id="rightsForm">
                        <div id="rightsByServer" class="row">
                            <!-- Cartes par serveur : chaque carte liste les LLMs du serveur en checkboxes -->
                        </div>
                        <div class="form-actions mt-3">
                            <button type="submit" class="btn btn-primary">Enregistrer les droits</button>
                        </div>
                        <div id="rightsFormMessage" class="mt-2 small" style="min-height:1.5rem;"></div>
                    </form>
                </div>
                <p id="rightsPlaceholder" class="text-muted">Sélectionnez un utilisateur à gauche pour gérer ses droits.</p>
            </div>
        </div>
    </div>
</section>

<style>
#userList .list-group-item { cursor: pointer; }
#userList .list-group-item.active { background-color: #0d6efd; color: #fff; }
.ia-server-card { margin-bottom: 1rem; }
.ia-server-card .card-body { padding: 0.75rem 1rem; }
.ia-llm-checkbox { margin-bottom: 0.35rem; }
</style>

<script>
(function() {
    const API_BASE = '<?= addslashes($api_base_url) ?>/ia';
    const JWT = '<?= addslashes($jwt_token) ?>';
    const CURRENT_ENTITY_ID = '<?= addslashes((string)($currentEntrepriseId ?? '')) ?>';
    const IS_ADMIN_GDRI = <?= $isAdminGdri ? 'true' : 'false' ?>;
    const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JWT });

    function withEntityQuery(path) {
        if (IS_ADMIN_GDRI && CURRENT_ENTITY_ID) {
            var sep = path.indexOf('?') === -1 ? '?' : '&';
            return path + sep + 'entity_id=' + encodeURIComponent(CURRENT_ENTITY_ID);
        }
        return path;
    }

    let users = [];
    let servers = [];
    let llms = [];
    let currentUserId = null;

    function setMessage(id, text, isError) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text || '';
        el.className = (el.className || '').replace(/\btext-danger\b|\btext-success\b/g, '').trim();
        if (text) el.classList.add(isError ? 'text-danger' : 'text-success');
    }

    function handleIaUnavailable(res) {
        if (res.status === 404 || res.status === 503) {
            return res.json().catch(() => ({})).then(data => {
                setMessage('rightsMessage', (data && data.message) || 'Module IA non disponible.', true);
                document.getElementById('rightsMessage').style.display = 'block';
                return null;
            });
        }
        return res.json();
    }

    function loadUsers() {
        return fetch(withEntityQuery(API_BASE + '/entity-users'), { headers: headers() })
            .then(r => { if (!r.ok) return handleIaUnavailable(r); return r.json(); })
            .then(data => {
                if (!data || !data.success) return;
                users = data.users || [];
                const listEl = document.getElementById('userList');
                listEl.innerHTML = '';
                if (!users.length) {
                    listEl.innerHTML = '<li class="list-group-item">Aucun utilisateur pour cette entité.</li>';
                    return;
                }
                users.forEach(u => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.dataset.id = u._id;
                    li.textContent = (u.name || u.email || u._id);
                    listEl.appendChild(li);
                });
            })
            .catch(e => { setMessage('rightsMessage', e.message, true); document.getElementById('rightsMessage').style.display = 'block'; });
    }

    function loadServers() {
        return fetch(API_BASE + '/servers', { headers: headers() })
            .then(r => r.ok ? r.json() : { success: false, servers: [] })
            .then(data => { if (data && data.success) servers = data.servers || []; });
    }

    function loadLlms() {
        return fetch(API_BASE + '/llms', { headers: headers() })
            .then(r => { if (!r.ok) return handleIaUnavailable(r); return r.json(); })
            .then(data => {
                if (!data || !data.success) return;
                llms = data.llms || [];
            })
            .catch(e => { setMessage('rightsMessage', e.message, true); document.getElementById('rightsMessage').style.display = 'block'; });
    }

    function groupLlmsByServer() {
        const byServer = {};
        llms.forEach(llm => {
            const sid = (llm.server_id && String(llm.server_id)) || '_none_';
            if (!byServer[sid]) byServer[sid] = [];
            byServer[sid].push(llm);
        });
        return byServer;
    }

    function renderRightsByServer(allowedSet) {
        const container = document.getElementById('rightsByServer');
        container.innerHTML = '';
        const byServer = groupLlmsByServer();
        const serverIds = Object.keys(byServer).filter(k => k !== '_none_');
        const noneLlms = byServer['_none_'] || [];

        serverIds.forEach(serverId => {
            const server = servers.find(s => s._id === serverId);
            const name = (server && server.name) || serverId;
            const list = byServer[serverId] || [];
            const card = document.createElement('div');
            card.className = 'col-12 col-sm-6 col-lg-4';
            card.innerHTML = '<div class="card ia-server-card h-100">' +
                '<div class="card-header py-2"><strong>' + (name.replace(/</g, '&lt;')) + '</strong></div>' +
                '<div class="card-body">' +
                list.map(llm => {
                    const id = 'llm_' + llm._id;
                    const checked = allowedSet.has(llm._id) ? ' checked' : '';
                    return '<div class="form-check ia-llm-checkbox"><input class="form-check-input" type="checkbox" id="' + id + '" value="' + llm._id + '"' + checked + '><label class="form-check-label small" for="' + id + '">' + (llm.name || llm.model || '').replace(/</g, '&lt;') + '</label></div>';
                }).join('') +
                '</div></div>';
            container.appendChild(card);
        });
        if (noneLlms.length) {
            const card = document.createElement('div');
            card.className = 'col-12 col-sm-6 col-lg-4';
            card.innerHTML = '<div class="card ia-server-card h-100">' +
                '<div class="card-header py-2"><strong>Sans serveur</strong></div>' +
                '<div class="card-body">' +
                noneLlms.map(llm => {
                    const id = 'llm_' + llm._id;
                    const checked = allowedSet.has(llm._id) ? ' checked' : '';
                    return '<div class="form-check ia-llm-checkbox"><input class="form-check-input" type="checkbox" id="' + id + '" value="' + llm._id + '"' + checked + '><label class="form-check-label small" for="' + id + '">' + (llm.name || llm.model || '').replace(/</g, '&lt;') + '</label></div>';
                }).join('') +
                '</div></div>';
            container.appendChild(card);
        }
        if (!llms.length) {
            container.innerHTML = '<div class="col-12"><p class="text-muted">Aucun LLM. Créez des modèles dans « LLMs de l\'entité ».</p></div>';
        }
    }

    function selectUser(userId) {
        currentUserId = userId;
        const listEl = document.getElementById('userList');
        listEl.querySelectorAll('.list-group-item').forEach(li => { li.classList.toggle('active', li.dataset.id === userId); });
        document.getElementById('rightsPlaceholder').classList.toggle('d-none', !!userId);
        document.getElementById('rightsPanel').classList.toggle('d-none', !userId);
        if (!userId) return;
        setMessage('rightsFormMessage', 'Chargement…');
        fetch(API_BASE + '/rights/user/' + encodeURIComponent(userId), { headers: headers() })
            .then(r => r.json())
            .then(data => {
                const allowed = new Set((data && data.llm_ids) ? data.llm_ids : []);
                renderRightsByServer(allowed);
                setMessage('rightsFormMessage', '');
            })
            .catch(e => setMessage('rightsFormMessage', 'Erreur: ' + e.message, true));
    }

    document.getElementById('userList').addEventListener('click', function(e) {
        const li = e.target.closest('.list-group-item');
        if (!li || !li.dataset.id) return;
        selectUser(li.dataset.id);
    });

    document.getElementById('rightsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (!currentUserId) return;
        const checked = Array.from(document.querySelectorAll('#rightsByServer input[type="checkbox"]:checked')).map(c => c.value);
        setMessage('rightsFormMessage', 'Enregistrement…');
        fetch(API_BASE + '/rights/user/' + encodeURIComponent(currentUserId), {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({ llm_ids: checked })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) setMessage('rightsFormMessage', 'Droits enregistrés.');
                else setMessage('rightsFormMessage', (data && data.message) || 'Erreur', true);
            })
            .catch(e => setMessage('rightsFormMessage', 'Erreur: ' + e.message, true));
    });

    Promise.all([loadUsers(), loadServers(), loadLlms()]).then(() => {});
})();
</script>

<?php require_once GDRI_ROOT . '/frontend/includes/footer.php'; ?>
