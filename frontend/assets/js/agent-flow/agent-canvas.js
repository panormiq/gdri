/**
 * Canvas agent-flow — infra workflow builder (mode agent uniquement).
 * Fichier : frontend/assets/js/agent-flow/agent-canvas.js
 */
(function() {
  var cfg = window.AGENT_FLOW_EDITOR || {};
  var API = (cfg.apiBase || '').replace(/\/$/, '') + '/agent-flows';
  var JWT = cfg.jwt || '';
  var flowId = cfg.flowId || null;
  var backUrl = cfg.backUrl || '#';

  var DEFAULT_OPS = {
    'data-backup': 'backup.run',
    'mail-out': 'emit.mail',
    'http-generic': 'emit.http'
  };

  var state = {
    flowId: flowId,
    name: 'Nouvel agent',
    description: '',
    enabled: true,
    bricks: [],
    bricksById: {},
    nodes: [],
    selectedNodeId: null
  };

  function headers() {
    return { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' };
  }

  function parseJson(res) {
    var ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') === -1) {
      return res.text().then(function() { throw new Error('Réponse non-JSON (' + res.status + ')'); });
    }
    return res.json();
  }

  function createId() {
    return 'node-' + Math.random().toString(36).slice(2, 9);
  }

  function getBrick(brickId) {
    return state.bricksById[brickId] || null;
  }

  function iconUrl(brick) {
    if (!brick || !brick.canvas || !brick.canvas.iconUrl) return null;
    if (brick.canvas.iconUrl.indexOf('http') === 0) return brick.canvas.iconUrl;
    var base = (cfg.apiBase || '').replace(/\/api\/?$/, '');
    return base + brick.canvas.iconUrl;
  }

  function addNodeFromBrick(brick, x, y) {
    if (brick.kind === 'trigger' && state.nodes.some(function(n) { return n.kind === 'trigger'; })) {
      alert('Un seul déclencheur par agent.');
      return null;
    }
    var node = {
      id: createId(),
      brickId: brick.id,
      kind: brick.kind || 'action',
      operation: brick.kind === 'action' ? (DEFAULT_OPS[brick.id] || null) : null,
      name: brick.name,
      config: defaultConfigForBrick(brick),
      x: x || (120 + state.nodes.length * 24),
      y: y || (80 + state.nodes.length * 110),
      nextId: null
    };
    state.nodes.push(node);
    chainNodesLinear();
    if (!state.selectedNodeId) state.selectedNodeId = node.id;
    render();
    return node;
  }

  function defaultConfigForBrick(brick) {
    if (brick.id === 'cron-trigger') {
      return { preset: 'weekly', hour: 3, minute: 0, dayOfWeek: 0 };
    }
    if (brick.id === 'data-backup') {
      return { scope: 'full', collections: [] };
    }
    if (brick.id === 'mail-out') {
      return {
        accountRef: '',
        to: '',
        subject: 'Sauvegarde GDRI {{date}}',
        body: 'Veuillez trouver ci-joint la sauvegarde automatique.',
        attachPrevious: true
      };
    }
    if (brick.id === 'http-generic') {
      return {
        emitUrl: '',
        emitMethod: 'POST',
        bearerToken: '',
        includeFileBase64: false,
        includeMetadata: true
      };
    }
    return {};
  }

  function chainNodesLinear() {
    var trigger = state.nodes.find(function(n) { return n.kind === 'trigger'; });
    var actions = state.nodes.filter(function(n) { return n.kind !== 'trigger'; })
      .sort(function(a, b) { return a.y - b.y; });
    state.nodes.forEach(function(n) { n.nextId = null; });
    var prev = trigger || null;
    actions.forEach(function(action) {
      if (prev) prev.nextId = action.id;
      prev = action;
    });
  }

  function buildPayload() {
    var triggerNode = state.nodes.find(function(n) { return n.kind === 'trigger'; });
    var trigger = triggerNode
      ? { brickId: triggerNode.brickId, config: triggerNode.config || {} }
      : { brickId: 'manual-trigger', config: {} };

    var steps = [];
    var cursor = triggerNode;
    var guard = 0;
    while (cursor && cursor.nextId && guard < 50) {
      guard++;
      var next = state.nodes.find(function(n) { return n.id === cursor.nextId; });
      if (!next) break;
      steps.push({
        id: next.id,
        brickId: next.brickId,
        operation: next.operation || DEFAULT_OPS[next.brickId] || null,
        config: next.config || {}
      });
      cursor = next;
    }

    return {
      name: state.name,
      description: state.description,
      enabled: state.enabled,
      trigger: trigger,
      steps: steps,
      canvas: {
        nodes: state.nodes.map(function(n) {
          return {
            id: n.id,
            brickId: n.brickId,
            kind: n.kind,
            operation: n.operation,
            name: n.name,
            config: n.config,
            x: n.x,
            y: n.y,
            nextId: n.nextId
          };
        })
      }
    };
  }

  function loadFromFlow(flow) {
    state.flowId = String(flow._id || '');
    state.name = flow.name || 'Agent';
    state.description = flow.description || '';
    state.enabled = flow.enabled !== false;
    document.getElementById('agentName').value = state.name;
    document.getElementById('agentEnabled').checked = state.enabled;

    if (flow.canvas && Array.isArray(flow.canvas.nodes) && flow.canvas.nodes.length) {
      state.nodes = flow.canvas.nodes.map(function(n) {
        var brick = getBrick(n.brickId);
        return {
          id: n.id || createId(),
          brickId: n.brickId,
          kind: n.kind || (brick && brick.kind) || 'action',
          operation: n.operation || DEFAULT_OPS[n.brickId] || null,
          name: n.name || (brick && brick.name) || n.brickId,
          config: n.config || {},
          x: n.x || 120,
          y: n.y || 80,
          nextId: n.nextId || null
        };
      });
    } else {
      state.nodes = [];
      var trigger = flow.trigger || { brickId: 'manual-trigger', config: {} };
      var tBrick = getBrick(trigger.brickId) || { id: trigger.brickId, name: trigger.brickId, kind: 'trigger' };
      state.nodes.push({
        id: createId(),
        brickId: trigger.brickId,
        kind: 'trigger',
        operation: null,
        name: tBrick.name,
        config: trigger.config || {},
        x: 120,
        y: 80,
        nextId: null
      });
      var y = 200;
      (flow.steps || []).forEach(function(step) {
        var b = getBrick(step.brickId) || { id: step.brickId, name: step.brickId, kind: 'action' };
        state.nodes.push({
          id: step.id || createId(),
          brickId: step.brickId,
          kind: 'action',
          operation: step.operation || DEFAULT_OPS[step.brickId] || null,
          name: b.name,
          config: step.config || {},
          x: 120,
          y: y,
          nextId: null
        });
        y += 120;
      });
      chainNodesLinear();
    }
    state.selectedNodeId = state.nodes[0] ? state.nodes[0].id : null;
    render();
  }

  function renderPalette() {
    var host = document.getElementById('agentPalette');
    if (!host) return;
    var triggers = state.bricks.filter(function(b) { return b.kind === 'trigger'; });
    var actions = state.bricks.filter(function(b) { return b.kind === 'action'; });

    function brickHtml(brick) {
      var url = iconUrl(brick);
      var icon = url
        ? '<img src="' + url + '" alt="">'
        : '<span class="emoji">' + ((brick.canvas && brick.canvas.iconEmoji) || '🔧') + '</span>';
      return '<div class="agent-brick-item" draggable="true" data-brick-id="' + brick.id + '">'
        + icon
        + '<div class="meta"><strong>' + brick.name + '</strong><small>' + (brick.description || '') + '</small></div>'
        + '</div>';
    }

    host.innerHTML = ''
      + '<div class="agent-palette-group"><h3>Déclencheurs</h3>' + triggers.map(brickHtml).join('') + '</div>'
      + '<div class="agent-palette-group"><h3>Actions</h3>' + actions.map(brickHtml).join('') + '</div>';

    host.querySelectorAll('.agent-brick-item').forEach(function(el) {
      el.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/brick-id', el.getAttribute('data-brick-id'));
      });
      el.addEventListener('click', function() {
        var brick = getBrick(el.getAttribute('data-brick-id'));
        if (brick) addNodeFromBrick(brick);
      });
    });
  }

  function renderConnections(svg) {
    svg.innerHTML = '';
    state.nodes.forEach(function(node) {
      if (!node.nextId) return;
      var target = state.nodes.find(function(n) { return n.id === node.nextId; });
      if (!target) return;
      var x1 = node.x + 100;
      var y1 = node.y + 72;
      var x2 = target.x + 100;
      var y2 = target.y;
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var midY = (y1 + y2) / 2;
      path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2);
      path.setAttribute('stroke', '#0e9cef');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.8');
      svg.appendChild(path);
    });
  }

  function renderCanvas() {
    var canvas = document.getElementById('agentCanvas');
    if (!canvas) return;
    var svg = canvas.querySelector('svg.connections');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('connections');
      canvas.appendChild(svg);
    }
    canvas.querySelectorAll('.agent-node').forEach(function(n) { n.remove(); });

    state.nodes.forEach(function(node) {
      var brick = getBrick(node.brickId) || {};
      var el = document.createElement('div');
      el.className = 'agent-node kind-' + (node.kind || 'action');
      if (node.id === state.selectedNodeId) el.classList.add('selected');
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';
      el.dataset.id = node.id;

      var url = iconUrl(brick);
      var icon = url
        ? '<img src="' + url + '" alt="">'
        : '<span class="emoji">' + ((brick.canvas && brick.canvas.iconEmoji) || '🔧') + '</span>';

      el.innerHTML = '<div class="agent-node-head">' + icon
        + '<div><div class="agent-node-title">' + (node.name || brick.name || node.brickId) + '</div>'
        + '<div class="agent-node-kind">' + (node.kind === 'trigger' ? 'Déclencheur' : 'Action') + '</div></div></div>';

      el.addEventListener('click', function(e) {
        e.stopPropagation();
        state.selectedNodeId = node.id;
        renderConfig();
        renderCanvas();
      });

      el.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        var startX = e.clientX;
        var startY = e.clientY;
        var ox = node.x;
        var oy = node.y;
        el.setPointerCapture(e.pointerId);
        function onMove(ev) {
          node.x = ox + (ev.clientX - startX);
          node.y = oy + (ev.clientY - startY);
          el.style.left = node.x + 'px';
          el.style.top = node.y + 'px';
          renderConnections(svg);
        }
        function onUp() {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          chainNodesLinear();
          renderConnections(svg);
        }
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
      });

      canvas.appendChild(el);
    });

    renderConnections(svg);
  }

  function fieldHtml(key, schema, value) {
    var title = (schema && schema.title) || key;
    if (schema && schema.type === 'boolean') {
      var checked = value !== false && value !== 'false' ? ' checked' : '';
      return '<div class="form-group"><label><input type="checkbox" data-key="' + key + '" data-type="boolean"' + checked + '> ' + title + '</label></div>';
    }
    if (key === 'body' || (schema && schema.format === 'textarea')) {
      return '<div class="form-group"><label>' + title + '</label><textarea rows="4" data-key="' + key + '">' + (value != null ? value : '') + '</textarea></div>';
    }
    if (schema && schema.enum) {
      return '<div class="form-group"><label>' + title + '</label><select data-key="' + key + '">'
        + schema.enum.map(function(opt) {
          return '<option value="' + opt + '"' + (String(value) === String(opt) ? ' selected' : '') + '>' + opt + '</option>';
        }).join('') + '</select></div>';
    }
    if (schema && schema.type === 'number') {
      return '<div class="form-group"><label>' + title + '</label><input type="number" data-key="' + key + '" value="' + (value != null ? value : (schema.default || '')) + '"></div>';
    }
    var inputType = (schema && schema.format === 'email') ? 'email' : ((schema && schema.format === 'uri') ? 'url' : 'text');
    return '<div class="form-group"><label>' + title + '</label><input type="' + inputType + '" data-key="' + key + '" value="' + (value != null ? value : '') + '"></div>';
  }

  function renderConfig() {
    var host = document.getElementById('agentConfig');
    if (!host) return;
    var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    if (!node) {
      host.innerHTML = '<p class="empty">Sélectionnez un bloc sur le canvas.</p>';
      return;
    }
    var brick = getBrick(node.brickId) || {};
    var schema = null;
    if (node.kind === 'trigger' && brick.trigger && brick.trigger.configSchema) {
      schema = brick.trigger.configSchema;
    } else if (brick.operations) {
      var opKey = node.operation || DEFAULT_OPS[node.brickId];
      var op = opKey && brick.operations[opKey];
      if (op && op.configSchema) schema = op.configSchema;
    }

    var html = '<h3>' + (node.name || brick.name) + '</h3>';
    html += '<p class="empty" style="margin-bottom:12px;">' + (brick.description || '') + '</p>';

    if (schema && schema.properties) {
      Object.keys(schema.properties).forEach(function(key) {
        var prop = schema.properties[key];
        var val = node.config[key];
        if (val === undefined && prop.default !== undefined) val = prop.default;
        html += fieldHtml(key, prop, val);
      });
    } else {
      html += '<p class="empty">Aucun paramètre pour ce bloc.</p>';
    }

    html += '<button type="button" class="btn-agent-ghost btn-agent-danger" id="btnDeleteNode" style="margin-top:12px;">Supprimer ce bloc</button>';
    host.innerHTML = html;

    host.querySelectorAll('[data-key]').forEach(function(input) {
      input.addEventListener('change', function() {
        var key = input.getAttribute('data-key');
        if (input.getAttribute('data-type') === 'boolean') {
          node.config[key] = input.checked;
          return;
        }
        var val = input.value;
        if (input.type === 'number') val = parseInt(val, 10);
        node.config[key] = val;
      });
    });

    var del = document.getElementById('btnDeleteNode');
    if (del) {
      del.addEventListener('click', function() {
        state.nodes = state.nodes.filter(function(n) { return n.id !== node.id; });
        state.nodes.forEach(function(n) { if (n.nextId === node.id) n.nextId = null; });
        chainNodesLinear();
        state.selectedNodeId = state.nodes[0] ? state.nodes[0].id : null;
        render();
      });
    }
  }

  function render() {
    renderPalette();
    renderCanvas();
    renderConfig();
  }

  function saveFlow() {
    state.name = document.getElementById('agentName').value.trim() || 'Nouvel agent';
    state.enabled = document.getElementById('agentEnabled').checked;
    var payload = buildPayload();
    var url = state.flowId ? (API + '/flows/' + state.flowId) : (API + '/flows');
    var method = state.flowId ? 'PUT' : 'POST';

    return fetch(url, { method: method, headers: headers(), body: JSON.stringify(payload) })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur sauvegarde');
        if (!state.flowId && data.flow && data.flow._id) {
          state.flowId = String(data.flow._id);
          var newUrl = window.location.pathname + '?flowId=' + encodeURIComponent(state.flowId);
          window.history.replaceState({}, '', newUrl);
        }
        alert('Agent enregistré.');
      });
  }

  function runFlow() {
    if (!state.flowId) {
      return saveFlow().then(function() {
        if (!state.flowId) throw new Error('Enregistrez l\'agent avant de le lancer.');
        return fetch(API + '/flows/' + state.flowId + '/run', { method: 'POST', headers: headers(), body: '{}' });
      }).then(parseJson);
    }
    return fetch(API + '/flows/' + state.flowId + '/run', { method: 'POST', headers: headers(), body: '{}' })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message);
        alert('Agent lancé.');
      });
  }

  function initCanvasDnD() {
    var canvas = document.getElementById('agentCanvas');
    if (!canvas) return;
    canvas.addEventListener('dragover', function(e) { e.preventDefault(); });
    canvas.addEventListener('drop', function(e) {
      e.preventDefault();
      var brickId = e.dataTransfer.getData('text/brick-id');
      var brick = getBrick(brickId);
      if (!brick) return;
      var rect = canvas.getBoundingClientRect();
      addNodeFromBrick(brick, e.clientX - rect.left - 100, e.clientY - rect.top - 36);
    });
    canvas.addEventListener('click', function() {
      state.selectedNodeId = null;
      renderConfig();
      renderCanvas();
    });
  }

  function boot() {
    fetch(API + '/bricks', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message);
        state.bricks = data.bricks || [];
        state.bricksById = {};
        state.bricks.forEach(function(b) { state.bricksById[b.id] = b; });

        if (state.flowId) {
          return fetch(API + '/flows/' + state.flowId, { headers: headers() })
            .then(parseJson)
            .then(function(fd) {
              if (!fd.success) throw new Error(fd.message);
              loadFromFlow(fd.flow);
            });
        }

        addNodeFromBrick(getBrick('cron-trigger') || state.bricks.find(function(b) { return b.kind === 'trigger'; }));
        addNodeFromBrick(getBrick('data-backup') || state.bricks.find(function(b) { return b.kind === 'action'; }), 120, 220);
        render();
      })
      .catch(function(e) {
        alert('Erreur initialisation : ' + e.message);
      });

    document.getElementById('btnSaveAgent').addEventListener('click', function() {
      saveFlow().catch(function(e) { alert(e.message); });
    });
    document.getElementById('btnRunAgent').addEventListener('click', function() {
      runFlow().catch(function(e) { alert(e.message); });
    });

    initCanvasDnD();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
