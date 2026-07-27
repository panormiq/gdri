/**
 * Liste / cartes agents (automatiques | assistés).
 * Config via window.AGENTS_LIST_APP
 */
(function() {
  var cfg = window.AGENTS_LIST_APP || {};
  var API = (cfg.apiBase || '').replace(/\/$/, '') + '/agent-flows';
  var JWT = cfg.jwt || '';
  var mode = cfg.mode || null; // automatic | assisted | null
  var editorBase = cfg.editorBase || '#';
  var reviewBase = cfg.reviewBase || 'pages/agent-human-review.php';
  var canManage = !!cfg.canManage;
  var showInbox = !!cfg.showInbox;

  function headers() {
    return { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' };
  }

  function parseJson(res) {
    var ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') === -1) {
      return res.text().then(function() {
        throw new Error('Réponse non-JSON (status ' + res.status + ')');
      });
    }
    return res.json();
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function triggerLabel(flow) {
    var t = flow.trigger || {};
    if (t.brickId === 'cron-trigger') return 'Planifié';
    if (t.brickId === 'manual-trigger') return 'Manuel';
    if (t.brickId === 'mail-in') return 'Mail entrant';
    if (t.brickId === 'facebook') return 'Facebook';
    return t.brickId || '—';
  }

  function modeBadge(flow) {
    var m = flow.effectiveInteractionMode || flow.derivedInteractionMode || 'automatic';
    if (m === 'assisted') {
      return '<span class="agent-card-badge is-assisted">Assisté</span>';
    }
    return '<span class="agent-card-badge">Automatique</span>';
  }

  function coverHtml(flow) {
    if (flow.imageUrl) {
      return '<div class="agent-card-cover"><img src="' + esc(flow.imageUrl) + '" alt="">' + modeBadge(flow) + '</div>';
    }
    return '<div class="agent-card-cover">' + modeBadge(flow) + '</div>';
  }

  function editorHref(flowId) {
    var base = editorBase || '#';
    var sep = base.indexOf('?') >= 0 ? '&' : '?';
    return base + sep + 'flowId=' + encodeURIComponent(flowId || '');
  }

  function cardHtml(flow) {
    var id = flow._id || '';
    var enabled = flow.enabled !== false;
    var manageThis = canManage && (flow.canManage !== false);
    var actions = '<button type="button" class="btn btn-success btn-sm agent-run" data-id="' + esc(id) + '">Lancer</button>';
    if (manageThis) {
      actions =
        '<a class="btn btn-outline btn-sm" href="' + esc(editorHref(id)) + '">Éditer</a> ' +
        actions +
        ' <button type="button" class="btn btn-outline btn-sm btn-danger agent-del" data-id="' + esc(id) + '">Suppr.</button>';
    }
    return (
      '<article class="agent-card" data-id="' + esc(id) + '">' +
      coverHtml(flow) +
      '<div class="agent-card-body">' +
      '<h3>' + esc(flow.name || 'Sans nom') + '</h3>' +
      '<p class="agent-card-desc">' + esc(flow.description || 'Pas de description') + '</p>' +
      '<div class="agent-card-meta">' + esc(triggerLabel(flow)) +
      (flow.scheduleLabel ? ' · ' + esc(flow.scheduleLabel) : '') +
      ' · ' + (enabled ? 'Actif' : 'Inactif') +
      '</div>' +
      '<div class="agent-card-actions">' + actions + '</div>' +
      '</div></article>'
    );
  }

  function bindCardActions(root) {
    root.querySelectorAll('.agent-run').forEach(function(btn) {
      btn.addEventListener('click', function() {
        btn.disabled = true;
        var card = btn.closest('.agent-card');
        var nameHint = card ? (card.querySelector('h3') && card.querySelector('h3').textContent) || '' : '';
        var body = /facebook/i.test(nameHint) ? { fetchLatestPost: true } : {};
        fetch(API + '/flows/' + btn.getAttribute('data-id') + '/run', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(body)
        })
          .then(parseJson)
          .then(function(d) {
            if (!d.success) throw new Error(d.message);
            if (d.run && d.run.status === 'waiting_human' && d.run.reviewUrl) {
              var url = d.run.reviewUrl;
              if (url.indexOf('http') !== 0 && cfg.urlPrefix) {
                url = cfg.urlPrefix.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
              }
              if (confirm('Validation humaine requise. Ouvrir la page de revue ?')) {
                window.location.href = url.indexOf('pages/') === 0 && cfg.reviewPageUrl
                  ? cfg.reviewPageUrl + '?runId=' + encodeURIComponent(d.run._id)
                  : url;
              }
              return;
            }
            if (d.triggerMessage && d.triggerMessage.text) {
              alert('Lancé.\n\n' + String(d.triggerMessage.text).slice(0, 300));
            } else {
              alert(d.run && d.run.status === 'waiting_human' ? 'En attente de validation humaine.' : 'Agent lancé.');
            }
            if (showInbox) loadInbox();
          })
          .catch(function(e) { alert(e.message); })
          .finally(function() { btn.disabled = false; });
      });
    });

    if (canManage) {
      root.querySelectorAll('.agent-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (!confirm('Supprimer cet agent ?')) return;
          fetch(API + '/flows/' + btn.getAttribute('data-id'), { method: 'DELETE', headers: headers() })
            .then(parseJson)
            .then(function(d) {
              if (!d.success) throw new Error(d.message);
              loadAgents();
            })
            .catch(function(e) { alert(e.message); });
        });
      });
    }
  }

  function loadAgents() {
    var statusEl = document.getElementById('agentsStatus');
    var grid = document.getElementById('agentsCards');
    if (!statusEl || !grid) return;
    statusEl.textContent = 'Chargement…';
    var qs = mode ? ('?interactionMode=' + encodeURIComponent(mode)) : '';
    fetch(API + '/flows' + qs, { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur');
        var flows = data.flows || [];
        if (!flows.length) {
          statusEl.textContent = mode === 'assisted'
            ? 'Aucun agent assisté. Ajoutez une brique « Revue documentaire » pour en créer un.'
            : (mode === 'automatic'
              ? 'Aucun agent automatique.'
              : 'Aucun agent.');
          grid.innerHTML = '';
          return;
        }
        statusEl.textContent = flows.length + ' agent(s).';
        grid.innerHTML = flows.map(cardHtml).join('');
        bindCardActions(grid);
      })
      .catch(function(e) {
        statusEl.textContent = 'Erreur : ' + e.message;
        grid.innerHTML = '';
      });
  }

  function loadInbox() {
    var host = document.getElementById('agentsInbox');
    var status = document.getElementById('inboxStatus');
    if (!host) return;
    if (status) status.textContent = 'Chargement…';
    fetch(API + '/runs?status=waiting_human&limit=50', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur');
        var runs = data.runs || [];
        if (status) status.textContent = runs.length ? runs.length + ' à traiter' : 'Rien en attente.';
        host.innerHTML = runs.map(function(run) {
          var reviewUrl = (cfg.reviewPageUrl || reviewBase) + '?runId=' + encodeURIComponent(run._id);
          var out = run.humanOutput || {};
          var from = out.from || '';
          var subject = out.subject || '';
          var line = from || subject
            ? esc(from || '—') + (subject ? ' — ' + esc(subject) : '')
            : esc(run.flowName || 'Agent');
          return (
            '<div class="agent-inbox-item">' +
            '<div><strong>' + line + '</strong><br>' +
            '<small class="text-muted">' + esc(run.flowName || '') +
            (run.startedAt ? ' · ' + esc(run.startedAt) : '') + '</small></div>' +
            '<a class="btn btn-primary btn-sm" href="' + esc(reviewUrl) + '">Traiter</a>' +
            '</div>'
          );
        }).join('');
      })
      .catch(function(e) {
        if (status) status.textContent = 'Erreur : ' + e.message;
      });
  }

  loadAgents();
  if (showInbox) loadInbox();
})();
