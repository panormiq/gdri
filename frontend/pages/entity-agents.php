<?php
/**
 * Console entité — Agents IA.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireEntityConsoleAccess();

$page_title = 'Agents IA';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$createAgentUrl = url('pages/entity-agent-editor.php');

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Agents IA',
    'Automatisations planifiées : backup, envoi mail, HTTP… Construites dans l’éditeur visuel (infra workflow).',
    ['actions' => '<a class="btn btn-primary" href="' . htmlspecialchars($createAgentUrl) . '">+ Créer un agent</a>']
);
?>

<div id="agentsMsg" class="alert alert-info small" style="display:none;"></div>

<div class="card">
    <div class="card-header" style="background:#f8f9fa; border-bottom:2px solid #6f42c1;">
        <h2 style="margin:0; font-size:1.1rem;">Agents de l'entité</h2>
    </div>
    <div class="card-body">
        <div id="agentsStatus" class="text-muted small">Chargement…</div>
        <div id="agentsTableWrap" style="overflow-x:auto; margin-top:1rem; display:none;">
            <table class="table table-bordered table-sm">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Déclencheur</th>
                        <th>Planification</th>
                        <th>Statut</th>
                        <th style="width:220px;">Actions</th>
                    </tr>
                </thead>
                <tbody id="agentsTbody"></tbody>
            </table>
        </div>
    </div>
</div>

<script>
(function() {
    var API = <?= json_encode($api_base_url . '/agent-flows') ?>;
    var JWT = <?= json_encode($jwt_token) ?>;
    var editorBase = <?= json_encode($createAgentUrl) ?>;

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

    function triggerLabel(flow) {
        var t = flow.trigger || {};
        if (t.brickId === 'cron-trigger') return '⏰ Planifié';
        if (t.brickId === 'manual-trigger') return '▶️ Manuel';
        return t.brickId || '—';
    }

    function loadAgents() {
        var statusEl = document.getElementById('agentsStatus');
        var wrap = document.getElementById('agentsTableWrap');
        var tbody = document.getElementById('agentsTbody');
        statusEl.textContent = 'Chargement…';

        fetch(API + '/flows', { headers: headers() })
            .then(parseJson)
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                var flows = data.flows || [];
                if (!flows.length) {
                    statusEl.textContent = 'Aucun agent. Cliquez sur « Créer un agent » pour commencer.';
                    wrap.style.display = 'none';
                    return;
                }
                statusEl.textContent = flows.length + ' agent(s).';
                wrap.style.display = 'block';
                tbody.innerHTML = flows.map(function(flow) {
                    var id = flow._id || '';
                    var enabled = flow.enabled !== false;
                    return '<tr>'
                        + '<td><strong>' + (flow.name || 'Sans nom') + '</strong>'
                        + (flow.description ? '<br><small class="text-muted">' + flow.description + '</small>' : '') + '</td>'
                        + '<td>' + triggerLabel(flow) + '</td>'
                        + '<td>' + (flow.scheduleLabel || '—') + '</td>'
                        + '<td>' + (enabled ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-secondary">Inactif</span>') + '</td>'
                        + '<td style="white-space:nowrap;">'
                        + '<a class="btn btn-outline btn-sm" href="' + editorBase + '?flowId=' + encodeURIComponent(id) + '">Éditer</a> '
                        + '<button type="button" class="btn btn-success btn-sm agent-run" data-id="' + id + '">Lancer</button> '
                        + '<button type="button" class="btn btn-outline btn-sm btn-danger agent-del" data-id="' + id + '">Suppr.</button>'
                        + '</td>'
                        + '</tr>';
                }).join('');

                tbody.querySelectorAll('.agent-run').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        btn.disabled = true;
                        fetch(API + '/flows/' + btn.getAttribute('data-id') + '/run', { method: 'POST', headers: headers(), body: '{}' })
                            .then(parseJson)
                            .then(function(d) {
                                if (!d.success) throw new Error(d.message);
                                alert('Agent lancé avec succès.');
                            })
                            .catch(function(e) { alert(e.message); })
                            .finally(function() { btn.disabled = false; });
                    });
                });

                tbody.querySelectorAll('.agent-del').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        if (!confirm('Supprimer cet agent ?')) return;
                        fetch(API + '/flows/' + btn.getAttribute('data-id'), { method: 'DELETE', headers: headers() })
                            .then(parseJson)
                            .then(function(d) {
                                if (!d.success) throw new Error(d.message);
                                loadAgents();
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

    loadAgents();
})();
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
