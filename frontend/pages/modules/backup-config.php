<?php
/**
 * Sauvegarde — configuration entité (ADMIN_ENTITY / ADMIN_GDRI)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/jwt-helper.php';
require_once __DIR__ . '/../../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Sauvegarde de la base client';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

require_once __DIR__ . '/../../includes/header.php';
renderConsoleLayoutStart(
    'Sauvegarde',
    'Export de la base MongoDB client (GDR-ENTREPRISE-*) vers le stockage local du serveur.',
    ['narrow' => true]
);
renderConsoleBackLink('Structurel', url('pages/entity-structurel.php'));
?>

    <div id="backupMsg" class="alert alert-info small" style="display:none;"></div>

    <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header" style="background:#f8f9fa; border-bottom:2px solid #0d6efd;">
            <h2 style="margin:0; font-size:1.15rem;">Configuration</h2>
        </div>
        <div class="card-body">
            <form id="backupConfigForm">
                <div class="form-group" style="margin-bottom:1rem;">
                    <label><input type="checkbox" id="cfgEnabled" checked> Sauvegarde activée pour cette entité</label>
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label for="cfgScope">Périmètre</label>
                    <select id="cfgScope" class="form-control">
                        <option value="full">Base complète</option>
                        <option value="collections">Collections sélectionnées</option>
                    </select>
                </div>
                <div class="form-group" id="collectionsGroup" style="margin-bottom:1rem; display:none;">
                    <label>Collections à inclure</label>
                    <div id="collectionsList" class="text-muted small">Chargement…</div>
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label for="cfgRetention">Rétention (jours)</label>
                    <input type="number" id="cfgRetention" class="form-control" min="1" max="365" value="30">
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label for="cfgSchedule">Planification (bientôt)</label>
                    <select id="cfgSchedule" class="form-control" disabled>
                        <option value="disabled">Manuel uniquement</option>
                        <option value="daily">Quotidien</option>
                        <option value="weekly">Hebdomadaire</option>
                    </select>
                    <p class="text-muted small" style="margin-top:0.35rem;">La planification automatique arrive en phase 2.</p>
                </div>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </form>
        </div>
    </div>

    <div class="section-actions" style="margin-bottom:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-success" id="btnRunBackup">▶ Sauvegarder maintenant</button>
        <button type="button" class="btn btn-outline" id="btnRefreshRuns">↻ Actualiser l'historique</button>
    </div>

    <div class="card">
        <div class="card-header" style="background:#f8f9fa; border-bottom:2px solid #dee2e6;">
            <h2 style="margin:0; font-size:1.15rem;">Historique</h2>
        </div>
        <div class="card-body">
            <div id="runsStatus" class="text-muted small">Chargement…</div>
            <div id="runsTableWrap" style="overflow-x:auto; margin-top:1rem; display:none;">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Statut</th>
                            <th>Collections</th>
                            <th>Documents</th>
                            <th>Taille</th>
                            <th style="width:160px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="runsTbody"></tbody>
                </table>
            </div>
        </div>
    </div>

<?php renderConsoleLayoutEnd(); ?>

<script>
(function() {
    var API = <?= json_encode($api_base_url . '/backup') ?>;
    var JWT = <?= json_encode($jwt_token) ?>;
    var entityConfig = null;
    var availableCollections = [];

    function headers() {
        return { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' };
    }

    function parseJson(res) {
        var ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.indexOf('application/json') === -1) {
            return res.text().then(function(text) {
                throw new Error('Réponse non-JSON (status ' + res.status + ')');
            });
        }
        return res.json();
    }

    function showMsg(text, type) {
        var el = document.getElementById('backupMsg');
        if (!el) return;
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

    function statusBadge(status) {
        var map = { completed: 'success', running: 'warning', failed: 'danger' };
        var cls = map[status] || 'secondary';
        return '<span class="badge badge-' + cls + '">' + (status || '?') + '</span>';
    }

    function renderCollectionsPicker() {
        var wrap = document.getElementById('collectionsList');
        if (!wrap) return;
        if (!availableCollections.length) {
            wrap.innerHTML = '<span class="text-muted">Aucune collection détectée.</span>';
            return;
        }
        var selected = new Set((entityConfig && entityConfig.collections) || []);
        wrap.innerHTML = availableCollections.map(function(name) {
            var checked = selected.has(name) ? ' checked' : '';
            return '<label style="display:block; margin-bottom:0.25rem;"><input type="checkbox" class="col-pick" value="' + name + '"' + checked + '> <code>' + name + '</code></label>';
        }).join('');
    }

    function toggleCollectionsGroup() {
        var scope = document.getElementById('cfgScope');
        var group = document.getElementById('collectionsGroup');
        if (group && scope) group.style.display = scope.value === 'collections' ? 'block' : 'none';
    }

    function loadConfig() {
        return fetch(API + '/entity/config', { headers: headers() })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur config');
                entityConfig = data.config || {};
                availableCollections = data.collections || [];
                document.getElementById('cfgEnabled').checked = entityConfig.enabled !== false;
                document.getElementById('cfgScope').value = entityConfig.scope || 'full';
                document.getElementById('cfgRetention').value = entityConfig.retentionDays || 30;
                document.getElementById('cfgSchedule').value = entityConfig.schedule || 'disabled';
                renderCollectionsPicker();
                toggleCollectionsGroup();
            });
    }

    function loadRuns() {
        var statusEl = document.getElementById('runsStatus');
        var wrap = document.getElementById('runsTableWrap');
        var tbody = document.getElementById('runsTbody');
        statusEl.textContent = 'Chargement…';
        return fetch(API + '/runs?limit=30', { headers: headers() })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                var runs = data.runs || [];
                if (!runs.length) {
                    statusEl.textContent = 'Aucune sauvegarde pour le moment.';
                    wrap.style.display = 'none';
                    return;
                }
                statusEl.textContent = runs.length + ' sauvegarde(s).';
                wrap.style.display = 'block';
                tbody.innerHTML = runs.map(function(run) {
                    var id = run._id || '';
                    var dl = run.status === 'completed'
                        ? '<button type="button" class="btn btn-outline btn-sm run-download" data-id="' + id + '" data-name="' + (run.fileName || 'backup.json.gz') + '">Télécharger</button>'
                        : '';
                    var del = '<button type="button" class="btn btn-outline btn-sm btn-danger run-delete" data-id="' + id + '">Supprimer</button>';
                    return '<tr>'
                        + '<td>' + formatDate(run.startedAt) + '</td>'
                        + '<td>' + statusBadge(run.status) + (run.error ? '<br><small class="text-danger">' + run.error + '</small>' : '') + '</td>'
                        + '<td>' + (run.collectionCount || 0) + '</td>'
                        + '<td>' + (run.documentCount || 0) + '</td>'
                        + '<td>' + formatBytes(run.sizeBytes) + '</td>'
                        + '<td style="white-space:nowrap;">' + dl + ' ' + del + '</td>'
                        + '</tr>';
                }).join('');
                tbody.querySelectorAll('.run-delete').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        if (!confirm('Supprimer cette sauvegarde ?')) return;
                        fetch(API + '/runs/' + btn.getAttribute('data-id'), { method: 'DELETE', headers: headers() })
                            .then(parseJson)
                            .then(function(d) { if (!d.success) throw new Error(d.message); loadRuns(); })
                            .catch(function(e) { alert(e.message); });
                    });
                });
                tbody.querySelectorAll('.run-download').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var runId = btn.getAttribute('data-id');
                        var fileName = btn.getAttribute('data-name') || 'backup.json.gz';
                        fetch(API + '/runs/' + runId + '/download', { headers: { 'Authorization': 'Bearer ' + JWT } })
                            .then(function(res) {
                                if (!res.ok) throw new Error('Téléchargement impossible (status ' + res.status + ')');
                                return res.blob();
                            })
                            .then(function(blob) {
                                var url = URL.createObjectURL(blob);
                                var a = document.createElement('a');
                                a.href = url;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                URL.revokeObjectURL(url);
                            })
                            .catch(function(e) { alert(e.message); });
                    });
                });
            })
            .catch(function(e) {
                statusEl.textContent = 'Erreur : ' + e.message;
                wrap.style.display = 'none';
            });
    }

    document.getElementById('cfgScope').addEventListener('change', toggleCollectionsGroup);

    document.getElementById('backupConfigForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var collections = [];
        if (document.getElementById('cfgScope').value === 'collections') {
            document.querySelectorAll('.col-pick:checked').forEach(function(cb) {
                collections.push(cb.value);
            });
        }
        var payload = {
            enabled: document.getElementById('cfgEnabled').checked,
            scope: document.getElementById('cfgScope').value,
            collections: collections,
            retentionDays: parseInt(document.getElementById('cfgRetention').value, 10) || 30,
            schedule: document.getElementById('cfgSchedule').value
        };
        fetch(API + '/entity/config', { method: 'PUT', headers: headers(), body: JSON.stringify(payload) })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                entityConfig = data.config;
                showMsg('Configuration enregistrée.', 'success');
            })
            .catch(function(e) { showMsg(e.message, 'danger'); });
    });

    document.getElementById('btnRunBackup').addEventListener('click', function() {
        var btn = this;
        btn.disabled = true;
        showMsg('Sauvegarde en cours…', 'info');
        fetch(API + '/run', { method: 'POST', headers: headers(), body: '{}' })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                showMsg('Sauvegarde terminée.', 'success');
                loadRuns();
            })
            .catch(function(e) { showMsg(e.message, 'danger'); })
            .finally(function() { btn.disabled = false; });
    });

    document.getElementById('btnRefreshRuns').addEventListener('click', loadRuns);

    loadConfig()
        .then(loadRuns)
        .catch(function(e) { showMsg(e.message, 'danger'); });
})();
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
