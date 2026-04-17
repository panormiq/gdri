<?php
require_once __DIR__ . '/bootstrap.php';
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}
$page_title = 'Chat IA - Admin GDRI';
require_once GDRI_ROOT . '/frontend/includes/header.php';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
?>
<section class="section">
    <div class="container">
        <h1>Chat IA - Configuration globale</h1>
        <p class="text-muted">Définit le serveur et le modèle par défaut globaux.</p>
        <div class="form-group">
            <label>Server ID par défaut</label>
            <input id="serverId" class="form-control" placeholder="ObjectId ia_servers">
        </div>
        <div class="form-group">
            <label>Model par défaut</label>
            <input id="model" class="form-control" placeholder="mistral:latest">
        </div>
        <button id="save" class="btn btn-primary">Enregistrer</button>
        <div id="msg" class="mt-2 small text-muted"></div>
    </div>
</section>
<script>
(function() {
  const API_GET = '<?= addslashes($api_base_url) ?>/chat/settings/global';
  const API = '<?= addslashes($api_base_url) ?>/chat/settings/global';
  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': 'Bearer <?= addslashes($jwt_token) ?>' };
  const msg = document.getElementById('msg');
  async function loadCurrent() {
    try {
      const res = await fetch(API_GET, { headers: HEADERS });
      const data = await res.json();
      if (data && data.success && data.data) {
        document.getElementById('serverId').value = data.data.default_server_id || '';
        document.getElementById('model').value = data.data.default_model || '';
      }
    } catch (_) {}
  }
  document.getElementById('save').addEventListener('click', async () => {
    msg.textContent = 'Enregistrement...';
    const res = await fetch(API, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        default_server_id: document.getElementById('serverId').value.trim(),
        default_model: document.getElementById('model').value.trim()
      })
    });
    const data = await res.json();
    msg.textContent = data.success ? 'Configuration sauvegardee.' : (data.message || 'Erreur');
  });
  loadCurrent();
})();
</script>
<?php require_once GDRI_ROOT . '/frontend/includes/footer.php'; ?>
