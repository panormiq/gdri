/**
 * Page run agent : démarre (async), poll la progression, modal de validation.
 */
(function() {
  var cfg = window.AGENT_RUN_APP || {};
  var API = (cfg.apiBase || '').replace(/\/$/, '') + '/agent-flows';
  var JWT = cfg.jwt || '';
  var flowId = cfg.flowId || null;
  var runId = cfg.runId || null;
  var pollTimer = null;
  var resumeToken = null;
  var modalOpen = false;

  var STATUS_LABEL = {
    pending: 'En attente',
    running: 'En cours',
    completed: 'OK',
    waiting_human: 'Validation',
    failed: 'Erreur',
    rejected: 'Rejeté',
    skipped: 'Non parcouru'
  };

  var RUN_LABEL = {
    running: 'Travail en cours…',
    waiting_human: 'En attente de validation',
    completed: 'Terminé',
    failed: 'Échec',
    rejected: 'Rejeté'
  };

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
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showMsg(text, kind) {
    var el = document.getElementById('runMsg');
    if (!el) return;
    el.style.display = text ? 'block' : 'none';
    el.className = 'alert small ' + (kind === 'ok' ? 'alert-success' : kind === 'err' ? 'alert-danger' : 'alert-info');
    el.textContent = text || '';
  }

  function setHourglass(on, label) {
    var box = document.getElementById('runHourglass');
    var lab = document.getElementById('runHourglassLabel');
    if (box) box.style.display = on ? '' : 'none';
    if (lab && label) lab.textContent = label;
  }

  function applyFlow(flow) {
    if (!flow) return;
    var title = document.getElementById('runTitle');
    var thumb = document.getElementById('runThumb');
    if (title) title.textContent = flow.name || 'Agent';
    if (thumb && flow.imageUrl) {
      thumb.src = flow.imageUrl;
      thumb.style.display = '';
    }
  }

  function ioCell(row) {
    if (row && row.cells && typeof row.cells === 'object') return row.cells;
    return row || {};
  }

  function renderIoTable(table) {
    var items = (table && table.items) || [];
    if (!items.length) {
      return '<p class="text-muted small" style="margin:4px 0 0;">Aucune ligne</p>';
    }
    var keys = ['from', 'subject', 'intention', 'confiance', 'resume', 'text', 'name', 'condition', 'actual'];
    var labels = {
      from: 'De', subject: 'Sujet', intention: 'Intention', confiance: 'Confiance',
      resume: 'Résumé', text: 'Texte', name: 'Nom', condition: 'Résultat', actual: 'Valeur'
    };
    var present = {};
    items.forEach(function(row) {
      var cells = ioCell(row);
      keys.forEach(function(k) {
        if (cells[k] != null && cells[k] !== '') present[k] = true;
      });
    });
    var cols = keys.filter(function(k) { return present[k]; });
    if (!cols.length) cols = ['text'];
    var html = '<div class="agent-run-io-wrap"><table class="agent-run-io-table"><thead><tr><th>#</th>';
    cols.forEach(function(k) { html += '<th>' + esc(labels[k] || k) + '</th>'; });
    html += '</tr></thead><tbody>';
    items.forEach(function(row, i) {
      var cells = ioCell(row);
      html += '<tr><td>' + (i + 1) + '</td>';
      cols.forEach(function(k) {
        var val = cells[k];
        html += '<td>' + esc(val == null || val === '' ? '—' : String(val)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderStepIo(it) {
    var preview = it && it.preview;
    if (!preview) return '';
    var html = '';
    if (preview.mapped) {
      var slots = Object.keys(preview.mapped);
      if (slots.length) {
        html += '<details class="agent-run-io"><summary>Entrées mappées</summary><ul>';
        slots.forEach(function(k) {
          var slot = preview.mapped[k] || {};
          html += '<li><code>' + esc(k) + '</code> ← ' + esc(slot.from || '') + ' = ' + esc(slot.value || '—') + '</li>';
        });
        html += '</ul></details>';
      }
    }
    var tables = Array.isArray(preview.tables) ? preview.tables : [];
    tables.forEach(function(table) {
      var n = table.itemsCount != null ? Number(table.itemsCount) : ((table.items && table.items.length) || 0);
      var role = table.role === 'out' ? 'Ce bloc' : 'Amont';
      html += '<details class="agent-run-io' + (table.role === 'out' ? ' is-out' : '') + '">';
      html += '<summary>' + esc(role + ' — ' + (table.name || table.slug || 'flux')) + ' · ' + n + ' ligne' + (n > 1 ? 's' : '') + '</summary>';
      html += renderIoTable(table);
      html += '</details>';
    });
    if (preview.debug) {
      html += '<details class="agent-run-io"><summary>Entrée — requête</summary><pre>' + esc(preview.debug.requestText || JSON.stringify(preview.debug.request || {}, null, 2) || '—') + '</pre></details>';
      html += '<details class="agent-run-io"><summary>Sortie — réponse</summary><pre>' + esc(preview.debug.responseText || JSON.stringify(preview.debug.response || {}, null, 2) || '—') + '</pre></details>';
    }
    return html;
  }

  function renderTimeline(items) {
    var host = document.getElementById('runTimeline');
    if (!host) return;
    if (!items || !items.length) {
      host.innerHTML = '<li class="text-muted small">Aucun bloc dans le flux.</li>';
      return;
    }
    host.innerHTML = items.map(function(it) {
      var st = it.status || 'pending';
      var mark = st === 'completed' ? '✓'
        : st === 'running' ? '<span class="agent-busy-spin" aria-hidden="true"></span>'
        : st === 'waiting_human' ? '!'
        : st === 'failed' || st === 'rejected' ? '×'
        : '·';
      return (
        '<li class="agent-run-step is-' + esc(st) + '">' +
        '<span class="agent-run-dot">' + mark + '</span>' +
        '<div><div class="agent-run-step-name">' + esc(it.name || it.brickId) + '</div>' +
        '<div class="agent-run-step-meta">' + esc(STATUS_LABEL[st] || st) +
        (it.error ? ' — ' + esc(it.error) : '') +
        '</div>' + renderStepIo(it) + '</div></li>'
      );
    }).join('');
  }

  function openModal(run, progress) {
    var modal = document.getElementById('runModal');
    if (!modal) return;
    var out = (progress && progress.humanOutput) || run.humanOutput || {};
    document.getElementById('runModalTitle').textContent = out.title || run.flowName || 'Validation';
    document.getElementById('runModalInstructions').textContent = out.instructions || 'Vérifiez puis validez ou rejetez.';
    var meta = [];
    if (out.from) meta.push('De : ' + out.from);
    if (out.subject) meta.push('Sujet : ' + out.subject);
    document.getElementById('runModalMeta').textContent = meta.join(' · ');
    var draft = document.getElementById('runModalDraft');
    if (out.draftHtml) draft.innerHTML = out.draftHtml;
    else draft.textContent = out.draftText || out.text || '';
    if (!draft.querySelector('.review-item-check') && (out.items_html || (out.items && out.items.length))) {
      var wrap = document.createElement('div');
      wrap.innerHTML = out.items_html || '';
      if (!wrap.innerHTML && Array.isArray(out.items)) {
        wrap.innerHTML = '<ul class="review-check-list">' + out.items.map(function(it, i) {
          return '<li><label><input type="checkbox" class="review-item-check" value="' +
            esc(it.id != null ? it.id : i) + '" checked> ' + esc(it.label || it.id || ('Élément ' + (i + 1))) +
            '</label></li>';
        }).join('') + '</ul>';
      }
      draft.appendChild(wrap);
    }
    var atts = Array.isArray(out.attachments) ? out.attachments : [];
    var attHost = document.getElementById('runModalAtts');
    attHost.innerHTML = atts.map(function(a) {
      var label = esc(a.filename || 'fichier');
      if (a.url) return '<li><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + label + '</a></li>';
      return '<li>' + label + '</li>';
    }).join('');
    var inbox = document.getElementById('runBtnInbox');
    if (inbox && run._id) {
      inbox.href = (cfg.reviewUrl || 'pages/agent-human-review.php') +
        (String(cfg.reviewUrl || '').indexOf('?') >= 0 ? '&' : '?') +
        'runId=' + encodeURIComponent(run._id);
    }
    resumeToken = run.resumeToken || null;
    modal.hidden = false;
    modalOpen = true;
  }

  function closeModal() {
    var modal = document.getElementById('runModal');
    if (modal) modal.hidden = true;
    modalOpen = false;
  }

  function renderDone(run) {
    var box = document.getElementById('runDone');
    if (!box) return;
    var ok = run.status === 'completed';
    box.style.display = '';
    box.className = 'agent-run-done ' + (ok ? 'is-ok' : 'is-err');
    box.textContent = ok
      ? 'Run terminé.'
      : (run.status === 'rejected'
        ? 'Run rejeté à la validation.'
        : ('Échec : ' + (run.error || run.status || 'erreur')));
  }

  function applyView(data) {
    var run = data.run || {};
    applyFlow(data.flow);
    renderTimeline((data.progress && data.progress.items) || []);
    var line = document.getElementById('runStatusLine');
    if (line) line.textContent = RUN_LABEL[run.status] || run.status || '';

    if (run.status === 'waiting_human') {
      setHourglass(false);
      stopPoll();
      openModal(run, data.progress);
      return;
    }
    if (modalOpen && run.status !== 'waiting_human') closeModal();

    if (run.status === 'running') {
      setHourglass(true, 'Travail en cours…');
      document.getElementById('runDone').style.display = 'none';
      return;
    }

    setHourglass(false);
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'rejected') {
      stopPoll();
      renderDone(run);
    }
  }

  function pollOnce() {
    if (!runId) return Promise.resolve();
    return fetch(API + '/runs/' + encodeURIComponent(runId), { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur run');
        applyView(data);
      });
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(function() {
      pollOnce().catch(function(e) { showMsg(e.message, 'err'); });
    }, 900);
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startRun() {
    if (!flowId) {
      showMsg('Aucun agent à lancer (flowId manquant).', 'err');
      setHourglass(false);
      return;
    }
    setHourglass(true, 'Démarrage…');
    fetch(API + '/flows/' + encodeURIComponent(flowId) + '/run', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ async: true })
    })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Échec du lancement');
        runId = data.run && data.run._id ? String(data.run._id) : null;
        if (!runId) throw new Error('Run créé sans identifiant');
        var u = new URL(window.location.href);
        u.searchParams.set('runId', runId);
        window.history.replaceState({}, '', u.pathname + u.search);
        applyView({ run: data.run, flow: data.flow, progress: data.progress || { items: [] } });
        startPoll();
        return pollOnce();
      })
      .catch(function(e) {
        setHourglass(false);
        showMsg(e.message, 'err');
      });
  }

  function collectAtelierValues() {
    var draft = document.getElementById('runModalDraft');
    if (!draft) return {};
    var form = draft.querySelector('.atelier-form') || draft;
    var values = {};
    form.querySelectorAll('[name]').forEach(function(el) {
      if (!el.name) return;
      if (el.type === 'checkbox') values[el.name] = !!el.checked;
      else values[el.name] = el.value;
    });
    return values;
  }

  function collectSelectedItems() {
    var draft = document.getElementById('runModalDraft');
    if (!draft) return [];
    return Array.prototype.slice.call(draft.querySelectorAll('.review-item-check, input[type="checkbox"]'))
      .filter(function(el) { return el.checked; })
      .map(function(el) { return el.value || el.getAttribute('data-index') || ''; })
      .filter(Boolean);
  }

  function decide(decision) {
    if (!runId) return;
    var btnA = document.getElementById('runBtnApprove');
    var btnR = document.getElementById('runBtnReject');
    if (btnA) btnA.disabled = true;
    if (btnR) btnR.disabled = true;
    fetch(API + '/runs/' + encodeURIComponent(runId) + '/resume', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        decision: decision,
        resumeToken: resumeToken,
        editedHtml: (document.getElementById('runModalDraft') || {}).innerHTML || '',
        selectedItems: collectSelectedItems(),
        values: collectAtelierValues()
      })
    })
      .then(parseJson)
      .then(function(data) {
        if (btnA) btnA.disabled = false;
        if (btnR) btnR.disabled = false;
        if (!data.success) throw new Error(data.message || 'Échec validation');
        closeModal();
        applyView(data);
        if (data.run && data.run.status === 'running') {
          setHourglass(true, 'Reprise du flux…');
          startPoll();
        }
      })
      .catch(function(e) {
        if (btnA) btnA.disabled = false;
        if (btnR) btnR.disabled = false;
        showMsg(e.message, 'err');
      });
  }

  document.getElementById('runBtnApprove').addEventListener('click', function() { decide('approve'); });
  document.getElementById('runBtnReject').addEventListener('click', function() { decide('reject'); });

  if (runId) {
    pollOnce()
      .then(function() {
        startPoll();
      })
      .catch(function(e) {
        showMsg(e.message, 'err');
        setHourglass(false);
      });
  } else {
    startRun();
  }
})();
