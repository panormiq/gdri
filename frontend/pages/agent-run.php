<?php
/**
 * Run d'un agent — sablier, progression du flux, modal de validation.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireUserWorkspaceEntityAccess();

$flowId = preg_replace('/[^a-f0-9]/i', '', (string) ($_GET['flowId'] ?? ''));
$runId = preg_replace('/[^a-f0-9]/i', '', (string) ($_GET['runId'] ?? ''));
$space = strtolower(trim((string) ($_GET['space'] ?? 'user')));
$backUrl = $space === 'entity'
    ? url('pages/entity-agents.php')
    : url('pages/user-agents.php');

$page_title = 'Run agent';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$runCss = __DIR__ . '/../assets/css/agent-run.css';
$extra_styles = [url('assets/css/agent-run.css') . '?v=' . (is_file($runCss) ? filemtime($runCss) : time())];
$runJs = __DIR__ . '/../assets/js/agent-flow/agent-run-app.js';
$extra_scripts = [url('assets/js/agent-flow/agent-run-app.js') . '?v=' . (is_file($runJs) ? filemtime($runJs) : time())];

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Run',
    'Progression du flux. La validation s’ouvre ici, pas dans une App.',
    ['actions' => '<a class="btn btn-outline" href="' . htmlspecialchars($backUrl) . '">← Agents</a>']
);
?>

<div class="agent-run">
    <div id="runMsg" class="alert alert-info small" style="display:none;"></div>

    <div class="agent-run-head">
        <img id="runThumb" class="agent-run-thumb" alt="" style="display:none;">
        <div>
            <h1 id="runTitle">Démarrage…</h1>
            <p class="agent-run-status" id="runStatusLine">Préparation du run</p>
        </div>
    </div>

    <div class="agent-run-hourglass" id="runHourglass">
        <div class="agent-run-spinner" aria-hidden="true"></div>
        <p class="text-muted small" style="margin:0;" id="runHourglassLabel">Travail en cours…</p>
    </div>

    <div class="card">
        <div class="card-header" style="background:#f8fafc;">
            <strong>Flux</strong>
        </div>
        <div class="card-body">
            <ol class="agent-run-timeline" id="runTimeline">
                <li class="text-muted small">Chargement…</li>
            </ol>
        </div>
    </div>

    <div id="runDone" class="agent-run-done" style="display:none;"></div>
</div>

<div class="agent-run-modal" id="runModal" hidden>
    <div class="agent-run-modal-backdrop" data-close-modal></div>
    <div class="agent-run-modal-card" role="dialog" aria-modal="true" aria-labelledby="runModalTitle">
        <h2 id="runModalTitle">Validation</h2>
        <p class="text-muted small" id="runModalInstructions"></p>
        <p class="text-muted small" id="runModalMeta"></p>
        <div class="agent-run-draft" id="runModalDraft"></div>
        <ul id="runModalAtts" style="margin:0; padding-left:1.1rem;"></ul>
        <div class="agent-run-modal-actions">
            <button type="button" class="btn btn-success" id="runBtnApprove">Valider</button>
            <button type="button" class="btn btn-danger" id="runBtnReject">Rejeter</button>
            <a class="btn btn-outline" id="runBtnInbox" href="<?= htmlspecialchars(url('pages/agent-human-review.php')) ?>">Ouvrir dans À traiter</a>
        </div>
    </div>
</div>

<script>
window.AGENT_RUN_APP = <?= json_encode([
    'apiBase' => $api_base_url,
    'jwt' => $jwt_token,
    'flowId' => $flowId ?: null,
    'runId' => $runId ?: null,
    'backUrl' => $backUrl,
    'reviewUrl' => url('pages/agent-human-review.php'),
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
