/**
 * Liste / cartes agents (liste unique).
 * Config via window.AGENTS_LIST_APP
 */
(function() {
  var cfg = window.AGENTS_LIST_APP || {};
  var API = (cfg.apiBase || '').replace(/\/$/, '') + '/agent-flows';
  var JWT = cfg.jwt || '';
  var mode = cfg.mode || null; // optional filter automatic | assisted | null
  var editorBase = cfg.editorBase || '#';
  var reviewBase = cfg.reviewBase || 'pages/agent-human-review.php';
  var runPage = cfg.runPageUrl || 'pages/agent-run.php';
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
    var list = Array.isArray(flow.triggers) && flow.triggers.length
      ? flow.triggers
      : (flow.trigger ? [flow.trigger] : []);
    var labels = [];
    var seen = {};
    function add(lab) {
      if (!lab || seen[lab]) return;
      seen[lab] = true;
      labels.push(lab);
    }
    list.forEach(function(t) {
      if (!t) return;
      if (t.brickId === 'trigger') {
        var m = (t.config && t.config.mode) || 'button';
        if (m === 'cron') add('Planifié');
        else if (m === 'webhook' || m === 'http') add('Webhook');
        else add('Manuel');
        return;
      }
      if (t.brickId === 'cron-trigger') add('Planifié');
      else if (t.brickId === 'manual-trigger') add('Manuel');
      else if (t.brickId === 'mail-in') add('Mail entrant');
      else if (t.brickId === 'facebook') add('Facebook');
      else add(t.brickId || '');
    });
    return labels.join(' + ') || '—';
  }

  function modeBadge(flow) {
    var m = flow.effectiveInteractionMode || flow.derivedInteractionMode || 'automatic';
    if (m === 'assisted') {
      return '<span class="agent-card-badge is-assisted">Validation humaine</span>';
    }
    return '<span class="agent-card-badge">Automatique</span>';
  }

  function staleBadge(flow) {
    if (!flow || !flow.staleCollections) return '';
    return '<span class="agent-card-badge is-stale">Liste à actualiser</span>';
  }

  function coverHtml(flow) {
    if (flow.imageUrl) {
      return '<div class="agent-card-cover"><img src="' + esc(flow.imageUrl) + '" alt="">' + modeBadge(flow) + staleBadge(flow) + '</div>';
    }
    return '<div class="agent-card-cover">' + modeBadge(flow) + staleBadge(flow) + '</div>';
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
    var runLabel = (flow.app && flow.app.buttonLabel) ? flow.app.buttonLabel : 'Lancer';
    var actions = '<button type="button" class="btn btn-success btn-sm agent-run" data-id="' + esc(id) + '">' + esc(runLabel) + '</button>';
    if (manageThis) {
      actions =
        '<a class="btn btn-outline btn-sm" href="' + esc(editorHref(id)) + '">Éditer</a> ' +
        actions +
        ' <button type="button" class="btn btn-outline btn-sm btn-danger agent-del" data-id="' + esc(id) + '">Suppr.</button>';
    }
    return (
      '<article class="agent-card' + (flow.staleCollections ? ' is-stale' : '') + '" data-id="' + esc(id) + '">' +
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
        var id = btn.getAttribute('data-id');
        var space = cfg.space || 'user';
        var href = runPage + (runPage.indexOf('?') >= 0 ? '&' : '?') +
          'flowId=' + encodeURIComponent(id || '') +
          '&space=' + encodeURIComponent(space);
        window.location.href = href;
      });
    });
    root.querySelectorAll('.agent-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!confirm('Supprimer cet agent ?')) return;
        fetch(API + '/flows/' + btn.getAttribute('data-id'), {
          method: 'DELETE',
          headers: headers()
        })
          .then(parseJson)
          .then(function(data) {
            if (!data.success) throw new Error(data.message || 'Échec');
            loadAgents();
          })
          .catch(function(e) {
            alert(e.message);
          });
      });
    });
  }

  function loadAgents() {
    var status = document.getElementById('agentsStatus');
    var cards = document.getElementById('agentsCards');
    if (!cards) return;
    if (status) status.textContent = 'Chargement…';
    var q = mode ? ('?interactionMode=' + encodeURIComponent(mode)) : '';
    fetch(API + '/flows' + q, { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur');
        var flows = data.flows || [];
        if (status) {
          status.textContent = flows.length
            ? flows.length + ' agent' + (flows.length > 1 ? 's' : '')
            : 'Aucun agent pour le moment.';
        }
        cards.innerHTML = flows.map(cardHtml).join('');
        bindCardActions(cards);
      })
      .catch(function(e) {
        if (status) status.textContent = e.message;
      });
  }

  function loadInbox() {
    if (!showInbox) return;
    var host = document.getElementById('agentsInbox');
    var status = document.getElementById('inboxStatus');
    if (!host) return;
    if (status) status.textContent = 'Chargement…';
    fetch(API + '/runs?status=waiting_human&limit=30', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur');
        var runs = data.runs || [];
        if (status) {
          status.textContent = runs.length
            ? runs.length + ' en attente'
            : 'Rien à traiter.';
        }
        host.innerHTML = runs
          .map(function(r) {
            var id = r._id || '';
            var title = (r.humanOutput && r.humanOutput.title) || r.flowName || 'Revue';
            var href = reviewBase + (reviewBase.indexOf('?') >= 0 ? '&' : '?') + 'runId=' + encodeURIComponent(id);
            return (
              '<a class="agent-inbox-item" href="' +
              esc(href) +
              '"><strong>' +
              esc(title) +
              '</strong><span>' +
              esc(r.flowName || '') +
              '</span></a>'
            );
          })
          .join('');
      })
      .catch(function(e) {
        if (status) status.textContent = e.message;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      loadAgents();
      loadInbox();
    });
  } else {
    loadAgents();
    loadInbox();
  }
})();
