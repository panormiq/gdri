<?php
/**
 * Éditeur agent IA — infra workflow builder (mode agent uniquement).
 * Accessible uniquement depuis Agents IA (pas de menu direct).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
    redirect(url('pages/dashboard.php'));
}

$flowId = preg_replace('/[^a-f0-9]/i', '', (string) ($_GET['flowId'] ?? ''));
$page_title = $flowId ? 'Éditer un agent' : 'Créer un agent';

$extra_styles = [url('assets/css/agent-flow-canvas.css')];
$agentCanvasJs = __DIR__ . '/../assets/js/agent-flow/agent-canvas.js';
$extra_scripts = [url('assets/js/agent-flow/agent-canvas.js') . '?v=' . (is_file($agentCanvasJs) ? filemtime($agentCanvasJs) : time())];

require_once __DIR__ . '/../includes/header.php';
?>

<div class="agent-editor-app">
    <div class="agent-editor-toolbar">
        <div>
            <a href="<?= url('pages/entity-agents.php') ?>" class="btn-agent-ghost" style="text-decoration:none; display:inline-block; margin-bottom:6px;">← Agents IA</a>
            <h1><?= $flowId ? 'Éditer un agent' : 'Créer un agent' ?></h1>
            <div class="sub">Canvas infra workflow — briques orchestrateur uniquement</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <input type="text" id="agentName" class="form-control" value="Nouvel agent" style="max-width:220px; background:#111827; border-color:#1f2937; color:#e2e8f0;">
            <label style="font-size:0.85rem; color:#cbd5e1;"><input type="checkbox" id="agentEnabled" checked> Actif</label>
        </div>
        <div class="agent-editor-actions">
            <button type="button" class="btn-agent-ghost" id="btnRunAgent">▶ Lancer</button>
            <button type="button" class="btn-agent" id="btnSaveAgent">💾 Enregistrer</button>
        </div>
    </div>

    <div class="agent-editor-layout">
        <aside class="agent-palette">
            <h3 style="margin:0 0 12px; font-size:0.95rem; color:#e2e8f0;">Palette</h3>
            <p class="text-muted small" style="margin:0 0 12px; color:#94a3b8;">Glisser un bloc sur le canvas. Relier ensuite via les ports bleus (bas/droite).</p>
            <div id="agentPalette">Chargement…</div>
        </aside>

        <div class="agent-canvas-wrap">
            <div id="agentCanvas" class="agent-canvas"></div>
        </div>

        <aside class="agent-config">
            <div id="agentConfig">
                <p class="empty">Sélectionnez un bloc sur le canvas.</p>
            </div>
        </aside>
    </div>
</div>

<script>
window.AGENT_FLOW_EDITOR = <?= json_encode([
    'apiBase' => rtrim(getApiBaseUrl(), '/'),
    'jwt' => getJWTToken(),
    'flowId' => $flowId ?: null,
    'backUrl' => url('pages/entity-agents.php'),
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
