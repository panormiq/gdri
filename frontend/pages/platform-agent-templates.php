<?php
/**
 * Console plateforme — templates de production des agents (mise en page + prompts).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$page_title = 'Templates de production';
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');

require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Templates de production',
    'Mises en page et prompts figés pour les agents. Chaque template a un profil de modèle LLM. Le couple « Création de page web » + « Page web agent » est le gabarit d’application.',
    ['narrow' => false]
);
renderConsoleBackLink('Agents IA', url('pages/platform-agents.php'));
?>

<div class="card" style="margin-bottom:1.25rem;">
    <div class="card-body">
        <label for="prodMatchBrief" style="font-weight:600;">Tester une demande</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
            <input type="text" id="prodMatchBrief" class="form-control" style="flex:1; min-width:220px;"
                   placeholder="Ex. Créer la page web de suivi d’un dossier, ou valider une facture">
            <select id="prodMatchUsage" class="form-control" style="max-width:160px;">
                <option value="validation">Validation</option>
                <option value="ia">Prompt IA</option>
                <option value="page">Page web</option>
            </select>
            <select id="prodMatchChannel" class="form-control" style="max-width:140px;">
                <option value="">Canal —</option>
                <option value="mail">Mail</option>
                <option value="facebook">Facebook</option>
                <option value="http">HTTP</option>
            </select>
            <button type="button" class="btn btn-primary" id="prodMatchBtn">Recommander</button>
        </div>
        <p id="prodMatchResult" class="text-muted small" style="margin:8px 0 0;"></p>
    </div>
</div>

<div id="prodTplStatus" class="text-muted small" style="margin-bottom:12px;">Chargement…</div>
<div id="prodTplList"></div>

<script>
(function() {
  var API = <?= json_encode($api_base_url . '/agent-flows') ?>;
  var JWT = <?= json_encode($jwt_token) ?>;

  function headers() {
    return { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' };
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadList() {
    var status = document.getElementById('prodTplStatus');
    fetch(API + '/production-templates', { headers: headers() })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var all = (data && data.templates) || [];
        var pages = all.filter(function(t) { return t.usage === 'page'; });
        var validation = all.filter(function(t) { return t.usage === 'validation'; });
        var ia = all.filter(function(t) { return t.usage === 'ia'; });
        status.textContent = all.length + ' modèles de production.';
        var host = document.getElementById('prodTplList');
        host.innerHTML = sectionHtml('Pages web — cœur du système', pages, 'page')
          + sectionHtml('Validation — mises en page', validation, 'validation')
          + sectionHtml('IA — prompts de production', ia, 'ia');
        host.querySelectorAll('[data-preview-id]').forEach(function(btn) {
          btn.addEventListener('click', function() { preview(btn.getAttribute('data-preview-id')); });
        });
      })
      .catch(function(e) {
        status.textContent = e.message || 'Chargement impossible';
      });
  }

  function modelBadge(t) {
    if (!t || !t.model) return '';
    var prefer = (t.model.prefer || []).slice(0, 3).join(', ');
    return '<span class="badge" style="background:#dbeafe;color:#1d4ed8;font-weight:600;padding:3px 8px;border-radius:999px;">'
      + esc(t.model.label || t.model.profile || 'Modèle')
      + '</span>'
      + (prefer ? '<span class="text-muted small" style="margin-left:6px;">' + esc(prefer) + '</span>' : '');
  }

  function sectionHtml(title, list, usage) {
    var html = '<h2 style="font-size:1.05rem;margin:1.25rem 0 10px;">' + esc(title) + '</h2>';
    if (!list.length) {
      html += '<p class="text-muted small">Aucun modèle.</p>';
      return html;
    }
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">';
    list.forEach(function(t) {
      html += '<div class="card" style="margin:0;"><div class="card-body">';
      html += '<strong>' + esc(t.title) + '</strong>';
      html += '<div style="margin:8px 0;">' + modelBadge(t) + '</div>';
      html += '<p class="text-muted small" style="margin:6px 0 8px;">' + esc(t.description) + '</p>';
      html += '<p class="small" style="margin:0 0 8px;"><code>' + esc(t.id) + '</code>';
      if (t.channels && t.channels.length) html += ' · ' + esc(t.channels.join(', '));
      html += '</p>';
      if (t.pairTitle) {
        html += '<p class="small" style="margin:0 0 8px;">Couple : <strong>' + esc(t.pairTitle) + '</strong></p>';
      }
      if (t.kind === 'html') {
        html += '<button type="button" class="btn btn-outline btn-sm" data-preview-id="' + esc(t.id) + '">Aperçu</button>';
      }
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function preview(id) {
    fetch(API + '/production-templates/' + encodeURIComponent(id), { headers: headers() })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Introuvable');
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
        var wide = id === 'page-web' ? '1080px' : '780px';
        wrap.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:' + wide + ';width:100%;max-height:90vh;overflow:auto;padding:20px;position:relative;">'
          + '<button type="button" class="btn btn-outline btn-sm" style="position:absolute;top:12px;right:12px;z-index:2;">Fermer</button>'
          + (data.html || '<p>Pas de HTML (prompt IA).</p>')
          + '</div>';
        wrap.querySelector('button').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };
        document.body.appendChild(wrap);
      })
      .catch(function(e) { alert(e.message); });
  }

  document.getElementById('prodMatchBtn').addEventListener('click', function() {
    var brief = document.getElementById('prodMatchBrief').value.trim();
    var usage = document.getElementById('prodMatchUsage').value;
    var channel = document.getElementById('prodMatchChannel').value;
    var out = document.getElementById('prodMatchResult');
    if (!brief) {
      out.textContent = 'Saisissez une demande.';
      return;
    }
    var url = API + '/production-templates/match?usage=' + encodeURIComponent(usage)
      + '&brief=' + encodeURIComponent(brief)
      + '&channel=' + encodeURIComponent(channel);
    fetch(url, { headers: headers() })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success || !data.template) {
          out.textContent = 'Aucun modèle.';
          return;
        }
        var t = data.template;
        var extra = '';
        if (t.model && t.model.label) extra += ' · modèle ' + esc(t.model.label);
        if (t.pairTitle) extra += ' · couple « ' + esc(t.pairTitle) + ' »';
        out.innerHTML = 'Recommandé : <strong>' + esc(t.title) + '</strong> <code>' + esc(t.id) + '</code>' + extra;
      })
      .catch(function(e) { out.textContent = e.message; });
  });

  loadList();
})();
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
