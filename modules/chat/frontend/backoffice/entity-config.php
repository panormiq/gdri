<?php
require_once __DIR__ . '/bootstrap.php';
if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

// Blocage d'accès direct si le module Chat n'est pas autorisé pour l'entité active.
$db = getDatabase();
$entitiesCollection = $db->entities;
$servicesCollection = $db->services;
$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
$chatService = $servicesCollection->findOne([
    '$or' => [
        ['slug' => 'chat'],
        ['slug' => 'module-chat-ia'],
        ['name' => new MongoDB\BSON\Regex('chat', 'i')]
    ]
]);
$entityAllowed = false;
if (!empty($currentEntrepriseId) && $chatService) {
    $entity = null;
    try {
        $entity = $entitiesCollection->findOne(['_id' => new MongoDB\BSON\ObjectId((string)$currentEntrepriseId)]);
    } catch (Exception $e) {
        $entity = null;
    }
    $authorized = [];
    if (!empty($entity['services_authorized'])) {
        $arr = $entity['services_authorized'];
        if ($arr instanceof MongoDB\Model\BSONArray) $arr = iterator_to_array($arr);
        $authorized = array_map('strval', (array)$arr);
    }
    $entityAllowed = in_array((string)$chatService['_id'], $authorized, true);
}
if (!$entityAllowed) {
    redirect(url('pages/entity-config.php'));
}

$page_title = 'Chat IA - Entite';
require_once GDRI_ROOT . '/frontend/includes/header.php';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
?>
<section class="section">
    <div class="container">
        <h1>Chat IA - Configuration entite</h1>
        <div class="form-group">
            <label>Server par default</label>
            <select id="serverId" class="form-control">
                <option value="">-- Selectionner un serveur IA --</option>
            </select>
        </div>
        <div class="form-group">
            <label>Model par defaut</label>
            <select id="model" class="form-control">
                <option value="">-- Selectionner un modele --</option>
            </select>
        </div>
        <button id="save" class="btn btn-primary">Enregistrer</button>
        <div id="msg" class="mt-2 small text-muted"></div>
        <hr>
        <h2 style="font-size:1.1rem;">Droits utilisateurs</h2>
        <p class="text-muted small">Active/desactive l'acces Chat par utilisateur de l'entite.</p>
        <div id="usersWrap" class="mt-2"></div>
    </div>
