<?php
/**
 * Résumé Facebook - Par page, avec filtres de temps
 * Affiche likes, commentaires, dernière interaction par onglet. Option pull de rattrapage si webhooks manqués.
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';
require_once '../../includes/entity-console-nav.php';

function hasFacebookServiceAccessViaApi()
{
    if (hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY)) {
        return true;
    }
    if (!hasRole(ROLE_USER_ENTITY)) {
        return false;
    }
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$token || !$apiBase) {
        return false;
    }
    $ch = curl_init($apiBase . '/users/me/services-context');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        return false;
    }
    $decoded = json_decode((string) $raw, true);
    $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
    foreach ($services as $service) {
        $slug = strtolower(trim((string) ($service['slug'] ?? '')));
        $name = strtolower(trim((string) ($service['name'] ?? '')));
        if ($slug === 'facebook' || strpos($name, 'facebook') !== false) {
            return true;
        }
    }
    return false;
}

if (!isLoggedIn()) {
    redirect(url('pages/dashboard.php'));
}

$hasAccess = hasFacebookServiceAccessViaApi();

if (!isLoggedIn() || !$hasAccess) {
    redirect(url('pages/dashboard.php'));
}

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

$page_title = 'Résumé Facebook';
require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Résumé Facebook',
    'Vue d\'ensemble par page : likes, commentaires et dernière interaction.',
    ['narrow' => true]
);
?>

    <div id="resume-loading" class="alert alert-info">Chargement des pages…</div>
    <div id="resume-empty" class="alert alert-warning" style="display: none;">
        Aucune page connectée. <a href="<?= htmlspecialchars(url('pages/modules/facebook.php') . '?tab=config') ?>">Connecter Facebook</a>.
    </div>

    <div id="resume-tabs" class="resume-tabs" style="display: none;">
        <ul class="nav nav-tabs" id="page-tabs" role="tablist"></ul>
        <div class="tab-content" id="page-tab-content"></div>
    </div>

<style>
.resume-tabs .nav-tabs { border-bottom: 1px solid #dee2e6; margin-bottom: 1rem; }
.resume-tabs .nav-tabs .nav-link { border: 1px solid transparent; border-radius: 4px 4px 0 0; padding: 0.5rem 1rem; color: #495057; cursor: pointer; }
.resume-tabs .nav-tabs .nav-link:hover { border-color: #e9ecef; }
.resume-tabs .nav-tabs .nav-link.active { color: #0d6efd; background: #fff; border-color: #dee2e6 #dee2e6 #fff; }
.resume-page-card { background: #f8f9fa; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
.resume-page-card h3 { margin: 0 0 0.75rem 0; font-size: 1.1rem; }
.resume-stats { display: flex; flex-wrap: wrap; gap: 1.5rem; font-size: 0.95rem; color: #495057; }
.resume-stats span { white-space: nowrap; }
.resume-stats strong { color: #212529; }
.resume-toolbar-per-page { margin-bottom: 1rem; }
.resume-stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.resume-stat-box { background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.9rem; }
.resume-stat-box .value { font-weight: 700; font-size: 1.1rem; color: #212529; }
.resume-stat-box .label { color: #6c757d; font-size: 0.8rem; margin-top: 0.15rem; }
.resume-evolution { font-size: 0.8rem; margin-top: 0.2rem; }
.resume-evolution.up { color: #198754; }
.resume-evolution.down { color: #dc3545; }
.resume-evolution.same { color: #6c757d; }
.resume-section-title { font-size: 0.85rem; font-weight: 600; color: #495057; margin: 1rem 0 0.5rem 0; }
.messages-by-urgency { margin-top: 1.5rem; border-top: 1px solid #dee2e6; padding-top: 1rem; }
.messages-load-trigger { margin-bottom: 0.75rem; }
.messages-by-urgency .sub-tabs { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.75rem; }
.messages-by-urgency .sub-tabs .sub-tab { padding: 0.35rem 0.75rem; border-radius: 4px; border: 1px solid #dee2e6; background: #fff; cursor: pointer; font-size: 0.9rem; }
.messages-by-urgency .sub-tabs .sub-tab:hover { background: #f1f3f5; }
.messages-by-urgency .sub-tabs .sub-tab.active { background: #0d6efd; color: #fff; border-color: #0d6efd; }
.messages-by-urgency .intention-filter { margin-bottom: 0.75rem; }
.msg-card { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
.msg-card .msg-meta { font-size: 0.85rem; color: #6c757d; margin-bottom: 0.5rem; }
.msg-card .msg-intentions { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
.msg-card .msg-intentions span { padding: 0.2rem 0.5rem; border-radius: 4px; background: #e9ecef; font-size: 0.8rem; }
.msg-card .msg-analysis { margin-bottom: 0.75rem; }
.msg-card .msg-analysis-block-title { font-size: 0.82rem; font-weight: 700; color: #495057; margin: 0 0 0.35rem 0; text-transform: uppercase; letter-spacing: 0.2px; }
.msg-card .msg-analysis-item { border-left: 3px solid #dee2e6; background: #f8f9fa; border-radius: 4px; padding: 0.55rem 0.7rem; margin-bottom: 0.5rem; }
.msg-card .msg-analysis-item.urgent { border-left-color: #dc3545; background: #fff5f5; }
.msg-card .msg-analysis-main { font-size: 0.88rem; color: #212529; font-weight: 600; margin-bottom: 0.2rem; }
.msg-card .msg-analysis-meta { font-size: 0.81rem; color: #495057; margin-bottom: 0.2rem; }
.msg-card .msg-analysis-main .tag { display: inline-block; margin-left: 0.45rem; font-size: 0.75rem; padding: 0.1rem 0.35rem; border-radius: 999px; background: #ffe3e3; color: #b02a37; font-weight: 600; vertical-align: middle; }
.msg-card .msg-analysis-reason { margin-top: 0.25rem; font-size: 0.8rem; color: #495057; white-space: pre-wrap; }
.msg-card .msg-analysis-fallback { font-size: 0.82rem; color: #6c757d; font-style: italic; margin-bottom: 0.5rem; }
.msg-card .msg-analysis-full { margin-top: 0.35rem; }
.msg-card .msg-analysis-full summary { cursor: pointer; font-size: 0.82rem; color: #0d6efd; font-weight: 600; }
.msg-card .msg-analysis-full pre { margin: 0.45rem 0 0 0; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 0.65rem; font-size: 0.78rem; line-height: 1.35; color: #212529; white-space: pre-wrap; word-break: break-word; }
.msg-card .msg-reply-row { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.msg-card .msg-reply-toolbar { margin-bottom: 0.25rem; }
.msg-card .msg-reply-alt { margin: 0.25rem 0 0 0; font-size: 0.85rem; }
.msg-card .msg-reply-alt .btn-link { padding: 0; font-size: 0.85rem; }
.msg-card .msg-reply-row > label { font-size: 0.85rem; font-weight: 600; }
.msg-card .msg-reply-row textarea { min-width: 100%; min-height: 60px; padding: 0.5rem; border-radius: 4px; border: 1px solid #dee2e6; font-size: 0.9rem; }
.msg-card .msg-reply-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.msg-card .msg-reply-actions .btn { white-space: nowrap; }
.msg-card .msg-feedback { margin-top: 0.9rem; border-top: 1px dashed #dee2e6; padding-top: 0.8rem; }
.msg-card .msg-feedback-form { margin-top: 0.6rem; display: none; gap: 0.5rem; flex-direction: column; }
.msg-card .msg-feedback-form.active { display: flex; }
.msg-card .msg-feedback-form select,
.msg-card .msg-feedback-form textarea { border: 1px solid #dee2e6; border-radius: 4px; padding: 0.45rem 0.5rem; font-size: 0.88rem; }
.msg-card .msg-feedback-form textarea { min-height: 70px; }
.msg-card .msg-feedback-status { font-size: 0.82rem; color: #495057; }
.msg-card .msg-feedback-status.running { color: #0d6efd; }
.msg-card .msg-feedback-status.success { color: #198754; }
.msg-card .msg-feedback-status.error { color: #dc3545; }
.msg-card .msg-feedback-context { margin-top: 0.7rem; display: none; gap: 0.5rem; flex-direction: column; }
.msg-card .msg-feedback-context.active { display: flex; }
.msg-card .msg-feedback-context textarea { min-height: 120px; border: 1px solid #dee2e6; border-radius: 4px; padding: 0.45rem 0.5rem; font-size: 0.88rem; }
.msg-card .msg-badge-replied { font-size: 0.8rem; color: #198754; background: #d1e7dd; padding: 0.25rem 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; display: inline-block; }
.msg-card .msg-replied-content { margin-top: 0.5rem; padding: 0.5rem 0.75rem; background: #e7f5ff; border-left: 3px solid #0d6efd; border-radius: 4px; }
.msg-card .msg-replied-content .msg-replied-text { margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #212529; white-space: pre-wrap; word-break: break-word; }
.msg-card .msg-replied-content.msg-replied-no-text { font-style: italic; color: #6c757d; }
.messages-list-empty { color: #6c757d; font-style: italic; padding: 1rem; }
.catchup-actions { margin-bottom: 0.9rem; }
.catchup-row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.45rem; }
.catchup-row input[type="datetime-local"] { max-width: 240px; }
.catchup-progress { margin-top: 0.6rem; padding: 0.65rem 0.75rem; background: #fff; border: 1px solid #dee2e6; border-radius: 6px; font-size: 0.88rem; color: #495057; }
.catchup-progress .line { margin: 0.2rem 0; }
.catchup-progress .done { color: #198754; }
.catchup-progress .running { color: #0d6efd; }
.catchup-progress .error { color: #dc3545; }
.hourglass {
    display: inline-block;
    margin-right: 0.25rem;
}
.catchup-progress .running .hourglass {
    animation: hourglass-spin 1.1s linear infinite;
}
.mini-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid #cbd5e1;
    border-top-color: #0d6efd;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: -2px;
    animation: mini-spin 0.8s linear infinite;
}
@keyframes mini-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
@keyframes hourglass-spin {
    0% { transform: rotate(0deg); }
    50% { transform: rotate(180deg); }
    100% { transform: rotate(360deg); }
}
</style>

<script>
(function() {
    var API_BASE = <?= json_encode($api_base_url) ?>;
    var JWT = <?= json_encode($jwt_token) ?>;
    var publishUrl = <?= json_encode(url('pages/modules/facebook-publish.php')) ?>;

    var STATUS_OPTIONS = [
        { value: 'all', label: 'Tous les messages' },
        { value: 'a_repondre', label: 'À répondre' },
        { value: 'a_ne_pas_repondre', label: 'À ne pas répondre' },
        { value: 'repondu', label: 'Répondu' }
    ];
    var INTENTION_OPTIONS = [
        { value: '', label: 'Tous les services' },
        { value: 'SAV', label: 'SAV' },
        { value: 'Commercial', label: 'Commercial' },
        { value: 'Technique', label: 'Technique' },
        { value: 'Critique', label: 'Critique' },
        { value: 'Positif', label: 'Positif' },
        { value: 'Général', label: 'Général' }
    ];

    function sinceDate(days) {
        var d = new Date();
        d.setDate(d.getDate() - parseInt(days, 10));
        return d.toISOString().slice(0, 10);
    }

    function formatDate(iso) {
        if (!iso) return '–';
        var d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function evolutionClass(val) {
        if (val == null || val === undefined) return 'same';
        return val > 0 ? 'up' : (val < 0 ? 'down' : 'same');
    }
    function evolutionLabel(val) {
        if (val == null || val === undefined) return '';
        if (val > 0) return ' +' + val + '% vs période précédente';
        if (val < 0) return ' ' + val + '% vs période précédente';
        return ' = vs période précédente';
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildCardHtml(p, pageId) {
        if (!p) return '<div class="resume-page-card"><p class="text-muted">Aucune donnée.</p></div>';
        var fmt = function(n) { return n != null && n !== undefined ? Number(n).toLocaleString('fr-FR') : '–'; };
        var last = formatDate(p.lastInteractionAt);
        var evo = (p && p.evolution) ? p.evolution : {};
        var stats = [];
        stats.push({ label: 'Abonnés (likes page)', value: fmt(p.fan_count), evo: null });
        stats.push({ label: 'Posts publiés', value: fmt(p.postsCount), evo: evo.postsPercent });
        stats.push({ label: 'Commentaires', value: fmt(p.commentsCount), evo: evo.commentsPercent });
        stats.push({ label: 'Réactions (j\'aime, etc.)', value: fmt(p.reactionsCount), evo: evo.reactionsPercent });
        stats.push({ label: 'Total interactions', value: fmt(p.totalInteractions), evo: evo.interactionsPercent });
        stats.push({ label: 'Moy. commentaires / post', value: p.avgCommentsPerPost != null ? p.avgCommentsPerPost : '–', evo: null });
        stats.push({ label: 'Moy. réactions / post', value: p.avgReactionsPerPost != null ? p.avgReactionsPerPost : '–', evo: null });
        stats.push({ label: 'Dernière interaction', value: last || '–', evo: null });

        var statsHtml = '<div class="resume-stats-grid">';
        stats.forEach(function(s) {
            var evoHtml = s.evo != null ? '<div class="resume-evolution ' + evolutionClass(s.evo) + '">' + evolutionLabel(s.evo) + '</div>' : '';
            statsHtml += '<div class="resume-stat-box"><div class="value">' + s.value + '</div><div class="label">' + s.label + '</div>' + evoHtml + '</div>';
        });
        statsHtml += '</div>';

        var topHtml = '';
        if (p.topPosts && p.topPosts.length > 0) {
            topHtml = '<div class="resume-section-title">Posts les plus interactifs</div>' +
                '<ul style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem;">';
            p.topPosts.forEach(function(post) {
                var msg = (post.message || '(sans texte)').replace(/</g, '&lt;').slice(0, 120);
                if ((post.message || '').length > 120) msg += '…';
                var total = (post.comments_count || 0) + (post.reactions_count || 0);
                topHtml += '<li><strong>' + total + ' interaction(s)</strong> (' + (post.comments_count || 0) + ' com., ' + (post.reactions_count || 0) + ' réac.) — ' + msg + '</li>';
            });
            topHtml += '</ul>' +
                '<p style="margin: 0.75rem 0 0 0; font-size: 0.85rem; color: #666;">' +
                'Des questions similaires reviennent souvent ? <a href="' + publishUrl + '">Ouvrir les posts de Page</a> pour publier depuis GDRI.' +
                '</p>';
        }
        var actionsHtml = '<div class="catchup-actions">' +
            '<div class="catchup-row">' +
                '<label for="catchup-since-' + escapeHtml(pageId || p.pageId || '') + '" style="margin:0;">Depuis :</label>' +
                '<input type="datetime-local" class="form-control form-control-sm catchup-since-input" id="catchup-since-' + escapeHtml(pageId || p.pageId || '') + '" />' +
                '<button type="button" class="btn btn-primary btn-sm btn-run-catchup" data-page-id="' + escapeHtml(pageId || p.pageId || '') + '">Lancer le rattrapage</button>' +
            '</div>' +
            '<div class="catchup-progress" style="display:none;"></div>' +
        '</div>';
        return '<div class="resume-page-card">' +
            '<h3>' + (p.pageName || ('Page ' + p.pageId)) + '</h3>' +
            actionsHtml +
            statsHtml + topHtml + '</div>';
    }

    function loadPageSummary(pageId, sinceDays, cardContainer) {
        cardContainer.innerHTML = '<p class="text-muted"><span class="mini-spinner"></span>Chargement du résumé…</p>';
        var since = sinceDays ? sinceDate(sinceDays) : '';
        var url = API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/summary';
        var params = [];
        if (since) params.push('since=' + encodeURIComponent(since));
        if (sinceDays) params.push('periodDays=' + encodeURIComponent(sinceDays));
        if (params.length) url += '?' + params.join('&');
        fetch(url, { headers: { 'Authorization': 'Bearer ' + JWT } })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && data.page) {
                    cardContainer.innerHTML = buildCardHtml(data.page, pageId);
                } else {
                    cardContainer.innerHTML = '<p class="text-muted">Impossible de charger le résumé.</p>';
                }
            })
            .catch(function() {
                cardContainer.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
            });
    }

    function renderCatchupProgress(box, lines, stateClass) {
        if (!box) return;
        box.style.display = 'block';
        box.innerHTML = lines.map(function(line) {
            var renderedLine = String(line || '');
            if ((stateClass || '') === 'running' && renderedLine.indexOf('⏳') !== -1) {
                renderedLine = renderedLine.replace(/⏳/g, '<span class="hourglass">⏳</span>');
            }
            return '<div class="line ' + (stateClass || '') + '">' + renderedLine + '</div>';
        }).join('');
    }

    function runCatchup(pageId, cardContainer, messagesListEl, statusState, intentionState, urgentGetter) {
        var btn = cardContainer.querySelector('.btn-run-catchup');
        var box = cardContainer.querySelector('.catchup-progress');
        var sinceInput = cardContainer.querySelector('.catchup-since-input');
        if (!btn || !pageId) return;

        btn.disabled = true;
        btn.textContent = 'Rattrapage en cours…';
        var startedAt = new Date();

        var payload = {};
        if (sinceInput && sinceInput.value) {
            var local = new Date(sinceInput.value);
            if (Number.isNaN(local.getTime())) {
                renderCatchupProgress(box, ['❌ Date invalide dans "Depuis".'], 'error');
                btn.disabled = false;
                btn.textContent = 'Lancer le rattrapage';
                return;
            }
            payload.sinceDate = local.toISOString();
        }

        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/catchup/start', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(r) { return r.json(); })
        .then(function(startData) {
            if (!startData || !startData.success || !startData.jobId) {
                throw new Error((startData && startData.message) ? startData.message : 'Impossible de démarrer le rattrapage');
            }
            var jobId = startData.jobId;
            var pollMs = 1200;
            var poller = setInterval(function() {
                fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/catchup/status/' + encodeURIComponent(jobId), {
                    headers: { 'Authorization': 'Bearer ' + JWT }
                })
                    .then(function(r) { return r.json(); })
                    .then(function(statusData) {
                        if (!statusData || !statusData.success || !statusData.job) {
                            return;
                        }
                        var job = statusData.job;
                        var elapsedSec = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
                        var selectedSinceLabel = job.requestedSinceDate ? formatDate(job.requestedSinceDate) : null;
                        var sinceLabel = job.sinceDateUsed ? formatDate(job.sinceDateUsed) : 'début par défaut';
                        var recovered = Number(job.recoveredCount || 0);
                        var posts = Number(job.postsCount || 0);
                        var comments = Number(job.commentsCount || 0);
                        var messages = Number(job.messagesCount || 0);
                        var aiProcessed = Number(job.aiProcessed || 0);
                        var aiTotal = Number(job.aiTotal || 0);

                        var lines = [];
                        if (selectedSinceLabel) lines.push('ℹ️ Date choisie : ' + selectedSinceLabel + '.');
                        lines.push('ℹ️ Recherche des messages depuis : ' + sinceLabel + '.');
                        lines.push('⏳ Récupération Facebook : ' + posts + ' post(s) scanné(s).');
                        lines.push('⏳ Messages ciblés : ' + (messages + comments) + ' (posts: ' + messages + ', commentaires: ' + comments + ').');
                        lines.push('⏳ Traitement IA : ' + aiProcessed + '/' + aiTotal + '.');
                        lines.push('ℹ️ Temps écoulé : ' + elapsedSec + 's.');

                        if (job.status === 'running') {
                            renderCatchupProgress(box, lines, 'running');
                            return;
                        }

                        clearInterval(poller);
                        btn.disabled = false;
                        btn.textContent = 'Lancer le rattrapage';

                        if (job.status === 'failed') {
                            lines.push('❌ Rattrapage échoué : ' + escapeHtml(job.error || 'erreur inconnue'));
                            renderCatchupProgress(box, lines, 'error');
                            return;
                        }

                        lines[2] = '✅ Récupération Facebook : ' + posts + ' post(s) scanné(s).';
                        lines[3] = '✅ Messages ciblés : ' + (messages + comments) + ' (posts: ' + messages + ', commentaires: ' + comments + ').';
                        lines[4] = '✅ Traitement IA : ' + aiProcessed + '/' + aiTotal + '.';
                        lines.push('✅ Rattrapage terminé.');
                        lines.push('✅ Total récupéré : ' + recovered + '.');

                        var diagnostics = job.diagnostics || null;
                        if (diagnostics && Number(diagnostics.postsWithCommentSignals || 0) > 0) {
                            var unavailable = Number(diagnostics.postsWhereCommentsUnavailable || 0);
                            var signaled = Number(diagnostics.postsWithCommentSignals || 0);
                            if (unavailable > 0) {
                                lines.push('⚠️ Diagnostic : ' + unavailable + '/' + signaled + ' post(s) signalent des commentaires non lisibles via API.');
                            }
                        }

                        renderCatchupProgress(box, lines, 'done');
                        if (messagesListEl && statusState && intentionState && urgentGetter) {
                            loadAnalyzedMessages(pageId, statusState.value, intentionState.value, messagesListEl, urgentGetter());
                        }
                    })
                    .catch(function() {
                        // Keep polling on transient errors.
                    });
            }, pollMs);
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Lancer le rattrapage';
            renderCatchupProgress(box, [
                '❌ Rattrapage échoué : ' + escapeHtml(err.message || 'erreur inconnue')
            ], 'error');
        });
    }

    function markMessageRepliedAndRefresh(card, listEl, pageId, replyText) {
        var messageId = card.getAttribute('data-message-id');
        if (!messageId) return;
        var section = card.closest('.messages-by-urgency');
        var status = section ? (section.querySelector('.sub-tab.active') && section.querySelector('.sub-tab.active').getAttribute('data-status')) : 'a_repondre';
        var intention = section && section.querySelector('.intention-filter select') ? section.querySelector('.intention-filter select').value : '';
        var urgentOnly = section && section.querySelector('.urgent-only-cb') ? section.querySelector('.urgent-only-cb').checked : false;
        var body = {};
        if (replyText) body.message = replyText;
        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed/' + encodeURIComponent(messageId) + '/replied', {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
            body: Object.keys(body).length ? JSON.stringify(body) : undefined
        }).then(function(r) { return r.json(); }).then(function(res) {
            if (res && res.success) loadAnalyzedMessages(pageId, status || 'a_repondre', intention, listEl, urgentOnly);
        }).catch(function() {});
    }

    function loadAnalyzedMessages(pageId, status, intention, listEl, urgentOnly, focusMessageId) {
        listEl.innerHTML = '<p class="text-muted">Chargement des messages…</p>';
        var url = API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed?status=' + encodeURIComponent(status || 'a_repondre');
        if (intention) url += '&intention=' + encodeURIComponent(intention);
        if (urgentOnly) url += '&urgent_only=1';
        if (focusMessageId) url += '&messageId=' + encodeURIComponent(focusMessageId);
        fetch(url, { headers: { 'Authorization': 'Bearer ' + JWT } })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success || !data.messages || !data.messages.length) {
                    listEl.innerHTML = '<p class="messages-list-empty">Aucun message pour ce filtre.</p>';
                    return;
                }
                var html = '';
                data.messages.forEach(function(m) {
                    html += buildMessageCardHtml(m, pageId);
                });
                listEl.innerHTML = html;
                listEl.querySelectorAll('.btn-prepare-reply').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        var msgBody = card.querySelector('.msg-body');
                        var msgText = msgBody ? msgBody.textContent.replace(/\s+/g, ' ').trim() : '';
                        var intentions = [];
                        card.querySelectorAll('.msg-intentions span').forEach(function(s) { intentions.push(s.textContent.trim()); });
                        var mainTa = card.querySelector('.msg-reply-text');
                        btn.disabled = true;
                        btn.textContent = 'Préparation…';
                        fetch(API_BASE + '/facebook/suggest-reply', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: msgText, intentions: intentions })
                        }).then(function(r) { return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = 'Préparer une réponse avec l\'IA';
                            if (!mainTa) return;
                            if (res.success && res.suggestions && res.suggestions.length) {
                                mainTa.value = res.suggestions[0] || '';
                                var existingAlt = card.querySelector('.msg-reply-alt');
                                if (existingAlt) existingAlt.remove();
                                if (res.suggestions[1]) {
                                    var alt = document.createElement('p');
                                    alt.className = 'msg-reply-alt';
                                    alt.innerHTML = '<button type="button" class="btn btn-link btn-sm btn-use-alt-reply">Utiliser la 2e suggestion</button>';
                                    mainTa.parentNode.insertBefore(alt, mainTa.nextSibling);
                                    alt.querySelector('.btn-use-alt-reply').addEventListener('click', function() {
                                        mainTa.value = res.suggestions[1];
                                        alt.remove();
                                    });
                                }
                            } else {
                                mainTa.placeholder = 'Aucune suggestion. Saisissez votre réponse.';
                            }
                        }).catch(function() {
                            btn.disabled = false;
                            btn.textContent = 'Préparer une réponse avec l\'IA';
                            if (mainTa) mainTa.placeholder = 'Erreur de chargement. Saisissez votre réponse.';
                        });
                    });
                });
                listEl.querySelectorAll('.btn-reply-comment').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        var pageId = card.getAttribute('data-page-id');
                        var postId = card.getAttribute('data-post-id');
                        var commentId = (card.getAttribute('data-comment-id') || '').trim();
                        var textarea = card.querySelector('.msg-reply-text');
                        var replyText = textarea ? textarea.value.trim() : '';
                        if (!replyText) { alert('Saisissez une réponse à envoyer.'); return; }
                        var url;
                        if (commentId && commentId !== 'undefined') {
                            url = API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/comments/' + encodeURIComponent(commentId) + '/replies';
                        } else if (postId) {
                            url = API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/posts/' + encodeURIComponent(postId) + '/comments';
                        } else {
                            alert('Impossible de répondre (post ou commentaire introuvable).'); return;
                        }
                        btn.disabled = true;
                        btn.textContent = 'Envoi…';
                        fetch(url, {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: replyText })
                        }).then(function(r) { return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = 'Répondre en commentaire';
                            if (res.success) {
                                if (textarea) textarea.value = '';
                                markMessageRepliedAndRefresh(card, listEl, pageId, replyText);
                                alert(commentId ? 'Réponse au commentaire publiée.' : 'Commentaire publié.');
                            } else { alert(res.message || 'Erreur.'); }
                        }).catch(function() { btn.disabled = false; btn.textContent = 'Répondre en commentaire'; alert('Erreur réseau.'); });
                    });
                });
                listEl.querySelectorAll('.btn-reply-mp').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        var pageId = card.getAttribute('data-page-id');
                        var recipientId = card.getAttribute('data-recipient-id');
                        var textarea = card.querySelector('.msg-reply-text');
                        var replyText = textarea ? textarea.value.trim() : '';
                        if (!recipientId) { alert('Destinataire inconnu.'); return; }
                        if (!replyText) { alert('Saisissez une réponse.'); return; }
                        btn.disabled = true;
                        btn.textContent = 'Envoi…';
                        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/reply', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipientId: recipientId, message: replyText })
                        }).then(function(r) { return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = 'Répondre en MP';
                            if (res.success) {
                                if (textarea) textarea.value = '';
                                markMessageRepliedAndRefresh(card, listEl, pageId, replyText);
                                alert('Message envoyé.');
                            } else { alert(res.message || 'Erreur.'); }
                        }).catch(function() { btn.disabled = false; btn.textContent = 'Répondre en MP'; alert('Erreur réseau.'); });
                    });
                });
                listEl.querySelectorAll('.btn-send-email').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        var pageId = card.getAttribute('data-page-id');
                        var messageId = card.getAttribute('data-message-id');
                        if (!pageId || !messageId) { alert('Message introuvable.'); return; }
                        btn.disabled = true;
                        var previousLabel = btn.textContent;
                        btn.textContent = 'Envoi…';
                        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed/' + encodeURIComponent(messageId) + '/email', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                        }).then(function(r) { return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = previousLabel;
                            if (res && res.success) {
                                alert('Message envoyé par mail.');
                            } else {
                                alert((res && res.message) ? res.message : 'Erreur lors de l\'envoi par mail.');
                            }
                        }).catch(function() {
                            btn.disabled = false;
                            btn.textContent = previousLabel;
                            alert('Erreur réseau.');
                        });
                    });
                });
                listEl.querySelectorAll('.btn-rerun-analysis').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        var pageId = card.getAttribute('data-page-id');
                        var messageId = card.getAttribute('data-message-id');
                        if (!pageId || !messageId) { alert('Message introuvable.'); return; }
                        var section = card.closest('.messages-by-urgency');
                        var filterStatus = section && section.querySelector('.sub-tab.active') ? section.querySelector('.sub-tab.active').getAttribute('data-status') : 'a_repondre';
                        var filterIntention = section && section.querySelector('.intention-filter select') ? section.querySelector('.intention-filter select').value : '';
                        var filterUrgentOnly = section && section.querySelector('.urgent-only-cb') ? section.querySelector('.urgent-only-cb').checked : false;
                        btn.disabled = true;
                        var previousLabel = btn.textContent;
                        btn.innerHTML = '<span class="mini-spinner"></span>Relance IA…';
                        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed/' + encodeURIComponent(messageId) + '/rerun-analysis', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                        }).then(function(r) { return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = previousLabel;
                            if (res && res.success) {
                                loadAnalyzedMessages(pageId, filterStatus || 'a_repondre', filterIntention, listEl, filterUrgentOnly, messageId);
                            } else {
                                alert((res && res.message) ? res.message : 'Erreur lors de la relance IA.');
                            }
                        }).catch(function() {
                            btn.disabled = false;
                            btn.textContent = previousLabel;
                            alert('Erreur réseau.');
                        });
                    });
                });
                listEl.querySelectorAll('.btn-toggle-feedback').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        var form = card ? card.querySelector('.msg-feedback-form') : null;
                        if (!form) return;
                        form.classList.toggle('active');
                    });
                });
                listEl.querySelectorAll('.btn-submit-feedback').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        if (!card) return;
                        var messageId = card.getAttribute('data-message-id');
                        var form = card.querySelector('.msg-feedback-form');
                        if (!messageId || !form) return;
                        var reasonEl = form.querySelector('.feedback-reason');
                        var correctionTypeEl = form.querySelector('.feedback-correction-type');
                        var expectedPriorityEl = form.querySelector('.feedback-expected-priority');
                        var statusEl = card.querySelector('.msg-feedback-status');
                        var contextWrap = card.querySelector('.msg-feedback-context');
                        var contextTextarea = card.querySelector('.feedback-context-text');
                        var reason = reasonEl ? reasonEl.value.trim() : '';
                        var correctionType = correctionTypeEl ? correctionTypeEl.value : 'other';
                        var expectedPriority = expectedPriorityEl ? expectedPriorityEl.value : '';
                        if (!reason || reason.length < 5) {
                            alert('Expliquez pourquoi la classification est incorrecte (minimum 5 caractères).');
                            return;
                        }
                        btn.disabled = true;
                        btn.innerHTML = '<span class="mini-spinner"></span>Envoi...';
                        if (statusEl) {
                            statusEl.className = 'msg-feedback-status running';
                            statusEl.innerHTML = '<span class="mini-spinner"></span>Envoi de la correction en cours...';
                        }
                        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed/' + encodeURIComponent(messageId) + '/feedback', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                reason: reason,
                                correctionType: correctionType,
                                expectedPriority: expectedPriority
                            })
                        }).then(function(r) { return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = 'Envoyer la correction';
                            if (res && res.success) {
                                if (reasonEl) reasonEl.value = '';
                                if (statusEl) {
                                    statusEl.className = 'msg-feedback-status success';
                                    statusEl.textContent = '✅ Correction enregistrée. Génération du contexte enrichi...';
                                }
                                fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed/' + encodeURIComponent(messageId) + '/feedback/suggest-context', {
                                    method: 'POST',
                                    headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        reason: reason,
                                        correctionType: correctionType,
                                        expectedPriority: expectedPriority
                                    })
                                }).then(function(r){ return r.json(); }).then(function(ctxRes) {
                                    if (ctxRes && ctxRes.success && contextTextarea) {
                                        contextTextarea.value = ctxRes.contextSuggestion || '';
                                        if (contextWrap) contextWrap.classList.add('active');
                                        if (form) form.classList.remove('active');
                                        if (statusEl) {
                                            statusEl.className = 'msg-feedback-status success';
                                            statusEl.textContent = '✅ Contexte proposé. Modifiez-le puis cliquez sur "Valider ce contexte".';
                                        }
                                    } else if (statusEl) {
                                        statusEl.className = 'msg-feedback-status error';
                                        statusEl.textContent = '❌ Correction enregistrée, mais génération du contexte impossible.';
                                    }
                                }).catch(function() {
                                    if (statusEl) {
                                        statusEl.className = 'msg-feedback-status error';
                                        statusEl.textContent = '❌ Correction enregistrée, mais erreur lors de la génération du contexte.';
                                    }
                                });
                            } else {
                                if (statusEl) {
                                    statusEl.className = 'msg-feedback-status error';
                                    statusEl.textContent = '❌ ' + ((res && res.message) ? res.message : 'Erreur lors de l\'envoi de la correction.');
                                }
                            }
                        }).catch(function() {
                            btn.disabled = false;
                            btn.textContent = 'Envoyer la correction';
                            if (statusEl) {
                                statusEl.className = 'msg-feedback-status error';
                                statusEl.textContent = '❌ Erreur réseau lors de l\'envoi.';
                            }
                        });
                    });
                });
                listEl.querySelectorAll('.btn-apply-feedback-context').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var card = btn.closest('.msg-card');
                        if (!card) return;
                        var messageId = card.getAttribute('data-message-id');
                        var contextWrap = card.querySelector('.msg-feedback-context');
                        var contextTextarea = card.querySelector('.feedback-context-text');
                        var statusEl = card.querySelector('.msg-feedback-status');
                        var contextText = contextTextarea ? contextTextarea.value.trim() : '';
                        if (!messageId || !contextText) {
                            if (statusEl) {
                                statusEl.className = 'msg-feedback-status error';
                                statusEl.textContent = '❌ Contexte vide. Veuillez renseigner le champ.';
                            }
                            return;
                        }
                        btn.disabled = true;
                        btn.innerHTML = '<span class="mini-spinner"></span>Validation...';
                        if (statusEl) {
                            statusEl.className = 'msg-feedback-status running';
                            statusEl.innerHTML = '<span class="mini-spinner"></span>Application du contexte...';
                        }
                        fetch(API_BASE + '/facebook/pages/' + encodeURIComponent(pageId) + '/messages/analyzed/' + encodeURIComponent(messageId) + '/feedback/apply-context', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contextText: contextText })
                        }).then(function(r){ return r.json(); }).then(function(res) {
                            btn.disabled = false;
                            btn.textContent = 'Valider ce contexte';
                            if (res && res.success) {
                                if (statusEl) {
                                    statusEl.className = 'msg-feedback-status success';
                                    statusEl.textContent = '✅ Contexte enrichi validé et appliqué.';
                                }
                                if (contextWrap) contextWrap.classList.remove('active');
                            } else if (statusEl) {
                                statusEl.className = 'msg-feedback-status error';
                                statusEl.textContent = '❌ ' + ((res && res.message) ? res.message : 'Erreur de validation du contexte.');
                            }
                        }).catch(function() {
                            btn.disabled = false;
                            btn.textContent = 'Valider ce contexte';
                            if (statusEl) {
                                statusEl.className = 'msg-feedback-status error';
                                statusEl.textContent = '❌ Erreur réseau lors de la validation du contexte.';
                            }
                        });
                    });
                });
            })
            .catch(function() {
                listEl.innerHTML = '<p class="messages-list-empty">Erreur de chargement des messages.</p>';
            });
    }

    function buildMessageCardHtml(m, pageId) {
        function escapeHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        var author = (m.author && m.author.name) ? m.author.name : 'Anonyme';
        var authorId = (m.author && m.author.id) ? String(m.author.id) : '';
        var date = m.created_time ? new Date(m.created_time).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        var intentions = (m.intentions || []).map(function(i) {
            return (i.name || i.category || i.label || '').trim();
        }).filter(Boolean);
        var uniqueIntentions = [];
        intentions.forEach(function(n) {
            if (uniqueIntentions.indexOf(n) === -1) uniqueIntentions.push(n);
        });
        var badges = uniqueIntentions.length ? uniqueIntentions.map(function(n) { return '<span>' + n.replace(/</g, '&lt;') + '</span>'; }).join('') : '<span>Général</span>';
        function normalizeIntentions(input) {
            if (!input) return [];
            if (Array.isArray(input)) return input;
            if (typeof input === 'object') {
                if (Array.isArray(input.analyses)) {
                    var fromAnalyses = [];
                    input.analyses.forEach(function(a) {
                        if (a && Array.isArray(a.intentions)) {
                            a.intentions.forEach(function(it) { fromAnalyses.push(it); });
                        }
                    });
                    if (fromAnalyses.length) return fromAnalyses;
                }
                if (Array.isArray(input.intentions)) return input.intentions;
                if (Array.isArray(input.intentions_detectees)) return input.intentions_detectees;
            }
            return [];
        }
        var detailedIntentions = normalizeIntentions(m.analysis_details);
        if (!detailedIntentions.length) detailedIntentions = normalizeIntentions({ intentions: m.intentions || [] });
        var seenDetailKeys = {};
        detailedIntentions = detailedIntentions.filter(function(i) {
            var key = [
                (i && (i.name || i.category || i.label) ? String(i.name || i.category || i.label) : ''),
                (i && (i.priority || i.priorite) ? String(i.priority || i.priorite) : ''),
                (i && (i.reason || i.raison || i.justification || i.explanation) ? String(i.reason || i.raison || i.justification || i.explanation) : '')
            ].join('||').toLowerCase();
            if (seenDetailKeys[key]) return false;
            seenDetailKeys[key] = true;
            return true;
        });
        var analysisHtml = '';
        if (detailedIntentions.length > 0) {
            analysisHtml = '<div class="msg-analysis"><div class="msg-analysis-block-title">Analyse 1</div>';
            detailedIntentions.forEach(function(i) {
                var name = escapeHtml(i && (i.name || i.category || i.label) ? String(i.name || i.category || i.label) : 'Intention');
                var certaintyRaw = i && (i.certainty !== undefined && i.certainty !== null) ? i.certainty
                    : (i && (i.score !== undefined && i.score !== null) ? i.score
                    : (i && (i.confidence !== undefined && i.confidence !== null) ? i.confidence : null));
                var certaintyLine = '';
                if (certaintyRaw !== null && certaintyRaw !== '') {
                    var certaintyNum = Number(certaintyRaw);
                    if (!Number.isNaN(certaintyNum)) {
                        certaintyLine = 'Confiance : <strong>' + certaintyNum + '%</strong>';
                    }
                }
                var priority = i && (i.priority || i.priorite) ? escapeHtml(String(i.priority || i.priorite)) : '';
                var priorityLine = priority ? ('Priorité : <strong>' + priority + '</strong>') : '';
                var urgent = !!(i && i.urgent === true);
                var reason = i && (i.reason || i.raison || i.justification || i.explanation) ? escapeHtml(String(i.reason || i.raison || i.justification || i.explanation)) : '';
                analysisHtml += '<div class="msg-analysis-item' + (urgent ? ' urgent' : '') + '">';
                analysisHtml += '<div class="msg-analysis-main">' + name + (urgent ? '<span class="tag">URGENT</span>' : '') + '</div>';
                if (certaintyLine || priorityLine) {
                    analysisHtml += '<div class="msg-analysis-meta">' + [certaintyLine, priorityLine].filter(Boolean).join(' · ') + '</div>';
                }
                if (reason) {
                    analysisHtml += '<div class="msg-analysis-reason">' + reason.replace(/\n/g, '<br>') + '</div>';
                }
                analysisHtml += '</div>';
            });
            analysisHtml += '</div>';
        } else {
            analysisHtml = '';
        }
        var fullAnalysisPayload = {
            analysis_details: m.analysis_details || null,
            intentions: Array.isArray(m.intentions) ? m.intentions : [],
            reportPriority: m.reportPriority || null,
            reponse_requise: (typeof m.reponse_requise === 'boolean') ? m.reponse_requise : null,
            analyzed_at: m.analyzed_at || null
        };
        var fullAnalysisJson = '';
        try {
            fullAnalysisJson = JSON.stringify(fullAnalysisPayload, null, 2);
        } catch (_) {
            fullAnalysisJson = String(fullAnalysisPayload);
        }
        analysisHtml += '<details class="msg-analysis-full"><summary>Afficher l\'analyse complète (données brutes)</summary><pre>' + escapeHtml(fullAnalysisJson) + '</pre></details>';
        var repliedAt = m.replied_at ? new Date(m.replied_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        var msgText = escapeHtml(m.message || '').replace(/\n/g, '<br>');
        var psid = (m.sender_psid || '').trim() || '';
        var postId = (m.post_id || '').trim() || '';
        var commentId = (m.comment_id || '').trim() || '';
        var isComment = !!postId;
        var recipientId = psid || authorId;
        var canReplyMp = !!recipientId;
        var canReplyComment = isComment && !!postId;
        var esc = function(s) { return escapeHtml(s || ''); };
        var repliedMsg = (m.replied_message || '').trim();
        var isReplied = !!repliedAt;
        var repliedBlock = repliedAt
            ? ('<div class="msg-badge-replied">Répondu le ' + escapeHtml(repliedAt) + '</div>' +
               (repliedMsg
                 ? '<div class="msg-replied-content"><strong>Réponse envoyée :</strong><p class="msg-replied-text">' + (escapeHtml(repliedMsg).replace(/\n/g, '<br>')) + '</p></div>'
                 : '<div class="msg-replied-content msg-replied-no-text"><em>Réponse envoyée (texte non enregistré)</em></div>'))
            : '';
        var card = '<div class="msg-card" data-message-id="' + esc(m.id) + '" data-page-id="' + esc(pageId) + '" data-post-id="' + esc(postId) + '" data-comment-id="' + esc(commentId) + '" data-author-id="' + esc(authorId) + '" data-sender-psid="' + esc(psid) + '" data-recipient-id="' + esc(recipientId) + '">' +
            repliedBlock +
            '<div class="msg-meta">' + author + ' · ' + date + '</div>' +
            '<div class="msg-intentions">' + badges + '</div>' +
            '<div class="msg-body">' + msgText + '</div>' +
            analysisHtml;
        if (!isReplied) {
            card += '<div class="msg-reply-row">' +
            '<div class="msg-reply-toolbar"><button type="button" class="btn btn-outline btn-sm btn-prepare-reply">Préparer une réponse avec l\'IA</button></div>' +
            '<label>Réponse à envoyer</label><textarea class="msg-reply-text" rows="3" placeholder="Cliquez sur « Préparer une réponse avec l\'IA » ou saisissez votre réponse."></textarea>' +
            '<div class="msg-reply-actions">';
            if (canReplyComment) {
                card += '<button type="button" class="btn btn-primary btn-reply-comment">Répondre en commentaire</button>';
            }
            if (canReplyMp) {
                card += '<button type="button" class="btn btn-primary btn-reply-mp">Répondre en MP</button>';
            }
            card += '<button type="button" class="btn btn-outline btn-rerun-analysis">Repasser par l\'IA</button>';
            card += '<button type="button" class="btn btn-outline btn-send-email">Envoyer via mail</button>';
            if (!canReplyComment && !canReplyMp) {
                card += '<span class="text-muted">Aucun canal Facebook direct disponible pour ce message.</span>';
            }
            card += '</div></div>';
        }
        card += '<div class="msg-feedback">' +
            '<button type="button" class="btn btn-outline btn-sm btn-toggle-feedback">Signaler une mauvaise classification</button>' +
            '<div class="msg-feedback-form">' +
                '<label>Type de correction</label>' +
                '<select class="feedback-correction-type">' +
                    '<option value="urgency_false_positive">Faux urgent (classé urgent alors que non urgent)</option>' +
                    '<option value="urgency_false_negative">Urgent non détecté</option>' +
                    '<option value="wrong_intention">Mauvaise intention/service</option>' +
                    '<option value="other">Autre</option>' +
                '</select>' +
                '<label>Priorité attendue</label>' +
                '<select class="feedback-expected-priority">' +
                    '<option value="">Non précisée</option>' +
                    '<option value="immediate">Immédiate</option>' +
                    '<option value="daily">Journalière</option>' +
                    '<option value="weekly">Hebdomadaire</option>' +
                    '<option value="monthly">Mensuelle</option>' +
                '</select>' +
                '<label>Pourquoi la classification est incorrecte ?</label>' +
                '<textarea class="feedback-reason" placeholder="Ex: Ce message est une simple demande d\'information, pas une urgence."></textarea>' +
                '<div class="msg-reply-actions"><button type="button" class="btn btn-primary btn-sm btn-submit-feedback">Envoyer la correction</button></div>' +
            '</div>' +
            '<div class="msg-feedback-context">' +
                '<label>Contexte enrichi proposé par l\'IA (éditable)</label>' +
                '<textarea class="feedback-context-text" placeholder="Le contexte proposé apparaîtra ici..."></textarea>' +
                '<div class="msg-reply-actions"><button type="button" class="btn btn-primary btn-sm btn-apply-feedback-context">Valider ce contexte</button></div>' +
            '</div>' +
            '<div class="msg-feedback-status"></div>' +
        '</div>';
        card += '</div>';
        return card;
    }

    function loadSummary() {
        var url = API_BASE + '/facebook/pages/summary?since=' + encodeURIComponent(sinceDate('30'));

        document.getElementById('resume-loading').style.display = 'block';
        document.getElementById('resume-empty').style.display = 'none';
        document.getElementById('resume-tabs').style.display = 'none';

        fetch(url, { headers: { 'Authorization': 'Bearer ' + JWT } })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                document.getElementById('resume-loading').style.display = 'none';
                if (!data.success || !data.pages || data.pages.length === 0) {
                    document.getElementById('resume-empty').style.display = 'block';
                    return;
                }
                renderTabs(data.pages);
                document.getElementById('resume-tabs').style.display = 'block';
            })
            .catch(function() {
                document.getElementById('resume-loading').style.display = 'none';
                document.getElementById('resume-empty').style.display = 'block';
                document.getElementById('resume-empty').textContent = 'Impossible de charger le résumé.';
            });
    }

    function renderTabs(pages) {
        var tabList = document.getElementById('page-tabs');
        var tabContent = document.getElementById('page-tab-content');
        tabList.innerHTML = '';
        tabContent.innerHTML = '';
        var loadedTabs = {};

        pages.forEach(function(p, idx) {
            var tabId = 'tab-' + (p.pageId || idx);
            var isFirst = idx === 0;
            var pageId = p.pageId;

            var li = document.createElement('li');
            li.className = 'nav-item';
            var link = document.createElement('a');
            link.className = 'nav-link' + (isFirst ? ' active' : '');
            link.href = '#' + tabId;
            link.setAttribute('role', 'tab');
            link.textContent = p.pageName || ('Page ' + pageId);
            var pane = document.createElement('div');
            pane.id = tabId;
            pane.className = 'tab-pane' + (isFirst ? ' active' : '');
            pane.setAttribute('role', 'tabpanel');
            pane.style.display = isFirst ? 'block' : 'none';

            var periodSelect = document.createElement('select');
            periodSelect.className = 'form-control';
            periodSelect.style.display = 'inline-block';
            periodSelect.style.width = 'auto';
            periodSelect.style.marginLeft = '0.5rem';
            periodSelect.innerHTML = '<option value="7">7 derniers jours</option><option value="30" selected>30 derniers jours</option><option value="90">90 derniers jours</option><option value="">Tout</option>';
            var toolbar = document.createElement('div');
            toolbar.className = 'resume-toolbar-per-page';
            toolbar.innerHTML = '<label>Période :</label> ';
            toolbar.appendChild(periodSelect);

            var cardContainer = document.createElement('div');
            cardContainer.className = 'resume-page-card-container';
            cardContainer.innerHTML = buildCardHtml(p, pageId);

            link.addEventListener('click', function(e) {
                e.preventDefault();
                tabList.querySelectorAll('.nav-link').forEach(function(l) { l.classList.remove('active'); });
                tabContent.querySelectorAll('.tab-pane').forEach(function(pan) { pan.classList.remove('active'); pan.style.display = 'none'; });
                link.classList.add('active');
                pane.classList.add('active');
                pane.style.display = 'block';
                if (!loadedTabs[pageId]) {
                    loadedTabs[pageId] = true;
                    loadPageSummary(pageId, periodSelect.value || '30', cardContainer);
                    loadAnalyzedMessages(pageId, currentStatus.value, currentIntention.value, messagesListEl, getUrgentOnly());
                }
            });

            li.appendChild(link);
            tabList.appendChild(li);

            periodSelect.addEventListener('change', function() {
                var val = periodSelect.value;
                loadPageSummary(pageId, val || null, cardContainer);
            });

            var messagesSection = document.createElement('div');
            messagesSection.className = 'messages-by-urgency';
            messagesSection.innerHTML = '<div class="resume-section-title">Messages</div>';
            var subTabsEl = document.createElement('div');
            subTabsEl.className = 'sub-tabs';
            STATUS_OPTIONS.forEach(function(s) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'sub-tab' + (s.value === 'all' ? ' active' : '');
                b.textContent = s.label;
                b.setAttribute('data-status', s.value);
                subTabsEl.appendChild(b);
            });
            var intentionSelect = document.createElement('select');
            intentionSelect.className = 'form-control intention-filter';
            intentionSelect.style.display = 'inline-block';
            intentionSelect.style.width = 'auto';
            intentionSelect.style.marginLeft = '0.5rem';
            INTENTION_OPTIONS.forEach(function(o) {
                var opt = document.createElement('option');
                opt.value = o.value;
                opt.textContent = o.label;
                intentionSelect.appendChild(opt);
            });
            var filterRow = document.createElement('div');
            filterRow.className = 'intention-filter';
            filterRow.innerHTML = '<label>Service / intention :</label> ';
            filterRow.appendChild(intentionSelect);
            var urgentCb = document.createElement('label');
            urgentCb.className = 'urgent-only-filter';
            urgentCb.style.marginLeft = '1rem';
            urgentCb.innerHTML = '<input type="checkbox" class="urgent-only-cb" /> Réponse urgente uniquement';
            filterRow.appendChild(urgentCb);
            var messagesListEl = document.createElement('div');
            messagesListEl.className = 'messages-list';

            var currentStatus = { value: 'all' };
            var currentIntention = { value: '' };
            function getUrgentOnly() { return urgentCb.querySelector('.urgent-only-cb') ? urgentCb.querySelector('.urgent-only-cb').checked : false; }
            function refreshMessages() {
                loadAnalyzedMessages(pageId, currentStatus.value, currentIntention.value, messagesListEl, getUrgentOnly());
            }
            var messagesLoaded = false;
            function ensureMessagesLoaded() {
                if (messagesLoaded) return;
                messagesLoaded = true;
                loadMessagesBtn.style.display = 'none';
                refreshMessages();
            }
            subTabsEl.querySelectorAll('.sub-tab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    subTabsEl.querySelectorAll('.sub-tab').forEach(function(x) { x.classList.remove('active'); });
                    btn.classList.add('active');
                    currentStatus.value = btn.getAttribute('data-status');
                    if (messagesLoaded) refreshMessages();
                });
            });
            intentionSelect.addEventListener('change', function() {
                currentIntention.value = intentionSelect.value;
                if (messagesLoaded) refreshMessages();
            });
            var urgentOnlyInput = urgentCb.querySelector('.urgent-only-cb');
            if (urgentOnlyInput) {
                urgentOnlyInput.addEventListener('change', function() {
                    if (messagesLoaded && currentStatus.value === 'a_repondre') refreshMessages();
                });
            }
            var loadMessagesBtn = document.createElement('button');
            loadMessagesBtn.type = 'button';
            loadMessagesBtn.className = 'btn btn-outline btn-sm messages-load-trigger';
            loadMessagesBtn.textContent = 'Charger les messages analysés';
            loadMessagesBtn.addEventListener('click', ensureMessagesLoaded);
            messagesListEl.innerHTML = '<p class="messages-list-empty">Les messages seront chargés à la demande pour accélérer l\'ouverture.</p>';

            messagesSection.appendChild(subTabsEl);
            messagesSection.appendChild(filterRow);
            messagesSection.appendChild(loadMessagesBtn);
            messagesSection.appendChild(messagesListEl);

            pane.appendChild(toolbar);
            pane.appendChild(cardContainer);
            pane.appendChild(messagesSection);
            tabContent.appendChild(pane);

            pane.addEventListener('click', function(evt) {
                var target = evt.target;
                if (target && target.classList && target.classList.contains('btn-run-catchup')) {
                    evt.preventDefault();
                    runCatchup(pageId, cardContainer, messagesListEl, currentStatus, currentIntention, getUrgentOnly);
                }
            });

            if (isFirst) {
                loadedTabs[pageId] = true;
                loadPageSummary(pageId, '30', cardContainer);
            }
        });
    }

    loadSummary();
})();
</script>

<?php
renderConsoleLayoutEnd();
require_once '../../includes/footer.php';
