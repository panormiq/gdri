<?php
/**
 * Console entité — Agents IA (liste unique).
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
$extra_styles = [url('assets/css/agent-cards.css')];
$extra_scripts = [url('assets/js/agent-flow/agents-list-app.js') . '?v=' . time()];

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Agents IA',
    'Apps agents : blocs génériques (déclencher, données, condition, action, validation, sortie). Les comptes restent dans Connecteurs.',
    ['actions' => '<a class="btn btn-primary" href="' . htmlspecialchars($createAgentUrl) . '">+ Créer un agent</a>']
);
?>

<div id="agentsMsg" class="alert alert-info small" style="display:none;"></div>

<div class="card" style="margin-bottom:1rem;">
    <div class="card-header" style="background:#f8f9fa;">
        <h2 style="margin:0; font-size:1.05rem;">Modèles prêts à l'emploi</h2>
    </div>
    <div class="card-body" style="display:flex; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline" id="btnTplMail">Créer Agent Mail</button>
        <button type="button" class="btn btn-outline" id="btnTplFacebook">Créer Agent Facebook</button>
        <button type="button" class="btn btn-outline" id="btnTplAssisted">Créer Agent avec validation</button>
        <button type="button" class="btn btn-outline" id="btnTplInvoices">Créer Agent factures mail</button>
        <span class="text-muted small" style="align-self:center;">Hook et Design page web sont des agents système : console GDRI → Agents GDRI.</span>
    </div>
</div>

<div id="agentsStatus" class="text-muted small">Chargement…</div>
<div id="agentsCards" class="agent-cards-grid"></div>

<script>
(function() {
    var API = <?= json_encode($api_base_url . '/agent-flows') ?>;
    var JWT = <?= json_encode($jwt_token) ?>;

    function headers() {
        return { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' };
    }

    function createFromTemplate(templateId) {
        var msg = document.getElementById('agentsMsg');
        msg.style.display = 'block';
        msg.textContent = 'Création du modèle…';
        fetch(API + '/templates/' + encodeURIComponent(templateId) + '/create', {
            method: 'POST',
            headers: headers(),
            body: '{}'
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) throw new Error(data.message);
                var id = data.flow && data.flow._id;
                if (id) {
                    window.location.href = <?= json_encode($createAgentUrl) ?> + '?flowId=' + encodeURIComponent(id);
                    return;
                }
                window.location.reload();
            })
            .catch(function(e) {
                msg.className = 'alert alert-danger small';
                msg.textContent = e.message;
            });
    }

    var btnTplMail = document.getElementById('btnTplMail');
    if (btnTplMail) btnTplMail.addEventListener('click', function() { createFromTemplate('agent-mail'); });
    var btnTplFb = document.getElementById('btnTplFacebook');
    if (btnTplFb) btnTplFb.addEventListener('click', function() { createFromTemplate('agent-facebook'); });
    var btnTplAs = document.getElementById('btnTplAssisted');
    if (btnTplAs) btnTplAs.addEventListener('click', function() { createFromTemplate('agent-assisted-doc'); });
    var btnTplInv = document.getElementById('btnTplInvoices');
    if (btnTplInv) btnTplInv.addEventListener('click', function() { createFromTemplate('agent-mail-invoices'); });
    var bootCreate = new URLSearchParams(window.location.search).get('create');
    if (bootCreate === 'agent-hook' || bootCreate === 'agent-design-page-web') {
      window.location.replace(<?= json_encode(url('pages/platform-gdri-agents.php')) ?> + '?create=' + encodeURIComponent(bootCreate));
      return;
    }
    if (bootCreate) createFromTemplate(bootCreate);
})();

window.AGENTS_LIST_APP = <?= json_encode([
    'apiBase' => $api_base_url,
    'jwt' => $jwt_token,
    'mode' => null,
    'editorBase' => $createAgentUrl,
    'canManage' => true,
    'showInbox' => false,
    'reviewPageUrl' => url('pages/agent-human-review.php'),
    'runPageUrl' => url('pages/agent-run.php'),
    'space' => 'entity',
    'scope' => 'entity',
    'isGdriAdmin' => hasRole(ROLE_ADMIN_GDRI),
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
