<?php
/**
 * Page de revue humaine (HITL) — file d'attente (liste) + détail d'un mail.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requireUserWorkspaceEntityAccess();

$runId = preg_replace('/[^a-f0-9]/i', '', (string) ($_GET['runId'] ?? ''));
$page_title = 'Revue documentaire';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$extra_styles = [
    url('assets/css/agent-cards.css'),
    url('assets/css/agent-run.css') . '?v=' . (is_file(__DIR__ . '/../assets/css/agent-run.css') ? filemtime(__DIR__ . '/../assets/css/agent-run.css') : time()),
];

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'À traiter',
    'File des runs en attente de validation humaine → ouvrez-en un pour valider ou rejeter.',
    ['actions' => '<a class="btn btn-outline" href="' . htmlspecialchars(url('pages/user-agents.php')) . '">← Agents</a>']
);
?>

<div id="reviewMsg" class="alert alert-info small" style="display:none;"></div>

<style>
.review-layout { display:grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap:16px; align-items:start; }
@media (max-width: 900px) { .review-layout { grid-template-columns: 1fr; } }
.review-queue-item {
  display:block; padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px;
  margin-bottom:8px; text-decoration:none; color:inherit; background:#fff;
}
.review-queue-item:hover { border-color:#93c5fd; background:#f8fbff; }
.review-queue-item.is-active { border-color:#2563eb; background:#eff6ff; box-shadow:0 0 0 1px #2563eb; }
.review-queue-item .q-from { font-weight:600; font-size:0.92rem; }
.review-queue-item .q-subject { color:#334155; font-size:0.88rem; margin-top:2px; }
.review-queue-item .q-meta { color:#94a3b8; font-size:0.75rem; margin-top:4px; }
</style>

<div class="review-layout">
    <div class="card" style="margin-bottom:1rem;">
        <div class="card-header" style="background:#f8fafc;">
            <strong>Mails à valider</strong>
            <span id="queueCount" class="text-muted small" style="margin-left:6px;"></span>
        </div>
        <div class="card-body" style="padding:12px;">
            <div id="reviewQueue"><p class="text-muted small" style="margin:0;">Chargement de la liste…</p></div>
        </div>
    </div>

    <div>
        <?php if (!$runId): ?>
        <div class="alert alert-info">
            Sélectionnez un mail dans la liste à gauche pour l’ouvrir et le valider.
        </div>
        <?php else: ?>

        <div class="card" style="margin-bottom:1rem;">
            <div class="card-body">
                <h2 id="reviewTitle" style="margin:0 0 8px; font-size:1.15rem;">Chargement…</h2>
                <p id="reviewInstructions" class="text-muted small" style="margin:0;"></p>
                <p id="reviewMeta" class="text-muted small" style="margin:8px 0 0;"></p>
            </div>
        </div>

        <div class="card" style="margin-bottom:1rem; display:none;" id="attachmentsCard">
            <div class="card-header" style="background:#f8fafc; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <strong>Pièces jointes — téléchargement</strong>
                <button type="button" class="btn btn-outline btn-sm" id="btnDownloadAllAtts" style="display:none;">Tout télécharger</button>
            </div>
            <div class="card-body">
                <ul id="attachmentsList" style="margin:0; padding-left:0; list-style:none;"></ul>
            </div>
        </div>

        <div class="card" style="margin-bottom:1rem;">
            <div class="card-header" style="background:#f8fafc;">
                <strong>Détail du mail sélectionné</strong>
            </div>
            <div class="card-body">
                <div id="reviewEditor"
                     contenteditable="true"
                     class="agent-run-draft"
                     style="min-height:280px; max-height:none; padding:16px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; outline:none;">
                </div>
            </div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn btn-success" id="btnApprove">Valider ce mail</button>
            <button type="button" class="btn btn-danger" id="btnReject">Rejeter ce mail</button>
            <a class="btn btn-outline" href="<?= htmlspecialchars(url('pages/user-agents.php')) ?>">Retour</a>
        </div>
        <?php endif; ?>
    </div>
</div>

<script>
(function() {
    var API = <?= json_encode($api_base_url . '/agent-flows') ?>;
    var JWT = <?= json_encode($jwt_token) ?>;
    var runId = <?= json_encode($runId) ?>;
    var assistedUrl = <?= json_encode(url('pages/agent-human-review.php')) ?>;
    var reviewPageBase = <?= json_encode(url('pages/agent-human-review.php')) ?>;
    var apiRoot = <?= json_encode(rtrim($api_base_url, '/')) ?>;
    var uploadsRoot = apiRoot.replace(/\/api\/?$/, '');
    var resumeToken = null;
    var currentFlowId = null;

    function headers() {
        return { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' };
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showMsg(text, ok) {
        var el = document.getElementById('reviewMsg');
        el.style.display = 'block';
        el.className = 'alert small ' + (ok ? 'alert-success' : 'alert-danger');
        el.textContent = text;
    }

    function humanOut(run) {
        var out = run.humanOutput || {};
        var steps = run.steps || [];
        var waiting = steps.find(function(s) { return s.status === 'waiting_human'; });
        if (waiting && waiting.output) out = waiting.output;
        return out || {};
    }

    function renderQueue(runs, activeId) {
        var host = document.getElementById('reviewQueue');
        var countEl = document.getElementById('queueCount');
        if (countEl) countEl.textContent = runs.length ? '(' + runs.length + ')' : '(0)';
        if (!runs.length) {
            host.innerHTML = '<p class="text-muted small" style="margin:0;">Aucun mail en attente.</p>';
            return;
        }
        host.innerHTML = runs.map(function(run) {
            var out = humanOut(run);
            var from = out.from || '—';
            var subject = out.subject || '(sans sujet)';
            var attN = Array.isArray(out.attachments) ? out.attachments.length : 0;
            var href = reviewPageBase + '?runId=' + encodeURIComponent(run._id);
            var active = String(run._id) === String(activeId) ? ' is-active' : '';
            return (
                '<a class="review-queue-item' + active + '" href="' + esc(href) + '">' +
                '<div class="q-from">' + esc(from) + '</div>' +
                '<div class="q-subject">' + esc(subject) + '</div>' +
                '<div class="q-meta">' + esc(run.flowName || 'Agent') +
                (attN ? ' · ' + attN + ' PJ' : '') +
                (run.startedAt ? ' · ' + esc(String(run.startedAt).slice(0, 19).replace('T', ' ')) : '') +
                '</div></a>'
            );
        }).join('');
    }

    function loadQueue(flowId) {
        var q = '/runs?status=waiting_human&limit=50';
        if (flowId) q += '&flowId=' + encodeURIComponent(flowId);
        return fetch(API + q, { headers: headers() })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur liste');
                renderQueue(data.runs || [], runId);
                return data.runs || [];
            });
    }

    function renderAttachments(atts) {
        var card = document.getElementById('attachmentsCard');
        var list = document.getElementById('attachmentsList');
        var btnAll = document.getElementById('btnDownloadAllAtts');
        if (!card || !list) return;
        if (!atts.length) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        list.innerHTML = '';
        var hrefs = [];
        atts.forEach(function(a) {
            var li = document.createElement('li');
            li.style.cssText = 'margin-bottom:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;';
            var label = (a.filename || 'fichier') +
                (a.size ? ' (' + Math.round(a.size / 1024) + ' Ko)' : '');
            var name = document.createElement('span');
            name.textContent = label;
            li.appendChild(name);
            if (a.url) {
                var href = a.url;
                if (href.indexOf('http') !== 0) {
                    href = uploadsRoot + (href.charAt(0) === '/' ? href : '/' + href);
                }
                hrefs.push({ href: href, name: a.filename || 'fichier' });
                var link = document.createElement('a');
                link.className = 'btn btn-primary btn-sm';
                link.href = href;
                link.download = a.filename || 'fichier';
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = 'Télécharger';
                li.appendChild(link);
                var open = document.createElement('a');
                open.className = 'btn btn-outline btn-sm';
                open.href = href;
                open.target = '_blank';
                open.rel = 'noopener';
                open.textContent = 'Ouvrir';
                li.appendChild(open);
            } else {
                var miss = document.createElement('span');
                miss.className = 'text-muted small';
                miss.textContent = '(fichier non disponible — ajoutez « Télécharger PJ » avant la revue)';
                li.appendChild(miss);
            }
            list.appendChild(li);
        });
        if (btnAll && hrefs.length) {
            btnAll.style.display = '';
            btnAll.onclick = function() {
                hrefs.forEach(function(item, i) {
                    setTimeout(function() {
                        var a = document.createElement('a');
                        a.href = item.href;
                        a.download = item.name;
                        a.target = '_blank';
                        a.rel = 'noopener';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    }, i * 250);
                });
            };
        } else if (btnAll) {
            btnAll.style.display = 'none';
        }
    }

    function goNextInQueue(runs) {
        var next = (runs || []).find(function(r) { return String(r._id) !== String(runId); });
        if (next) {
            window.location.href = reviewPageBase + '?runId=' + encodeURIComponent(next._id);
        } else {
            window.location.href = assistedUrl;
        }
    }

    // Toujours charger la liste (même sans runId)
    var queuePromise = runId
        ? Promise.resolve()
        : loadQueue(null).catch(function(e) {
            document.getElementById('reviewQueue').innerHTML =
                '<p class="text-danger small">' + esc(e.message) + '</p>';
        });

    if (!runId) return;

    fetch(API + '/runs/' + encodeURIComponent(runId), { headers: headers() })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.success) throw new Error(data.message || 'Erreur');
            var run = data.run;
            if (run.status !== 'waiting_human') {
                throw new Error('Ce run n\'attend plus de validation (statut : ' + run.status + ').');
            }
            resumeToken = run.resumeToken;
            currentFlowId = run.flowId ? String(run.flowId) : null;
            var out = humanOut(run);

            document.getElementById('reviewTitle').textContent = out.title || run.flowName || 'Revue';
            document.getElementById('reviewInstructions').textContent =
                (out.instructions || '') +
                ' — Un mail à la fois : validez ou rejetez, puis passez au suivant dans la liste.';
            var metaBits = ['Agent : ' + (run.flowName || '')];
            if (out.from) metaBits.push('De : ' + out.from);
            if (out.subject) metaBits.push('Sujet : ' + out.subject);
            document.getElementById('reviewMeta').textContent = metaBits.join(' · ');
            document.getElementById('reviewEditor').innerHTML =
                out.draftHtml || ('<p>' + String(out.draftText || '').replace(/</g, '&lt;') + '</p>');

            renderAttachments(Array.isArray(out.attachments) ? out.attachments : []);
            return loadQueue(currentFlowId);
        })
        .catch(function(e) {
            showMsg(e.message, false);
            var ba = document.getElementById('btnApprove');
            var br = document.getElementById('btnReject');
            if (ba) ba.disabled = true;
            if (br) br.disabled = true;
            loadQueue(null).catch(function() {});
        });

    function collectAtelierValues(editor) {
        var values = {};
        if (!editor) return values;
        var form = editor.querySelector('.atelier-form') || editor;
        form.querySelectorAll('[name]').forEach(function(el) {
            if (!el.name) return;
            if (el.type === 'checkbox') values[el.name] = !!el.checked;
            else values[el.name] = el.value;
        });
        return values;
    }

    function resume(decision) {
        var editor = document.getElementById('reviewEditor');
        var html = editor.innerHTML;
        var text = editor.innerText || editor.textContent || '';
        document.getElementById('btnApprove').disabled = true;
        document.getElementById('btnReject').disabled = true;
        fetch(API + '/runs/' + encodeURIComponent(runId) + '/resume', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                decision: decision,
                resumeToken: resumeToken,
                editedHtml: html,
                editedText: text,
                values: collectAtelierValues(editor)
            })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                showMsg(
                    decision === 'approve'
                        ? 'Validé — passage au mail suivant…'
                        : 'Rejeté — passage au mail suivant…',
                    true
                );
                return loadQueue(currentFlowId).then(function(runs) {
                    setTimeout(function() { goNextInQueue(runs); }, 600);
                });
            })
            .catch(function(e) {
                showMsg(e.message, false);
                document.getElementById('btnApprove').disabled = false;
                document.getElementById('btnReject').disabled = false;
            });
    }

    document.getElementById('btnApprove').addEventListener('click', function() {
        if (!confirm('Valider ce mail et continuer le flow ?')) return;
        resume('approve');
    });
    document.getElementById('btnReject').addEventListener('click', function() {
        if (!confirm('Rejeter ce mail et arrêter ce run ?')) return;
        resume('reject');
    });
})();
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
