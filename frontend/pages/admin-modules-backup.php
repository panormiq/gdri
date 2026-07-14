<?php
/**
 * Console plateforme — Sauvegarde des bases client (ADMIN_GDRI)
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once '../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Sauvegarde des bases client';
require_once '../includes/header.php';
renderConsoleLayoutStart(
    'Sauvegarde des bases client',
    'Politique globale, chemin de stockage et supervision des sauvegardes par entité.',
    ['narrow' => true]
);
renderConsoleBackLink('Extensions', url('pages/admin-modules.php'));
?>

    <div id="platformMsg" class="alert alert-info small" style="display:none;"></div>

    <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header" style="background:#f8f9fa; border-bottom:2px solid #0d6efd;">
            <h2 style="margin:0; font-size:1.15rem;">Configuration plateforme</h2>
        </div>
        <div class="card-body">
            <form id="platformConfigForm">
                <div class="form-group" style="margin-bottom:1rem;">
                    <label><input type="checkbox" id="platEnabled" checked> Service de sauvegarde activé</label>
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label for="platStoragePath">Chemin de stockage (serveur)</label>
                    <input type="text" id="platStoragePath" class="form-control" placeholder="backend/storage/backups">
                    <p class="text-muted small" style="margin-top:0.35rem;">Chemin absolu ou relatif à la racine du projet. Laisser vide pour la valeur par défaut.</p>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div class="form-group">
                        <label for="platRetention">Rétention par défaut (jours)</label>
                        <input type="number" id="platRetention" class="form-control" min="1" max="365" value="30">
                    </div>
                    <div class="form-group">
                        <label for="platSchedule">Planification par défaut</label>
                        <select id="platSchedule" class="form-control" disabled>
                            <option value="disabled">Manuel uniquement</option>
                            <option value="daily">Quotidien</option>
                            <option value="weekly">Hebdomadaire</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;">Enregistrer</button>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header" style="background:#f8f9fa; border-bottom:2px solid #dee2e6;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <h2 style="margin:0; font-size:1.15rem;">Supervision par entité</h2>
                <button type="button" class="btn btn-outline btn-sm" id="btnRefreshOverview">↻ Actualiser</button>
            </div>
        </div>
        <div class="card-body">
            <div id="overviewStatus" class="text-muted small">Chargement…</div>
            <div id="overviewTableWrap" style="overflow-x:auto; margin-top:1rem; display:none;">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>Entité</th>
                            <th>Dernière sauvegarde</th>
                            <th>Statut</th>
                            <th>Taille</th>
                            <th style="width:200px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="overviewTbody"></tbody>
                </table>
            </div>
        </div>
    </div>

<?php renderConsoleLayoutEnd(); ?>

<script>
(function() {
    var API = <?= json_encode(getApiBaseUrl() . '/backup') ?>;
    var JWT = <?= json_encode(getJWTToken()) ?>;

    function headers() {
        return { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' };
    }

    function parseJson(res) {
        var ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.indexOf('application/json') === -1) {
            return res.text().then(function() {
                throw new Error('Réponse non-JSON (status ' + res.status + ')');
            });
        }
        return res.json();
    }

    function showMsg(text, type) {
        var el = document.getElementById('platformMsg');
        el.textContent = text;
        el.className = 'alert alert-' + (type || 'info') + ' small';
        el.style.display = 'block';
    }

    function formatBytes(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' o';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' Ko';
        if (n < 1073741824) return (n / 1048576).toFixed(1) + ' Mo';
        return (n / 1073741824).toFixed(2) + ' Go';
    }

    function formatDate(d) {
        if (!d) return '—';
        try { return new Date(d).toLocaleString('fr-FR'); } catch (_) { return String(d); }
    }

    function loadConfig() {
        return fetch(API + '/platform/config', { headers: headers() })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                var c = data.config || {};
                document.getElementById('platEnabled').checked = c.enabled !== false;
                document.getElementById('platStoragePath').value = c.storagePath || '';
                document.getElementById('platRetention').value = c.defaultRetentionDays || 30;
                document.getElementById('platSchedule').value = c.defaultSchedule || 'disabled';
            });
    }

    function loadOverview() {
        var statusEl = document.getElementById('overviewStatus');
        var wrap = document.getElementById('overviewTableWrap');
        var tbody = document.getElementById('overviewTbody');
        statusEl.textContent = 'Chargement…';
        return fetch(API + '/platform/overview', { headers: headers() })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                var rows = data.overview || [];
                if (!rows.length) {
                    statusEl.textContent = 'Aucune entité trouvée.';
                    wrap.style.display = 'none';
                    return;
                }
                statusEl.textContent = rows.length + ' entité(s).';
                wrap.style.display = 'block';
                tbody.innerHTML = rows.map(function(row) {
                    var last = row.lastRun;
                    var status = last ? last.status : '—';
                    var size = last ? formatBytes(last.sizeBytes) : '—';
                    var date = last ? formatDate(last.startedAt) : 'Jamais';
                    var err = last && last.error ? '<br><small class="text-danger">' + last.error + '</small>' : '';
                    return '<tr>'
                        + '<td><strong>' + (row.name || row.entrepriseId) + '</strong><br><code class="small">' + row.entrepriseId + '</code></td>'
                        + '<td>' + date + '</td>'
                        + '<td>' + status + err + '</td>'
                        + '<td>' + size + '</td>'
                        + '<td>'
                        + '<button type="button" class="btn btn-success btn-sm run-backup" data-id="' + row.entrepriseId + '">Sauvegarder</button> '
                        + '<a class="btn btn-outline btn-sm" href="<?= url('pages/modules/backup-config.php') ?>">Config entité</a>'
                        + '</td>'
                        + '</tr>';
                }).join('');
                tbody.querySelectorAll('.run-backup').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var id = btn.getAttribute('data-id');
                        btn.disabled = true;
                        fetch(API + '/run', {
                            method: 'POST',
                            headers: headers(),
                            body: JSON.stringify({ entrepriseId: id })
                        })
                            .then(parseJson)
                            .then(function(d) {
                                if (!d.success) throw new Error(d.message);
                                showMsg('Sauvegarde lancée pour ' + id, 'success');
                                loadOverview();
                            })
                            .catch(function(e) { showMsg(e.message, 'danger'); })
                            .finally(function() { btn.disabled = false; });
                    });
                });
            })
            .catch(function(e) {
                statusEl.textContent = 'Erreur : ' + e.message;
                wrap.style.display = 'none';
            });
    }

    document.getElementById('platformConfigForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var payload = {
            enabled: document.getElementById('platEnabled').checked,
            storagePath: document.getElementById('platStoragePath').value.trim() || null,
            defaultRetentionDays: parseInt(document.getElementById('platRetention').value, 10) || 30,
            defaultSchedule: document.getElementById('platSchedule').value
        };
        fetch(API + '/platform/config', { method: 'PUT', headers: headers(), body: JSON.stringify(payload) })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                showMsg('Configuration plateforme enregistrée.', 'success');
            })
            .catch(function(e) { showMsg(e.message, 'danger'); });
    });

    document.getElementById('btnRefreshOverview').addEventListener('click', loadOverview);

    loadConfig()
        .then(loadOverview)
        .catch(function(e) { showMsg(e.message, 'danger'); });
})();
</script>

<?php require_once '../includes/footer.php'; ?>
