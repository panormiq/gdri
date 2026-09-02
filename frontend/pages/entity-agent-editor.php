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
$isGdriAdmin = hasRole(ROLE_ADMIN_GDRI);

$flowId = preg_replace('/[^a-f0-9]/i', '', (string) ($_GET['flowId'] ?? ''));
$page_title = $flowId ? 'Éditer un agent' : 'Créer un agent';

$editorSpace = strtolower(trim((string) ($_GET['space'] ?? '')));
$editorReturn = strtolower(trim((string) ($_GET['return'] ?? '')));
$fromUserSpace = ($editorSpace === 'user' || in_array($editorReturn, ['auto', 'automatic', 'assisted', 'agents'], true));
$fromGdri = ($editorSpace === 'gdri' || $editorReturn === 'gdri');
if ($fromGdri && !$isGdriAdmin) {
    redirect(url('pages/dashboard.php'));
}
if ($fromGdri) {
    $backUrl = url('pages/platform-gdri-agents.php');
    $backLabel = '← Agents GDRI';
    $defaultInteractionMode = 'auto';
} elseif ($fromUserSpace) {
    $backUrl = url('pages/user-agents.php');
    $backLabel = '← Agents';
    $defaultInteractionMode = 'auto';
} else {
    $backUrl = url('pages/entity-agents.php');
    $backLabel = '← Agents IA';
    $defaultInteractionMode = 'auto';
}

$agentCanvasCss = __DIR__ . '/../assets/css/agent-flow-canvas.css';
$agentCardsCss = __DIR__ . '/../assets/css/agent-cards.css';
$extra_styles = [
    url('assets/css/agent-flow-canvas.css') . '?v=' . (is_file($agentCanvasCss) ? filemtime($agentCanvasCss) : time()),
    url('assets/css/agent-cards.css') . '?v=' . (is_file($agentCardsCss) ? filemtime($agentCardsCss) : time()),
];
$agentCanvasJs = __DIR__ . '/../assets/js/agent-flow/agent-canvas.js';
$fieldTypesJs = __DIR__ . '/../assets/js/collection-field-types.js';
$extra_scripts = [
    url('assets/js/collection-field-types.js') . '?v=' . (is_file($fieldTypesJs) ? filemtime($fieldTypesJs) : time()),
    url('assets/js/agent-flow/agent-canvas.js') . '?v=' . (is_file($agentCanvasJs) ? filemtime($agentCanvasJs) : time())
];

require_once __DIR__ . '/../includes/header.php';
?>

