/**
 * Canvas agent-flow — infra workflow builder (mode agent uniquement).
 * Fichier : frontend/assets/js/agent-flow/agent-canvas.js
 */
(function() {
  var cfg = window.AGENT_FLOW_EDITOR || {};
  var API_ROOT = (cfg.apiBase || '').replace(/\/$/, '');
  var API = API_ROOT + '/agent-flows';
  var JWT = cfg.jwt || '';
  var flowId = cfg.flowId || null;
  var ENTREPRISE_ID = cfg.entrepriseId || null;
  var backUrl = cfg.backUrl || '#';
  var reviewPageUrl = cfg.reviewPageUrl || '';

  var DEFAULT_OPS = {
    'data-backup': 'backup.run',
    'mail-out': 'emit.mail',
    'facebook-out': 'emit.reply',
    'http-generic': 'emit.http',
    'analyse-intention': 'analyse.run',
    'route-intention': 'route.resolve',
    'human-doc-review': 'review.pause',
    'logic-if': 'logic.if',
    'mail-delete': 'mail.delete',
    'mail-save-attachments': 'mail.saveAttachments'
  };

  var NODE_WIDTH = 200;
  var PORT_STEM = 18;
  /** Marge (px) avant de basculer ports vertical ↔ horizontal pendant un drag */
  var PORT_ORIENT_HYSTERESIS = 28;

  var state = {
    flowId: flowId,
    name: 'Nouvel agent',
    description: '',
    enabled: true,
    imageUrl: '',
    interactionMode: 'auto',
    agentContext: '',
    bricks: [],
    bricksById: {},
    nodes: [],
    selectedNodeId: null,
    linking: null,
    paletteDragActive: false,
    suppressAutoConnectUntil: 0,
    paletteOpenTypes: {},
    paletteClickTimer: null,
    activeTab: 'canvas',
    analyseConfig: null,
    routeConfig: null,
    docReviewConfig: null,
    facebookPages: [],
    facebookPagesLoaded: false,
    facebookPagesError: null,
    entrepriseId: ENTREPRISE_ID,
    /** 'v' | 'h' par lien source>target — évite le flip de ports au seuil 45° */
    portOrientByLink: {}
  };

  function headers() {
    return { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json' };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    var node = {
      id: createId(),
      brickId: brick.id,
      kind: brick.kind || 'action',
      operation: brick.kind === 'action' ? (DEFAULT_OPS[brick.id] || null) : null,
      name: brick.name,
      config: defaultConfigForBrick(brick),
      x: x || (120 + state.nodes.length * 24),
      y: y || (80 + state.nodes.length * 110),
      nextId: null,
      nextFalseId: null
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
        subject: '{{subject}}',
        body: '{{body}}',
        attachPrevious: false,
        usePreviousRoute: true
      };
    }
    if (brick.id === 'facebook-out') {
      return {
        action: 'publish',
        pageId: '',
        message: '{{body}}',
        usePreviousRoute: true,
        link: '',
        imageUrl: '',
        published: true,
        replyMode: 'auto',
        commentId: '',
        postId: '',
        recipientId: ''
      };
    }
    if (brick.id === 'analyse-intention') {
      return { messageField: 'text' };
    }
    if (brick.id === 'logic-if') {
      return { field: '', op: 'contains', value: '' };
    }
    if (brick.id === 'human-doc-review') {
      return {
        title: 'Revue documentaire',
        instructions: 'Vérifiez le contenu et les pièces jointes, puis validez ou rejetez.',
        reviewContext: '',
        templateNamespace: (cfg.defaultReviewNamespace || 'agent:review:invoice')
      };
    }
    if (brick.id === 'route-intention') {
      return {};
    }
    if (brick.id === 'facebook') {
      return {
        pageId: '',
        ingestModes: ['push', 'poll'],
        resources: ['posts'],
        webhookEvents: ['comments', 'messages'],
        limit: 25,
        postLimit: 25,
        lookbackHours: 168,
        lookbackUnit: 'days',
        pollIntervalMinutes: 15,
        commentCatchupLimit: 20,
        commentsPerPost: 50,
        commentsFetchAll: false,
        commentPostIds: '',
        messageConversationsLimit: 10,
        messagesPerConversation: 20,
        scenario: ''
      };
    }
    if (brick.id === 'mail-in') {
      return { accountRef: '' };
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
    return state.nodes.find(function(n) {
      return n.nextId === targetId || n.nextFalseId === targetId;
    }) || null;
  }

  /** Normalise fields (string | {key,label}) → {key,label} */
  function normalizeContextField(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { key: entry, label: humanizeFieldKey(entry) };
    }
    if (typeof entry === 'object' && entry.key) {
      return {
        key: String(entry.key),
        label: String(entry.label || humanizeFieldKey(entry.key))
      };
    }
    return null;
  }

  function humanizeFieldKey(key) {
    var map = {
      from: 'Expéditeur',
      subject: 'Sujet',
      text: 'Texte',
      body: 'Corps',
      messageId: 'Message-ID',
      sourceRef: 'UID / référence',
      attachments: 'Pièces jointes',
      channel: 'Canal',
      pageId: 'Page Facebook',
      intention_principale: 'Intention principale',
      reponse_requise: 'Réponse requise',
      confidence: 'Confiance',
      decision: 'Décision',
      editedText: 'Texte validé',
      editedHtml: 'HTML validé',
      'author.email': 'Email expéditeur',
      'author.name': 'Nom expéditeur',
      'metadata.accountRef': 'Compte mail',
      'metadata.mailbox': 'Dossier IMAP'
    };
    if (map[key]) return map[key];
    return String(key || '').replace(/\./g, ' · ');
  }

  function extractBrickContextFields(brick) {
    var out = [];
    if (!brick) return out;
    function pushList(list) {
      (list || []).forEach(function(entry) {
        var f = normalizeContextField(entry);
        if (f) out.push(f);
      });
    }
    if (brick.trigger && brick.trigger.outputContext) {
      pushList(brick.trigger.outputContext.fields);
    }
    if (brick.operations) {
      Object.keys(brick.operations).forEach(function(opKey) {
        var op = brick.operations[opKey];
        if (op && op.outputMessage) pushList(op.outputMessage.fields);
      });
    }
    return out;
  }

  /** Tous les nœuds en amont (parents récursifs). */
  function getUpstreamNodes(nodeId) {
    var result = [];
    var visited = {};
    function walk(id) {
      if (!id || visited[id]) return;
      visited[id] = true;
      state.nodes.forEach(function(n) {
        if (n.nextId === id || n.nextFalseId === id) {
          result.push(n);
          walk(n.id);
        }
      });
    }
    walk(nodeId);
    return result;
  }

  /**
   * Champs de contexte disponibles pour un nœud = sorties des blocs amont.
   * @returns {{key:string,label:string,source:string}[]}
   */
  function collectContextFieldsForNode(nodeId) {
    var byKey = {};
    var upstream = getUpstreamNodes(nodeId);
    // Inclure aussi les triggers même s'ils ne sont pas encore reliés
    // uniquement s'il n'y a aucun amont : aide à démarrer.
    var sources = upstream.length
      ? upstream
      : state.nodes.filter(function(n) { return n.kind === 'trigger'; });

    sources.forEach(function(n) {
      var brick = getBrick(n.brickId) || {};
      var sourceName = n.name || brick.name || n.brickId;
      extractBrickContextFields(brick).forEach(function(f) {
        if (!byKey[f.key]) {
          byKey[f.key] = {
            key: f.key,
            label: f.label,
            source: sourceName
          };
        }
      });
    });

    // Contexte global toujours utile
    if (!byKey.channel) {
      byKey.channel = { key: 'channel', label: 'Canal', source: 'Contexte' };
    }

    return Object.keys(byKey).map(function(k) { return byKey[k]; })
      .sort(function(a, b) {
        return String(a.label).localeCompare(String(b.label), 'fr');
      });
  }

  function logicOpLabel(op) {
    var labels = {
      contains: 'contient',
      eq: 'est égal à',
      neq: 'est différent de',
      truthy: 'est renseigné',
      falsy: 'est vide',
      gt: 'supérieur à',
      lt: 'inférieur à'
    };
    return labels[op] || op;
  }

  function logicIfSummary(config) {
    var cfg = config || {};
    var field = cfg.field ? humanizeFieldKey(cfg.field) : '…';
    var op = logicOpLabel(cfg.op || 'contains');
    if (cfg.op === 'truthy' || cfg.op === 'falsy') {
      return field + ' ' + op;
    }
    var val = cfg.value != null && String(cfg.value) !== '' ? String(cfg.value) : '…';
    return field + ' ' + op + ' « ' + val + ' »';
  }

  function contextFieldSelectHtml(fields, selectedKey, dataKey) {
    var html = '<select data-key="' + escapeHtml(dataKey || 'field') + '" data-context-field="1">';
    if (!fields.length) {
      html += '<option value="">— Reliez un bloc amont (ex. Mail entrant) —</option>';
    } else {
      html += '<option value="">— Choisir un champ —</option>';
      var groups = {};
      fields.forEach(function(f) {
        var g = f.source || 'Contexte';
        if (!groups[g]) groups[g] = [];
        groups[g].push(f);
      });
      Object.keys(groups).forEach(function(g) {
        html += '<optgroup label="' + escapeHtml(g) + '">';
        groups[g].forEach(function(f) {
          html += '<option value="' + escapeHtml(f.key) + '"'
            + (String(selectedKey) === String(f.key) ? ' selected' : '') + '>'
            + escapeHtml(f.label) + ' (' + escapeHtml(f.key) + ')</option>';
        });
        html += '</optgroup>';
      });
      // Valeur actuelle absente de la liste (ancien flow) → option conservée
      if (selectedKey && !fields.some(function(f) { return f.key === selectedKey; })) {
        html += '<option value="' + escapeHtml(selectedKey) + '" selected>'
          + escapeHtml(humanizeFieldKey(selectedKey)) + ' (' + escapeHtml(selectedKey) + ') — hors liste</option>';
      }
    }
    html += '</select>';
    return html;
  }

  function syncLogicIfDefaults(node) {
    if (!node || node.brickId !== 'logic-if') return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (!node.config.op) node.config.op = 'contains';
    var fields = collectContextFieldsForNode(node.id);
    if (!node.config.field && fields.length) {
      var preferred = fields.find(function(f) { return f.key === 'subject'; })
        || fields.find(function(f) { return f.key === 'from'; })
        || fields.find(function(f) { return f.key === 'intention_principale'; })
        || fields[0];
      if (preferred) node.config.field = preferred.key;
    }
    if (node.config.field) {
      node.name = 'Si : ' + logicIfSummary(node.config);
    }
  }

  function connectNodes(sourceId, targetId) {
    if (Date.now() < state.suppressAutoConnectUntil) return false;
    if (!sourceId || !targetId || sourceId === targetId) return false;
    var source = state.nodes.find(function(n) { return n.id === sourceId; });
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (!source || !target) return false;
    if (target.kind === 'trigger') return false;

    // Si / If : 1er lien = Oui (nextId), 2e = Non (nextFalseId)
    if (source.brickId === 'logic-if') {
      if (!source.nextId || source.nextId === targetId) {
        source.nextId = targetId;
      } else if (!source.nextFalseId || source.nextFalseId === targetId) {
        source.nextFalseId = targetId;
      } else {
        source.nextFalseId = targetId;
      }
      if (target.brickId === 'logic-if') syncLogicIfDefaults(target);
      return true;
    }

    state.nodes.forEach(function(n) {
      if (n.nextId === targetId && n.brickId !== 'logic-if') n.nextId = null;
    });
    source.nextId = targetId;
    if (target.brickId === 'logic-if') syncLogicIfDefaults(target);
    return true;
  }

  function clearPortOrientForNode(nodeId) {
    Object.keys(state.portOrientByLink).forEach(function(key) {
      var parts = key.split('>');
      if (parts[0] === nodeId || parts[1] === nodeId) delete state.portOrientByLink[key];
    });
  }

  function disconnectOutgoing(nodeId) {
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    if (node) {
      node.nextId = null;
      node.nextFalseId = null;
      clearPortOrientForNode(nodeId);
    }
  }

  function isEditableKeyboardTarget(el) {
    if (!el || el === document.body) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return !!(el.closest && el.closest('[contenteditable="true"]'));
  }

  function deleteSelectedNode() {
    var nodeId = state.selectedNodeId;
    if (!nodeId) return false;
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    if (!node) return false;
    state.nodes = state.nodes.filter(function(n) { return n.id !== nodeId; });
    state.nodes.forEach(function(n) {
      if (n.nextId === nodeId) n.nextId = null;
      if (n.nextFalseId === nodeId) n.nextFalseId = null;
    });
    clearPortOrientForNode(nodeId);
    state.selectedNodeId = state.nodes[0] ? state.nodes[0].id : null;
    render();
    return true;
  }

  function collectReachableSteps(startNodes) {
    var byId = {};
    state.nodes.forEach(function(n) { byId[n.id] = n; });
    var steps = [];
    var seen = {};
    var queue = [];
    startNodes.forEach(function(t) {
      if (t.nextId) queue.push(t.nextId);
      if (t.nextFalseId) queue.push(t.nextFalseId);
    });
    while (queue.length) {
      var id = queue.shift();
      if (!id || seen[id]) continue;
      var n = byId[id];
      if (!n || n.kind === 'trigger') continue;
      seen[id] = true;
      steps.push({
        id: n.id,
        brickId: n.brickId,
        operation: n.operation || DEFAULT_OPS[n.brickId] || null,
        config: n.config || {}
      });
      if (n.nextId) queue.push(n.nextId);
      if (n.nextFalseId) queue.push(n.nextFalseId);
    }
    return steps;
  }

  function buildPayload() {
    var triggerNodes = state.nodes.filter(function(n) { return n.kind === 'trigger'; });
    var triggers = triggerNodes.map(function(t) {
      return { id: t.id, brickId: t.brickId, config: t.config || {} };
    });
    var trigger = triggers[0] || { brickId: 'manual-trigger', config: {} };
    var steps = collectReachableSteps(triggerNodes);

    return {
      name: state.name,
      description: state.description,
      enabled: state.enabled,
      imageUrl: state.imageUrl || null,
      interactionMode: state.interactionMode || 'auto',
      agentContext: state.agentContext || '',
      trigger: trigger,
      triggers: triggers,
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
            nextId: n.nextId,
            nextFalseId: n.nextFalseId || null
          };
        })
      }
    };
  }

  function syncIdentityFields() {
    var nameEl = document.getElementById('agentName');
    var enEl = document.getElementById('agentEnabled');
    var imgEl = document.getElementById('agentImageUrl');
    var modeEl = document.getElementById('agentInteractionMode');
    var ctxEl = document.getElementById('agentContext');
    var preview = document.getElementById('agentImagePreview');
    if (nameEl) nameEl.value = state.name || '';
    if (enEl) enEl.checked = state.enabled !== false;
    if (imgEl) imgEl.value = state.imageUrl || '';
    if (modeEl) modeEl.value = state.interactionMode || 'auto';
    if (ctxEl) ctxEl.value = state.agentContext || '';
    if (preview) {
      if (state.imageUrl) {
        preview.src = state.imageUrl;
        preview.style.display = '';
      } else {
        preview.removeAttribute('src');
        preview.style.display = 'none';
      }
    }
  }

  function readIdentityFromDom() {
    var nameEl = document.getElementById('agentName');
    var enEl = document.getElementById('agentEnabled');
    var imgEl = document.getElementById('agentImageUrl');
    var modeEl = document.getElementById('agentInteractionMode');
    var ctxEl = document.getElementById('agentContext');
    if (nameEl) state.name = nameEl.value.trim() || 'Nouvel agent';
    if (enEl) state.enabled = enEl.checked;
    if (imgEl) state.imageUrl = imgEl.value.trim();
    if (modeEl) state.interactionMode = modeEl.value || 'auto';
    if (ctxEl) state.agentContext = ctxEl.value.trim();
  }

  function loadFromFlow(flow) {
    state.flowId = String(flow._id || '');
    state.imageUrl = flow.imageUrl || '';
    state.interactionMode = flow.interactionMode || 'auto';
    state.name = flow.name || 'Agent';
    state.description = flow.description || '';
    state.enabled = flow.enabled !== false;
    state.agentContext = flow.agentContext != null ? String(flow.agentContext) : '';
    syncIdentityFields();

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
          nextId: n.nextId || null,
          nextFalseId: n.nextFalseId || null
        };
      });
    } else {
      state.nodes = [];
      var triggerList = Array.isArray(flow.triggers) && flow.triggers.length
        ? flow.triggers
        : [flow.trigger || { brickId: 'manual-trigger', config: {} }];
      var tx = 120;
      triggerList.forEach(function(trigger, ti) {
        var tBrick = getBrick(trigger.brickId) || { id: trigger.brickId, name: trigger.brickId, kind: 'trigger' };
        state.nodes.push({
          id: trigger.id || createId(),
          brickId: trigger.brickId,
          kind: 'trigger',
          operation: null,
          name: tBrick.name,
          config: trigger.config || {},
          x: tx + ti * 240,
          y: 80,
          nextId: null,
          nextFalseId: null
        });
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
          nextId: null,
          nextFalseId: null
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

  function isConnectorBrick(brick) {
    if (!brick) return false;
    if (brick.origin === 'connector') return true;
    if (brick.category === 'connector') return true;
    return !!(brick.serviceRef && String(brick.serviceRef).indexOf('connectors/') === 0);
  }

  function isConnectorInput(brick) {
    return isConnectorBrick(brick) && brick.kind === 'trigger';
  }

  function isConnectorOutput(brick) {
    return isConnectorBrick(brick) && brick.kind !== 'trigger';
  }

  function openNodeConfig(node) {
    if (!node) return;
    state.selectedNodeId = node.id;
    updateConfigTabs();
    var cfgUi = brickConfigUi(node.brickId);
    if (cfgUi && cfgUi.tabId) {
      setActiveTab(cfgUi.tabId);
      return;
    }
    setActiveTab('canvas');
    renderConfig();
    renderCanvas();
  }

  function renderPalette() {
    var host = document.getElementById('agentPalette');
    if (!host) return;

    var connectorsIn = state.bricks.filter(isConnectorInput);
    var connectorsOut = state.bricks.filter(isConnectorOutput);
    var connectorIds = {};
    connectorsIn.concat(connectorsOut).forEach(function(b) { connectorIds[b.id] = true; });

    var triggers = state.bricks.filter(function(b) {
      return b.kind === 'trigger' && !connectorIds[b.id];
    });
    var ai = state.bricks.filter(function(b) {
      return !connectorIds[b.id] && (b.category === 'ai' || b.id === 'analyse-intention');
    });
    var logic = state.bricks.filter(function(b) {
      return !connectorIds[b.id] && (b.category === 'logic' || b.id === 'logic-if');
    });
    var human = state.bricks.filter(function(b) {
      return !connectorIds[b.id] && (b.category === 'human' || b.interaction === 'human');
    });
    var claimed = {};
    connectorsIn.concat(connectorsOut, triggers, ai, logic, human).forEach(function(b) { claimed[b.id] = true; });
    var actions = state.bricks.filter(function(b) {
      return !claimed[b.id] && b.kind === 'action';
    });

    function brickHtml(brick) {
      var url = iconUrl(brick);
      var icon = url
        ? '<img src="' + url + '" alt="">'
        : '<span class="emoji">' + ((brick.canvas && brick.canvas.iconEmoji) || '🔧') + '</span>';
      return '<div class="agent-brick-item" draggable="true" data-brick-id="' + escapeHtml(brick.id) + '" title="Glisser ou clic pour ajouter · Double-clic pour paramétrer">'
        + icon
        + '<div class="meta"><strong>' + escapeHtml(brick.name) + '</strong><small>' + escapeHtml(brick.description || '') + '</small></div>'
        + '</div>';
    }

    function typeShell(id, label, count, bodyHtml, extraClass) {
      var isOpen = !!state.paletteOpenTypes[id];
      return '<div class="agent-palette-type' + (extraClass ? ' ' + extraClass : '') + (isOpen ? ' is-open' : '') + '" data-type="' + escapeHtml(id) + '">'
        + '<button type="button" class="agent-palette-type-header" aria-expanded="' + (isOpen ? 'true' : 'false') + '">'
        + '<span class="agent-palette-type-label">' + escapeHtml(label) + '</span>'
        + '<span class="agent-palette-type-count">' + count + '</span>'
        + '<span class="agent-palette-type-chevron" aria-hidden="true">▸</span>'
        + '</button>'
        + '<div class="agent-palette-type-body">' + bodyHtml + '</div>'
        + '</div>';
    }

    var connectorCount = connectorsIn.length + connectorsOut.length;
    var connectorBody = '';
    if (connectorCount) {
      connectorBody = ''
        + (connectorsIn.length
          ? typeShell(
            'connector-input',
            'Input',
            connectorsIn.length,
            '<p class="agent-palette-type-hint">Entrées : mail, Facebook…</p>' + connectorsIn.map(brickHtml).join(''),
            'agent-palette-type--nested'
          )
          : '')
        + (connectorsOut.length
          ? typeShell(
            'connector-output',
            'Output',
            connectorsOut.length,
            '<p class="agent-palette-type-hint">Sorties : mail, Facebook, HTTP…</p>' + connectorsOut.map(brickHtml).join(''),
            'agent-palette-type--nested'
          )
          : '');
    }

    var html = '';
    if (connectorCount) {
      html += typeShell('connector', 'Connecteurs', connectorCount, connectorBody, '');
    }

    var flatGroups = [
      { id: 'trigger', label: 'Déclencheurs', hint: 'Manuel, cron…', bricks: triggers },
      { id: 'ai', label: 'IA', hint: 'Analyse, intentions…', bricks: ai },
      { id: 'logic', label: 'Logique', hint: 'Conditions, routage…', bricks: logic },
      { id: 'human', label: 'Humain', hint: 'Revue, validation…', bricks: human },
      { id: 'action', label: 'Actions', hint: 'Modules & traitements', bricks: actions }
    ];

    flatGroups.forEach(function(group) {
      if (!group.bricks.length) return;
      html += typeShell(
        group.id,
        group.label,
        group.bricks.length,
        '<p class="agent-palette-type-hint">' + escapeHtml(group.hint) + '</p>' + group.bricks.map(brickHtml).join(''),
        ''
      );
    });

    host.innerHTML = html || '<p class="empty">Aucune brique disponible.</p>';

    host.querySelectorAll('.agent-palette-type').forEach(function(typeEl) {
      var typeId = typeEl.getAttribute('data-type');
      var header = typeEl.querySelector(':scope > .agent-palette-type-header');
      if (!header) return;

      header.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var next = !typeEl.classList.contains('is-open');
        typeEl.classList.toggle('is-open', next);
        header.setAttribute('aria-expanded', next ? 'true' : 'false');
        state.paletteOpenTypes[typeId] = next;
      });
    });

    host.querySelectorAll('.agent-brick-item').forEach(function(el) {
      el.addEventListener('dragstart', function(e) {
        state.paletteDragActive = true;
        if (state.paletteClickTimer) {
          clearTimeout(state.paletteClickTimer);
          state.paletteClickTimer = null;
        }
        cancelLinkDrag();
        e.dataTransfer.setData('text/brick-id', el.getAttribute('data-brick-id'));
      });
      el.addEventListener('dragend', function() {
        state.paletteDragActive = false;
        state.suppressAutoConnectUntil = Date.now() + 300;
      });
      el.addEventListener('click', function(e) {
        if (state.paletteDragActive) return;
        e.stopPropagation();
        var brickId = el.getAttribute('data-brick-id');
        if (state.paletteClickTimer) clearTimeout(state.paletteClickTimer);
        state.paletteClickTimer = setTimeout(function() {
          state.paletteClickTimer = null;
          var brick = getBrick(brickId);
          if (brick) addNodeFromBrick(brick);
        }, 220);
      });
      el.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (state.paletteClickTimer) {
          clearTimeout(state.paletteClickTimer);
          state.paletteClickTimer = null;
        }
        var brick = getBrick(el.getAttribute('data-brick-id'));
        if (!brick) return;
        var node = addNodeFromBrick(brick);
        openNodeConfig(node);
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

  function linkOrientKey(sourceId, targetId) {
    return sourceId + '>' + targetId;
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
    var stem = PORT_STEM;

    if (outSide === 'bottom' || outSide === 'top') {
      var midY = y1 + (y2 - y1) / 2;
      if (outSide === 'bottom' && inSide === 'top') {
        if (y2 - y1 > 2 * stem) {
          midY = Math.max(y1 + stem, Math.min(y2 - stem, midY));
        }
      } else if (outSide === 'top' && inSide === 'bottom') {
        if (y1 - y2 > 2 * stem) {
          midY = Math.min(y1 - stem, Math.max(y2 + stem, midY));
        }
      }
      return 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2;
    }

    var midX = x1 + (x2 - x1) / 2;
    if (outSide === 'right' && inSide === 'left') {
      if (x2 - x1 > 2 * stem) {
        midX = Math.max(x1 + stem, Math.min(x2 - stem, midX));
      }
    } else if (outSide === 'left' && inSide === 'right') {
      if (x1 - x2 > 2 * stem) {
        midX = Math.min(x1 - stem, Math.max(x2 + stem, midX));
      }
    }
    return 'M' + x1 + ' ' + y1 + ' C ' + midX + ' ' + y1 + ', ' + midX + ' ' + y2 + ', ' + x2 + ' ' + y2;
  }

  /** Ports pour une orientation forcée ('v' | 'h'), sans toucher à l'hystérésis */
  function portsForOrientation(sourceId, targetId, canvas, orient) {
    var s = getNodeRect(sourceId, canvas);
    var t = getNodeRect(targetId, canvas);
    if (!s || !t) return null;
    var dx = t.center.x - s.center.x;
    var dy = t.center.y - s.center.y;
    if (orient === 'v') {
      if (dy >= 0) return { out: s.bottom, in: t.top };
      return { out: s.top, in: t.bottom };
    }
    if (dx >= 0) return { out: s.right, in: t.left };
    return { out: s.left, in: t.right };
  }

  function portDistance(ports) {
    if (!ports) return Infinity;
    var dx = ports.in.x - ports.out.x;
    var dy = ports.in.y - ports.out.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Courbe directe uniquement (plus de détour orthogonal type L).
   * Choisit l'orientation de ports la plus courte, avec hystérésis.
   */
  function buildConnectionPath(sourceId, targetId, canvas) {
    var key = linkOrientKey(sourceId, targetId);
    var preferred = state.portOrientByLink[key] || null;
    var portsV = portsForOrientation(sourceId, targetId, canvas, 'v');
    var portsH = portsForOrientation(sourceId, targetId, canvas, 'h');
    if (!portsV && !portsH) return null;

    var distV = portDistance(portsV);
    var distH = portDistance(portsH);
    var orient;

    if (preferred === 'v' && portsV && distV <= distH + PORT_ORIENT_HYSTERESIS) {
      orient = 'v';
    } else if (preferred === 'h' && portsH && distH <= distV + PORT_ORIENT_HYSTERESIS) {
      orient = 'h';
    } else {
      orient = distV <= distH ? 'v' : 'h';
    }

    state.portOrientByLink[key] = orient;
    var ports = orient === 'v' ? portsV : portsH;
    return { d: buildCurvePath(ports.out, ports.in), routed: false };
  }

  function drawLink(svg, canvas, sourceId, targetId, cssClass) {
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (!target) return;
    var route = buildConnectionPath(sourceId, targetId, canvas);
    if (!route) return;
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', route.d);
    path.setAttribute('class', 'connection-direct' + (cssClass ? ' ' + cssClass : ''));
    svg.appendChild(path);
  }

  function renderConnections(svg, canvas) {
    svg.innerHTML = '';
    state.nodes.forEach(function(node) {
      if (node.nextId) drawLink(svg, canvas, node.id, node.nextId, node.brickId === 'logic-if' ? 'connection-true' : '');
      if (node.nextFalseId) drawLink(svg, canvas, node.id, node.nextFalseId, 'connection-false');
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
        + '<div class="agent-node-kind' + (node.brickId === 'logic-if' ? ' logic' : '') + '">'
        + (isConnectorBrick(brick) ? 'Connecteur'
          : (node.kind === 'trigger' ? 'Déclencheur'
            : (node.brickId === 'logic-if' || brick.category === 'logic' ? 'Logique'
              : (brick.category === 'ai' ? 'IA'
                : (brick.category === 'human' || brick.interaction === 'human' ? 'Humain' : 'Action')))))
        + (node.brickId === 'facebook' && node.config
          ? ' · ' + facebookNodeSummary(node.config)
          : '')
        + (node.brickId === 'facebook-out' && node.config
          ? ' · ' + facebookOutNodeSummary(node.config)
          : '')
        + (node.brickId === 'logic-if'
          ? ' · ' + escapeHtml(logicIfSummary(node.config || {}))
          : '')
        + '</div></div></div>'
        + '<span class="agent-node-port agent-node-port--right agent-node-port--out" data-port="right" aria-hidden="true"></span>'
        + '<span class="agent-node-port agent-node-port--bottom agent-node-port--out" data-port="bottom" aria-hidden="true"></span>';

      el.addEventListener('click', function(e) {
        e.stopPropagation();
        state.selectedNodeId = node.id;
        renderConfig();
        renderCanvas();
      });

      el.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        e.preventDefault();
        openNodeConfig(node);
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

  function facebookPageLabel(page) {
    if (!page) return '';
    var name = page.pageName || page.pageId || '';
    var id = page.pageId || '';
    if (name && id && name !== id) return name + ' (' + id + ')';
    return name || id;
  }

  function findFacebookPage(pageId) {
    var pid = String(pageId || '').trim();
    if (!pid) return null;
    return (state.facebookPages || []).find(function(p) { return String(p.pageId) === pid; }) || null;
  }

  function facebookPageOptionsHtml(selectedId, allowEmpty) {
    var sel = String(selectedId || '');
    var opts = [];
    if (allowEmpty) {
      opts.push('<option value="">— Choisir une page —</option>');
    }
    if (!state.facebookPagesLoaded) {
      opts.push('<option value="" disabled>Chargement…</option>');
    } else if (!(state.facebookPages || []).length) {
      opts.push('<option value="" disabled>Aucune page connectée</option>');
    } else {
      state.facebookPages.forEach(function(p) {
        var id = String(p.pageId || '');
        var disabled = p.hasToken === false ? ' disabled' : '';
        var suffix = p.hasToken === false ? ' (token manquant)' : '';
        opts.push(
          '<option value="' + escapeHtml(id) + '"' +
          (sel === id ? ' selected' : '') +
          disabled + '>' +
          escapeHtml(facebookPageLabel(p) + suffix) +
          '</option>'
        );
      });
      if (sel && !findFacebookPage(sel)) {
        opts.push('<option value="' + escapeHtml(sel) + '" selected>' + escapeHtml(sel) + ' (hors liste)</option>');
      }
    }
    return opts.join('');
  }

  function resolveEditorEntrepriseId() {
    return state.entrepriseId || ENTREPRISE_ID || null;
  }

  function mapConnectorInstancesToPages(instances) {
    return (instances || [])
      .filter(function(inst) {
        return inst && inst.settings && inst.settings.pageId;
      })
      .map(function(inst) {
        var pageId = String(inst.settings.pageId);
        return {
          pageId: pageId,
          pageName: String(inst.settings.pageName || inst.name || ('Page ' + pageId)),
          hasToken: true,
          tokenStatus: inst.enabled === false ? 'inactive' : 'active',
          webhooksSubscribed: [],
          source: 'connector_instances',
          instanceId: inst._id ? String(inst._id) : null,
          enabled: inst.enabled !== false
        };
      });
  }

  function loadFacebookPagesFromConnectorsFallback() {
    var url = API_ROOT + '/connectors/instances/list/all?connectorId=facebook';
    var eid = resolveEditorEntrepriseId();
    if (eid) url += '&entrepriseId=' + encodeURIComponent(eid);
    return fetch(url, { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data || !data.success) {
          throw new Error((data && data.message) || 'Impossible de lister les instances Facebook');
        }
        return mapConnectorInstancesToPages(data.data || data.instances || []);
      });
  }

  function loadFacebookPages() {
    var url = API + '/facebook-pages';
    var eid = resolveEditorEntrepriseId();
    if (eid) url += '?entrepriseId=' + encodeURIComponent(eid);

    return fetch(url, { headers: headers() })
      .then(function(res) {
        if (res.status === 404) {
          // Backend pas encore redémarré / ancienne route → fallback Connecteurs
          return loadFacebookPagesFromConnectorsFallback().then(function(pages) {
            return { success: true, pages: pages, via: 'connectors-fallback' };
          });
        }
        return parseJson(res).then(function(data) {
          if (!data || !data.success) {
            throw new Error((data && data.message) || ('Erreur pages Facebook (' + res.status + ')'));
          }
          return data;
        });
      })
      .then(function(data) {
        state.facebookPagesLoaded = true;
        state.facebookPagesError = null;
        state.facebookPages = Array.isArray(data.pages) ? data.pages : [];
        if (data.entrepriseId) state.entrepriseId = data.entrepriseId;
        fillFacebookPageSelects();
        return state.facebookPages;
      })
      .catch(function(err) {
        // Dernier recours : liste Connecteurs
        return loadFacebookPagesFromConnectorsFallback()
          .then(function(pages) {
            state.facebookPagesLoaded = true;
            state.facebookPagesError = null;
            state.facebookPages = pages;
            fillFacebookPageSelects();
            return pages;
          })
          .catch(function() {
            state.facebookPagesLoaded = true;
            state.facebookPages = [];
            state.facebookPagesError = (err && err.message) || 'Erreur chargement pages Facebook';
            fillFacebookPageSelects();
            return [];
          });
      });
  }

  function fillFacebookPageSelects() {
    var panelSel = document.getElementById('fbPageId');
    if (panelSel && panelSel.tagName === 'SELECT') {
      var current = panelSel.value;
      var node = getFacebookNode();
      var preferred = (node && node.config && node.config.pageId) || current || '';
      var allowEmpty = true;
      panelSel.innerHTML = facebookPageOptionsHtml(preferred, allowEmpty);
      if (preferred) panelSel.value = preferred;
      var hint = document.getElementById('fbPageHint');
      if (hint) {
        if (state.facebookPagesError) {
          hint.textContent = 'Erreur : ' + state.facebookPagesError + ' — vérifiez que le backend est redémarré.';
          hint.style.color = '#f87171';
        } else if (!(state.facebookPages || []).length) {
          hint.textContent = 'Aucune page pour cette entité. Les instances visibles dans Connecteurs → Facebook devraient apparaître ici.';
          hint.style.color = '#fb923c';
        } else {
          hint.textContent = state.facebookPages.length + ' page(s) disponible(s). Utilisée pour l’écoute (webhook / poll) et synchronisée à l’enregistrement.';
          hint.style.color = '#64748b';
        }
      }
    }
    document.querySelectorAll('select[data-key="pageId"][data-fb-page-select="1"]').forEach(function(sel) {
      var cur = sel.value;
      var allowEmpty = sel.getAttribute('data-allow-empty') !== '0';
      sel.innerHTML = facebookPageOptionsHtml(cur, allowEmpty);
      if (cur) sel.value = cur;
    });
  }

  function fieldHtml(key, schema, value, opts) {
    opts = opts || {};
    var title = (schema && schema.title) || key;
    if (key === 'pageId' && (opts.brickId === 'facebook' || opts.brickId === 'facebook-out')) {
      var allowEmpty = opts.brickId !== 'facebook-out';
      return '<div class="form-group"><label>' + escapeHtml(title || 'Compte / page Facebook') + '</label>'
        + '<select data-key="pageId" data-fb-page-select="1" data-allow-empty="' + (allowEmpty ? '1' : '0') + '">'
        + facebookPageOptionsHtml(value, allowEmpty)
        + '</select>'
        + '<p class="empty" style="margin-top:6px;">Pages connectées de l\'entité (facebook_configs).</p>'
        + '</div>';
    }
    if (schema && (schema.format === 'context-field' || key === 'field' && opts.brickId === 'logic-if' || key === 'messageField')) {
      var ctxFields = opts.contextFields || [];
      var help = (schema && schema.description)
        || 'Liste des champs fournis par les blocs connectés en amont.';
      return '<div class="form-group"><label>' + escapeHtml(title) + '</label>'
        + contextFieldSelectHtml(ctxFields, value, key)
        + '<p class="empty" style="margin-top:6px;">' + escapeHtml(help) + '</p></div>';
    }
    if (schema && schema.type === 'boolean') {
      var checked = value !== false && value !== 'false' ? ' checked' : '';
      return '<div class="form-group"><label><input type="checkbox" data-key="' + key + '" data-type="boolean"' + checked + '> ' + title + '</label></div>';
    }
    if (key === 'body' || key === 'message' || (schema && schema.format === 'textarea')) {
      return '<div class="form-group"><label>' + title + '</label><textarea rows="4" data-key="' + key + '">' + (value != null ? value : '') + '</textarea></div>';
    }
    if (schema && schema.enum) {
      var enumLabels = (schema.enumLabels && typeof schema.enumLabels === 'object') ? schema.enumLabels : {};
      return '<div class="form-group"><label>' + title + '</label><select data-key="' + key + '">'
        + schema.enum.map(function(opt) {
          var lab = enumLabels[opt] || (key === 'op' ? logicOpLabel(opt) : opt);
          return '<option value="' + opt + '"' + (String(value) === String(opt) ? ' selected' : '') + '>'
            + escapeHtml(lab) + '</option>';
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

    var cfgUi = brickConfigUi(node.brickId);
    if (cfgUi && cfgUi.tabId) {
      html += '<button type="button" class="btn-agent" id="btnOpenBrickConfig" style="margin-bottom:12px;">Ouvrir config « ' +
        (cfgUi.tabLabel || cfgUi.tabId) + ' »</button>';
    }
    if (brick.interaction === 'human') {
      html += '<p class="empty" style="color:#fb923c; margin-bottom:12px;">Intervention humaine — place l\'agent en mode assisté.</p>';
    }

    if (node.brickId === 'human-doc-review') {
      var nsReview = (node.config && node.config.templateNamespace)
        || cfg.defaultReviewNamespace
        || 'agent:review:invoice';
      html += '<div style="margin:0 0 12px; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;">';
      html += '<p class="empty" style="margin:0 0 8px; color:#93c5fd;">Remplissez le contexte de page ci-dessous, puis créez la page par IA (utilise aussi le contexte général de l\'agent).</p>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">';
      html += '<button type="button" class="btn-agent" id="btnGenerateReviewPageAi">Créer page par IA</button>';
      html += '<a class="btn-agent-ghost" href="' + escapeHtml(docEditorUrl(nsReview)) + '" target="_blank" rel="noopener" style="text-decoration:none; display:inline-flex; align-items:center;">Ouvrir l\'éditeur</a>';
      html += '</div>';
      html += '<p id="reviewAiStatus" class="empty" style="margin:0; color:#64748b;"></p>';
      html += '</div>';
    }

    var incoming = getIncomingNode(node.id);
    var outgoing = node.nextId ? state.nodes.find(function(n) { return n.id === node.nextId; }) : null;
    var outgoingFalse = node.nextFalseId ? state.nodes.find(function(n) { return n.id === node.nextFalseId; }) : null;
    html += '<div class="agent-conn-panel">';
    html += '<div class="agent-conn-row"><span>Entrée</span><strong>' + (incoming ? (incoming.name || incoming.brickId) : '—') + '</strong></div>';
    if (node.brickId === 'logic-if') {
      html += '<div class="agent-conn-row"><span>Oui</span><strong>' + (outgoing ? (outgoing.name || outgoing.brickId) : '—') + '</strong></div>';
      html += '<div class="agent-conn-row"><span>Non</span><strong>' + (outgoingFalse ? (outgoingFalse.name || outgoingFalse.brickId) : '—') + '</strong></div>';
      html += '<p class="empty" style="margin-top:8px;">1er lien depuis le port = Oui, 2e lien = Non.</p>';
    } else {
      html += '<div class="agent-conn-row"><span>Sortie</span><strong>' + (outgoing ? (outgoing.name || outgoing.brickId) : '—') + '</strong></div>';
    }
    if (node.nextId || node.nextFalseId) {
      html += '<button type="button" class="btn-agent-ghost" id="btnDisconnectNode" style="margin-top:8px;">Déconnecter les sorties</button>';
    } else {
      html += '<p class="empty" style="margin-top:8px;">Glissez depuis un port bas/droite vers un autre bloc.</p>';
    }
    html += '</div>';

    var contextFields = collectContextFieldsForNode(node.id);

    if (node.brickId === 'logic-if') {
      if (!node.config || typeof node.config !== 'object') node.config = {};
      if (!node.config.op) node.config.op = 'contains';
      // Auto-choisir un champ utile si vide et qu'on a du contexte mail / intention
      if (!node.config.field && contextFields.length) {
        var preferred = contextFields.find(function(f) { return f.key === 'subject'; })
          || contextFields.find(function(f) { return f.key === 'from'; })
          || contextFields.find(function(f) { return f.key === 'intention_principale'; })
          || contextFields[0];
        if (preferred) node.config.field = preferred.key;
      }
      html += '<div class="agent-logic-panel" style="margin:12px 0; padding:12px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;">';
      html += '<p style="margin:0 0 10px; color:#93c5fd; font-size:0.9rem;"><strong>Condition</strong> — '
        + escapeHtml(logicIfSummary(node.config)) + '</p>';
      if (!getUpstreamNodes(node.id).length) {
        html += '<p class="empty" style="color:#fbbf24; margin-bottom:10px;">Reliez d\'abord ce bloc après un déclencheur (ex. Mail entrant) pour voir les champs disponibles.</p>';
      }
      html += '</div>';
    }

    if (schema && schema.properties) {
      Object.keys(schema.properties).forEach(function(key) {
        var prop = schema.properties[key];
        var val = node.config[key];
        if (val === undefined && prop.default !== undefined) val = prop.default;
        // Masquer « valeur » si opérateur sans valeur
        if (node.brickId === 'logic-if' && key === 'value') {
          var opNow = node.config.op || 'contains';
          if (opNow === 'truthy' || opNow === 'falsy') return;
        }
        html += fieldHtml(key, prop, val, {
          brickId: node.brickId,
          contextFields: contextFields
        });
      });
    } else {
      html += '<p class="empty">Aucun paramètre pour ce bloc.</p>';
    }

    if (node.brickId === 'logic-if' && contextFields.length) {
      html += '<details style="margin-top:10px; color:#94a3b8; font-size:0.85rem;"><summary>Champs disponibles ('
        + contextFields.length + ')</summary><ul style="margin:8px 0 0; padding-left:1.1rem;">';
      contextFields.forEach(function(f) {
        html += '<li><strong>' + escapeHtml(f.label) + '</strong> <code>' + escapeHtml(f.key)
          + '</code> ← ' + escapeHtml(f.source) + '</li>';
      });
      html += '</ul></details>';
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
        if (key === 'pageId' && (node.brickId === 'facebook' || node.brickId === 'facebook-out')) {
          var page = findFacebookPage(val);
          node.config.pageName = page ? (page.pageName || '') : '';
        }
        if (node.brickId === 'logic-if') {
          // Mettre à jour le libellé du nœud pour le canvas
          node.name = 'Si : ' + logicIfSummary(node.config);
          render();
          return;
        }
        if (key === 'pageId' && (node.brickId === 'facebook' || node.brickId === 'facebook-out')) {
          renderCanvas();
        }
      });
    });

    var openCfg = document.getElementById('btnOpenBrickConfig');
    if (openCfg && cfgUi && cfgUi.tabId) {
      openCfg.addEventListener('click', function() {
        setActiveTab(cfgUi.tabId);
      });
    }
    var btnGenReviewAi = document.getElementById('btnGenerateReviewPageAi');
    if (btnGenReviewAi) {
      btnGenReviewAi.addEventListener('click', function() {
        generateReviewPageFromAi(node, btnGenReviewAi);
      });
    }

    var del = document.getElementById('btnDeleteNode');
    if (del) {
      del.addEventListener('click', function() {
        deleteSelectedNode();
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
    updateConfigTabs();
  }

  function flowHasBrick(brickId) {
    return state.nodes.some(function(n) { return n.brickId === brickId; });
  }

  function brickConfigUi(brickId) {
    var brick = getBrick(brickId);
    if (!brick) return null;
    return brick.configUi || (brick.agentConfig
      ? { type: 'panel', tabId: brick.agentConfig.tabId, tabLabel: brick.agentConfig.tabLabel }
      : null);
  }

  function updateConfigTabs() {
    var tabInt = document.getElementById('tabIntentions');
    var tabRoute = document.getElementById('tabRouting');
    var tabDoc = document.getElementById('tabDocReview');
    var tabFb = document.getElementById('tabFacebook');
    if (tabInt) tabInt.style.display = flowHasBrick('analyse-intention') ? '' : 'none';
    if (tabRoute) tabRoute.style.display = flowHasBrick('route-intention') ? '' : 'none';
    if (tabDoc) tabDoc.style.display = flowHasBrick('human-doc-review') ? '' : 'none';
    if (tabFb) tabFb.style.display = flowHasBrick('facebook') ? '' : 'none';

    state.nodes.forEach(function(n) {
      var ui = brickConfigUi(n.brickId);
      if (!ui || !ui.tabId) return;
      var el = document.querySelector('.agent-tab[data-tab="' + ui.tabId + '"]');
      if (el) el.style.display = '';
    });
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.agent-tab').forEach(function(btn) {
      var on = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('is-active', on);
      btn.classList.toggle('btn-agent', on);
      btn.classList.toggle('btn-agent-ghost', !on);
    });
    var canvas = document.getElementById('panelCanvas');
    var intentions = document.getElementById('panelIntentions');
    var routing = document.getElementById('panelRouting');
    var docReview = document.getElementById('panelDocReview');
    var facebook = document.getElementById('panelFacebook');
    if (canvas) canvas.style.display = tab === 'canvas' ? '' : 'none';
    if (intentions) intentions.style.display = tab === 'intentions' ? '' : 'none';
    if (routing) routing.style.display = tab === 'routing' ? '' : 'none';
    if (docReview) docReview.style.display = tab === 'doc-review' ? '' : 'none';
    if (facebook) facebook.style.display = tab === 'facebook' ? '' : 'none';
    if (tab === 'intentions') loadAnalyseConfigPanel();
    if (tab === 'routing') loadRouteConfigPanel();
    if (tab === 'doc-review') loadDocReviewConfigPanel();
    if (tab === 'facebook') loadFacebookConfigPanel();
  }

  function getFacebookNode() {
    return state.nodes.find(function(n) { return n.brickId === 'facebook'; }) || null;
  }

  function clampFbInt(raw, fallback, min, max) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n)) n = fallback;
    return Math.min(Math.max(n, min), max);
  }

  function hoursToLookbackUi(hours) {
    var h = clampFbInt(hours, 168, 1, 2160);
    if (h % 24 === 0 && h >= 24) {
      return { value: h / 24, unit: 'days', hours: h };
    }
    return { value: h, unit: 'hours', hours: h };
  }

  function lookbackUiToHours(value, unit) {
    var v = clampFbInt(value, unit === 'days' ? 7 : 168, 1, 2160);
    var hours = unit === 'days' ? v * 24 : v;
    return clampFbInt(hours, 168, 1, 2160);
  }

  function formatLookbackLabel(hours) {
    var h = clampFbInt(hours, 168, 1, 2160);
    if (h % 24 === 0 && h >= 24) {
      var d = h / 24;
      return d + ' j';
    }
    return h + ' h';
  }

  function facebookWebhookLabels(events) {
    var map = {
      comments: 'com.',
      messages: 'MP',
      posts: 'posts',
      notifications: 'notif.'
    };
    var list = Array.isArray(events) ? events : [];
    if (!list.length) return 'webhook';
    return list.map(function(e) { return map[e] || e; }).join('+');
  }

  function facebookPageShortLabel(cfg) {
    var page = findFacebookPage(cfg && cfg.pageId);
    var pageLabel = (page && page.pageName) || (cfg && cfg.pageName) || (cfg && cfg.pageId) || '';
    if (!pageLabel) return 'sans page';
    return String(pageLabel).length > 18 ? String(pageLabel).slice(0, 16) + '…' : pageLabel;
  }

  function facebookOutNodeSummary(cfg) {
    if (!cfg) return 'sortant';
    var action = cfg.action === 'reply' ? 'réponse' : 'publish';
    return facebookPageShortLabel(cfg) + ' · ' + action;
  }

  function facebookNodeSummary(cfg) {
    if (!cfg) return 'écoute';
    var parts = [];
    parts.push(facebookPageShortLabel(cfg));
    var modes = cfg.ingestModes || [];
    if (modes.indexOf('push') !== -1) {
      parts.push('wh:' + facebookWebhookLabels(cfg.webhookEvents));
    }
    if (modes.indexOf('poll') !== -1) {
      var res = Array.isArray(cfg.resources) && cfg.resources.length ? cfg.resources : ['posts'];
      var short = res.map(function(r) {
        if (r === 'posts') return 'P';
        if (r === 'comments') return 'C';
        if (r === 'messages') return 'MP';
        return r;
      }).join('+');
      parts.push('poll ' + short + '/' + formatLookbackLabel(cfg.lookbackHours));
    }
    return parts.length ? parts.join(' · ') : 'écoute';
  }

  function setCardFieldsEnabled(cardId, enabled) {
    var card = document.getElementById(cardId);
    if (!card) return;
    card.style.opacity = enabled ? '1' : '0.45';
    card.querySelectorAll('input, select, textarea, button').forEach(function(el) {
      if (el.type === 'checkbox' && (el.id === 'fbResPosts' || el.id === 'fbResComments' || el.id === 'fbResMessages')) {
        return;
      }
      el.disabled = !enabled;
    });
  }

  function syncFacebookZonesUi() {
    var pushOn = !!(document.getElementById('fbModePush') && document.getElementById('fbModePush').checked);
    var pollOn = !!(document.getElementById('fbModePoll') && document.getElementById('fbModePoll').checked);
    var whEvents = document.getElementById('fbWebhookEvents');
    if (whEvents) {
      whEvents.style.opacity = pushOn ? '1' : '0.4';
      whEvents.style.pointerEvents = pushOn ? '' : 'none';
    }
    ['fbWhComments', 'fbWhMessages', 'fbWhPosts', 'fbWhNotifications'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !pushOn;
    });

    var pollBody = document.getElementById('fbPollBody');
    if (pollBody) {
      pollBody.style.opacity = pollOn ? '1' : '0.4';
      pollBody.style.pointerEvents = pollOn ? '' : 'none';
    }
    ['fbLookbackValue', 'fbLookbackUnit', 'fbPollInterval', 'fbResPosts', 'fbResComments', 'fbResMessages'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !pollOn;
    });
    var presets = document.getElementById('fbLookbackPresets');
    if (presets) presets.style.pointerEvents = pollOn ? '' : 'none';

    var postsOn = pollOn && document.getElementById('fbResPosts') && document.getElementById('fbResPosts').checked;
    var commentsOn = pollOn && document.getElementById('fbResComments') && document.getElementById('fbResComments').checked;
    var messagesOn = pollOn && document.getElementById('fbResMessages') && document.getElementById('fbResMessages').checked;
    setCardFieldsEnabled('fbPollPostsFields', postsOn);
    setCardFieldsEnabled('fbPollCommentsFields', commentsOn);
    setCardFieldsEnabled('fbPollMessagesFields', messagesOn);

    var fetchAll = document.getElementById('fbCommentsFetchAll');
    var perPost = document.getElementById('fbCommentsPerPost');
    if (perPost && fetchAll) perPost.disabled = !commentsOn || fetchAll.checked;

    var hint = document.getElementById('fbWebhookHint');
    if (hint) {
      if (!pushOn) {
        hint.textContent = 'Webhook désactivé — aucun événement temps réel ne déclenchera cet agent.';
      } else {
        var selected = [];
        if (document.getElementById('fbWhComments') && document.getElementById('fbWhComments').checked) selected.push('commentaires');
        if (document.getElementById('fbWhMessages') && document.getElementById('fbWhMessages').checked) selected.push('messages privés');
        if (document.getElementById('fbWhPosts') && document.getElementById('fbWhPosts').checked) selected.push('publications');
        if (document.getElementById('fbWhNotifications') && document.getElementById('fbWhNotifications').checked) {
          selected.push('autres notifications');
        }
        hint.textContent = selected.length
          ? ('Écoute webhook : ' + selected.join(', ') + '.')
          : 'Cochez au moins un type d’événement webhook.';
      }
    }
  }

  function syncFacebookLookbackHidden() {
    var valueEl = document.getElementById('fbLookbackValue');
    var unitEl = document.getElementById('fbLookbackUnit');
    var hidden = document.getElementById('fbLookback');
    var hint = document.getElementById('fbLookbackHint');
    if (!valueEl || !unitEl) return;
    var hours = lookbackUiToHours(valueEl.value, unitEl.value);
    if (hidden) hidden.value = String(hours);
    if (hint) {
      hint.textContent = 'Fenêtre active : ' + formatLookbackLabel(hours)
        + ' — seuls les messages créés dans cette période sont pris en compte (max 90 j).';
    }
    document.querySelectorAll('#fbLookbackPresets [data-fb-lookback-hours]').forEach(function(btn) {
      var preset = parseInt(btn.getAttribute('data-fb-lookback-hours'), 10);
      btn.classList.toggle('btn-agent', preset === hours);
      btn.classList.toggle('btn-agent-ghost', preset !== hours);
    });
  }

  function setFacebookLookbackHours(hours) {
    var ui = hoursToLookbackUi(hours);
    var valueEl = document.getElementById('fbLookbackValue');
    var unitEl = document.getElementById('fbLookbackUnit');
    if (unitEl) unitEl.value = ui.unit;
    if (valueEl) valueEl.value = ui.value;
    syncFacebookLookbackHidden();
  }

  function loadFacebookConfigPanel() {
    var node = getFacebookNode();
    if (!node) return;
    if (!node.config) node.config = defaultConfigForBrick(getBrick('facebook') || { id: 'facebook' });
    var cfg = node.config;
    var scenEl = document.getElementById('fbScenario');
    if (scenEl) scenEl.value = cfg.scenario || '';
    fillFacebookPageSelects();
    var pageEl = document.getElementById('fbPageId');
    if (pageEl && cfg.pageId) pageEl.value = cfg.pageId;
    setFacebookLookbackHours(cfg.lookbackHours != null ? cfg.lookbackHours : 168);

    var postLimit = cfg.postLimit != null ? cfg.postLimit : (cfg.limit != null ? cfg.limit : 25);
    var postLimitEl = document.getElementById('fbPostLimit');
    var limitHidden = document.getElementById('fbLimit');
    if (postLimitEl) postLimitEl.value = postLimit;
    if (limitHidden) limitHidden.value = postLimit;

    var catchupEl = document.getElementById('fbCommentCatchup');
    var perPostEl = document.getElementById('fbCommentsPerPost');
    var fetchAllEl = document.getElementById('fbCommentsFetchAll');
    var postIdsEl = document.getElementById('fbCommentPostIds');
    var convEl = document.getElementById('fbMsgConversations');
    var msgEl = document.getElementById('fbMsgPerConv');
    var intervalEl = document.getElementById('fbPollInterval');
    if (catchupEl) catchupEl.value = cfg.commentCatchupLimit != null ? cfg.commentCatchupLimit : 20;
    if (perPostEl) perPostEl.value = cfg.commentsPerPost != null ? cfg.commentsPerPost : 50;
    if (fetchAllEl) fetchAllEl.checked = !!cfg.commentsFetchAll;
    if (postIdsEl) {
      postIdsEl.value = Array.isArray(cfg.commentPostIds)
        ? cfg.commentPostIds.join('\n')
        : (cfg.commentPostIds || '');
    }
    if (convEl) convEl.value = cfg.messageConversationsLimit != null ? cfg.messageConversationsLimit : 10;
    if (msgEl) msgEl.value = cfg.messagesPerConversation != null ? cfg.messagesPerConversation : 20;
    if (intervalEl) intervalEl.value = cfg.pollIntervalMinutes != null ? cfg.pollIntervalMinutes : 15;

    var modes = cfg.ingestModes || [];
    var pushEl = document.getElementById('fbModePush');
    var pollEl = document.getElementById('fbModePoll');
    if (pushEl) pushEl.checked = modes.indexOf('push') !== -1;
    if (pollEl) pollEl.checked = modes.indexOf('poll') !== -1;
    var wh = Array.isArray(cfg.webhookEvents) && cfg.webhookEvents.length
      ? cfg.webhookEvents
      : ['comments', 'messages'];
    var whComments = document.getElementById('fbWhComments');
    var whMessages = document.getElementById('fbWhMessages');
    var whPosts = document.getElementById('fbWhPosts');
    var whNotif = document.getElementById('fbWhNotifications');
    if (whComments) whComments.checked = wh.indexOf('comments') !== -1;
    if (whMessages) whMessages.checked = wh.indexOf('messages') !== -1;
    if (whPosts) whPosts.checked = wh.indexOf('posts') !== -1;
    if (whNotif) whNotif.checked = wh.indexOf('notifications') !== -1;
    var res = cfg.resources || [];
    var postsEl = document.getElementById('fbResPosts');
    var commentsEl = document.getElementById('fbResComments');
    var messagesEl = document.getElementById('fbResMessages');
    if (postsEl) postsEl.checked = res.indexOf('posts') !== -1;
    if (commentsEl) commentsEl.checked = res.indexOf('comments') !== -1;
    if (messagesEl) messagesEl.checked = res.indexOf('messages') !== -1;
    syncFacebookZonesUi();
  }

  function applyFacebookScenario(scenario) {
    var node = getFacebookNode();
    if (!node) return;
    if (!node.config) node.config = {};
    var presets = {
      comments: {
        ingestModes: ['push', 'poll'],
        webhookEvents: ['comments'],
        resources: ['comments'],
        commentsFetchAll: true,
        scenario: 'comments'
      },
      messages: {
        ingestModes: ['push', 'poll'],
        webhookEvents: ['messages'],
        resources: ['messages'],
        scenario: 'messages'
      },
      posts: {
        ingestModes: ['poll'],
        webhookEvents: [],
        resources: ['posts'],
        scenario: 'posts'
      },
      mix: {
        ingestModes: ['push', 'poll'],
        webhookEvents: ['comments', 'messages'],
        resources: ['posts', 'comments', 'messages'],
        scenario: 'mix'
      }
    };
    var p = presets[scenario];
    if (!p) return;
    Object.keys(p).forEach(function(k) { node.config[k] = p[k]; });
    loadFacebookConfigPanel();
    renderCanvas();
  }

  function readFacebookConfigFromPanel(node) {
    if (!node.config) node.config = {};
    node.config.pageId = (document.getElementById('fbPageId') || {}).value || '';
    var selectedPage = findFacebookPage(node.config.pageId);
    node.config.pageName = selectedPage ? (selectedPage.pageName || '') : (node.config.pageName || '');
    var postLimit = clampFbInt((document.getElementById('fbPostLimit') || {}).value, 25, 1, 50);
    node.config.postLimit = postLimit;
    node.config.limit = postLimit;
    var limitHidden = document.getElementById('fbLimit');
    if (limitHidden) limitHidden.value = String(postLimit);

    node.config.commentCatchupLimit = clampFbInt(
      (document.getElementById('fbCommentCatchup') || {}).value,
      20,
      1,
      50
    );
    node.config.commentsPerPost = clampFbInt(
      (document.getElementById('fbCommentsPerPost') || {}).value,
      50,
      1,
      100
    );
    node.config.commentsFetchAll = !!(
      document.getElementById('fbCommentsFetchAll') && document.getElementById('fbCommentsFetchAll').checked
    );
    var postIdsRaw = ((document.getElementById('fbCommentPostIds') || {}).value || '').trim();
    node.config.commentPostIds = postIdsRaw
      ? postIdsRaw.split(/[\s,;]+/).map(function(s) { return s.trim(); }).filter(Boolean)
      : [];
    node.config.messageConversationsLimit = clampFbInt(
      (document.getElementById('fbMsgConversations') || {}).value,
      10,
      1,
      50
    );
    node.config.messagesPerConversation = clampFbInt(
      (document.getElementById('fbMsgPerConv') || {}).value,
      20,
      1,
      50
    );
    node.config.pollIntervalMinutes = clampFbInt(
      (document.getElementById('fbPollInterval') || {}).value,
      15,
      5,
      1440
    );

    syncFacebookLookbackHidden();
    var lookHours = clampFbInt((document.getElementById('fbLookback') || {}).value, 168, 1, 2160);
    var unit = (document.getElementById('fbLookbackUnit') || {}).value || 'hours';
    node.config.lookbackHours = lookHours;
    node.config.lookbackUnit = unit;
    node.config.scenario = (document.getElementById('fbScenario') || {}).value || '';
    var modes = [];
    if (document.getElementById('fbModePush') && document.getElementById('fbModePush').checked) modes.push('push');
    if (document.getElementById('fbModePoll') && document.getElementById('fbModePoll').checked) modes.push('poll');
    node.config.ingestModes = modes.length ? modes : ['poll'];
    var webhookEvents = [];
    if (document.getElementById('fbWhComments') && document.getElementById('fbWhComments').checked) webhookEvents.push('comments');
    if (document.getElementById('fbWhMessages') && document.getElementById('fbWhMessages').checked) webhookEvents.push('messages');
    if (document.getElementById('fbWhPosts') && document.getElementById('fbWhPosts').checked) webhookEvents.push('posts');
    if (document.getElementById('fbWhNotifications') && document.getElementById('fbWhNotifications').checked) {
      webhookEvents.push('notifications');
    }
    node.config.webhookEvents = webhookEvents.length ? webhookEvents : ['comments', 'messages'];
    var resources = [];
    if (document.getElementById('fbResPosts') && document.getElementById('fbResPosts').checked) resources.push('posts');
    if (document.getElementById('fbResComments') && document.getElementById('fbResComments').checked) resources.push('comments');
    if (document.getElementById('fbResMessages') && document.getElementById('fbResMessages').checked) resources.push('messages');
    node.config.resources = resources.length ? resources : (modes.indexOf('poll') !== -1 ? ['posts'] : []);
  }

  function saveFacebookConfigPanel() {
    var node = getFacebookNode();
    if (!node) return alert('Ajoutez le déclencheur Facebook sur le canvas.');
    readFacebookConfigFromPanel(node);
    alert('Config Facebook enregistrée sur le nœud (pensez à Enregistrer l\'agent pour l\'appliquer au connecteur).');
    renderCanvas();
  }

  function generateReviewPageFromAi(node, btnEl) {
    if (!node) return;
    // Sync champs du formulaire (reviewContext, etc.) avant l'appel
    var host = document.getElementById('agentConfig');
    if (host) {
      host.querySelectorAll('[data-key]').forEach(function(el) {
        var key = el.getAttribute('data-key');
        if (!key) return;
        if (el.type === 'checkbox') node.config[key] = !!el.checked;
        else node.config[key] = el.value;
      });
    }
    readIdentityFromDom();

    var ns = (node.config && node.config.templateNamespace)
      || cfg.defaultReviewNamespace
      || 'agent:review:invoice';
    node.config.templateNamespace = ns;

    var agentContext = state.agentContext || '';
    var reviewContext = (node.config && node.config.reviewContext) || '';
    if (!agentContext && !reviewContext) {
      alert('Renseignez au moins le contexte général de l\'agent ou le contexte de la page de validation.');
      return;
    }
    if (!confirm('Générer la page « ' + ns + ' » par IA ? La mise en page existante sera remplacée.')) return;

    var statusEl = document.getElementById('reviewAiStatus');
    var apiDoc = (cfg.docApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/agent-documentaire-v2')).replace(/\/$/, '');
    if (btnEl) btnEl.disabled = true;
    if (statusEl) statusEl.textContent = 'Génération IA en cours…';

    return fetch(apiDoc + '/templates/' + encodeURIComponent(ns) + '/generate-ai', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        agentContext: agentContext,
        reviewContext: reviewContext,
        brief: reviewContext || agentContext,
        save: true,
        entrepriseId: resolveEditorEntrepriseId() || undefined
      })
    })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.error || data.message || 'Échec génération');
        if (statusEl) {
          statusEl.textContent = (data.message || 'OK')
            + (data.source === 'ia' ? ' — ouvrez l\'éditeur pour ajuster.' : ' — modèle de secours (IA indisponible).');
        }
        window.open(docEditorUrl(ns), '_blank', 'noopener');
      })
      .catch(function(e) {
        if (statusEl) statusEl.textContent = e.message;
        alert(e.message);
      })
      .finally(function() {
        if (btnEl) btnEl.disabled = false;
      });
  }

  function docEditorUrl(namespace) {
    var base = (cfg.docEditorBaseUrl || '').replace(/\?.*$/, '');
    if (!base) return '#';
    var ns = namespace || cfg.defaultReviewNamespace || 'agent:review:invoice';
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'template=' + encodeURIComponent(ns);
  }

  function syncDocEditorLink() {
    var input = document.getElementById('docReviewTemplateNs');
    var link = document.getElementById('btnDocOpenEditor');
    var hint = document.getElementById('docReviewEditorHint');
    var ns = (input && input.value.trim()) || cfg.defaultReviewNamespace || 'agent:review:invoice';
    if (link) {
      link.href = docEditorUrl(ns);
      link.textContent = 'Ouvrir l\'éditeur HTML (« ' + ns + ' »)';
    }
    if (hint) {
      hint.textContent = ns
        ? 'Éditeur : ' + ns + ' — enregistrez le template puis liez le même namespace ci-dessous.'
        : 'Choisissez ou créez un namespace, puis ouvrez l\'éditeur.';
    }
  }

  function ensureDocReviewNode() {
    var node = state.nodes.find(function(n) { return n.brickId === 'human-doc-review'; });
    if (!node) {
      alert('Ajoutez la brique « Revue documentaire » sur le canvas.');
      return null;
    }
    if (!node.config) node.config = {};
    return node;
  }

  function bootstrapInvoiceReviewTemplate(force) {
    var ns = cfg.defaultReviewNamespace || 'agent:review:invoice';
    var input = document.getElementById('docReviewTemplateNs');
    if (input && input.value.trim()) ns = input.value.trim();
    else if (input) input.value = ns;

    var apiDoc = (cfg.docApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/agent-documentaire-v2')).replace(/\/$/, '');
    return fetch(apiDoc + '/templates/' + encodeURIComponent(ns) + '/ensure-seed', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ force: !!force })
    })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.error || data.message || 'Création impossible');
        var node = ensureDocReviewNode();
        if (node) {
          node.config.templateNamespace = ns;
          if (input) input.value = ns;
        }
        syncDocEditorLink();
        renderConfig();
        return ns;
      });
  }

  function loadDocReviewConfigPanel() {
    var input = document.getElementById('docReviewTemplateNs');
    if (!input) return;
    var node = state.nodes.find(function(n) { return n.brickId === 'human-doc-review'; });
    input.value = (node && node.config && node.config.templateNamespace)
      || cfg.defaultReviewNamespace
      || 'agent:review:invoice';
    syncDocEditorLink();
    if (!input._docNsBound) {
      input._docNsBound = true;
      input.addEventListener('input', syncDocEditorLink);
      input.addEventListener('change', syncDocEditorLink);
    }
  }

  function saveDocReviewConfigPanel() {
    var input = document.getElementById('docReviewTemplateNs');
    var node = ensureDocReviewNode();
    if (!node) return;
    node.config.templateNamespace = input ? input.value.trim() : '';
    syncDocEditorLink();
    alert('Config document enregistrée sur le nœud (pensez à Enregistrer l\'agent).');
    renderConfig();
  }

  function loadAnalyseConfigPanel() {
    if (!state.flowId) {
      document.getElementById('intentionsList').innerHTML = '<p class="empty">Enregistrez l\'agent d\'abord.</p>';
      return;
    }
    fetch(API + '/flows/' + state.flowId + '/brick-config/analyse-intention', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message);
        state.analyseConfig = (data.data && data.data.config) || { intentions: [], basePrompt: '' };
        document.getElementById('analyseBasePrompt').value = state.analyseConfig.basePrompt || '';
        var modeEl = document.getElementById('intentionMode');
        if (modeEl) modeEl.value = state.analyseConfig.intentionMode || 'fixed';
        var map = state.analyseConfig.intentionSetBySource || {};
        var mapMail = document.getElementById('intentionMapMail');
        var mapFb = document.getElementById('intentionMapFacebook');
        var mapContact = document.getElementById('intentionMapContact');
        if (mapMail) mapMail.value = map.mail || 'mail';
        if (mapFb) mapFb.value = map.facebook || 'reseaux-sociaux';
        if (mapContact) mapContact.value = map.contact || 'contact';
        syncIntentionModeUi();
        renderIntentionsList();
      })
      .catch(function(e) {
        document.getElementById('intentionsList').innerHTML = '<p class="empty">' + e.message + '</p>';
      });
  }

  function syncIntentionPresetSelect() {
    var sel = document.getElementById('intentionPresetSelect');
    if (!sel || !state.analyseConfig) return;
    var presetId = state.analyseConfig.intentionPresetId || '';
    if (presetId && Array.prototype.some.call(sel.options, function(o) { return o.value === presetId; })) {
      sel.value = presetId;
    }
  }

  function syncIntentionModeUi() {
    var modeEl = document.getElementById('intentionMode');
    var bySource = document.getElementById('intentionBySourceMap');
    var mode = modeEl ? modeEl.value : 'fixed';
    if (bySource) bySource.style.display = mode === 'by-source' ? '' : 'none';
  }

  function renderIntentionsList() {
    var list = document.getElementById('intentionsList');
    var items = (state.analyseConfig && state.analyseConfig.intentions) || [];
    syncIntentionPresetSelect();
    if (!items.length) {
      list.innerHTML = '<p class="empty">Aucune intention. Chargez une liste préconstruite ou ajoutez-en une.</p>';
      return;
    }
    list.innerHTML = items.map(function(it, idx) {
      return '<div class="intention-row" data-idx="' + idx + '">'
        + '<label class="intention-field-label">Nom</label>'
        + '<input data-f="name" class="form-control intention-name" placeholder="ex: commercial" value="' + escapeHtml(it.name || '') + '">'
        + '<label class="intention-field-label">Définition</label>'
        + '<textarea data-f="definition" class="form-control intention-definition" rows="4" placeholder="Description complète utilisée pour l\'analyse IA…">' + escapeHtml(it.definition || '') + '</textarea>'
        + '<button type="button" class="btn-agent-ghost btn-rm-intention" data-idx="' + idx + '">Supprimer</button>'
        + '</div>';
    }).join('');

    list.querySelectorAll('.intention-row').forEach(function(row) {
      row.querySelectorAll('[data-f]').forEach(function(input) {
        input.addEventListener('input', function() {
          var i = parseInt(row.getAttribute('data-idx'), 10);
          var f = input.getAttribute('data-f');
          state.analyseConfig.intentions[i][f] = input.value;
        });
      });
    });
    list.querySelectorAll('.btn-rm-intention').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        state.analyseConfig.intentions.splice(i, 1);
        renderIntentionsList();
      });
    });
  }

  function applyIntentionPreset(presetId) {
    if (!presetId) return Promise.resolve();
    return fetch(API + '/intention-presets/' + encodeURIComponent(presetId), { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success || !data.preset) throw new Error(data.message || 'Preset introuvable');
        var existing = (state.analyseConfig && state.analyseConfig.intentions) || [];
        if (existing.length && !confirm('Remplacer la liste d\'intentions actuelle par « ' + (data.preset.label || presetId) + ' » ?')) {
          return;
        }
        var keepPrompt = (state.analyseConfig && state.analyseConfig.basePrompt) || '';
        state.analyseConfig = data.analyseConfig || {
          basePrompt: '',
          intentions: data.preset.intentions || [],
          intentionPresetId: data.preset.id
        };
        state.analyseConfig.basePrompt = keepPrompt;
        state.analyseConfig.intentionPresetId = data.preset.id;
        document.getElementById('analyseBasePrompt').value = keepPrompt;
        renderIntentionsList();

        // Toujours aligner le routage sur la nouvelle liste (conserve les cibles homonymes)
        syncRouteRulesFromIntentions(state.analyseConfig.intentions || []);
        if (document.getElementById('routingRulesList')) renderRoutingRules();
      });
  }

  function syncRouteRulesFromIntentions(intentions) {
    var names = [];
    var seen = {};
    (intentions || []).forEach(function(it) {
      var name = String(it.name || it.id || '').trim();
      if (!name) return;
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      names.push(name);
    });

    if (!state.routeConfig) {
      state.routeConfig = {
        rules: [],
        defaultTarget: { type: 'emails', to: [] },
        subjectTemplate: '[{{intention}}] {{subject}}',
        bodyTemplate: 'Intention: {{intention}}\n\nMessage:\n{{body}}'
      };
    }

    var byKey = {};
    (state.routeConfig.rules || []).forEach(function(r) {
      var key = String((r.when && r.when.intention) || '').trim().toLowerCase();
      if (!key || byKey[key]) return;
      byKey[key] = r;
    });

    state.routeConfig.rules = names.map(function(name) {
      var prev = byKey[name.toLowerCase()];
      return {
        when: { intention: name },
        target: ensureRouteTarget((prev && prev.target) || { type: 'emails', to: [] })
      };
    });

    if (!state.routeConfig.defaultTarget) {
      state.routeConfig.defaultTarget = { type: 'emails', to: [] };
    }
    return state.routeConfig;
  }

  function ensureAnalyseConfigLoaded() {
    if (state.analyseConfig && Array.isArray(state.analyseConfig.intentions)) {
      return Promise.resolve(state.analyseConfig);
    }
    if (!state.flowId) return Promise.resolve(null);
    return fetch(API + '/flows/' + state.flowId + '/brick-config/analyse-intention', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (data.success) {
          state.analyseConfig = (data.data && data.data.config) || { intentions: [], basePrompt: '' };
        }
        return state.analyseConfig;
      })
      .catch(function() { return null; });
  }

  var ROUTE_TARGET_TYPES = [
    { id: 'emails', label: 'Emails' },
    { id: 'annuaire-service', label: 'Service Annuaire' },
    { id: 'flow-branch', label: 'Branche du flow' },
    { id: 'continue', label: 'Suite du flow' },
    { id: 'stop', label: 'Arrêter' }
  ];

  function loadRouteConfigPanel() {
    if (!state.flowId) {
      document.getElementById('routingRulesList').innerHTML = '<p class="empty">Enregistrez l\'agent d\'abord.</p>';
      return;
    }
    ensureAnalyseConfigLoaded()
      .then(function() {
        return fetch(API + '/flows/' + state.flowId + '/brick-config/route-intention', { headers: headers() });
      })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message);
        state.routeConfig = (data.data && data.data.config) || {
          rules: [],
          defaultTarget: { type: 'emails', to: [] }
        };
        if (!state.routeConfig.defaultTarget) {
          state.routeConfig.defaultTarget = { type: 'emails', to: [] };
        }
        document.getElementById('routeSubjectTpl').value = state.routeConfig.subjectTemplate || '[{{intention}}] {{subject}}';
        document.getElementById('routeBodyTpl').value = state.routeConfig.bodyTemplate || 'Intention: {{intention}}\n\n{{body}}';
        syncRouteRulesFromIntentions((state.analyseConfig && state.analyseConfig.intentions) || []);
        renderRoutingRules();
      })
      .catch(function(e) {
        document.getElementById('routingRulesList').innerHTML = '<p class="empty">' + e.message + '</p>';
      });
  }

  function canvasNodeOptionsHtml(selected) {
    var sel = String(selected || '').trim();
    var opts = ['<option value="">— Nœud cible —</option>'];
    var known = {};
    (state.nodes || []).forEach(function(n) {
      if (!n || n.kind === 'trigger') return;
      known[n.id] = true;
      var label = (n.name || n.brickId || n.id) + ' (' + (n.brickId || '') + ')';
      opts.push(
        '<option value="' + escapeHtml(n.id) + '"' + (n.id === sel ? ' selected' : '') + '>' +
        escapeHtml(label) + '</option>'
      );
    });
    if (sel && !known[sel]) {
      opts.push('<option value="' + escapeHtml(sel) + '" selected>' + escapeHtml(sel) + '</option>');
    }
    return opts.join('');
  }

  function targetTypeOptionsHtml(selected) {
    var sel = String(selected || 'emails').toLowerCase();
    return ROUTE_TARGET_TYPES.map(function(t) {
      return '<option value="' + t.id + '"' + (t.id === sel ? ' selected' : '') + '>' + escapeHtml(t.label) + '</option>';
    }).join('');
  }

  function ensureRouteTarget(target) {
    var t = target && typeof target === 'object' ? target : {};
    var type = String(t.type || 'emails').toLowerCase();
    if (type === 'annuaire-service') return { type: type, serviceId: String(t.serviceId || '') };
    if (type === 'flow-branch') return { type: type, nextStepId: String(t.nextStepId || t.nextId || '') };
    if (type === 'stop' || type === 'continue') return { type: type };
    return {
      type: 'emails',
      to: Array.isArray(t.to) ? t.to.slice() : (t.to ? [String(t.to)] : [])
    };
  }

  function routeTargetFieldsHtml(target, prefix) {
    var t = ensureRouteTarget(target);
    var html = '<label class="intention-field-label">Type de cible</label>'
      + '<select data-f="targetType" data-prefix="' + prefix + '" class="form-control route-target-type">'
      + targetTypeOptionsHtml(t.type) + '</select>';

    if (t.type === 'emails') {
      html += '<label class="intention-field-label">Emails destinataires</label>'
        + '<textarea data-f="to" data-prefix="' + prefix + '" class="form-control route-emails" rows="2" '
        + 'placeholder="destinataire@exemple.fr, autre@exemple.fr">'
        + escapeHtml((t.to || []).join(', ')) + '</textarea>';
    } else if (t.type === 'annuaire-service') {
      html += '<label class="intention-field-label">ID service Annuaire</label>'
        + '<input data-f="serviceId" data-prefix="' + prefix + '" class="form-control route-field" '
        + 'placeholder="ObjectId du service" value="' + escapeHtml(t.serviceId || '') + '">';
    } else if (t.type === 'flow-branch') {
      html += '<label class="intention-field-label">Nœud suivant (branche)</label>'
        + '<select data-f="nextStepId" data-prefix="' + prefix + '" class="form-control route-field">'
        + canvasNodeOptionsHtml(t.nextStepId) + '</select>'
        + '<p class="text-muted small" style="margin:6px 0 0; color:#64748b;">Ex. brancher « devis » vers une brique de création de devis.</p>';
    } else if (t.type === 'continue') {
      html += '<p class="text-muted small" style="margin:8px 0 0; color:#64748b;">Suit le lien canvas de la brique Routage.</p>';
    } else if (t.type === 'stop') {
      html += '<p class="text-muted small" style="margin:8px 0 0; color:#64748b;">Le run s\'arrête après le routage.</p>';
    }
    return html;
  }

  function applyRouteTargetField(targetRef, field, value) {
    if (field === 'targetType') {
      var next = ensureRouteTarget({ type: value });
      Object.keys(targetRef).forEach(function(k) { delete targetRef[k]; });
      Object.keys(next).forEach(function(k) { targetRef[k] = next[k]; });
      return true;
    }
    if (field === 'to') {
      targetRef.type = 'emails';
      targetRef.to = String(value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      delete targetRef.serviceId;
      delete targetRef.nextStepId;
      return false;
    }
    if (field === 'serviceId') {
      targetRef.type = 'annuaire-service';
      targetRef.serviceId = String(value || '').trim();
      delete targetRef.to;
      delete targetRef.nextStepId;
      return false;
    }
    if (field === 'nextStepId') {
      targetRef.type = 'flow-branch';
      targetRef.nextStepId = String(value || '').trim();
      delete targetRef.to;
      delete targetRef.serviceId;
      return false;
    }
    return false;
  }

  function bindRouteTargetFields(root, getTarget, onTypeChange) {
    if (!root) return;
    root.querySelectorAll('[data-f]').forEach(function(input) {
      var handler = function() {
        var f = input.getAttribute('data-f');
        var target = getTarget();
        if (!target) return;
        var rerender = applyRouteTargetField(target, f, input.value);
        if (rerender && typeof onTypeChange === 'function') onTypeChange();
      };
      input.addEventListener('input', handler);
      if (input.tagName === 'SELECT') input.addEventListener('change', handler);
    });
  }

  function renderRoutingRules() {
    var list = document.getElementById('routingRulesList');
    var defaultBox = document.getElementById('routingDefaultTarget');
    if (!state.routeConfig) {
      state.routeConfig = { rules: [], defaultTarget: { type: 'emails', to: [] } };
    }
    syncRouteRulesFromIntentions((state.analyseConfig && state.analyseConfig.intentions) || []);
    var rules = state.routeConfig.rules || [];

    if (!rules.length) {
      list.innerHTML = '<p class="empty">Aucune intention dans la liste — ajoutez-en dans l\'onglet Intentions. En attendant, la cible par défaut s\'applique.</p>';
    } else {
      list.innerHTML = rules.map(function(rule, idx) {
        var intention = (rule.when && rule.when.intention) || '';
        rule.target = ensureRouteTarget(rule.target);
        return '<div class="route-row" data-idx="' + idx + '">'
          + '<div class="route-intention-label">' + escapeHtml(intention) + '</div>'
          + routeTargetFieldsHtml(rule.target, 'rule:' + idx)
          + '</div>';
      }).join('');
    }

    if (defaultBox) {
      state.routeConfig.defaultTarget = ensureRouteTarget(
        state.routeConfig.defaultTarget || { type: 'emails', to: [] }
      );
      defaultBox.innerHTML = '<h3 style="margin:0 0 8px; color:#cbd5e1; font-size:1rem;">Cible par défaut</h3>'
        + '<p class="text-muted small" style="margin:0 0 10px; color:#64748b;">Si l\'intention détectée n\'est pas dans la liste.</p>'
        + routeTargetFieldsHtml(state.routeConfig.defaultTarget, 'default');
    }

    list.querySelectorAll('.route-row').forEach(function(row) {
      var idx = parseInt(row.getAttribute('data-idx'), 10);
      bindRouteTargetFields(row, function() {
        if (!state.routeConfig.rules[idx].target) state.routeConfig.rules[idx].target = { type: 'emails', to: [] };
        return state.routeConfig.rules[idx].target;
      }, renderRoutingRules);
    });

    if (defaultBox) {
      bindRouteTargetFields(defaultBox, function() {
        if (!state.routeConfig.defaultTarget) state.routeConfig.defaultTarget = { type: 'emails', to: [] };
        return state.routeConfig.defaultTarget;
      }, renderRoutingRules);
    }
  }

  function saveFlow() {
    var fbNode = getFacebookNode();
    if (fbNode && document.getElementById('panelFacebook')) {
      readFacebookConfigFromPanel(fbNode);
    }
    readIdentityFromDom();
    var payload = buildPayload();
    var url = state.flowId ? (API + '/flows/' + state.flowId) : (API + '/flows');
    var method = state.flowId ? 'PUT' : 'POST';

    return fetch(url, { method: method, headers: headers(), body: JSON.stringify(payload) })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Erreur sauvegarde');
        if (!state.flowId && data.flow && data.flow._id) {
          state.flowId = String(data.flow._id);
          var u = new URL(window.location.href);
          u.searchParams.set('flowId', state.flowId);
          window.history.replaceState({}, '', u.pathname + u.search);
        }
        var syncMsg = '';
        if (data.facebookSync && data.facebookSync.matched > 0) {
          syncMsg = ' Volume/fenêtre appliqués au connecteur Facebook ('
            + data.facebookSync.modified + '/' + data.facebookSync.matched + ').';
        }
        alert('Agent enregistré.' + syncMsg);
      });
  }

  function runFlow() {
    var body = {};
    var isFb =
      state.nodes.some(function(n) { return n.brickId === 'facebook'; }) ||
      (state.nodes.some(function(n) { return n.brickId === 'analyse-intention'; }) &&
        /facebook/i.test(state.name || ''));
    if (isFb) body.fetchLatestPost = true;

    function doRun() {
      return fetch(API + '/flows/' + state.flowId + '/run', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
      }).then(parseJson).then(function(data) {
        if (!data.success) throw new Error(data.message);
        if (data.run && data.run.status === 'waiting_human') {
          var review = (reviewPageUrl || 'pages/agent-human-review.php') +
            '?runId=' + encodeURIComponent(data.run._id);
          if (confirm('Validation humaine requise. Ouvrir la page de revue ?')) {
            window.location.href = review;
          }
          return;
        }
        var msg = data.triggerMessage;
        if (msg && msg.text) {
          alert(
            'Agent lancé.\n\nDernier post analysé :\n' +
            String(msg.text).slice(0, 400) +
            (msg.permalink_url ? '\n\n' + msg.permalink_url : '')
          );
        } else {
          alert('Agent lancé.');
        }
      });
    }

    if (!state.flowId) {
      return saveFlow().then(function() {
        if (!state.flowId) throw new Error('Enregistrez l\'agent avant de le lancer.');
        return doRun();
      });
    }
    return doRun();
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

  function initCanvasKeyboard() {
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Delete' && e.key !== 'Del') return;
      if (state.activeTab !== 'canvas') return;
      if (isEditableKeyboardTarget(e.target)) return;
      if (!state.selectedNodeId) return;
      e.preventDefault();
      deleteSelectedNode();
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
              if (fd.flow && fd.flow.entrepriseId) {
                state.entrepriseId = String(fd.flow.entrepriseId);
              }
              loadFromFlow(fd.flow);
              return loadFacebookPages();
            })
            .then(function() {
              fillFacebookPageSelects();
            });
        }

        return loadFacebookPages().then(function() {
          render();
          fillFacebookPageSelects();
        });
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

    var imgUrl = document.getElementById('agentImageUrl');
    if (imgUrl) {
      imgUrl.addEventListener('change', function() {
        state.imageUrl = imgUrl.value.trim();
        syncIdentityFields();
      });
    }
    var modeEl = document.getElementById('agentInteractionMode');
    if (modeEl) {
      modeEl.addEventListener('change', function() {
        state.interactionMode = modeEl.value || 'auto';
      });
    }
    var ctxEl = document.getElementById('agentContext');
    if (ctxEl) {
      ctxEl.addEventListener('input', function() {
        state.agentContext = ctxEl.value;
      });
      ctxEl.addEventListener('change', function() {
        state.agentContext = ctxEl.value.trim();
      });
    }
    var btnSaveDoc = document.getElementById('btnSaveDocReview');
    if (btnSaveDoc) {
      btnSaveDoc.addEventListener('click', saveDocReviewConfigPanel);
    }
    var btnDocCreate = document.getElementById('btnDocCreateInvoiceTpl');
    if (btnDocCreate) {
      btnDocCreate.addEventListener('click', function() {
        bootstrapInvoiceReviewTemplate(false)
          .then(function(ns) {
            window.open(docEditorUrl(ns), '_blank', 'noopener');
          })
          .catch(function(e) { alert(e.message); });
      });
    }
    var btnDocAi = document.getElementById('btnDocAiBootstrap');
    if (btnDocAi) {
      btnDocAi.addEventListener('click', function() {
        if (!confirm('Réinitialiser le modèle de départ « Revue facture » (sans IA) puis ouvrir l\'éditeur ?')) return;
        bootstrapInvoiceReviewTemplate(true)
          .then(function(ns) {
            window.open(docEditorUrl(ns), '_blank', 'noopener');
          })
          .catch(function(e) { alert(e.message); });
      });
    }
    var btnDocGenAi = document.getElementById('btnDocGenerateAi');
    if (btnDocGenAi) {
      btnDocGenAi.addEventListener('click', function() {
        var ns = cfg.defaultReviewNamespace || 'agent:review:invoice';
        var input = document.getElementById('docReviewTemplateNs');
        if (input && input.value.trim()) ns = input.value.trim();
        else if (input) input.value = ns;
        var briefEl = document.getElementById('docReviewAiBrief');
        var statusEl = document.getElementById('docReviewAiStatus');
        var brief = briefEl ? briefEl.value.trim() : '';
        if (!brief) {
          brief = 'Page de revue facture mail : en-tête, expéditeur/sujet, corps, pièces jointes téléchargeables.';
        }
        if (!confirm('Générer la page « ' + ns + ' » par IA ? La mise en page existante sera remplacée.')) return;
        var apiDoc = (cfg.docApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/agent-documentaire-v2')).replace(/\/$/, '');
        btnDocGenAi.disabled = true;
        if (statusEl) statusEl.textContent = 'Génération IA en cours…';
        fetch(apiDoc + '/templates/' + encodeURIComponent(ns) + '/generate-ai', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            brief: brief,
            save: true,
            entrepriseId: ENTREPRISE_ID || undefined
          })
        })
          .then(parseJson)
          .then(function(data) {
            if (!data.success) throw new Error(data.error || data.message || 'Échec génération');
            var node = ensureDocReviewNode();
            if (node) node.config.templateNamespace = ns;
            syncDocEditorLink();
            if (statusEl) {
              statusEl.textContent = (data.message || 'OK')
                + (data.source === 'ia' ? ' — ouvrez l\'éditeur pour ajuster.' : ' — modèle de secours (IA indisponible).');
            }
            window.open(docEditorUrl(ns), '_blank', 'noopener');
          })
          .catch(function(e) {
            if (statusEl) statusEl.textContent = e.message;
            alert(e.message);
          })
          .finally(function() {
            btnDocGenAi.disabled = false;
          });
      });
    }

    document.querySelectorAll('.agent-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setActiveTab(btn.getAttribute('data-tab'));
      });
    });

    var btnApplyPreset = document.getElementById('btnApplyIntentionPreset');
    if (btnApplyPreset) {
      btnApplyPreset.addEventListener('click', function() {
        var sel = document.getElementById('intentionPresetSelect');
        var presetId = sel ? sel.value : '';
        if (!presetId) return alert('Choisissez une liste préconstruite.');
        applyIntentionPreset(presetId).catch(function(e) { alert(e.message); });
      });
    }
    var presetSelect = document.getElementById('intentionPresetSelect');
    if (presetSelect) {
      var PRESET_HINTS = {
        mail: 'Boîte mail : commercial, SAV, technique, administratif…',
        'reseaux-sociaux': 'Commentaires / posts : commercial, critique, positif, spam…',
        contact: 'Formulaire web : devis, info, RDV, recrutement…'
      };
      presetSelect.addEventListener('change', function() {
        var hint = document.getElementById('intentionPresetHint');
        if (!hint) return;
        hint.textContent = PRESET_HINTS[presetSelect.value] ||
          'Remplace la liste actuelle et resynchronise les points de routage.';
      });
    }

    var btnAddIntention = document.getElementById('btnAddIntention');
    if (btnAddIntention) {
      btnAddIntention.addEventListener('click', function() {
        if (!state.analyseConfig) state.analyseConfig = { intentions: [], basePrompt: '' };
        if (!state.analyseConfig.intentions) state.analyseConfig.intentions = [];
        state.analyseConfig.intentions.push({ id: 'new-' + Date.now(), name: '', definition: '', priority: 'medium' });
        renderIntentionsList();
      });
    }
    var btnSaveIntentions = document.getElementById('btnSaveIntentions');
    if (btnSaveIntentions) {
      btnSaveIntentions.addEventListener('click', function() {
        if (!state.flowId) return alert('Enregistrez l\'agent d\'abord.');
        state.analyseConfig.basePrompt = document.getElementById('analyseBasePrompt').value;
        delete state.analyseConfig.defaultEmails;
        if (Array.isArray(state.analyseConfig.intentions)) {
          state.analyseConfig.intentions = state.analyseConfig.intentions.map(function(it) {
            return {
              id: it.id || it.name,
              name: it.name || '',
              definition: it.definition || '',
              priority: it.priority || 'medium'
            };
          });
        }
        var modeEl = document.getElementById('intentionMode');
        state.analyseConfig.intentionMode = modeEl ? modeEl.value : 'fixed';
        state.analyseConfig.intentionSetBySource = {
          mail: (document.getElementById('intentionMapMail') || {}).value || 'mail',
          facebook: (document.getElementById('intentionMapFacebook') || {}).value || 'reseaux-sociaux',
          contact: (document.getElementById('intentionMapContact') || {}).value || 'contact'
        };
        fetch(API + '/flows/' + state.flowId + '/brick-config/analyse-intention', {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({ config: state.analyseConfig })
        }).then(parseJson).then(function(d) {
          if (!d.success) throw new Error(d.message);
          if (d.routeConfig) {
            state.routeConfig = d.routeConfig;
          } else {
            syncRouteRulesFromIntentions(state.analyseConfig.intentions || []);
          }
          if (document.getElementById('routingRulesList')) renderRoutingRules();
          alert('Intentions enregistrées — points de routage resynchronisés.');
        }).catch(function(e) { alert(e.message); });
      });
    }
    var intentionModeEl = document.getElementById('intentionMode');
    if (intentionModeEl) {
      intentionModeEl.addEventListener('change', syncIntentionModeUi);
    }
    var btnSaveFb = document.getElementById('btnSaveFacebook');
    if (btnSaveFb) btnSaveFb.addEventListener('click', saveFacebookConfigPanel);
    var fbPageSel = document.getElementById('fbPageId');
    if (fbPageSel) {
      fbPageSel.addEventListener('change', function() {
        var node = getFacebookNode();
        if (!node) return;
        if (!node.config) node.config = {};
        node.config.pageId = fbPageSel.value || '';
        var page = findFacebookPage(node.config.pageId);
        node.config.pageName = page ? (page.pageName || '') : '';
        renderCanvas();
      });
    }
    document.querySelectorAll('#fbLookbackPresets [data-fb-lookback-hours]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setFacebookLookbackHours(btn.getAttribute('data-fb-lookback-hours'));
      });
    });
    var lookVal = document.getElementById('fbLookbackValue');
    var lookUnit = document.getElementById('fbLookbackUnit');
    if (lookVal) lookVal.addEventListener('input', syncFacebookLookbackHidden);
    if (lookVal) lookVal.addEventListener('change', syncFacebookLookbackHidden);
    if (lookUnit) lookUnit.addEventListener('change', syncFacebookLookbackHidden);
    [
      'fbModePush',
      'fbModePoll',
      'fbWhComments',
      'fbWhMessages',
      'fbWhPosts',
      'fbWhNotifications',
      'fbResPosts',
      'fbResComments',
      'fbResMessages',
      'fbCommentsFetchAll'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', syncFacebookZonesUi);
    });
    document.querySelectorAll('[data-fb-scenario]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        applyFacebookScenario(btn.getAttribute('data-fb-scenario'));
      });
    });
    var btnSaveRouting = document.getElementById('btnSaveRouting');
    if (btnSaveRouting) {
      btnSaveRouting.addEventListener('click', function() {
        if (!state.flowId) return alert('Enregistrez l\'agent d\'abord.');
        syncRouteRulesFromIntentions((state.analyseConfig && state.analyseConfig.intentions) || []);
        state.routeConfig.subjectTemplate = document.getElementById('routeSubjectTpl').value;
        state.routeConfig.bodyTemplate = document.getElementById('routeBodyTpl').value;
        fetch(API + '/flows/' + state.flowId + '/brick-config/route-intention', {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({ config: state.routeConfig })
        }).then(parseJson).then(function(d) {
          if (!d.success) throw new Error(d.message);
          alert('Routage enregistré.');
        }).catch(function(e) { alert(e.message); });
      });
    }

    initCanvasDnD();
    initCanvasKeyboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
