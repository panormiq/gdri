<?php
/**
 * Console entité — Agents IA (cartes auto / assistés + modèles).
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

$tab = isset($_GET['tab']) && $_GET['tab'] === 'assisted' ? 'assisted' : 'automatic';

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Agents IA',
    'Apps agents : image, mode automatique ou assisté, config par brique. Les comptes restent dans Connecteurs.',
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
        <button type="button" class="btn btn-outline" id="btnTplAssisted">Créer Agent assisté (document)</button>
        <button type="button" class="btn btn-outline" id="btnTplInvoices">Créer Agent factures mail</button>
        <span class="text-muted small" style="align-self:center;">Mail / Facebook = auto · Assisté / Factures = pause + Valider / Rejeter</span>
    </div>
</div>

<div style="display:flex; gap:8px; margin-bottom:1rem; flex-wrap:wrap;">
    <a class="btn <?= $tab === 'automatic' ? 'btn-primary' : 'btn-outline' ?>"
       href="<?= htmlspecialchars(url('pages/entity-agents.php?tab=automatic')) ?>">Automatiques</a>
    <a class="btn <?= $tab === 'assisted' ? 'btn-primary' : 'btn-outline' ?>"
       href="<?= htmlspecialchars(url('pages/entity-agents.php?tab=assisted')) ?>">Assistés</a>
</div>

<?php if ($tab === 'assisted'): ?>
<div class="card" style="margin-bottom:1.25rem;">
    <div class="card-header" style="background:#fff7ed; border-bottom:2px solid #ea580c;">
        <h2 style="margin:0; font-size:1.05rem;">À traiter</h2>
    </div>
    <div class="card-body">
        <div id="inboxStatus" class="text-muted small">Chargement…</div>
        <div id="agentsInbox" class="agent-inbox-list"></div>
    </div>
</div>
<?php endif; ?>

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
})();

window.AGENTS_LIST_APP = <?= json_encode([
    'apiBase' => $api_base_url,
    'jwt' => $jwt_token,
    'mode' => $tab,
    'editorBase' => $createAgentUrl,
    'canManage' => true,
    'showInbox' => $tab === 'assisted',
    'reviewPageUrl' => url('pages/agent-human-review.php'),
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
