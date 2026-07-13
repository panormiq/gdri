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

  var NODE_WIDTH = 200;
  var PORT_STEM = 18;
  var ROUTE_GAP = 22;

  var state = {
    flowId: flowId,
    name: 'Nouvel agent',
    description: '',
    enabled: true,
    bricks: [],
    bricksById: {},
    nodes: [],
    selectedNodeId: null,
    linking: null,
    paletteDragActive: false,
    suppressAutoConnectUntil: 0
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

  /** Migration anciens flows sans canvas.nextId — enchaîne trigger → steps dans l'ordre */
  function chainLegacySteps(triggerNode, actionNodes) {
    if (!triggerNode) return;
    var prev = triggerNode;
    actionNodes.forEach(function(action) {
      prev.nextId = action.id;
      prev = action;
    });
  }

  function getIncomingNode(targetId) {
    return state.nodes.find(function(n) { return n.nextId === targetId; }) || null;
  }

  function connectNodes(sourceId, targetId) {
    if (Date.now() < state.suppressAutoConnectUntil) return false;
    if (!sourceId || !targetId || sourceId === targetId) return false;
    var source = state.nodes.find(function(n) { return n.id === sourceId; });
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (!source || !target) return false;
    if (target.kind === 'trigger') return false;

    state.nodes.forEach(function(n) {
      if (n.nextId === targetId) n.nextId = null;
    });
    source.nextId = targetId;
    return true;
  }

  function disconnectOutgoing(nodeId) {
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    if (node) node.nextId = null;
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
      var triggerNode = state.nodes.find(function(n) { return n.kind === 'trigger'; });
      var actionNodes = state.nodes.filter(function(n) { return n.kind !== 'trigger'; });
      chainLegacySteps(triggerNode, actionNodes);
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
        state.paletteDragActive = true;
        cancelLinkDrag();
        e.dataTransfer.setData('text/brick-id', el.getAttribute('data-brick-id'));
      });
      el.addEventListener('dragend', function() {
        state.paletteDragActive = false;
        state.suppressAutoConnectUntil = Date.now() + 300;
      });
      el.addEventListener('click', function() {
        if (state.paletteDragActive) return;
        var brick = getBrick(el.getAttribute('data-brick-id'));
        if (brick) addNodeFromBrick(brick);
      });
    });
  }

  function getNodeRect(nodeId, canvas) {
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    if (!node) return null;
    var el = canvas.querySelector('.agent-node[data-id="' + nodeId + '"]');
    var h = el ? el.offsetHeight : 72;
    var w = NODE_WIDTH;
    var cx = node.x + w / 2;
    var cy = node.y + h / 2;
    return {
      top: { x: cx, y: node.y, side: 'top' },
      bottom: { x: cx, y: node.y + h, side: 'bottom' },
      left: { x: node.x, y: cy, side: 'left' },
      right: { x: node.x + w, y: cy, side: 'right' },
      center: { x: cx, y: cy }
    };
  }

  /** Choisit les ports selon la position relative (haut/bas ou gauche/droite) */
  function pickConnectionPorts(sourceId, targetId, canvas) {
    var s = getNodeRect(sourceId, canvas);
    var t = getNodeRect(targetId, canvas);
    if (!s || !t) return null;

    var dx = t.center.x - s.center.x;
    var dy = t.center.y - s.center.y;

    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy >= 0) return { out: s.bottom, in: t.top };
      return { out: s.top, in: t.bottom };
    }
    if (dx >= 0) return { out: s.right, in: t.left };
    return { out: s.left, in: t.right };
  }

  function getNodeBounds(nodeId, canvas) {
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    if (!node) return null;
    var el = canvas.querySelector('.agent-node[data-id="' + nodeId + '"]');
    var h = el ? el.offsetHeight : 72;
    return {
      left: node.x,
      right: node.x + NODE_WIDTH,
      top: node.y,
      bottom: node.y + h
    };
  }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  /** Blocs traversés par le corridor source → cible (hors extrémités) */
  function getObstaclesBetween(sourceId, targetId, canvas) {
    var srcB = getNodeBounds(sourceId, canvas);
    var tgtB = getNodeBounds(targetId, canvas);
    if (!srcB || !tgtB) return [];

    var pad = 6;
    var corridor = {
      left: Math.min(srcB.left, tgtB.left) - pad,
      right: Math.max(srcB.right, tgtB.right) + pad,
      top: Math.min(srcB.top, tgtB.top) - pad,
      bottom: Math.max(srcB.bottom, tgtB.bottom) + pad
    };

    return state.nodes
      .filter(function(n) { return n.id !== sourceId && n.id !== targetId; })
      .map(function(n) { return getNodeBounds(n.id, canvas); })
      .filter(function(b) { return b && rectsOverlap(corridor, b); });
  }

  /** Passe sous (ou au-dessus) les obstacles pour ne traverser aucun bloc */
  function computeRouteChannel(obstacles, srcB, tgtB, from, to) {
    var outSide = from.side;
    var inSide = to.side;

    if (outSide === 'top' && inSide === 'bottom') {
      var above = Math.min(srcB.top, tgtB.top);
      obstacles.forEach(function(o) { above = Math.min(above, o.top); });
      return above - ROUTE_GAP;
    }

    var below = Math.max(srcB.bottom, tgtB.bottom);
    obstacles.forEach(function(o) { below = Math.max(below, o.bottom); });
    return below + ROUTE_GAP;
  }

  /**
   * Courbe de Bézier — tangente perpendiculaire au bord du port
   * (vertical pour haut/bas, horizontal pour gauche/droite)
   */
  function buildCurvePath(from, to) {
    var x1 = from.x;
    var y1 = from.y;
    var x2 = to.x;
    var y2 = to.y;
    var outSide = from.side || 'bottom';
    var inSide = to.side || 'top';

    if (outSide === 'bottom' || outSide === 'top') {
      var midY = y1 + (y2 - y1) / 2;
      if (outSide === 'bottom' && inSide === 'top') {
        midY = Math.max(y1 + PORT_STEM, Math.min(y2 - PORT_STEM, midY));
      } else {
        midY = Math.min(y1 - PORT_STEM, Math.max(y2 + PORT_STEM, midY));
      }
      return 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2;
    }

    var midX = x1 + (x2 - x1) / 2;
    if (outSide === 'right' && inSide === 'left') {
      midX = Math.max(x1 + PORT_STEM, Math.min(x2 - PORT_STEM, midX));
    } else {
      midX = Math.min(x1 - PORT_STEM, Math.max(x2 + PORT_STEM, midX));
    }
    return 'M' + x1 + ' ' + y1 + ' C ' + midX + ' ' + y1 + ', ' + midX + ' ' + y2 + ', ' + x2 + ' ' + y2;
  }

  /**
   * Contourne les obstacles via un couloir horizontal sous les blocs
   * (tiges perpendiculaires + tronçon courbe le long du couloir)
   */
  function buildChannelPath(from, to, channelY) {
    var x1 = from.x;
    var y1 = from.y;
    var x2 = to.x;
    var y2 = to.y;
    var outSide = from.side;
    var inSide = to.side;
    var s = PORT_STEM;
    var midX = (x1 + x2) / 2;

    if (outSide === 'bottom' && inSide === 'top') {
      return 'M' + x1 + ' ' + y1
        + ' C ' + x1 + ' ' + (y1 + s) + ', ' + x1 + ' ' + (channelY - s) + ', ' + x1 + ' ' + channelY
        + ' C ' + midX + ' ' + channelY + ', ' + midX + ' ' + channelY + ', ' + x2 + ' ' + channelY
        + ' C ' + x2 + ' ' + (channelY + s) + ', ' + x2 + ' ' + (y2 - s) + ', ' + x2 + ' ' + y2;
    }

    if (outSide === 'top' && inSide === 'bottom') {
      return 'M' + x1 + ' ' + y1
        + ' C ' + x1 + ' ' + (y1 - s) + ', ' + x1 + ' ' + (channelY + s) + ', ' + x1 + ' ' + channelY
        + ' C ' + midX + ' ' + channelY + ', ' + midX + ' ' + channelY + ', ' + x2 + ' ' + channelY
        + ' C ' + x2 + ' ' + (channelY - s) + ', ' + x2 + ' ' + (y2 + s) + ', ' + x2 + ' ' + y2;
    }

    if (outSide === 'right' && inSide === 'left') {
      return 'M' + x1 + ' ' + y1
        + ' C ' + (x1 + s) + ' ' + y1 + ', ' + (x1 + s) + ' ' + (y1 + s) + ', ' + (x1 + s) + ' ' + channelY
        + ' C ' + midX + ' ' + channelY + ', ' + midX + ' ' + channelY + ', ' + (x2 - s) + ' ' + channelY
        + ' C ' + (x2 - s) + ' ' + channelY + ', ' + (x2 - s) + ' ' + y2 + ', ' + x2 + ' ' + y2;
    }

    if (outSide === 'left' && inSide === 'right') {
      return 'M' + x1 + ' ' + y1
        + ' C ' + (x1 - s) + ' ' + y1 + ', ' + (x1 - s) + ' ' + (y1 + s) + ', ' + (x1 - s) + ' ' + channelY
        + ' C ' + midX + ' ' + channelY + ', ' + midX + ' ' + channelY + ', ' + (x2 + s) + ' ' + channelY
        + ' C ' + (x2 + s) + ' ' + channelY + ', ' + (x2 + s) + ' ' + y2 + ', ' + x2 + ' ' + y2;
    }

    return buildCurvePath(from, to);
  }

  function buildConnectionPath(sourceId, targetId, canvas) {
    var ports = pickConnectionPorts(sourceId, targetId, canvas);
    if (!ports) return null;

    var obstacles = getObstaclesBetween(sourceId, targetId, canvas);
    if (!obstacles.length) {
      return { d: buildCurvePath(ports.out, ports.in), routed: false };
    }

    var srcB = getNodeBounds(sourceId, canvas);
    var tgtB = getNodeBounds(targetId, canvas);
    var channelY = computeRouteChannel(obstacles, srcB, tgtB, ports.out, ports.in);
    return { d: buildChannelPath(ports.out, ports.in, channelY), routed: true, channelY: channelY };
  }

  function renderConnections(svg, canvas) {
    svg.innerHTML = '';
    state.nodes.forEach(function(node) {
      if (!node.nextId) return;
      var target = state.nodes.find(function(n) { return n.id === node.nextId; });
      if (!target) return;
      var ports = pickConnectionPorts(node.id, target.id, canvas);
      if (!ports) return;

      var route = buildConnectionPath(node.id, target.id, canvas);
      if (!route) return;

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', route.d);
      path.setAttribute('class', route.routed ? 'connection-routed' : 'connection-direct');
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
    var emptyHint = canvas.querySelector('.agent-canvas-empty');
    if (!state.nodes.length) {
      if (!emptyHint) {
        emptyHint = document.createElement('div');
        emptyHint.className = 'agent-canvas-empty';
        emptyHint.textContent = 'Glissez des blocs depuis la palette. Aucun lien automatique.';
        canvas.appendChild(emptyHint);
      }
      svg.innerHTML = '';
      return;
    }
    if (emptyHint) emptyHint.remove();

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

      el.innerHTML = '<span class="agent-node-port agent-node-port--top agent-node-port--in" data-port="top" aria-hidden="true"></span>'
        + '<span class="agent-node-port agent-node-port--left agent-node-port--in" data-port="left" aria-hidden="true"></span>'
        + '<div class="agent-node-head">' + icon
        + '<div><div class="agent-node-title">' + (node.name || brick.name || node.brickId) + '</div>'
        + '<div class="agent-node-kind">' + (node.kind === 'trigger' ? 'Déclencheur' : 'Action') + '</div></div></div>'
        + '<span class="agent-node-port agent-node-port--right agent-node-port--out" data-port="right" aria-hidden="true"></span>'
        + '<span class="agent-node-port agent-node-port--bottom agent-node-port--out" data-port="bottom" aria-hidden="true"></span>';

      el.addEventListener('click', function(e) {
        e.stopPropagation();
        state.selectedNodeId = node.id;
        renderConfig();
        renderCanvas();
      });

      el.querySelectorAll('.agent-node-port--out').forEach(function(port) {
        port.addEventListener('pointerdown', function(e) {
          if (e.button !== 0) return;
          if (state.paletteDragActive) return;
          e.stopPropagation();
          e.preventDefault();
          startLinkDrag(e, node.id, port.getAttribute('data-port'), canvas, svg);
        });
      });

      el.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.agent-node-port')) return;
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
          renderConnections(svg, canvas);
        }
        function onUp() {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          renderConnections(svg, canvas);
        }
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
      });

      canvas.appendChild(el);
    });

    renderConnections(svg, canvas);
  }

  function cancelLinkDrag() {
    if (!state.linking) return;
    if (state.linking.preview && state.linking.preview.parentNode) {
      state.linking.preview.parentNode.removeChild(state.linking.preview);
    }
    if (state.linking.canvas) {
      state.linking.canvas.classList.remove('is-linking');
    }
    document.removeEventListener('pointermove', state.linking.onMove);
    document.removeEventListener('pointerup', state.linking.onFinish);
    document.removeEventListener('pointercancel', state.linking.onFinish);
    state.linking = null;
  }

  function startLinkDrag(e, sourceId, side, canvas, svg) {
    cancelLinkDrag();

    var rect = canvas.getBoundingClientRect();
    var preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    preview.setAttribute('class', 'connection-preview');
    svg.appendChild(preview);
    canvas.classList.add('is-linking');

    var startClientX = e.clientX;
    var startClientY = e.clientY;
    var moved = false;

    function portPoint() {
      var nr = getNodeRect(sourceId, canvas);
      return nr ? nr[side] : null;
    }

    function updatePreview(ev) {
      if (Math.abs(ev.clientX - startClientX) > 4 || Math.abs(ev.clientY - startClientY) > 4) {
        moved = true;
      }
      var from = portPoint();
      if (!from) return;
      var to = {
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        side: side === 'bottom' ? 'top' : 'left'
      };
      preview.setAttribute('d', buildCurvePath(from, to));
    }

    function finishLink(ev) {
      cancelLinkDrag();

      if (!moved) return;

      var targetEl = document.elementFromPoint(ev.clientX, ev.clientY);
      var targetNodeEl = targetEl && targetEl.closest('.agent-node');
      if (targetNodeEl && targetNodeEl.dataset.id !== sourceId) {
        connectNodes(sourceId, targetNodeEl.dataset.id);
        render();
        return;
      }
      renderConnections(svg, canvas);
    }

    function onMove(ev) { updatePreview(ev); }

    state.linking = {
      sourceId: sourceId,
      side: side,
      canvas: canvas,
      preview: preview,
      onMove: onMove,
      onFinish: finishLink
    };

    updatePreview(e);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finishLink);
    document.addEventListener('pointercancel', finishLink);
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

    var incoming = getIncomingNode(node.id);
    var outgoing = node.nextId ? state.nodes.find(function(n) { return n.id === node.nextId; }) : null;
    html += '<div class="agent-conn-panel">';
    html += '<div class="agent-conn-row"><span>Entrée</span><strong>' + (incoming ? (incoming.name || incoming.brickId) : '—') + '</strong></div>';
    html += '<div class="agent-conn-row"><span>Sortie</span><strong>' + (outgoing ? (outgoing.name || outgoing.brickId) : '—') + '</strong></div>';
    if (node.nextId) {
      html += '<button type="button" class="btn-agent-ghost" id="btnDisconnectNode" style="margin-top:8px;">Déconnecter la sortie</button>';
    } else {
      html += '<p class="empty" style="margin-top:8px;">Glissez depuis un port bas/droite vers un autre bloc.</p>';
    }
    html += '</div>';

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
        state.selectedNodeId = state.nodes[0] ? state.nodes[0].id : null;
        render();
      });
    }

    var disconnect = document.getElementById('btnDisconnectNode');
    if (disconnect) {
      disconnect.addEventListener('click', function() {
        disconnectOutgoing(node.id);
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
    canvas.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    canvas.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      cancelLinkDrag();
      state.suppressAutoConnectUntil = Date.now() + 400;

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
