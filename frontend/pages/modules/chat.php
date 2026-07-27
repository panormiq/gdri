<?php
/**
 * Point d'entrée Chat IA — Mon espace (layout console).
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';
require_once '../../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$_SESSION['gdri_workspace_mode'] = 'user';

$page_title = 'Chat IA';
$assetBase = '/modules/chat/frontend';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Chat IA',
    'Assistant avec mémoire de conversation, contexte et choix serveur/modèle.'
);
?>

<link rel="stylesheet" href="<?= htmlspecialchars($assetBase) ?>/assets/css/chat.css?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/chat/frontend/assets/css/chat.css') ?>">

<div class="chat-page">
    <div class="chat-container">
        <div class="chat-card">
            <div class="chat-header">
                <div class="chat-header-top">
                    <div>
                        <h2>Assistant IA</h2>
                        <small style="color:#666;">Chat avec mémoire de conversation</small>
                    </div>
                </div>
                <div class="chat-meta" id="chatMeta">Chargement de la configuration...</div>
                <div class="runtime-selectors" id="runtimeSelectors" style="display:none;">
                    <div class="field">
                        <label for="serverSelect"><strong>Serveur</strong></label>
                        <select id="serverSelect"></select>
                    </div>
                    <div class="field">
                        <label for="modelSelect"><strong>LLM</strong></label>
                        <select id="modelSelect"></select>
                    </div>
                </div>
                <div class="context-wrap">
                    <label for="contextInput"><strong>Contexte</strong></label>
                    <textarea id="contextInput" placeholder="Ex: Tu réponds en français, style concis, domaine métier RH."></textarea>
                    <div class="context-help">Ce contexte guide l’IA pendant cette conversation uniquement.</div>
                </div>
            </div>

            <div class="chat-messages" id="messages">
                <div class="chat-message bot">Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider aujourd'hui ?</div>
            </div>
            <div class="chat-status-line" id="statusLine"></div>
            <div class="chat-typing" id="typing">L'IA est en train d'écrire...</div>

            <div class="chat-input-area">
                <div class="response-mode-wrap">
                    <label for="responseMode">Réponse</label>
                    <select id="responseMode" title="Mode d’affichage de la réponse IA">
                        <option value="complete">Complète (une fois)</option>
                        <option value="stream">Flux (mot à mot)</option>
                    </select>
                </div>
                <input type="text" id="userInput" placeholder="Écrivez votre message..." autocomplete="off">
                <button type="button" id="sendBtn">Envoyer</button>
            </div>
        </div>
    </div>
</div>

<script>
window.CHAT_CONFIG = {
    apiBase: <?= json_encode($api_base_url, JSON_UNESCAPED_UNICODE) ?>,
    jwt: <?= json_encode($jwt_token, JSON_UNESCAPED_UNICODE) ?>
};
</script>
<script src="<?= htmlspecialchars($assetBase) ?>/assets/js/chat-app.js?v=<?= (int)@filemtime(__DIR__ . '/../../../modules/chat/frontend/assets/js/chat-app.js') ?>"></script>

<?php
renderConsoleLayoutEnd();
require_once '../../includes/footer.php';
?>
