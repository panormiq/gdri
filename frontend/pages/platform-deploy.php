<?php
/**
 * Console plateforme — Déploiement / mise à jour TEST.
 * ADMIN_GDRI uniquement. La mise à jour PROD reste locale.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Déploiement';
$api_base_url = getApiBaseUrl();
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Déploiement',
    'Mettre à jour l’environnement TEST depuis Git. La production reste en lancement local sur le serveur.'
);
?>

<div class="alert alert-light border small" style="margin-bottom: 1.25rem;" role="note">
    <strong>Qui peut quoi ?</strong>
    <ul style="margin: 0.5rem 0 0; padding-left: 1.2rem;">
        <li><strong>Console (ici)</strong> — ADMIN_GDRI : pull branche <code>develop</code> → TEST (<code>test.gdri.fr</code>).</li>
        <li><strong>Local serveur</strong> — mise à jour PROD : <code>demarrage\11-update-prod.bat</code> (après merge).</li>
        <li>Pas de VPN requis pour cette page.</li>
    </ul>
</div>

<div class="card" style="margin-bottom: 1.25rem; padding: 1rem 1.25rem;">
    <h3 style="margin-top: 0;">État Git</h3>
    <pre id="deploy-git" class="small" style="background:#f6f8fa;padding:0.75rem;border-radius:6px;overflow:auto;min-height:4rem;">Chargement…</pre>
    <p id="deploy-last" class="small text-muted" style="margin-bottom:0;"></p>
</div>

<div class="card" style="margin-bottom: 1.25rem; padding: 1rem 1.25rem;">
    <h3 style="margin-top: 0;">Actions</h3>
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;margin-bottom:1rem;">
        <button type="button" id="btn-update-test" class="btn btn-primary">
            Mettre à jour TEST
        </button>
        <label class="small" style="display:flex;align-items:center;gap:0.35rem;">
            <input type="checkbox" id="opt-restart" checked>
            Redémarrer backend test (:3001)
        </label>
        <label class="small" style="display:flex;align-items:center;gap:0.35rem;">
            <input type="checkbox" id="opt-force">
            Force (stash temporaire des fichiers locaux non commités)
        </label>
    </div>
    <p class="small text-muted" style="margin:0 0 1rem;">
        Si le journal dit « modifications locales détectées », coche <strong>Force</strong>
        <em>uniquement</em> pour des fichiers runtime (ex. <code>.security-monitor-state.json</code>).
        Si ce sont des features non commités (<code>demarrage/</code>, deploy…), committe d’abord sur <code>develop</code>.
    </p>
    <button type="button" id="btn-update-prod" class="btn btn-outline" disabled title="Désactivé depuis la console">
        Mettre à jour PROD (local uniquement)
    </button>
    <p class="small text-muted" style="margin-top:0.75rem;margin-bottom:0;">
        PROD : lance <code>demarrage\11-update-prod.bat</code> sur le serveur après le merge GitHub.
    </p>
</div>

<div class="card" style="padding: 1rem 1.25rem;">
    <h3 style="margin-top: 0;">Journal</h3>
    <pre id="deploy-log" class="small" style="background:#0d1117;color:#e6edf3;padding:0.75rem;border-radius:6px;overflow:auto;min-height:10rem;max-height:24rem;white-space:pre-wrap;"></pre>
</div>

<script>
(function () {
  const API = <?= json_encode(rtrim($api_base_url, '/'), JSON_UNESCAPED_SLASHES) ?>;
  const token = <?= json_encode($_SESSION['jwt_token'] ?? '', JSON_UNESCAPED_UNICODE) ?>;

  const elGit = document.getElementById('deploy-git');
  const elLast = document.getElementById('deploy-last');
  const elLog = document.getElementById('deploy-log');
  const btnTest = document.getElementById('btn-update-test');
  const optRestart = document.getElementById('opt-restart');
  const optForce = document.getElementById('opt-force');

  function authHeaders() {
    return {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
  }

  function renderStatus(data) {
    const git = data.git || {};
    elGit.textContent = [
      'Branche : ' + (git.branch || '—'),
      'HEAD    : ' + (git.head || '—'),
      'Upstream: ' + (git.upstream || '—'),
      '',
      git.status || ''
    ].join('\n');

    const d = data.deploy || {};
    if (d.running) {
      elLast.textContent = 'Déploiement en cours… (' + (d.action || '') + ') depuis ' + (d.startedAt || '');
      btnTest.disabled = true;
    } else if (d.finishedAt) {
      elLast.textContent = 'Dernier run : ' + (d.action || '') + ' — code ' + d.exitCode + ' — ' + d.finishedAt
        + (d.triggeredBy && d.triggeredBy.email ? ' — par ' + d.triggeredBy.email : '');
      btnTest.disabled = false;
    } else {
      elLast.textContent = 'Aucun déploiement console pour le moment.';
      btnTest.disabled = false;
    }
    if (d.log) elLog.textContent = d.log;
  }

  async function loadStatus() {
    try {
      const res = await fetch(API + '/admin/deploy/status', { headers: authHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Erreur status');
      renderStatus(json.data || {});
    } catch (e) {
      elGit.textContent = 'Erreur: ' + e.message;
    }
  }

  btnTest.addEventListener('click', async function () {
    if (!confirm('Lancer la mise à jour TEST (branche develop) ?')) return;
    btnTest.disabled = true;
    elLog.textContent = 'Lancement…\n';
    try {
      const res = await fetch(API + '/admin/deploy/update-test', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          restartBackend: !!optRestart.checked,
          force: !!optForce.checked
        })
      });
      const json = await res.json();
      elLog.textContent = (json.data && json.data.log) ? json.data.log : (json.message || '');
      if (!json.success) {
        alert(json.message || 'Échec');
      }
    } catch (e) {
      elLog.textContent += '\nErreur: ' + e.message;
      alert(e.message);
    }
    await loadStatus();
  });

  loadStatus();
})();
</script>

<?php
renderConsolePageClose();
require_once __DIR__ . '/../includes/footer.php';