<div class="agent-editor-app">
    <div class="agent-editor-toolbar">
        <div>
            <a href="<?= htmlspecialchars($backUrl) ?>" class="btn-agent-ghost" style="text-decoration:none; display:inline-block; margin-bottom:6px;"><?= htmlspecialchars($backLabel) ?></a>
            <h1><?= $flowId ? 'Éditer un agent' : 'Créer un agent' ?></h1>
            <div class="sub">Canvas · Lancer = debug sur les blocs et les liens · Action = champs · IA = prompt</div>
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
            <button type="button" class="btn-agent-ghost btn-agent-danger" id="btnClearRun" hidden title="Retirer le debug du dernier run sur le canvas">✕ Effacer le run</button>
            <button type="button" class="btn-agent" id="btnSaveAgent">💾 Enregistrer</button>
        </div>
    </div>

    <div class="agent-editor-context" style="padding:0 16px 12px; max-width:960px;">
        <label for="agentContext" style="display:block; margin:0 0 4px; color:#cbd5e1; font-size:0.9rem; font-weight:600;">Contexte général de l'agent</label>
        <textarea id="agentContext" rows="2" class="form-control"
            placeholder="Ex. Lire les données du connecteur, les faire valider, puis envoyer le résultat."
            style="background:#111827; border-color:#1f2937; color:#e2e8f0; width:100%;"></textarea>
        <p class="text-muted small" style="margin:6px 0 0; color:#64748b;">
            But global de l'agent. Le bloc Validation s’en sert pour choisir le modèle de production (facture, analyse IA, mail…).
        </p>
    </div>

    <div class="agent-editor-tabs" id="agentEditorTabs" style="display:flex; gap:8px; padding:0 16px 12px; flex-wrap:wrap;">
        <button type="button" class="btn-agent agent-tab is-active" data-tab="canvas">Canvas</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="design" id="tabDesign" style="display:none;">Design</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="app" id="tabApp">Configuration</button>
        <span id="agentChannelTabs" style="display:contents;"></span>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="facebook" id="tabFacebook" style="display:none;">Facebook</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="intentions" id="tabIntentions" style="display:none;">Intentions</button>
        <button type="button" class="btn-agent-ghost agent-tab" data-tab="routing" id="tabRouting" style="display:none;">Routage</button>
    </div>

    <div class="agent-editor-layout" id="panelCanvas">
        <aside class="agent-palette">
            <div class="agent-palette-head">
                <h3>Palette</h3>
                <p class="agent-palette-type-hint">Clic ou glisser pour ajouter. Survol pour le détail.</p>
                <button type="button" class="btn-agent-ghost" id="btnHookPalette" title="Configurer le bloc sous-agent (nom, image, hook)">Apparence du bloc</button>
            </div>
            <div id="agentPalette" class="agent-palette-list">Chargement…</div>
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

    <div id="panelDesign" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:880px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Design (hook onglet)</h2>
        <p class="text-muted small" style="color:#94a3b8; margin:0 0 16px;">
            Accroche de l’agent GDRI « Design page web ». L’agent lui-même est dans Agents IA.
        </p>
        <div id="vizDesignTabHost"></div>
    </div>

    <div id="panelApp" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:960px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Configuration</h2>
        <p class="text-muted small" style="color:#94a3b8; margin:0 0 20px;">
            Identité de l’agent : le <strong style="color:#cbd5e1;">bloc</strong> (sous-agent dans un autre flux)
            et, à part, l’<strong style="color:#cbd5e1;">App</strong> utilisateur.
        </p>

        <section id="agentBlockSection" class="agent-config-section">
            <h3 style="margin:0 0 6px; color:#e2e8f0; font-size:1.05rem;">Agent — bloc sous-agent</h3>
            <p class="text-muted small" style="margin:0 0 16px; color:#94a3b8;">
                Nom, image et hook du bloc quand cet agent est posé ailleurs.
                Le hook n’est pas un bloc sur ce canvas : c’est l’accroche (palette, onglet, modal, app) et le design du bloc.
            </p>

            <div class="agent-app-layout">
                <div class="agent-app-form">
                    <label for="appName" style="display:block; margin:0 0 4px; color:#cbd5e1; font-weight:600;">Nom du bloc</label>
                    <input type="text" id="appName" class="form-control" maxlength="80"
                        style="background:#111827; color:#e2e8f0; border-color:#1f2937;"
                        placeholder="Ex. Revue des données">

                    <label for="appDescription" style="display:block; margin:14px 0 4px; color:#cbd5e1; font-weight:600;">Description</label>
                    <textarea id="appDescription" rows="2" class="form-control" maxlength="240"
                        style="background:#111827; color:#e2e8f0; border-color:#1f2937; width:100%;"
                        placeholder="Ce que fait ce sous-agent."></textarea>

                    <label for="appImageUrl" style="display:block; margin:14px 0 4px; color:#cbd5e1; font-weight:600;">Image du bloc (URL)</label>
                    <input type="url" id="appImageUrl" class="form-control"
                        style="background:#111827; color:#e2e8f0; border-color:#1f2937;"
                        placeholder="https://…">

                    <label for="paletteIconEmoji" style="display:block; margin:14px 0 4px; color:#cbd5e1; font-weight:600;">Icône (emoji)</label>
                    <input type="text" id="paletteIconEmoji" class="form-control" maxlength="8"
                        style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:120px;"
                        placeholder="🪝" value="🪝">

                    <label for="paletteFamily" style="display:block; margin:14px 0 4px; color:#cbd5e1; font-weight:600;">Famille palette</label>
                    <select id="paletteFamily" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:280px;">
                        <option value="action">Action</option>
                        <option value="data">Entrées</option>
                        <option value="ia">IA</option>
                        <option value="output">Sortie</option>
                    </select>

                    <label for="paletteHookSurface" style="display:block; margin:14px 0 4px; color:#cbd5e1; font-weight:600;">Hook</label>
                    <select id="paletteHookSurface" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:360px;">
                        <option value="palette">Palette — bouton (nom + image)</option>
                    </select>
                    <p id="paletteHookHint" class="text-muted small" style="margin:6px 0 0; color:#64748b;">
                        Tu ne le vois pas dans ce flux : il s’applique au bloc une fois l’agent posé dans un autre canvas.
                    </p>

                    <div style="margin-top:16px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                        <button type="button" class="btn-agent" id="btnPublishPalette">Publier comme sous-agent</button>
                        <p id="palettePublishStatus" class="text-muted small" style="margin:0; color:#64748b;"></p>
                    </div>
                </div>

                <aside class="agent-app-preview-wrap">
                    <p style="margin:0 0 8px; color:#94a3b8; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.04em;">Aperçu bloc</p>
                    <div class="agent-block-preview" id="agentBlockPreview">
                        <div class="agent-node agent-node--insertable kind-action" id="agentBlockPreviewNode">
                            <div class="agent-node-head">
                                <span class="emoji" id="agentBlockPreviewEmoji">🪝</span>
                                <div class="agent-node-identity-mini">
                                    <div class="agent-node-title-row">
                                        <div class="agent-node-title" id="agentBlockPreviewName">Nouvel agent</div>
                                        <span class="agent-node-badge" id="agentBlockPreviewHook">hook · palette</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p id="agentBlockPreviewHint" class="text-muted small" style="margin:10px 0 0; color:#64748b;">
                        Entrées et sorties du bloc viennent des blocs Flux de cet agent. Ici : le design.
                    </p>
                    <div id="agentHookExportPreview" style="margin-top:14px;"></div>
                </aside>
            </div>
        </section>

        <section id="agentAppSection" class="agent-config-section" style="margin-top:32px; padding-top:24px; border-top:1px solid #1f2937;">
            <h3 style="margin:0 0 6px; color:#e2e8f0; font-size:1.05rem;">Application</h3>
            <p class="text-muted small" style="margin:0 0 16px; color:#94a3b8;">
                Play + validation = run (sablier, flux, modal), pas une App.
                Une App n’apparaît que si tu ajoutes plusieurs pages user.
            </p>

            <div class="agent-app-layout">
                <div class="agent-app-form">
                    <label for="appPublish" style="display:block; margin:0 0 4px; color:#cbd5e1; font-weight:600;">Publier dans Applications</label>
                    <select id="appPublish" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:360px;">
                        <option value="auto">Auto — seulement si plusieurs pages</option>
                        <option value="yes">Toujours (forcer une App)</option>
                        <option value="no">Jamais</option>
                    </select>
                    <p id="appPublishHint" class="text-muted small" style="margin:6px 0 0; color:#64748b;"></p>

                    <div id="appButtonRow" style="margin-top:14px;">
                        <label for="appButtonLabel" style="display:block; margin:0 0 4px; color:#cbd5e1; font-weight:600;">Libellé du bouton</label>
                        <input type="text" id="appButtonLabel" class="form-control" maxlength="40"
                            style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:280px;"
                            placeholder="Lancer">
                        <p class="text-muted small" style="margin:6px 0 0; color:#64748b;">
                            Visible quand le déclencheur est en mode bouton. Enregistré avec l’agent.
                        </p>
                    </div>
                </div>

                <aside class="agent-app-preview-wrap">
                    <p style="margin:0 0 8px; color:#94a3b8; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.04em;">Aperçu carte</p>
                    <article class="agent-card agent-app-preview" id="appPreviewCard">
                        <div class="agent-card-cover" id="appPreviewCover"></div>
                        <div class="agent-card-body">
                            <h3 id="appPreviewName">Nouvel agent</h3>
                            <p class="agent-card-desc" id="appPreviewDesc">Pas de description</p>
                            <div class="agent-card-meta" id="appPreviewMeta">Manuel · Actif</div>
                            <div class="agent-card-actions">
                                <button type="button" class="btn btn-success btn-sm" id="appPreviewBtn" disabled>Lancer</button>
                            </div>
                        </div>
                    </article>
                    <p id="appSurfaceHint" class="text-muted small" style="margin:10px 0 0; color:#64748b;"></p>
                </aside>
            </div>

            <section id="appPagesSection" style="margin-top:28px; padding-top:20px; border-top:1px solid #1f2937;">
                <h3 style="margin:0 0 6px; color:#e2e8f0; font-size:1.05rem;">Pages de l’App</h3>
                <p class="text-muted small" style="margin:0 0 14px; color:#94a3b8;">
                    Crée des pages, édite-les, et insère la vue d’un bloc (Play, validation, données, run).
                    Deux pages ou plus = une App.
                </p>
                <div id="appPagesList"></div>
                <button type="button" class="btn-agent" id="btnAppAddPage" style="margin-top:10px;">+ Page</button>
            </section>
        </section>
    </div>

    <div id="panelFacebook" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:1100px;">
        <h2 id="fbPanelTitle" style="margin:0 0 8px; color:#e2e8f0;">Facebook — écoute</h2>
        <p id="fbPanelNamespace" class="text-muted small agent-expert-only" style="color:#93c5fd; margin:0 0 8px; font-family:ui-monospace,monospace;"></p>
        <p class="text-muted small" style="color:#94a3b8;">
            Config propre à ce bloc Entrées (ce compte). Un autre bloc Facebook a son propre onglet et ses propres filtres.
        </p>

        <div style="margin:12px 0; display:flex; flex-wrap:wrap; gap:8px;">
            <button type="button" class="btn-agent-ghost" data-fb-scenario="comments">Veille commentaires</button>
            <button type="button" class="btn-agent-ghost" data-fb-scenario="messages">Messages privés</button>
            <button type="button" class="btn-agent-ghost" data-fb-scenario="posts">Nouveaux posts (poll)</button>
            <button type="button" class="btn-agent-ghost" data-fb-scenario="mix">Mix recommandé</button>
        </div>
        <input type="hidden" id="fbScenario" value="">

        <div style="margin-top:16px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;">
            <label style="display:block; margin:0 0 6px; color:#e2e8f0; font-weight:600;">Compte / page Facebook</label>
            <p id="fbPageLabel" style="margin:0; color:#e2e8f0; font-weight:500;">—</p>
            <input type="hidden" id="fbPageId" value="">
            <p id="fbPageHint" class="text-muted small" style="margin:8px 0 0; color:#64748b;">
                Choisissez la page dans le bloc Entrées (panneau de droite). Ici : ce que l’agent écoute.
            </p>
        </div>

        <div style="margin-top:20px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;" id="fbWebhookZone">
            <h3 style="margin:0 0 8px; font-size:15px; color:#e2e8f0;">Webhook — temps réel</h3>
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
            <h3 style="margin:0 0 8px; font-size:15px; color:#e2e8f0;">Appel Graph</h3>
            <p class="text-muted small" style="margin:0 0 12px; color:#94a3b8;">
                Choisissez un critère, ou les deux : par date, par nombre, ou les N plus récents dans la fenêtre.
            </p>

            <div id="fbPollBody">
                <div style="display:flex; flex-wrap:wrap; gap:16px; margin-bottom:12px;">
                    <label style="display:inline-flex; align-items:center; gap:8px; color:#e2e8f0; margin:0;">
                        <input type="checkbox" id="fbPollByDate"> Limiter par date
                    </label>
                    <label style="display:inline-flex; align-items:center; gap:8px; color:#e2e8f0; margin:0;">
                        <input type="checkbox" id="fbPollByCount"> Limiter par nombre
                    </label>
                </div>
                <p id="fbPollBoundHint" class="text-muted small" style="margin:0 0 12px; color:#64748b;"></p>

                <div id="fbPollDateFields">
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
                </div>
                <input type="hidden" id="fbLookback" value="168">
                <input type="hidden" id="fbLimit" value="25">
                <p id="fbLookbackHint" class="text-muted small" style="margin:0 0 16px; color:#64748b;"></p>
                </div>

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
            Webhook = événements unitaires. Poll = appel Graph (bouton, cron, ou rythme du connecteur).
            Un seul enregistrement : le bouton <strong>Enregistrer</strong> de l’agent applique aussi cette écoute au connecteur Facebook de <em>ce</em> compte.
        </p>
    </div>

    <div id="panelMailChannel" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:960px;">
        <h2 id="mailPanelTitle" style="margin:0 0 8px; color:#e2e8f0;">Mail — lecture</h2>
        <p id="mailPanelNamespace" class="text-muted small agent-expert-only" style="color:#93c5fd; margin:0 0 8px; font-family:ui-monospace,monospace;"></p>
        <p class="text-muted small" style="color:#94a3b8; margin:0 0 16px;">
            Filtres de cette boîte. Un second bloc Entrées mail peut lire une autre boîte ou un autre dossier.
        </p>
        <div style="margin:0 0 16px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;">
            <label style="display:block; margin:0 0 6px; color:#e2e8f0; font-weight:600;">Boîte</label>
            <p id="mailPanelAccount" style="margin:0; color:#e2e8f0;">—</p>
        </div>
        <div id="mailPanelKinds"></div>
        <div class="form-group" style="margin-top:16px;">
            <label for="mailPanelMailbox">Dossier IMAP (optionnel)</label>
            <input type="text" id="mailPanelMailbox" class="form-control" placeholder="INBOX"
                style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:280px;">
            <p class="text-muted small" style="margin:6px 0 0; color:#64748b;">Vide = dossier du connecteur. Chaque bloc peut viser un dossier différent.</p>
        </div>

        <div style="margin-top:20px; padding:14px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;" id="mailSearchZone">
            <h3 style="margin:0 0 8px; font-size:15px; color:#e2e8f0;">Recherche IMAP</h3>
            <p class="text-muted small" style="margin:0 0 12px; color:#94a3b8;">
                Le serveur mail filtre <em>avant</em> de renvoyer les messages (expéditeur, sujet, date, non lus).
                On ne télécharge pas toute la boîte.
            </p>

            <label style="display:flex; align-items:flex-start; gap:8px; color:#e2e8f0; margin:0 0 14px;">
                <input type="checkbox" id="mailUnseenOnly" style="margin-top:3px;">
                <span>
                    <strong style="display:block;">Uniquement non lus</strong>
                    <span class="text-muted small" style="color:#94a3b8;">Pour le poll automatique seulement. Un lancement manuel avec un max (ex. 3) lit les N plus récents, même déjà lus.</span>
                </span>
            </label>

            <div style="display:grid; gap:12px; margin-bottom:14px;">
                <div>
                    <label for="mailFromContains" style="display:block; margin:0 0 4px; color:#cbd5e1;">Expéditeur (contient)</label>
                    <input type="text" id="mailFromContains" class="form-control" placeholder="ex. facturation@, games workshop"
                        style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                </div>
                <div>
                    <label for="mailSubjectContains" style="display:block; margin:0 0 4px; color:#cbd5e1;">Sujet (contient)</label>
                    <input type="text" id="mailSubjectContains" class="form-control" placeholder="ex. facture, invoice"
                        style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:16px; margin-bottom:12px;">
                <label style="display:inline-flex; align-items:center; gap:8px; color:#e2e8f0; margin:0;">
                    <input type="checkbox" id="mailPollByDate"> Limiter par date
                </label>
                <label style="display:inline-flex; align-items:center; gap:8px; color:#e2e8f0; margin:0;">
                    <input type="checkbox" id="mailPollByCount"> Limiter par nombre
                </label>
            </div>
            <p id="mailPollBoundHint" class="text-muted small" style="margin:0 0 12px; color:#64748b;"></p>

            <div id="mailPollDateFields">
                <label style="display:block; margin:0 0 4px; color:#cbd5e1;">Fenêtre de temps</label>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;" id="mailLookbackPresets">
                    <button type="button" class="btn-agent-ghost" data-mail-lookback-hours="24">24 h</button>
                    <button type="button" class="btn-agent-ghost" data-mail-lookback-hours="72">3 j</button>
                    <button type="button" class="btn-agent-ghost" data-mail-lookback-hours="168">7 j</button>
                    <button type="button" class="btn-agent-ghost" data-mail-lookback-hours="336">14 j</button>
                    <button type="button" class="btn-agent-ghost" data-mail-lookback-hours="720">30 j</button>
                    <button type="button" class="btn-agent-ghost" data-mail-lookback-hours="2160">90 j</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:8px;">
                    <div style="flex:1; min-width:120px;">
                        <label for="mailLookbackValue" style="display:block; margin:0 0 4px; color:#cbd5e1;">Durée</label>
                        <input type="number" id="mailLookbackValue" min="1" max="2160" step="1" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                    </div>
                    <div style="min-width:140px;">
                        <label for="mailLookbackUnit" style="display:block; margin:0 0 4px; color:#cbd5e1;">Unité</label>
                        <select id="mailLookbackUnit" class="form-control" style="background:#111827; color:#e2e8f0; border-color:#1f2937;">
                            <option value="hours">Heures</option>
                            <option value="days">Jours</option>
                        </select>
                    </div>
                </div>
                <input type="hidden" id="mailLookback" value="168">
                <p id="mailLookbackHint" class="text-muted small" style="margin:0 0 16px; color:#64748b;"></p>
            </div>

            <div id="mailPollCountFields">
                <label for="mailPollLimit" style="display:block; margin:0 0 4px; color:#cbd5e1;">Max messages / passage</label>
                <input type="number" id="mailPollLimit" min="1" max="100" step="1" class="form-control"
                    style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:160px;">
                    <p class="text-muted small" style="margin:4px 0 0; color:#64748b;">Les N plus récents de la boîte, déjà lus inclus. La date et « non lus » ne s’appliquent pas à ce plafond.</p>
            </div>
        </div>
        <p class="text-muted small" style="margin-top:16px; color:#64748b;">
            Enregistrer l’agent recopie ces filtres sur le connecteur mail-in de <em>ce</em> compte (poll planifié).
            Lancer sans message en contexte relance la même SEARCH.
        </p>
    </div>

    <div id="panelIntentions" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:1100px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Liste d’intentions (legacy)</h2>
        <p class="text-muted small" style="color:#94a3b8;">
            Conservé pour les anciens agents. Les nouvelles listes se choisissent dans le bloc <strong>Entrées</strong> (collection / liste préconstruite).
            L’IA exécute un prompt : elle ne crée plus de détection d’intention toute seule.
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
    </div>

    <div id="panelRouting" class="agent-brick-config-panel" style="display:none; padding:16px; max-width:1100px;">
        <h2 style="margin:0 0 8px; color:#e2e8f0;">Règles de routage</h2>
        <p class="text-muted small" style="color:#94a3b8;">
            Un point de routage par intention de la liste (onglet Intentions).
            Si vous ajoutez / retirez / renommez une intention, les points se resynchronisent automatiquement (les cibles déjà configurées sont conservées).
        </p>
        <div id="routingRulesList" style="margin-top:16px;"></div>
        <div id="routingDefaultTarget" style="margin-top:20px; padding:14px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;"></div>
        <p class="text-muted small" style="margin-top:12px; color:#64748b;">Enregistré avec le bouton <strong>Enregistrer</strong> de l’agent.</p>
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
    'isGdriAdmin' => (bool) $isGdriAdmin,
    'backUrl' => $backUrl,
    'space' => $fromGdri ? 'gdri' : ($fromUserSpace ? 'user' : 'entity'),
    'return' => $editorReturn ?: null,
    'reviewPageUrl' => url('pages/agent-human-review.php'),
    'runPageUrl' => url('pages/agent-run.php'),
    'docEditorBaseUrl' => url('pages/modules/document-agent-v2/editor.php'),
    'docApiBase' => rtrim(getApiBaseUrl(), '/') . '/agent-documentaire-v2',
    'docModelsApiBase' => rtrim(getApiBaseUrl(), '/') . '/agent-documentaire',
    'docTemplateApiBase' => rtrim(getApiBaseUrl(), '/') . '/doc-template',
    'docTemplateUrl' => url('pages/modules/doc-template-v3'),
    'docCollectionsUrl' => url('pages/modules/doc-template-v3/collections'),
    'docFillUrl' => url('pages/modules/doc-template-v3/collections'),
    'defaultReviewNamespace' => 'agent:review:invoice',
], JSON_UNESCAPED_SLASHES) ?>;
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