</section>
<script>
(function() {
  const API = '<?= addslashes($api_base_url) ?>/chat/settings/entity';
  const API_GET = '<?= addslashes($api_base_url) ?>/chat/settings/entity';
  const API_SERVERS = '<?= addslashes($api_base_url) ?>/ia/servers';
  const API_USERS = '<?= addslashes($api_base_url) ?>/chat/settings/entity-user-access';
  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': 'Bearer <?= addslashes($jwt_token) ?>' };
  const msg = document.getElementById('msg');
  const usersWrap = document.getElementById('usersWrap');
  const serverSelect = document.getElementById('serverId');
  const modelSelect = document.getElementById('model');
  let serversCache = [];

  async function loadModels(serverId, selectedModel) {
    modelSelect.innerHTML = '<option value="">-- Selectionner un modele --</option>';
    if (!serverId) return;
    try {
      const res = await fetch('<?= addslashes($api_base_url) ?>/ia/servers/' + encodeURIComponent(serverId) + '/models', { headers: HEADERS });
      const data = await res.json();
      let models = data && data.success && Array.isArray(data.models) ? data.models : [];
      const srv = serversCache.find((s) => String(s._id) === String(serverId)) || {};
      let enabled = Array.isArray(srv.enabledModels) ? srv.enabledModels.map(String) : [];
      const def = srv.defaultModel ? String(srv.defaultModel).trim() : '';
      if (def && !enabled.includes(def)) enabled = enabled.concat([def]);
      if (enabled.length) {
        const allowedSet = new Set(enabled);
        models = models.filter((m) => {
          const n = typeof m === 'string' ? m : ((m && (m.name || m.id)) || '');
          return allowedSet.has(String(n));
        });
      }
      models.forEach((m) => {
        const name = typeof m === 'string' ? m : (m && (m.name || m.id)) || '';
        if (!name) return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        modelSelect.appendChild(opt);
      });
      if (selectedModel) modelSelect.value = selectedModel;
      if (selectedModel && modelSelect.value !== selectedModel) {
        const opt = document.createElement('option');
        opt.value = selectedModel;
        opt.textContent = selectedModel + ' (actuel)';
        modelSelect.appendChild(opt);
        modelSelect.value = selectedModel;
      }
    } catch (_) {
      modelSelect.innerHTML = '<option value="">-- Impossible de charger les modeles --</option>';
    }
  }

  async function loadServers(selectedId, selectedModel) {
    try {
      const res = await fetch(API_SERVERS, { headers: HEADERS });
      const data = await res.json();
      const servers = data && data.success && Array.isArray(data.servers) ? data.servers : [];
      serversCache = servers;
      serverSelect.innerHTML = '<option value="">-- Selectionner un serveur IA --</option>';
      servers.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s._id || '';
        opt.textContent = (s.name || s.provider || 'Serveur') + ' (' + (s.provider || '-') + ')';
        serverSelect.appendChild(opt);
      });
      if (selectedId) serverSelect.value = selectedId;
      await loadModels(serverSelect.value, selectedModel || '');
    } catch (_) {
      serverSelect.innerHTML = '<option value="">-- Impossible de charger les serveurs --</option>';
      await loadModels('', '');
    }
  }

  async function loadCurrent() {
    try {
      const res = await fetch(API_GET, { headers: HEADERS });
      const data = await res.json();
      if (data && data.success && data.data) {
        await loadServers(data.data.default_server_id || '', data.data.default_model || '');
      } else {
        await loadServers('', '');
      }
    } catch (_) {
      await loadServers('', '');
    }
  }

  async function loadUsers() {
    usersWrap.innerHTML = '<div class="small text-muted">Chargement...</div>';
    try {
      const res = await fetch(API_USERS, { headers: HEADERS });
      const data = await res.json();
      if (!data.success) {
        usersWrap.innerHTML = '<div class="small text-danger">' + (data.message || 'Erreur') + '</div>';
        return;
      }
      const rows = Array.isArray(data.data) ? data.data : [];
      if (!rows.length) {
        usersWrap.innerHTML = '<div class="small text-muted">Aucun utilisateur trouve.</div>';
        return;
      }
      let html = '<table class="table table-sm"><thead><tr><th>Email</th><th>Role</th><th>Acces</th><th></th></tr></thead><tbody>';
      rows.forEach((u) => {
        html += '<tr data-user="' + u.user_id + '"><td>' + (u.email || '') + '</td><td>' + (u.role || '') + '</td><td><input type="checkbox" class="u-enabled"' + (u.enabled ? ' checked' : '') + '></td><td><button class="btn btn-sm btn-outline-primary u-save">Sauver</button></td></tr>';
      });
      html += '</tbody></table>';
      usersWrap.innerHTML = html;
      usersWrap.querySelectorAll('.u-save').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tr = btn.closest('tr');
          const userId = tr.getAttribute('data-user');
          const enabled = tr.querySelector('.u-enabled').checked;
          btn.disabled = true;
          await fetch(API_USERS + '/' + userId, {
            method: 'PUT',
            headers: HEADERS,
            body: JSON.stringify({ enabled })
          });
          btn.disabled = false;
        });
      });
    } catch (e) {
      usersWrap.innerHTML = '<div class="small text-danger">Erreur: ' + (e.message || e) + '</div>';
    }
  }

  document.getElementById('save').addEventListener('click', async () => {
    msg.textContent = 'Enregistrement...';
    const res = await fetch(API, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        default_server_id: document.getElementById('serverId').value,
        default_model: document.getElementById('model').value
      })
    });
    const data = await res.json();
    msg.textContent = data.success ? 'Configuration sauvegardee.' : (data.message || 'Erreur');
  });
  serverSelect.addEventListener('change', async () => {
    await loadModels(serverSelect.value, '');
  });
  loadCurrent();
  loadUsers();
})();
</script>
<?php require_once GDRI_ROOT . '/frontend/includes/footer.php'; ?>
