<?php
/**
 * Console plateforme — Déploiement TEST + sync données.
 * ADMIN_GDRI ou DEV. Pas de mise à jour PROD (manuel uniquement).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireDeployConsoleAccess();

$page_title = 'Déploiement';
$api_base_url = getApiBaseUrl();
$isDevOnly = canAccessDeployConsoleOnly();
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Déploiement',
    'Mettre à jour l’environnement TEST (code + données). La production reste en déploiement manuel.'
);
?>

<div class="alert alert-light border small" style="margin-bottom: 1.25rem;" role="note">
    <strong>Qui peut quoi ?</strong>
    <ul style="margin: 0.5rem 0 0; padding-left: 1.2rem;">
        <li><strong>Console (ici)</strong> — rôle <code>DEV</code> ou <code>ADMIN_GDRI</code> :
            pull <code>develop</code> → dossier <code>gdri-dev</code> / <code>test.gdri.fr</code>,
            et sync Mongo prod → test.</li>
        <li><strong>PROD</strong> — manuel uniquement (merge GitHub + <code>git pull</code> dans <code>htdocs/gdri</code>).</li>
        <?php if ($isDevOnly): ?>
        <li>Ton compte <code>DEV</code> n’a accès qu’à cette page sur la prod.</li>
        <?php endif; ?>
    </ul>
</div>

<div class="card" style="margin-bottom: 1.25rem; padding: 1rem 1.25rem;">
    <h3 style="margin-top: 0;">État Git (TEST / gdri-dev)</h3>
    <pre id="deploy-git" class="small" style="background:#f6f8fa;padding:0.75rem;border-radius:6px;overflow:auto;min-height:4rem;">Chargement…</pre>
    <p id="deploy-last" class="small text-muted" style="margin-bottom:0;"></p>
</div>

<div class="card" style="margin-bottom: 1.25rem; padding: 1rem 1.25rem;">
    <h3 style="margin-top: 0;">Code TEST</h3>
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
    <p class="small text-muted" style="margin:0;">
        Pull <code>origin/develop</code> dans <code>C:\xampp\htdocs\gdri-dev</code>.
        Coche <strong>Force</strong> seulement pour des fichiers runtime locaux.
    </p>
</div>

<div class="card" style="margin-bottom: 1.25rem; padding: 1rem 1.25rem;">
    <h3 style="margin-top: 0;">Données TEST</h3>
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;margin-bottom:1rem;">
        <button type="button" id="btn-sync-data" class="btn btn-secondary">
            Synchroniser données prod → test
        </button>
    </div>
    <p class="small text-muted" style="margin:0;">
        Clone <code>GDR-INNOVATION</code> → <code>GDR-INNOVATION-TEST</code> (écrase la base test plateforme).
        Les bases entreprise <code>GDR-ENTREPRISE-*</code> restent partagées — ne pas faire de tests destructifs dessus.
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
  const btnSync = document.getElementById('btn-sync-data');
  const optRestart = document.getElementById('opt-restart');
  const optForce = document.getElementById('opt-force');

  function authHeaders() {
    return {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
  }

  function setBusy(busy) {
    btnTest.disabled = busy;
    btnSync.disabled = busy;
  }

  function renderStatus(data) {
    const git = data.git || {};
    elGit.textContent = [
      'Dossier : ' + (git.projectRoot || '—'),
      'Branche : ' + (git.branch || '—'),
      'HEAD    : ' + (git.head || '—'),
      'Upstream: ' + (git.upstream || '—'),
      '',
      git.status || ''
    ].join('\n');

    const d = data.deploy || {};
    if (d.running) {
      elLast.textContent = 'Opération en cours… (' + (d.action || '') + ') depuis ' + (d.startedAt || '');
      setBusy(true);
    } else if (d.finishedAt) {
      elLast.textContent = 'Dernier run : ' + (d.action || '') + ' — code ' + d.exitCode + ' — ' + d.finishedAt
        + (d.triggeredBy && d.triggeredBy.email ? ' — par ' + d.triggeredBy.email : '');
      setBusy(false);
    } else {
      elLast.textContent = 'Aucune opération console pour le moment.';
      setBusy(false);
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
    if (!confirm('Lancer la mise à jour TEST (git pull develop dans gdri-dev) ?')) return;
    setBusy(true);
    elLog.textContent = 'Lancement mise à jour code TEST…\n';
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
      if (!json.success) alert(json.message || 'Échec');
    } catch (e) {
      elLog.textContent += '\nErreur: ' + e.message;
      alert(e.message);
    }
    await loadStatus();
  });

  btnSync.addEventListener('click', async function () {
    if (!confirm('Écraser GDR-INNOVATION-TEST avec une copie de GDR-INNOVATION (prod) ?')) return;
    setBusy(true);
    elLog.textContent = 'Synchronisation données prod → test…\n';
    try {
      const res = await fetch(API + '/admin/deploy/sync-test-data', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ drop: true })
      });
      const json = await res.json();
      elLog.textContent = (json.data && json.data.log) ? json.data.log : (json.message || '');
      if (!json.success) alert(json.message || 'Échec');
    } catch (e) {
      elLog.textContent += '\nErreur: ' + e.message;
      alert(e.message);
    }
    await loadStatus();
  });

  loadStatus();
  setInterval(function () {
    // Poll léger si une op est en cours
    if (btnTest.disabled) loadStatus();
  }, 4000);
})();
</script>

<?php
renderConsolePageClose();
require_once __DIR__ . '/../includes/footer.php';
