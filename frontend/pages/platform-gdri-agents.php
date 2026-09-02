<?php
/**
 * Console plateforme — Agents GDRI officiels (Hook, Design…).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$page_title = 'Agents GDRI';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$editorUrl = url('pages/entity-agent-editor.php') . '?return=gdri';
$extra_styles = [url('assets/css/agent-cards.css')];
$extra_scripts = [url('assets/js/agent-flow/agents-list-app.js') . '?v=' . time()];

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Agents GDRI',
    'Agents système de la plateforme. Ce ne sont pas des agents métier : on les édite ici, puis on les pose comme boîte noire dans un flux (palette Hook, sous-agent Design…).',
    ['narrow' => false]
);
renderConsoleBackLink('Agents IA', url('pages/platform-agents.php'));
?>

<div id="agentsMsg" class="alert alert-info small" style="display:none;"></div>

<div class="card" style="margin-bottom:1.25rem;">
    <div class="card-header" style="background:#f8f9fa;">
        <h2 style="margin:0; font-size:1.05rem;">Modèles système</h2>
    </div>
    <div class="card-body" style="display:flex; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" id="btnTplHook">Créer / ouvrir Hook</button>
        <button type="button" class="btn btn-primary" id="btnTplDesign">Créer / ouvrir Design page web</button>
        <span class="text-muted small" style="align-self:center;">Un exemplaire par entité. La palette et les sous-agents pointent vers ces flux.</span>
    </div>
</div>

<div id="agentsStatus" class="text-muted small">Chargement…</div>
<div id="agentsCards" class="agent-cards-grid"></div>

<script>
(function() {
    var API = <?= json_encode($api_base_url . '/agent-flows') ?>;
    var JWT = <?= json_encode($jwt_token) ?>;
    var editorUrl = <?= json_encode($editorUrl) ?>;

    function headers() {
        return { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' };
    }

    function createFromTemplate(templateId) {
        var msg = document.getElementById('agentsMsg');
        msg.style.display = 'block';
        msg.className = 'alert alert-info small';
        msg.textContent = 'Ouverture de l’agent système…';
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
                    window.location.href = editorUrl + '&flowId=' + encodeURIComponent(id);
                    return;
                }
                window.location.reload();
            })
            .catch(function(e) {
                msg.className = 'alert alert-danger small';
                msg.textContent = e.message;
            });
    }

    var btnTplHook = document.getElementById('btnTplHook');
    if (btnTplHook) btnTplHook.addEventListener('click', function() { createFromTemplate('agent-hook'); });
    var btnTplDesign = document.getElementById('btnTplDesign');
    if (btnTplDesign) btnTplDesign.addEventListener('click', function() { createFromTemplate('agent-design-page-web'); });
    var bootCreate = new URLSearchParams(window.location.search).get('create');
    if (bootCreate) createFromTemplate(bootCreate);
})();

window.AGENTS_LIST_APP = <?= json_encode([
    'apiBase' => $api_base_url,
    'jwt' => $jwt_token,
    'mode' => null,
    'editorBase' => $editorUrl,
    'canManage' => true,
    'showInbox' => false,
    'reviewPageUrl' => url('pages/agent-human-review.php'),
    'runPageUrl' => url('pages/agent-run.php'),
    'space' => 'gdri',
    'scope' => 'gdri',
    'isGdriAdmin' => true,
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
