<?php
/**
 * Éditeur agent IA — infra workflow builder (mode agent uniquement).
 * Accessible uniquement depuis Agents IA (pas de menu direct).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';

require_once __DIR__ . '/../includes/entity-console-nav.php';
requireUserWorkspaceEntityAccess();

$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);

$flowId = preg_replace('/[^a-f0-9]/i', '', (string) ($_GET['flowId'] ?? ''));
$page_title = $flowId ? 'Éditer un agent' : 'Créer un agent';

$editorSpace = strtolower(trim((string) ($_GET['space'] ?? '')));
$editorReturn = strtolower(trim((string) ($_GET['return'] ?? '')));
$fromUserSpace = ($editorSpace === 'user' || in_array($editorReturn, ['auto', 'automatic', 'assisted'], true));
if ($editorReturn === 'assisted') {
    $backUrl = url('pages/user-agents-assisted.php');
    $backLabel = '← Agents assistés';
    $defaultInteractionMode = 'assisted';
} elseif ($fromUserSpace) {
    $backUrl = url('pages/user-agents-auto.php');
    $backLabel = '← Agents automatiques';
    $defaultInteractionMode = 'automatic';
} else {
    $backUrl = url('pages/entity-agents.php');
    $backLabel = '← Agents IA';
    $defaultInteractionMode = 'auto';
}

$extra_styles = [url('assets/css/agent-flow-canvas.css'), url('assets/css/agent-cards.css')];
$agentCanvasJs = __DIR__ . '/../assets/js/agent-flow/agent-canvas.js';
$extra_scripts = [url('assets/js/agent-flow/agent-canvas.js') . '?v=' . (is_file($agentCanvasJs) ? filemtime($agentCanvasJs) : time())];

require_once __DIR__ . '/../includes/header.php';
?>

<div class="agent-editor-app">
    <div class="agent-editor-toolbar">
        <div>
            <a href="<?= htmlspecialchars($backUrl) ?>" class="btn-agent-ghost" style="text-decoration:none; display:inline-block; margin-bottom:6px;"><?= htmlspecialchars($backLabel) ?></a>
            <h1><?= $flowId ? 'Éditer un agent' : 'Créer un agent' ?></h1>
            <div class="sub">Canvas + pages de config par brique · image app · mode auto / assisté</div>
        </div>
        <div class="agent-editor-identity">
            <img id="agentImagePreview" class="agent-thumb" alt="" style="display:none;">
            <input type="text" id="agentName" class="form-control" value="Nouvel agent" style="max-width:200px; background:#111827; border-color:#1f2937; color:#e2e8f0;">
            <input type="url" id="agentImageUrl" class="form-control" placeholder="URL image (app)" style="max-width:220px; background:#111827; border-color:#1f2937; color:#e2e8f0;">
            <select id="agentInteractionMode" class="form-control" style="max-width:160px; background:#111827; border-color:#1f2937; color:#e2e8f0;" title="Mode d'interaction">
                <option value="auto"<?= $defaultInteractionMode === 'auto' ? ' selected' : '' ?>>Mode : auto (dérivé)</option>
                <option value="automatic"<?= $defaultInteractionMode === 'automatic' ? ' selected' : '' ?>>Forcer automatique</option>
                <option value="assisted"<?= $defaultInteractionMode === 'assisted' ? ' selected' : '' ?>>Forcer assisté</option>
            </select>
            <label style="font-size:0.85rem; color:#cbd5e1;"><input type="checkbox" id="agentEnabled" checked> Actif</label>
        </div>
        <div class="agent-editor-actions">
            <button type="button" class="btn-agent-ghost" id="btnRunAgent">▶ Lancer</button>
            <button type="button" class="btn-agent" id="btnSaveAgent">💾 Enregistrer</button>
        </div>
    </div>

    <div style="padding:0 16px 12px; max-width:960px;">
        <label for="agentContext" style="display:block; margin:0 0 4px; color:#cbd5e1; font-size:0.9rem; font-weight:600;">Contexte général de l'agent</label>
        <textarea id="agentContext" rows="2" class="form-control"
            placeholder="Ex. Récupérer mes invoices Games Workshop, les faire valider, puis supprimer le mail."
            style="background:#111827; border-color:#1f2937; color:#e2e8f0; width:100%;"></textarea>
        <p class="text-muted small" style="margin:6px 0 0; color:#64748b;">
            But global de l'agent. Combiné au « contexte de page de validation » de la brique Revue pour générer la page par IA.
        </p>
    </div>

    <div class="agent-editor-tabs" id="agentEditorTabs" style="display:flex; gap:8px; padding:0 16px 12px; flex-wrap:wrap;">
        <button type="button" class="btn-agent agent-tab is-active" data-tab="canvas">Canvas</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="facebook" id="tabFacebook" style="display:none;">Facebook</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="intentions" id="tabIntentions" style="display:none;">Intentions</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="routing" id="tabRouting" style="display:none;">Routage</button>
    </div>

    <div class="agent-editor-layout" id="panelCanvas">
        <aside class="agent-palette">
            <h3 style="margin:0 0 12px; font-size:0.95rem; color:#e2e8f0;">Palette</h3>
            <p class="text-muted small" style="margin:0 0 12px; color:#94a3b8;">Clic pour dérouler un type. Connecteurs → Input / Output. Double-clic pour paramétrer.</p>
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

    <div id="panelFacebook" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:1100px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Facebook — écoute</h2>
        <p class="text-muted small" style="color:#94a3b8;">
            Configurez ce que cet agent écoute. La connexion OAuth / pages se gère côté connecteur plateforme.
            Plusieurs déclencheurs (Mail + Facebook) peuvent coexister sur le même agent.
        </p>

        <div style="margin:12px 0; display:flex; flex-wrap:wrap; gap:8px;">
            <button type="button" class="btn-agent-ghost" data-fb-scenario="comments">Veille commentaires</button>
            <button type="button" class="btn-agent-ghost" data-fb-scenario="messages">Messages privés</button>
            <button type="button" class="btn-agent-ghost" data-fb-scenario="posts">Nouveaux posts (poll)</button>
            <button type="button" class="btn-agent-ghost" data-fb-scenario="mix">Mix recommandé</button>
        </div>
        <input type="hidden" id="fbScenario" value="">

        <div style="margin-top:16px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;">
            <label for="fbPageId" style="display:block; margin:0 0 6px; color:#e2e8f0; font-weight:600;">Compte / page Facebook</label>
            <select id="fbPageId" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                <option value="">Chargement des pages…</option>
            </select>
            <p id="fbPageHint" class="text-muted small" style="margin:8px 0 0; color:#64748b;">
                Sélectionnez la page connectée que cet agent écoute. Connexion OAuth : Paramètres → Connecteurs → Facebook.
            </p>
        </div>

        <div style="margin-top:20px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;" id="fbWebhookZone">
            <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
                <h3 style="margin:0; font-size:15px; color:#e2e8f0;">Webhook — temps réel</h3>
                <label style="display:inline-flex; align-items:center; gap:6px; color:#e2e8f0; margin:0;">
                    <input type="checkbox" id="fbModePush"> Activer
                </label>
            </div>
            <p class="text-muted small" style="margin:0 0 12px; color:#94a3b8;">
                Meta pousse chaque événement dès qu’il arrive (pas de «&nbsp;nombre de messages&nbsp;» :
                1 événement = 1 run). Choisissez ce que cet agent doit traiter.
            </p>
            <div id="fbWebhookEvents" style="display:grid; gap:10px;">
                <label style="display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#111827; color:#e2e8f0; cursor:pointer;">
                    <input type="checkbox" id="fbWhComments" style="margin-top:3px;">
                    <span>
                        <strong style="display:block;">Commentaires</strong>
                        <span class="text-muted small" style="color:#94a3b8;">Commentaires sur les publications de la page (champ feed).</span>
                    </span>
                </label>
                <label style="display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#111827; color:#e2e8f0; cursor:pointer;">
                    <input type="checkbox" id="fbWhMessages" style="margin-top:3px;">
                    <span>
                        <strong style="display:block;">Messages privés</strong>
                        <span class="text-muted small" style="color:#94a3b8;">Messages Messenger reçus par la page (champ messaging).</span>
                    </span>
                </label>
                <label style="display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#111827; color:#e2e8f0; cursor:pointer;">
                    <input type="checkbox" id="fbWhPosts" style="margin-top:3px;">
                    <span>
                        <strong style="display:block;">Publications</strong>
                        <span class="text-muted small" style="color:#94a3b8;">Nouveaux posts / statuts publiés sur la page (feed sans commentaire).</span>
                    </span>
                </label>
                <label style="display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#111827; color:#e2e8f0; cursor:pointer;">
                    <input type="checkbox" id="fbWhNotifications" style="margin-top:3px;">
                    <span>
                        <strong style="display:block;">Autres notifications</strong>
                        <span class="text-muted small" style="color:#94a3b8;">Mentions, réactions et autres événements feed non classés ci-dessus.</span>
                    </span>
                </label>
            </div>
            <p id="fbWebhookHint" class="text-muted small" style="margin:10px 0 0; color:#64748b;"></p>
        </div>

        <div style="margin-top:20px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;" id="fbPollZone">
            <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
                <h3 style="margin:0; font-size:15px; color:#e2e8f0;">Polling Graph — rattrapage</h3>
                <label style="display:inline-flex; align-items:center; gap:6px; color:#e2e8f0; margin:0;">
                    <input type="checkbox" id="fbModePoll"> Activer
                </label>
            </div>
            <p class="text-muted small" style="margin:0 0 12px; color:#94a3b8;">
                Chaque type a ses propres limites. La fenêtre de temps et l’intervalle sont communs.
            </p>

            <div id="fbPollBody">
                <label style="display:block; margin:0 0 4px; color:#cbd5e1;">Fenêtre de temps (commune)</label>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;" id="fbLookbackPresets">
                    <button type="button" class="btn-agent-ghost" data-fb-lookback-hours="24">24 h</button>
                    <button type="button" class="btn-agent-ghost" data-fb-lookback-hours="72">3 j</button>
                    <button type="button" class="btn-agent-ghost" data-fb-lookback-hours="168">7 j</button>
                    <button type="button" class="btn-agent-ghost" data-fb-lookback-hours="336">14 j</button>
                    <button type="button" class="btn-agent-ghost" data-fb-lookback-hours="720">30 j</button>
                    <button type="button" class="btn-agent-ghost" data-fb-lookback-hours="2160">90 j</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:8px;">
                    <div style="flex:1; min-width:120px;">
                        <label for="fbLookbackValue" style="display:block; margin:0 0 4px; color:#cbd5e1;">Durée</label>
                        <input type="number" id="fbLookbackValue" min="1" max="2160" step="1" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                    </div>
                    <div style="min-width:140px;">
                        <label for="fbLookbackUnit" style="display:block; margin:0 0 4px; color:#cbd5e1;">Unité</label>
                        <select id="fbLookbackUnit" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                            <option value="hours">Heures</option>
                            <option value="days">Jours</option>
                        </select>
                    </div>
                    <div style="min-width:140px;">
                        <label for="fbPollInterval" style="display:block; margin:0 0 4px; color:#cbd5e1;">Intervalle (min)</label>
                        <input type="number" id="fbPollInterval" min="5" max="1440" step="1" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                    </div>
                </div>
                <input type="hidden" id="fbLookback" value="168">
                <input type="hidden" id="fbLimit" value="25">
                <p id="fbLookbackHint" class="text-muted small" style="margin:0 0 16px; color:#64748b;"></p>

                <!-- Posts -->
                <div style="margin-bottom:12px; padding:12px; border:1px solid #1f2937; border-radius:8px; background:#111827;" id="fbPollPostsCard">
                    <label style="display:flex; align-items:center; gap:8px; color:#e2e8f0; margin:0 0 8px;">
                        <input type="checkbox" id="fbResPosts">
                        <strong>Posts / publications</strong>
                    </label>
                    <div id="fbPollPostsFields">
                        <label for="fbPostLimit" style="display:block; margin:0 0 4px; color:#cbd5e1;">Max posts / passage</label>
                        <input type="number" id="fbPostLimit" min="1" max="50" step="1" class="form-control" style="background:#0f172a; color:#e2e8f0; border-color:#1f2937; max-width:160px;">
                        <p class="text-muted small" style="margin:4px 0 0; color:#64748b;">Nombre de publications Graph à récupérer par tick.</p>
                    </div>
                </div>

                <!-- Commentaires -->
                <div style="margin-bottom:12px; padding:12px; border:1px solid #1f2937; border-radius:8px; background:#111827;" id="fbPollCommentsCard">
                    <label style="display:flex; align-items:center; gap:8px; color:#e2e8f0; margin:0 0 8px;">
                        <input type="checkbox" id="fbResComments">
                        <strong>Commentaires</strong>
                    </label>
                    <div id="fbPollCommentsFields" style="display:grid; gap:10px;">
                        <div style="display:flex; flex-wrap:wrap; gap:12px;">
                            <div style="flex:1; min-width:140px;">
                                <label for="fbCommentCatchup" style="display:block; margin:0 0 4px; color:#cbd5e1;">Posts à scanner</label>
                                <input type="number" id="fbCommentCatchup" min="1" max="50" step="1" class="form-control" style="background:#0f172a; color:#e2e8f0; border-color:#1f2937;">
                            </div>
                            <div style="flex:1; min-width:140px;">
                                <label for="fbCommentsPerPost" style="display:block; margin:0 0 4px; color:#cbd5e1;">Commentaires / post</label>
                                <input type="number" id="fbCommentsPerPost" min="1" max="100" step="1" class="form-control" style="background:#0f172a; color:#e2e8f0; border-color:#1f2937;">
                            </div>
                        </div>
                        <label style="display:flex; align-items:flex-start; gap:8px; color:#e2e8f0; margin:0;">
                            <input type="checkbox" id="fbCommentsFetchAll" style="margin-top:3px;">
                            <span>
                                <strong style="display:block;">Récupérer tous les commentaires du post</strong>
                                <span class="text-muted small" style="color:#94a3b8;">Pagination Graph complète par post (ignore la limite «&nbsp;commentaires / post&nbsp;»).</span>
                            </span>
                        </label>
                        <div>
                            <label for="fbCommentPostIds" style="display:block; margin:0 0 4px; color:#cbd5e1;">IDs de posts ciblés (optionnel)</label>
                            <textarea id="fbCommentPostIds" rows="2" class="form-control" placeholder="Un ID par ligne, ou séparés par virgule — sinon = posts récents scannés" style="background:#0f172a; color:#e2e8f0; border-color:#1f2937;"></textarea>
                            <p class="text-muted small" style="margin:4px 0 0; color:#64748b;">Utile pour rattraper tous les commentaires d’un ou plusieurs posts précis.</p>
                        </div>
                    </div>
                </div>

                <!-- Messages privés -->
                <div style="margin-bottom:4px; padding:12px; border:1px solid #1f2937; border-radius:8px; background:#111827;" id="fbPollMessagesCard">
                    <label style="display:flex; align-items:center; gap:8px; color:#e2e8f0; margin:0 0 8px;">
                        <input type="checkbox" id="fbResMessages">
                        <strong>Messages privés (Messenger)</strong>
                    </label>
                    <div id="fbPollMessagesFields" style="display:flex; flex-wrap:wrap; gap:12px;">
                        <div style="flex:1; min-width:140px;">
                            <label for="fbMsgConversations" style="display:block; margin:0 0 4px; color:#cbd5e1;">Conversations / passage</label>
                            <input type="number" id="fbMsgConversations" min="1" max="50" step="1" class="form-control" style="background:#0f172a; color:#e2e8f0; border-color:#1f2937;">
                        </div>
                        <div style="flex:1; min-width:140px;">
                            <label for="fbMsgPerConv" style="display:block; margin:0 0 4px; color:#cbd5e1;">Messages / conversation</label>
                            <input type="number" id="fbMsgPerConv" min="1" max="50" step="1" class="form-control" style="background:#0f172a; color:#e2e8f0; border-color:#1f2937;">
                        </div>
                    </div>
                    <p class="text-muted small" style="margin:8px 0 0; color:#64748b;">Nécessite la permission pages_messaging. Les messages envoyés par la page sont ignorés.</p>
                </div>
            </div>
        </div>

        <p class="text-muted small" style="margin-top:16px; color:#64748b;">
            Test manuel : bouton ▶ Lancer (dernier post).
            Webhook = événements unitaires (pas de quota «&nbsp;N messages&nbsp;») ; le poll gère volume + fenêtre.
            Enregistrer l’agent synchronise ces choix sur le connecteur Facebook de l’entité.
        </p>
        <button type="button" class="btn-agent" id="btnSaveFacebook" style="margin-top:12px;">Enregistrer config Facebook</button>
    </div>

    <div id="panelIntentions" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:1100px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Analyse d'intention (bloc IA)</h2>
        <p class="text-muted small" style="color:#94a3b8;">
            Classification uniquement : messages + liste d'intentions + prompt → intention détectée.
            Enregistrez l'agent une fois avant d'éditer.
        </p>

        <label style="display:block; margin:12px 0 4px; color:#cbd5e1;">Mode de liste</label>
        <select id="intentionMode" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:360px;">
            <option value="fixed">Liste fixe (ci-dessous)</option>
            <option value="by-source">Selon la source (mail / Facebook / contact)</option>
        </select>

        <div id="intentionBySourceMap" style="display:none; margin-top:12px; padding:12px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;">
            <p class="text-muted small" style="margin:0 0 8px; color:#94a3b8;">Preset utilisé selon le canal du run :</p>
            <div style="display:grid; gap:8px; max-width:420px;">
                <label style="color:#cbd5e1; display:flex; justify-content:space-between; gap:8px; align-items:center;">Mail
                    <select id="intentionMapMail" class="form-control" style="width:200px; background:#111827; color:#e2e8f0; border-color:#1f2937;">
                        <option value="mail">Mail</option>
                        <option value="reseaux-sociaux">Réseaux sociaux</option>
                        <option value="contact">Contact</option>
                    </select>
                </label>
                <label style="color:#cbd5e1; display:flex; justify-content:space-between; gap:8px; align-items:center;">Facebook
                    <select id="intentionMapFacebook" class="form-control" style="width:200px; background:#111827; color:#e2e8f0; border-color:#1f2937;">
                        <option value="reseaux-sociaux">Réseaux sociaux</option>
                        <option value="mail">Mail</option>
                        <option value="contact">Contact</option>
                    </select>
                </label>
                <label style="color:#cbd5e1; display:flex; justify-content:space-between; gap:8px; align-items:center;">Contact
                    <select id="intentionMapContact" class="form-control" style="width:200px; background:#111827; color:#e2e8f0; border-color:#1f2937;">
                        <option value="contact">Contact</option>
                        <option value="mail">Mail</option>
                        <option value="reseaux-sociaux">Réseaux sociaux</option>
                    </select>
                </label>
            </div>
        </div>

        <div class="intention-preset-bar" style="margin-top:12px; padding:12px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;">
            <label for="intentionPresetSelect" style="display:block; margin:0 0 6px; color:#cbd5e1;">Charger une liste préconstruite</label>
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                <select id="intentionPresetSelect" class="form-control" style="min-width:220px; flex:1; background:#111827; color:#e2e8f0; border-color:#1f2937;">
                    <option value="">— Choisir une liste —</option>
                    <option value="mail">Mail</option>
                    <option value="reseaux-sociaux">Réseaux sociaux</option>
                    <option value="contact">Contact / formulaire</option>
                </select>
                <button type="button" class="btn-agent-ghost" id="btnApplyIntentionPreset">Charger la liste</button>
            </div>
            <p id="intentionPresetHint" class="text-muted small" style="margin:8px 0 0; color:#64748b;">
                Remplace la liste fixe (et propose de resynchroniser le routage).
            </p>
        </div>

        <label style="display:block; margin:12px 0 4px; color:#cbd5e1;">Prompt (optionnel — utilisez {{Liste des intentions}})</label>
        <textarea id="analyseBasePrompt" rows="4" class="form-control" style="width:100%; background:#111827; color:#e2e8f0; border-color:#1f2937;"></textarea>
        <p class="text-muted small" style="margin:8px 0 0; color:#64748b;">
            Les destinataires et branches se configurent dans l’onglet <strong>Routage</strong> (pas ici).
        </p>
        <div id="intentionsList" style="margin-top:16px;"></div>
        <button type="button" class="btn-agent-ghost" id="btnAddIntention" style="margin-top:8px;">+ Intention</button>
        <button type="button" class="btn-agent" id="btnSaveIntentions" style="margin-top:8px; margin-left:8px;">Enregistrer intentions</button>
    </div>

    <div id="panelRouting" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:1100px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Règles de routage</h2>
        <p class="text-muted small" style="color:#94a3b8;">
            Un point de routage par intention de la liste (onglet Intentions).
            Si vous ajoutez / retirez / renommez une intention, les points se resynchronisent automatiquement (les cibles déjà configurées sont conservées).
        </p>
        <div id="routingRulesList" style="margin-top:16px;"></div>
        <div id="routingDefaultTarget" style="margin-top:20px; padding:14px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;"></div>
        <button type="button" class="btn-agent" id="btnSaveRouting" style="margin-top:12px;">Enregistrer routage</button>
        <div id="routingMailTemplates" style="margin-top:20px;">
            <h3 style="margin:0 0 8px; color:#cbd5e1; font-size:1rem;">Templates mail</h3>
            <p class="text-muted small" style="color:#64748b; margin:0 0 8px;">Utilisés uniquement pour les cibles Email / Service Annuaire.</p>
            <label style="display:block; margin:8px 0 4px; color:#cbd5e1;">Sujet (template)</label>
            <input type="text" id="routeSubjectTpl" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
            <label style="display:block; margin:12px 0 4px; color:#cbd5e1;">Corps (template)</label>
            <textarea id="routeBodyTpl" rows="6" class="form-control" style="width:100%; background:#111827; color:#e2e8f0; border-color:#1f2937;"></textarea>
        </div>
    </div>

</div>

<script>
window.AGENT_FLOW_EDITOR = <?= json_encode([
    'apiBase' => rtrim(getApiBaseUrl(), '/'),
    'jwt' => getJWTToken(),
    'flowId' => $flowId ?: null,
    'entrepriseId' => $currentEntrepriseId ? (string) $currentEntrepriseId : null,
    'backUrl' => $backUrl,
    'space' => $fromUserSpace ? 'user' : 'entity',
    'return' => $editorReturn ?: null,
    'reviewPageUrl' => url('pages/agent-human-review.php'),
    'docEditorBaseUrl' => url('pages/modules/document-agent-v2/editor.php'),
    'docApiBase' => rtrim(getApiBaseUrl(), '/') . '/agent-documentaire-v2',
    'defaultReviewNamespace' => 'agent:review:invoice',
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
