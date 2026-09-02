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
  var isGdriAdmin = !!cfg.isGdriAdmin;
  var reviewPageUrl = cfg.reviewPageUrl || '';
  var runPageUrl = cfg.runPageUrl || '';

  var DEFAULT_OPS = {
    trigger: null,
    data: 'data.read',
    condition: 'condition.if',
    loop: 'loop.run',
    action: 'action.run',
    ia: 'ia.run',
    validation: 'validation.pause',
    visualization: 'visualization.run',
    output: 'output.emit'
  };

  var FAMILY_ORDER = ['trigger', 'data', 'condition', 'loop', 'action', 'ia', 'visualization', 'validation', 'output'];

  var NODE_WIDTH = 180;
  var PORT_STEM = 18;
  var LOOP_U_GAP = 28;
  var LOOP_U_RADIUS = 10;

  var state = {
    flowId: flowId,
    name: 'Nouvel agent',
    description: '',
    enabled: true,
    imageUrl: '',
    interactionMode: 'auto',
    agentContext: '',
    vizDesign: {
      templateId: '',
      logoUrl: '',
      prompt: 'Page web claire : en-tête avec logo, barre d’onglets (données / pièces), cartes De / Sujet / Message / pièces jointes, boutons Valider et Rejeter.',
      colors: { primary: '#1d4ed8', background: '#f1f5f9', surface: '#ffffff', text: '#0f172a', muted: '#64748b' },
      zones: ['nav', 'data']
    },
    app: { publish: 'auto', buttonLabel: 'Lancer', pages: [] },
    palette: { publish: false, iconEmoji: '🪝', parentFamily: 'action', hookSurface: 'palette', rowId: '', description: '' },
    exports: {},
    bricks: [],
    bricksById: {},
    nodes: [],
    selectedNodeId: null,
    linking: null,
    paletteDragActive: false,
    suppressAutoConnectUntil: 0,
    paletteClickTimer: null,
    activeTab: 'canvas',
    analyseConfig: null,
    routeConfig: null,
    docReviewConfig: null,
    facebookPages: [],
    facebookPagesLoaded: false,
        facebookPagesError: null,
    facebookPanelLoaded: false,
    activeChannelNodeId: null,
    mailConfig: null,
    mailConfigLoaded: false,
    connectorInstances: [],
    connectorTypes: [],
    connectorInstancesLoaded: false,
    dataContracts: null,
    actionContracts: null,
    zoneContracts: null,
    docCollections: [],
    docCollectionsLoaded: false,
    docCollectionsError: null,
    intentionPresets: [],
    intentionPresetsLoaded: false,
    blockTemplatesByUsage: {},
    productionTemplatesByUsage: {},
    blockTemplateDetails: {},
    subAgentById: {},
    hookCatalog: null,
    paletteCatalog: [],
    paletteHookForm: false,
    entityLlms: [],
    entityLlmsLoaded: false,
    entityLlmsPromise: null,
    lastWebhookPresetId: null,
    selectedLink: null,
    entrepriseId: ENTREPRISE_ID,
    /** 'v' | 'h' par lien source>target — évite le flip de ports au seuil 45° */
    portOrientByLink: {},
    runDebug: null,
    runPollTimer: null,
    expertView: false
  };

  var EXPERT_VIEW_KEY = 'gdri.agentCanvas.expertView';

  function readExpertView() {
    try { return localStorage.getItem(EXPERT_VIEW_KEY) === '1'; } catch (e) { return false; }
  }

  function isExpertView() {
    return !!state.expertView;
  }

  function applyExpertViewClass() {
    var on = isExpertView();
    var app = document.querySelector('.agent-editor-app');
    if (app) app.classList.toggle('is-expert-view', on);
    document.body.classList.toggle('agent-expert-view', on);
    document.querySelectorAll('.agent-contract-modal').forEach(function(el) {
      el.classList.toggle('is-expert-view', on);
    });
  }

  function syncViewModeToggle() {
    document.querySelectorAll('.agent-view-toggle [data-view-mode]').forEach(function(btn) {
      var expert = btn.getAttribute('data-view-mode') === 'expert';
      btn.classList.toggle('is-active', expert === isExpertView());
    });
  }

  function setExpertView(on) {
    state.expertView = !!on;
    try { localStorage.setItem(EXPERT_VIEW_KEY, state.expertView ? '1' : '0'); } catch (e) { /* ignore */ }
    applyExpertViewClass();
    syncViewModeToggle();
    render();
  }

  function initViewModeToggle() {
    state.expertView = readExpertView();
    applyExpertViewClass();
    var wrap = document.querySelector('.agent-canvas-wrap');
    if (!wrap || wrap.querySelector('.agent-view-toggle')) {
      syncViewModeToggle();
      return;
    }
    var bar = document.createElement('div');
    bar.className = 'agent-view-toggle';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Affichage du canvas');
    bar.innerHTML = '<button type="button" data-view-mode="basic">Basique</button>'
      + '<button type="button" data-view-mode="expert">Expert</button>';
    wrap.appendChild(bar);
    bar.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-view-mode]');
      if (!btn) return;
      setExpertView(btn.getAttribute('data-view-mode') === 'expert');
    });
    syncViewModeToggle();
  }

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

  function isConditionNode(node) {
    return !!(node && (node.brickId === 'condition' || node.brickId === 'logic-if'));
  }

  function isLoopNode(node) {
    return !!(node && node.brickId === 'loop');
  }

  function isFalsePort(port) {
    return port === 'false' || port === 'done';
  }

  function isCasePort(port) {
    var p = String(port || '');
    return p === 'default' || p.indexOf('case:') === 0;
  }

  function isCaseCondition(node) {
    var m = String((node && node.config && node.config.mode) || 'if').toLowerCase();
    return m === 'case' || m === 'switch' || m === 'cas';
  }

  function isCollectionCaseSource(node) {
    return isCaseCondition(node) && String((node && node.config && node.config.caseSource) || 'manual') === 'collection';
  }

  function conditionCaseCollectionId(node) {
    if (!node || !node.config) return '';
    return String(node.config.caseCollectionId || '').trim();
  }

  function nodeBoundCollectionId(n) {
    if (!n || !n.config) return '';
    var id = String(n.config.collectionId || '').trim();
    if (!id) return '';
    if (n.brickId === 'data' && String(n.config.provider || '').toLowerCase() === 'json') return id;
    if (isCollectionOutput(n)) return id;
    return '';
  }

  function collectionsInFlowForCondition(node) {
    var exclude = node && node.id;
    var refs = [];
    var seen = {};
    function push(n, upstream) {
      if (!n || n.id === exclude) return;
      var id = nodeBoundCollectionId(n);
      if (!id || seen[id]) return;
      seen[id] = true;
      refs.push({
        collectionId: id,
        name: String((n.config && (n.config.modelName || n.config.collectionNamespace)) || n.name || id),
        nodeName: String(n.name || n.brickId || ''),
        nodeId: n.id,
        upstream: !!upstream,
        fields: Array.isArray(n.config && n.config.modelFields) ? n.config.modelFields : []
      });
    }
    getUpstreamNodes(node && node.id).forEach(function(n) { push(n, true); });
    (state.nodes || []).forEach(function(n) { push(n, false); });
    return refs;
  }

  function fieldsForFlowCollection(collectionId, flowRefs) {
    var id = String(collectionId || '').trim();
    var fromFlow = (flowRefs || []).filter(function(r) { return r.collectionId === id; })[0];
    if (fromFlow && fromFlow.fields && fromFlow.fields.length) {
      return fromFlow.fields.map(function(f) {
        return {
          key: String((f && (f.key || f.name)) || ''),
          label: String((f && (f.label || f.key || f.name)) || '')
        };
      }).filter(function(f) { return f.key; });
    }
    var col = findDocCollection(id);
    return col ? fieldsFromCollection(col) : [];
  }

  function newCaseId() {
    return 'c' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeConditionCases(raw) {
    var list = Array.isArray(raw) ? raw : [];
    var out = [];
    var seen = {};
    list.forEach(function(item, i) {
      if (item == null) return;
      var id;
      var value;
      var label;
      var rowId = '';
      if (typeof item !== 'object') {
        value = String(item);
        id = newCaseId();
        label = value;
      } else {
        id = String(item.id || '').trim() || newCaseId();
        value = item.value != null ? String(item.value) : '';
        label = String(item.label || '').trim();
        rowId = String(item.rowId || '').trim();
      }
      if (seen[id]) id = newCaseId();
      seen[id] = true;
      out.push({ id: id, value: value, label: label || value || ('Cas ' + (i + 1)), rowId: rowId });
    });
    return out;
  }

  function ensureConditionCases(node) {
    if (!node || !isConditionNode(node)) return [];
    if (!node.config || typeof node.config !== 'object') node.config = {};
    var cases = normalizeConditionCases(node.config.cases);
    if (!isCollectionCaseSource(node) && cases.length < 2) {
      while (cases.length < 2) {
        cases.push({ id: newCaseId(), value: '', label: '', rowId: '' });
      }
    }
    node.config.cases = cases;
    if (!node.config.caseOp) node.config.caseOp = 'eq';
    return cases;
  }

  function casePortLabel(c) {
    var s = String((c && (c.label || c.value)) || '').trim() || 'Cas';
    if (s.length > 14) s = s.slice(0, 13) + '…';
    return s;
  }

  function collectionUpdatedMs(col) {
    if (!col || !col.updatedAt) return 0;
    var t = Date.parse(col.updatedAt);
    return Number.isFinite(t) ? t : 0;
  }

  function collectionRevisionOf(col) {
    if (!col || col.dataRevision == null || col.dataRevision === '') return null;
    var n = Number(col.dataRevision);
    return Number.isFinite(n) ? n : null;
  }

  function collectionVersionOf(col) {
    return String((col && col.version) || '').trim();
  }

  function findDocCollection(id) {
    var want = String(id || '').trim();
    if (!want) return null;
    return (state.docCollections || []).filter(function(c) {
      return collectionKeyOf(c) === want;
    })[0] || null;
  }

  function isConditionCollectionStale(node) {
    if (!isCollectionCaseSource(node)) return false;
    var id = conditionCaseCollectionId(node);
    if (!id && !String((node.config && node.config.casePresetId) || '').trim()) return true;
    if (!id) return false;
    if (!state.docCollectionsLoaded) return false;
    var col = findDocCollection(id);
    if (!col) return true;
    var storedRev = node.config && node.config.casesCollectionRevision;
    var colRev = collectionRevisionOf(col);
    if (storedRev != null && storedRev !== '' && colRev != null) {
      if (Number(storedRev) !== colRev) return true;
    } else {
      var snap = node.config && node.config.casesSnapshotAt ? Date.parse(node.config.casesSnapshotAt) : 0;
      if (!Number.isFinite(snap) || snap <= 0) return true;
      if (collectionUpdatedMs(col) > snap + 1000) return true;
    }
    var storedVer = String((node.config && node.config.casesCollectionVersion) || '').trim();
    var colVer = collectionVersionOf(col);
    if (storedVer && colVer && storedVer !== colVer) return true;
    return false;
  }

  function pickCaseValueKey(node, fields) {
    var keys = (fields || []).map(function(f) { return f.key; }).filter(Boolean);
    var preferred = String((node && node.config && node.config.caseValueKey) || '').trim();
    if (preferred && keys.indexOf(preferred) !== -1) return preferred;
    var order = ['name', 'intention', 'slug', 'id', 'label'];
    for (var i = 0; i < order.length; i++) {
      if (keys.indexOf(order[i]) !== -1) return order[i];
    }
    return keys[0] || 'name';
  }

  function pickCaseLabelKey(node, fields, valueKey) {
    var keys = (fields || []).map(function(f) { return f.key; }).filter(Boolean);
    var preferred = String((node && node.config && node.config.caseLabelKey) || '').trim();
    if (preferred && keys.indexOf(preferred) !== -1) return preferred;
    if (keys.indexOf('label') !== -1) return 'label';
    if (keys.indexOf('name') !== -1) return 'name';
    return valueKey || keys[0] || 'name';
  }

  function rowCaseText(row, key) {
    if (!row) return '';
    if (key && row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
    return '';
  }

  function casesFromCollectionRows(rows, valueKey, labelKey, prev) {
    var prevList = normalizeConditionCases(prev);
    var byRow = {};
    var byVal = {};
    prevList.forEach(function(c) {
      if (c.rowId) byRow[c.rowId] = c;
      byVal[String(c.value).toLowerCase()] = c;
    });
    var used = {};
    var out = [];
    (rows || []).forEach(function(row) {
      var value = rowCaseText(row, valueKey) || rowCaseText(row, 'name') || rowCaseText(row, 'intention');
      if (!value) return;
      var label = rowCaseText(row, labelKey) || value;
      var rowId = String((row && (row.id || row._id)) || '').trim();
      var prevCase = (rowId && byRow[rowId]) || byVal[value.toLowerCase()];
      var id = (prevCase && prevCase.id && !used[prevCase.id]) ? prevCase.id : ('r' + (rowId ? String(rowId).slice(-8) : newCaseId()));
      if (used[id]) id = newCaseId();
      used[id] = true;
      out.push({ id: id, value: value, label: label, rowId: rowId });
    });
    return out;
  }

  function pruneMissingCasePorts(node, cases) {
    var keep = { default: true };
    (cases || []).forEach(function(c) { keep['case:' + c.id] = true; });
    var map = nodeNextPortMap(node);
    Object.keys(map).forEach(function(p) {
      if (p.indexOf('case:') === 0 && !keep[p]) delete map[p];
    });
    node.nextPortIds = map;
    syncNextAliases(node);
  }

  function caseRowsFromCollection(model) {
    var raw = Array.isArray(model && model.elements) ? model.elements : [];
    var fields = fieldsFromCollection(model);
    return raw.map(function(row) { return rowFromV3Element(row, fields); });
  }

  function mergeDocCollection(model) {
    if (!model) return;
    var id = collectionKeyOf(model);
    if (!id) return;
    var list = state.docCollections || [];
    var found = false;
    state.docCollections = list.map(function(c) {
      if (collectionKeyOf(c) !== id) return c;
      found = true;
      return Object.assign({}, c, {
        updatedAt: model.updatedAt != null ? model.updatedAt : c.updatedAt,
        version: model.version != null ? model.version : c.version,
        dataRevision: model.dataRevision != null ? model.dataRevision : c.dataRevision,
        fields: model.fields || c.fields,
        name: model.name || c.name,
        slug: model.slug || c.slug
      });
    });
    if (!found) state.docCollections.push(model);
  }

  function syncCasesFromCollectionModel(node, model) {
    if (!node || !model) return [];
    if (!node.config) node.config = {};
    var fields = fieldsFromCollection(model);
    var rows = caseRowsFromCollection(model);
    var valueKey = pickCaseValueKey(node, fields);
    var labelKey = pickCaseLabelKey(node, fields, valueKey);
    var cases = casesFromCollectionRows(rows, valueKey, labelKey, node.config.cases);
    node.config.caseSource = 'collection';
    node.config.caseCollectionId = collectionKeyOf(model);
    node.config.modelName = String(model.name || model.slug || '');
    node.config.caseValueKey = valueKey;
    node.config.caseLabelKey = labelKey;
    node.config.cases = cases;
    node.config.casesCollectionVersion = collectionVersionOf(model) || '1.0.0';
    var rev = collectionRevisionOf(model);
    node.config.casesCollectionRevision = rev != null ? rev : 0;
    node.config.casesSnapshotAt = model.updatedAt
      ? (model.updatedAt instanceof Date ? model.updatedAt.toISOString() : String(model.updatedAt))
      : new Date().toISOString();
    if (!String(node.config.field || '').trim()) {
      var ctx = collectContextFieldsForNode(node.id);
      var preferred = ctx.filter(function(f) {
        var k = String((f && (f.localKey || f.key)) || '');
        return k === 'intention' || k === 'intention_principale' || k === 'name';
      })[0] || ctx[0];
      if (preferred) node.config.field = preferred.key;
    }
    pruneMissingCasePorts(node, cases);
    mergeDocCollection(model);
    return cases;
  }

  function refreshCasesFromCollection(node) {
    if (!node || !isConditionNode(node)) return Promise.resolve();
    if (!node.config) node.config = {};
    node.config.caseSource = 'collection';
    var presetId = String(node.config.casePresetId || '').trim();
    var colId = conditionCaseCollectionId(node);
    var job;
    if (presetId && !colId) {
      job = fetch(API + '/intention-presets/' + encodeURIComponent(presetId) + '/collection', {
        method: 'POST',
        headers: headers()
      }).then(parseJson).then(function(res) {
        var model = res && res.data;
        if (!model) throw new Error((res && (res.message || res.error)) || 'Collection introuvable');
        return loadV3CollectionDetail(collectionKeyOf(model)).catch(function() { return model; });
      });
    } else if (colId) {
      job = loadV3CollectionDetail(colId);
    } else {
      return Promise.resolve();
    }
    return job.then(function(model) {
      syncCasesFromCollectionModel(node, model);
      return loadDocCollections(true).then(function() {
        render();
        return model;
      });
    }).catch(function(err) {
      window.alert('Impossible d’actualiser la liste : ' + ((err && err.message) || err));
    });
  }

  function applyCaseCollectionChoice(node, val) {
    if (!node) return Promise.resolve();
    if (!node.config) node.config = {};
    node.config.caseSource = 'collection';
    if (!val) {
      node.config.caseCollectionId = '';
      node.config.casePresetId = '';
      render();
      return Promise.resolve();
    }
    if (val.indexOf('__preset__:') === 0) {
      node.config.casePresetId = val.slice('__preset__:'.length);
      node.config.caseCollectionId = '';
      return refreshCasesFromCollection(node);
    }
    node.config.casePresetId = '';
    node.config.caseCollectionId = val;
    return refreshCasesFromCollection(node);
  }

  function conditionPortLabel(node, portId) {
    var port = String(portId || '');
    if (port === 'true') return 'Vrai';
    if (port === 'false') return 'Faux';
    if (port === 'default') return 'Défaut';
    if (port.indexOf('case:') === 0) {
      var cid = port.slice(5);
      var found = normalizeConditionCases(node && node.config && node.config.cases).filter(function(c) {
        return c.id === cid;
      })[0];
      return found ? casePortLabel(found) : 'Cas';
    }
    return '';
  }

  function namedInputPorts(node) {
    if (isLoopNode(node)) {
      return [{ id: 'return', label: 'Retour', css: 'return', side: 'bottom-right' }];
    }
    return null;
  }

  function namedPortHtml(p, dir, opts) {
    var side = p.side || (dir === 'in' ? 'left' : 'right');
    var dataPort = (side === 'bottom-left' || side === 'bottom-right') ? 'bottom' : (side === 'right' ? 'right' : 'left');
    var extra = ' agent-node-port--' + (side === 'bottom-left' ? 'loop-body' : (side === 'bottom-right' ? 'loop-return' : side));
    var inline = !!(opts && opts.inline);
    var hideCap = !!(opts && opts.hideCaption);
    var style = (!inline && p.top != null) ? (' style="top:' + p.top + '%;transform:translateY(-50%);"') : '';
    return '<button type="button" class="agent-node-port agent-node-port-named agent-node-port--'
      + dir + extra + (inline ? ' is-inline' : '') + '" data-port="' + dataPort + '" data-port-id="' + escapeHtml(p.id)
      + '" title="' + escapeHtml(p.label) + '"' + style + '>'
      + (hideCap ? '' : '<span class="agent-node-port-caption">' + escapeHtml(p.label) + '</span>')
      + '<span class="agent-node-port-dot agent-node-port-dot--' + escapeHtml(p.css) + '"></span>'
      + '</button>';
  }

  function conditionCaseListHtml(node) {
    if (!isConditionNode(node) || !isCaseCondition(node)) return '';
    var cases = isCollectionCaseSource(node)
      ? normalizeConditionCases(node.config && node.config.cases)
      : ensureConditionCases(node);
    var rows = cases.map(function(c) {
      return {
        id: 'case:' + c.id,
        label: String((c && (c.label || c.value)) || '').trim() || 'Cas',
        css: 'case'
      };
    });
    rows.push({ id: 'default', label: 'Défaut', css: 'default' });
    return '<ul class="agent-node-cases">' + rows.map(function(r) {
      return '<li class="agent-node-case-row">'
        + '<span class="agent-node-case-label">' + escapeHtml(r.label) + '</span>'
        + namedPortHtml({ id: r.id, label: r.label, css: r.css, side: 'right' }, 'out', { inline: true, hideCaption: true })
        + '</li>';
    }).join('') + '</ul>';
  }

  function loopBodyIds(loopNode) {
    var ids = [];
    if (!loopNode) return ids;
    var byId = {};
    state.nodes.forEach(function(n) { byId[n.id] = n; });
    var done = {};
    nodeNextFalseIds(loopNode).forEach(function(id) { done[id] = true; });
    var seen = {};
    var q = nodeNextIds(loopNode).slice();
    while (q.length) {
      var id = q.shift();
      if (!id || seen[id] || done[id] || id === loopNode.id) continue;
      seen[id] = true;
      ids.push(id);
      var n = byId[id];
      if (n) allOutgoingIds(n).forEach(function(next) { q.push(next); });
    }
    return ids;
  }

  function isInLoopBody(loopNode, nodeId) {
    if (!loopNode || !nodeId || loopNode.id === nodeId) return false;
    return loopBodyIds(loopNode).indexOf(nodeId) !== -1;
  }

  function namedOutputPorts(node) {
    if (isConditionNode(node) && isCaseCondition(node)) {
      var cases = isCollectionCaseSource(node)
        ? normalizeConditionCases(node.config && node.config.cases)
        : ensureConditionCases(node);
      var n = cases.length + 1;
      var ports = cases.map(function(c, i) {
        return {
          id: 'case:' + c.id,
          label: casePortLabel(c),
          css: 'case',
          side: 'right',
          top: Math.round(((i + 1) / (n + 1)) * 100)
        };
      });
      ports.push({
        id: 'default',
        label: 'Défaut',
        css: 'default',
        side: 'right',
        top: Math.round(((cases.length + 1) / (n + 1)) * 100)
      });
      return ports;
    }
    if (isConditionNode(node)) {
      return [
        { id: 'true', label: 'Vrai', css: 'true', side: 'right' },
        { id: 'false', label: 'Faux', css: 'false', side: 'right' }
      ];
    }
    if (isLoopNode(node)) {
      return [
        { id: 'done', label: 'Terminé', css: 'done', side: 'right' },
        { id: 'body', label: 'Répéter', css: 'body', side: 'bottom-left' }
      ];
    }
    return null;
  }

  function asIdList(primaryArray, legacySingle) {
    var out = [];
    var seen = {};
    function push(id) {
      var s = id == null ? '' : String(id).trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    }
    if (Array.isArray(primaryArray)) primaryArray.forEach(push);
    push(legacySingle);
    return out;
  }

  function nodeNextIds(node) {
    return node ? asIdList(node.nextIds, node.nextId) : [];
  }

  function nodeNextFalseIds(node) {
    return node ? asIdList(node.nextFalseIds, node.nextFalseId) : [];
  }

  function nodeNextPortMap(node) {
    if (!node || !node.nextPortIds || typeof node.nextPortIds !== 'object' || Array.isArray(node.nextPortIds)) {
      return {};
    }
    var out = {};
    Object.keys(node.nextPortIds).forEach(function(port) {
      var ids = asIdList(node.nextPortIds[port], null);
      if (ids.length) out[port] = ids;
    });
    return out;
  }

  function nodeNextPortIds(node, port) {
    if (!port) return [];
    return asIdList(nodeNextPortMap(node)[port], null);
  }

  function allOutgoingIds(node) {
    var seen = {};
    var out = [];
    function push(id) {
      var s = id == null ? '' : String(id).trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    }
    nodeNextIds(node).forEach(push);
    nodeNextFalseIds(node).forEach(push);
    var map = nodeNextPortMap(node);
    Object.keys(map).forEach(function(port) { map[port].forEach(push); });
    return out;
  }

  function syncNextAliases(node) {
    if (!node) return node;
    var ids = asIdList(node.nextIds, null);
    var falses = asIdList(node.nextFalseIds, null);
    node.nextIds = ids;
    node.nextFalseIds = falses;
    node.nextId = ids[0] || null;
    node.nextFalseId = falses[0] || null;
    node.nextPortIds = nodeNextPortMap(node);
    return node;
  }

  function nodeTargetsId(node, targetId) {
    return allOutgoingIds(node).indexOf(targetId) !== -1;
  }

  function getIncomingNodes(targetId) {
    return state.nodes.filter(function(n) { return nodeTargetsId(n, targetId); });
  }

  function getIncomingNode(targetId) {
    return getIncomingNodes(targetId)[0] || null;
  }

  function namesList(nodes) {
    if (!nodes || !nodes.length) return '—';
    return nodes.map(function(n) { return n.name || n.brickId; }).join(', ');
  }

  function wouldCreateCycle(sourceId, targetId) {
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (isLoopNode(target)) return false;
    var seen = {};
    var queue = [targetId];
    while (queue.length) {
      var id = queue.shift();
      if (!id || seen[id]) continue;
      if (id === sourceId) return true;
      seen[id] = true;
      var n = state.nodes.find(function(node) { return node.id === id; });
      if (n) allOutgoingIds(n).forEach(function(next) { queue.push(next); });
    }
    return false;
  }

  function iconUrl(brick) {
    if (!brick || !brick.canvas || !brick.canvas.iconUrl) return null;
    if (brick.canvas.iconUrl.indexOf('http') === 0) return brick.canvas.iconUrl;
    var base = (cfg.apiBase || '').replace(/\/api\/?$/, '');
    return base + brick.canvas.iconUrl;
  }

  function addNodeFromBrick(brick, x, y, opts) {
    opts = opts || {};
    var prevSelected = state.selectedNodeId;
    var node = {
      id: createId(),
      brickId: brick.id,
      kind: brick.kind || 'action',
      operation: brick.kind === 'action' ? (DEFAULT_OPS[brick.id] || null) : null,
      name: uniqueNodeName(opts.name || defaultNodeName(brick)),
      slug: '',
      config: defaultConfigForBrick(brick),
      x: x || (120 + state.nodes.length * 24),
      y: y || (80 + state.nodes.length * 110),
      nextId: null,
      nextFalseId: null,
      nextIds: [],
      nextFalseIds: [],
      nextPortIds: {}
    };
    if (opts.config && typeof opts.config === 'object') {
      Object.keys(opts.config).forEach(function(key) {
        node.config[key] = opts.config[key];
      });
    }
    if (brick.id === 'validation' || brick.id === 'human-doc-review') {
      if (!node.config.subTemplateId) node.config.subTemplateId = 'agent-design-page-web';
    }
    state.nodes.push(node);
    if (opts.slug) node.slug = uniqueNodeSlug(opts.slug, node.id);
    ensureNodeSlug(node);
    if (!opts.silent && !state.selectedNodeId) state.selectedNodeId = node.id;
    var dataProv = String((node.config && node.config.provider) || '').toLowerCase();
    if (brick.id === 'data' && dataProv !== 'flow' && dataProv !== 'flux'
        && !String((node.config && (node.config.collectionNamespace || node.config.presetId)) || '').trim()) {
      applyWebhookPresetToData({ nodeId: node.id });
    }
    if (brick.id === 'loop') syncLoopDefaults(node);
    if (!opts.silent) {
      if (brick.id === 'visualization') {
        if (prevSelected && prevSelected !== node.id) {
          var srcViz = state.nodes.find(function(n) { return n.id === prevSelected; });
          if (srcViz && vizCanAttachFrom(srcViz)) connectNodes(prevSelected, node.id);
        }
        suggestVizFields(node);
        syncVizRole(node);
        state.selectedNodeId = node.id;
      }
      render();
      if (brick.id === 'validation' || brick.id === 'human-doc-review') {
        importOfficialSubAgent(node);
      }
      if (brick.id === 'visualization') {
        refreshHookListForBlock(node, 'import');
      }
    }
    return node;
  }

  function paletteChildKey(child) {
    if (!child) return '';
    return String(child.templateId || child.flowId || child.place || child.id || child.name || '')
      .trim()
      .toLowerCase();
  }

  function catalogRowToShortcut(row, brick) {
    if (!row) return null;
    var name = String(row.name || row.label || '').trim();
    if (!name && !row.templateId && !row.flowId) return null;
    var id = String(row.id || row.templateId || row.flowId || name).trim();
    return {
      id: id,
      name: name || id,
      iconEmoji: String(row.iconEmoji || '').trim() || '⚙',
      logoUrl: String(row.logoUrl || '').trim(),
      description: String(row.description || '').trim()
        || ('Sous-action « ' + (name || id) + ' » — boîte noire, flux interne à part.'),
      place: 'insertable',
      templateId: String(row.templateId || '').trim(),
      flowId: String(row.flowId || '').trim(),
      parentFamily: String(row.parentFamily || (brick && (brick.family || brick.id)) || 'action').trim(),
      color: String(row.color || '').trim(),
      hookSurface: String(row.hookSurface || 'palette').trim() || 'palette'
    };
  }

  function paletteChildrenOf(brick) {
    var family = String((brick && (brick.family || brick.id)) || '').trim();
    var byKey = {};
    var fromBrick = brick && brick.palette && Array.isArray(brick.palette.children)
      ? brick.palette.children
      : [];
    if (!fromBrick.length && brick && brick.id === 'action') {
      fromBrick = [{
        id: 'hook',
        name: 'Hook',
        iconEmoji: '🪝',
        description: 'Chaîne éditeur (choix du hook) reliée à la chaîne exécution (ajouter le hook au flux).',
        place: 'insertable',
        templateId: 'agent-hook',
        hookSurface: 'palette'
      }];
    }
    fromBrick.forEach(function(child) {
      var key = paletteChildKey(child);
      if (key) byKey[key] = child;
    });
    (state.paletteCatalog || []).forEach(function(row) {
      var parent = String((row && row.parentFamily) || 'action').trim();
      if (parent !== family && parent !== (brick && brick.id)) return;
      var shortcut = catalogRowToShortcut(row, brick);
      if (!shortcut) return;
      var key = paletteChildKey(shortcut);
      if (key) byKey[key] = shortcut;
    });
    return Object.keys(byKey).map(function(k) { return byKey[k]; });
  }

  function placePaletteShortcut(shortcut, x, y) {
    var place = String((shortcut && (shortcut.place || shortcut.id)) || '');
    if (place === 'hook' || place === 'insertable' || (shortcut && (shortcut.templateId || shortcut.flowId))) {
      return placeInsertableBlock(shortcut, x, y);
    }
    var brick = getBrick((shortcut && shortcut.brickId) || 'action');
    return brick ? addNodeFromBrick(brick, x, y) : null;
  }

  function isHookShortcut(shortcut) {
    if (!shortcut) return false;
    var tid = String(shortcut.templateId || '').trim().toLowerCase();
    var name = String(shortcut.name || '').trim().toLowerCase();
    var id = String(shortcut.id || shortcut.place || '').trim().toLowerCase();
    return tid === 'agent-hook' || name === 'hook' || id === 'hook';
  }

  function placeInsertableBlock(shortcut, x, y) {
    var family = String((shortcut && (shortcut.brickId || shortcut.parentFamily)) || 'action');
    var brick = getBrick(family) || getBrick('action');
    if (!brick) return null;
    var name = String((shortcut && shortcut.name) || 'Sous-action').trim() || 'Sous-action';
    var slugHint = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'sous_action';
    var hookBlock = isHookShortcut(shortcut);
    var node = addNodeFromBrick(brick, x, y, {
      silent: true,
      name: name,
      slug: slugHint,
      config: {
        insertable: true,
        subTemplateId: String((shortcut && shortcut.templateId) || '').trim(),
        subFlowId: String((shortcut && shortcut.flowId) || '').trim(),
        paletteId: String((shortcut && shortcut.id) || '').trim(),
        hookSurface: '',
        exportName: hookBlock ? 'hook' : '',
        actionId: 'ia.compose',
        operation: 'ia.compose'
      }
    });
    state.selectedNodeId = node.id;
    render();
    if (node.config.subTemplateId && !node.config.subFlowId) {
      importOfficialSubAgent(node);
    }
    refreshHookListForBlock(node, 'import');
    return node;
  }

  function defaultNodeName(brick) {
    if (!brick) return 'Bloc';
    if (brick.id === 'action') return 'Action';
    if (brick.id === 'ia') return 'IA';
    if (brick.id === 'data') return 'Entrées';
    if (brick.id === 'output') return 'Sortie';
    if (brick.id === 'condition') return 'Condition';
    if (brick.id === 'loop') return 'Boucle';
    if (brick.id === 'validation') return 'Sous-agent';
    if (brick.id === 'visualization') return 'Visualisation';
    if (brick.id === 'trigger') return 'Déclencher';
    return brick.name || brick.id || 'Bloc';
  }

  function migrateDataBlockName(name, brickId, brick) {
    var n = String(name || '').trim();
    if (brickId === 'data') {
      if (!n || n === 'Données') return 'Entrées';
      if (n.indexOf('Données ') === 0) return 'Entrées ' + n.slice('Données '.length);
    }
    return n || (brick && brick.name) || brickId;
  }

  function uniqueNodeName(base) {
    var want = String(base || 'Bloc');
    var names = state.nodes.map(function(n) { return String(n.name || ''); });
    if (names.indexOf(want) === -1) return want;
    var i = 2;
    while (names.indexOf(want + ' ' + i) !== -1) i += 1;
    return want + ' ' + i;
  }

  function slugifyNodeName(raw, fallback) {
    var s = String(raw || '');
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (err) { /* ignore */ }
    s = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    return s || fallback || 'bloc';
  }

  function uniqueNodeSlug(base, nodeId) {
    var slug = String(base || '').trim() || 'bloc';
    var taken = state.nodes
      .filter(function(n) { return n && n.id !== nodeId; })
      .map(function(n) { return String(n.slug || '').trim(); })
      .filter(Boolean);
    if (taken.indexOf(slug) === -1) return slug;
    var i = 2;
    while (taken.indexOf(slug + '_' + i) !== -1) i += 1;
    return slug + '_' + i;
  }

  function ensureNodeSlug(node) {
    if (!node) return '';
    var fallback = slugifyNodeName(node.brickId || 'bloc', 'bloc');
    var slug = String(node.slug || '').trim();
    if (!slug) {
      if (node.brickId === 'data') {
        var nm = String(node.name || '').trim();
        if (!nm || nm === 'Entrées' || nm === 'Données') slug = 'donnees';
        else slug = slugifyNodeName(nm, 'donnees');
      } else {
        slug = slugifyNodeName(node.name || node.brickId, fallback);
      }
    }
    slug = uniqueNodeSlug(slug, node.id);
    node.slug = slug;
    return slug;
  }

  function ensureAllSlugs() {
    state.nodes.forEach(function(n) { ensureNodeSlug(n); });
  }

  function rewriteNamespaceRefs(fromSlug, toSlug) {
    if (!fromSlug || !toSlug || fromSlug === toSlug) return;
    function rewriteStr(str) {
      if (typeof str !== 'string') return str;
      var out = str.split('{{' + fromSlug + '.').join('{{' + toSlug + '.');
      if (out === fromSlug || out.indexOf(fromSlug + '.') === 0) {
        out = toSlug + out.slice(fromSlug.length);
      }
      return out;
    }
    function walk(obj) {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function(k) {
        if (typeof obj[k] === 'string') obj[k] = rewriteStr(obj[k]);
        else if (obj[k] && typeof obj[k] === 'object') walk(obj[k]);
      });
    }
    state.nodes.forEach(function(n) {
      if (n && n.config) walk(n.config);
    });
  }

  function renameNode(node, nextName) {
    if (!node) return;
    var name = String(nextName == null ? '' : nextName).trim();
    if (!name) return;
    var oldSlug = String(node.slug || '').trim();
    var oldAuto = slugifyNodeName(node.name || '', node.brickId || 'bloc');
    node.name = name;
    if (!oldSlug || oldSlug === oldAuto) {
      var nextSlug = uniqueNodeSlug(slugifyNodeName(name, node.brickId || 'bloc'), node.id);
      if (oldSlug && oldSlug !== nextSlug) rewriteNamespaceRefs(oldSlug, nextSlug);
      node.slug = nextSlug;
    }
  }

  function retargetNodeSlug(node, nextSlugRaw) {
    if (!node) return;
    var oldSlug = String(node.slug || '').trim();
    var nextSlug = uniqueNodeSlug(slugifyNodeName(nextSlugRaw, node.brickId || 'bloc'), node.id);
    if (oldSlug && oldSlug !== nextSlug) rewriteNamespaceRefs(oldSlug, nextSlug);
    node.slug = nextSlug;
  }

  function isSharedReviewNamespace(ns) {
    var s = String(ns || '').trim();
    if (!s) return true;
    if (s === 'agent:review:invoice') return true;
    if (s === (cfg.defaultReviewNamespace || 'agent:review:invoice')) return true;
    return false;
  }

  /** Page dédiée à CE bloc (pas le modèle partagé invoice). */
  function blockPageNamespace(node) {
    var fid = state.flowId || 'draft';
    var nid = (node && node.id) || 'node';
    return 'agent:review:' + fid + ':' + nid;
  }

  function resolveBlockPageNamespace(node) {
    if (!node) return '';
    if (!node.config || typeof node.config !== 'object') node.config = {};
    var current = String(node.config.templateNamespace || '').trim();
    if (current && !isSharedReviewNamespace(current)) {
      if (state.flowId && current.indexOf('agent:review:draft:') === 0) {
        current = 'agent:review:' + state.flowId + ':' + node.id;
      }
      node.config.templateNamespace = current;
      return current;
    }
    var ns = blockPageNamespace(node);
    node.config.templateNamespace = ns;
    return ns;
  }

  function migrateValidationPageNamespaces() {
    state.nodes.forEach(function(n) {
      if (!n || (n.brickId !== 'validation' && n.brickId !== 'human-doc-review')) return;
      resolveBlockPageNamespace(n);
    });
    ensureAppState();
    state.app.pages.forEach(function(p) {
      if (!p) return;
      var ns = String(p.templateNamespace || '');
      if (!ns || ns.indexOf('agent:app:draft:') === 0) {
        p.templateNamespace = appPageNamespace(p);
      }
    });
  }

  function defaultConfigForBrick(brick) {
    if (brick.id === 'trigger') {
      return { mode: 'button', preset: 'daily', hour: 8, minute: 0, webhookInstanceId: '', blockOnSelect: true, blockOnImport: true };
    }
    if (brick.id === 'data') {
      return {
        provider: '',
        instanceId: '',
        kinds: [],
        accountRef: '',
        pageId: '',
        payload: '',
        presetId: '',
        modelName: '',
        modelFields: [],
        modelRows: [],
        collectionId: '',
        collectionNamespace: '',
        referenceFields: []
      };
    }
    if (brick.id === 'condition') {
      return { mode: 'if', field: '', op: 'contains', value: '', caseOp: 'eq', caseSource: 'manual', cases: [] };
    }
    if (brick.id === 'loop') {
      return { mode: 'items', times: 10, field: 'items', op: 'truthy', value: '', maxIterations: 50 };
    }
    if (brick.id === 'action') {
      return {
        actionId: 'ia.compose',
        operation: 'ia.compose',
        writeMode: 'merge',
        variables: [],
        values: {},
        activeZone: '',
        copyFrom: '',
        mappedOutputIds: [],
        outputMaps: {},
        activeComposeTab: 'fields'
      };
    }
    if (brick.id === 'ia') {
      return { source: 'mapped', writeMode: 'merge', prompt: '', mapping: {}, literals: {}, productionTemplateId: '' };
    }
    if (brick.id === 'validation') {
      return {
        title: 'Sous-agent',
        subTemplateId: 'agent-design-page-web',
        subFlowId: ''
      };
    }
    if (brick.id === 'visualization') {
      return {
        vizType: 'select',
        valueField: '',
        labelField: '',
        surface: '',
        collectionPreset: 'hook'
      };
    }
    if (brick.id === 'output') {
      return {
        provider: '',
        connectorId: '',
        instanceId: '',
        accountRef: '',
        pageId: '',
        to: '',
        subject: '',
        body: '',
        usePreviousRoute: true,
        attachPrevious: false,
        mapping: {},
        literals: {},
        collectionId: '',
        collectionNamespace: '',
        modelName: '',
        modelFields: [],
        modelRows: [],
        writeMode: 'insert',
        exportName: 'chrome',
        exportFields: [],
        copyFrom: ''
      };
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
        pollByDate: true,
        pollByCount: true,
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
      prev.nextIds = [action.id];
      syncNextAliases(prev);
      prev = action;
    });
  }

  /** Normalise fields (string | {key,label}) → {key,label} */
  function normalizeContextField(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { key: entry, label: humanizeFieldKey(entry), hint: describeContextField(entry) };
    }
    if (typeof entry === 'object' && entry.key) {
      var key = String(entry.key);
      return {
        key: key,
        label: String(entry.label || humanizeFieldKey(key)),
        type: entry.type || '',
        example: entry.example,
        hint: describeContextField(key, entry)
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
      loopIteration: 'Itération de boucle',
      loopContinue: 'Boucle en cours',
      loopDone: 'Boucle terminée',
      reponse_requise: 'Réponse requise',
      response: 'Réponse IA',
      result: 'Résultat numérique',
      confidence: 'Confiance',
      decision: 'Décision',
      title: 'Titre de revue',
      draftHtml: 'Brouillon HTML',
      editedText: 'Texte validé',
      editedHtml: 'HTML validé',
      today: 'Date du jour',
      date: 'Date / heure',
      'author.email': 'Email expéditeur',
      'author.name': 'Nom expéditeur',
      'metadata.accountRef': 'Compte mail',
      'metadata.mailbox': 'Dossier IMAP'
    };
    if (map[key]) return map[key];
    return String(key || '').replace(/\./g, ' · ');
  }

  function formatFieldExample(ex) {
    if (ex == null || ex === '') return '';
    if (typeof ex === 'object') {
      try { ex = JSON.stringify(ex); } catch (err) { return ''; }
    }
    var s = String(ex).replace(/\s+/g, ' ').trim();
    if (s.length > 72) s = s.slice(0, 70) + '…';
    return s;
  }

  function describeContextField(key, extra) {
    extra = extra || {};
    var map = {
      today: 'Date du jour au format AAAA-MM-JJ. Utile dans un prompt sans texte amont (ex. plantes à planter aujourd’hui).',
      date: 'Date et heure actuelles du serveur.',
      channel: 'Canal d’origine du message : mail, facebook, http, json…',
      from: 'Expéditeur ou auteur de la ligne courante (1re ligne si pas de boucle).',
      subject: 'Sujet de la ligne courante (e-mail, titre de post / commentaire).',
      text: 'Texte de la ligne courante (corps mail, commentaire, post). Un document simple = 1 ligne.',
      body: 'Corps du message, souvent identique à text.',
      messageId: 'Identifiant technique du message (IMAP, Graph, webhook…).',
      sourceRef: 'Référence source pour une action (UID mail, id Facebook…).',
      attachments: 'Liste des pièces jointes (nom, type, éventuellement URL).',
      timestamp: 'Horodatage du message d’origine.',
      instanceId: 'Identifiant de l’instance de connecteur utilisée.',
      'author.id': 'Identifiant de l’auteur sur le canal (Facebook, etc.).',
      'author.name': 'Nom affiché de l’auteur.',
      'author.email': 'Adresse e-mail de l’auteur, si le canal la fournit.',
      'metadata.accountRef': 'Compte mail utilisé (ex. support@entreprise.fr).',
      'metadata.mailbox': 'Dossier IMAP d’où vient le message (INBOX, etc.).',
      pageId: 'Identifiant de la page Facebook.',
      postId: 'Identifiant du post Facebook parent.',
      permalink_url: 'Lien public vers le post ou le commentaire.',
      created_time: 'Date de publication côté Facebook.',
      conversationId: 'Identifiant de la conversation Messenger.',
      type: 'Type d’élément (post, commentaire, mp, notification, payload…).',
      json: 'Objet JSON parsé depuis le bloc Entrées.',
      item: 'Item : la ligne courante (le mail / post en cours). C’est en général ce qu’il faut brancher sur un item de template.',
      items: 'Tableau entier (toutes les lignes). Utile pour une liste (intentions, digest), pas pour un seul message.',
      intention: 'Intention détectée par l’IA (contrat de sortie JSON).',
      confiance: 'Score de confiance renvoyé par l’IA (0–1).',
      resume: 'Résumé produit par l’IA.',
      itemsCount: 'Nombre de lignes du tableau (équivalent de {{donnees.length}}).',
      'items.length': 'Nombre de lignes du tableau.',
      'item.length': 'Nombre de lignes du tableau (alias de items.length).',
      itemIndex: 'Index de parcours dans la boucle (0 = première ligne). Mail 1 → 0, mail 2 → 1.',
      itemNumber: 'N° de ligne dans la boucle (1 = première). Mail 1 → 1, mail 2 → 2.',
      name: 'Nom de la ligne (auteur, titre…). Dans la boucle : {{donnees.name}}. Libellé d’un champ : {{donnees.sujet.name}}.',
      payload: 'Texte brut saisi ou reçu avant parsing.',
      intentions: 'Liste des intentions disponibles en base.',
      source: 'Origine de la liste (ex. intentions).',
      metadata: 'Métadonnées mappées depuis un appel HTTP.',
      title: 'Titre de la page de revue humaine (configuré sur le bloc Validation).',
      draftHtml: 'HTML du brouillon montré au validateur (contenu à relire / corriger).',
      decision: 'Choix humain après reprise : approve (validé) ou reject (refusé).',
      editedHtml: 'HTML éventuellement modifié par le validateur.',
      editedText: 'Texte éventuellement modifié par le validateur.',
      response: 'Texte produit par l’éditeur / l’IA (intention, réponse, synthèse…).',
      result: 'Résultat d’une formule arithmétique ({{prix}} * {{quantite}}).',
      intention_principale: 'Intention principale détectée dans le prompt IA.',
      success: 'Indique si l’étape précédente a réussi.',
      confidence: 'Score de confiance renvoyé par l’IA (0–1).',
      reponse_requise: 'Indique si une réponse doit être envoyée.',
      condition: 'Résultat du test : vrai, faux, ou le cas correspondant.',
      field: 'Nom du champ qui a été testé par la condition.',
      actual: 'Valeur trouvée dans le flux au moment du test.',
      loopIteration: 'Numéro du tour de boucle en cours (1, 2, 3…).',
      loopContinue: 'true s’il reste encore un tour à faire.',
      loopDone: 'true quand la boucle est terminée.',
      triggeredAt: 'Date et heure du déclenchement du flux.',
      entrepriseId: 'Identifiant de l’entreprise du flux.',
      flowId: 'Identifiant du flux en cours.',
      mode: 'Mode de déclenchement (manuel, cron, webhook…).',
      webhookInstanceId: 'Instance de connecteur liée au webhook.',
      provider: 'Connecteur utilisé par la sortie (mail, facebook…).',
      mailFlag: 'Flag IMAP après action (seen / unseen).',
      mailDeleted: 'true si le mail a été supprimé.',
      mailbox: 'Dossier IMAP actuel (après un déplacement).',
      folderUrl: 'Dossier local où les pièces jointes ont été téléchargées.',
      facebookHidden: 'true si le commentaire a été masqué.',
      facebookLiked: 'true si l’élément a été liké.',
      facebookDeleted: 'true si l’élément Facebook a été supprimé.'
    };
    var hint = String(extra.description || extra.hint || map[key] || '').trim();
    if (!hint && key.indexOf('item.') === 0) {
      var local = key.slice(5);
      hint = String(map[local] || '').trim();
      if (hint) hint = 'Ligne courante — ' + hint;
      else hint = 'Champ « ' + local + ' » de la ligne courante ({{item.' + local + '}}).';
    }
    if (!hint) {
      hint = 'Valeur « ' + (extra.label || humanizeFieldKey(key) || key) + ' » disponible dans le flux.';
    }
    var ex = formatFieldExample(extra.example);
    if (ex) hint += ' Ex. : ' + ex;
    return hint;
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
        if (nodeTargetsId(n, id)) {
          result.push(n);
          walk(n.id);
        }
      });
    }
    walk(nodeId);
    return result;
  }

  function isTriggerNode(node) {
    if (!node) return false;
    var id = String(node.brickId || '');
    if (id === 'manual-trigger' || id === 'cron-trigger') return true;
    return node.kind === 'trigger' || id === 'trigger';
  }

  function triggerModeOf(node) {
    if (!node) return 'button';
    var id = String(node.brickId || '');
    if (id === 'manual-trigger') return 'button';
    if (id === 'cron-trigger') return 'cron';
    var mode = String((node.config && node.config.mode) || 'button').toLowerCase();
    if (mode === 'http') return 'webhook';
    if (mode === 'select' || mode === 'import') return 'block';
    return mode || 'button';
  }

  function ancestorTrigger(nodeId) {
    return getUpstreamNodes(nodeId).find(isTriggerNode) || null;
  }

  function nodeDescendantIds(startId) {
    var byId = {};
    state.nodes.forEach(function(n) { byId[n.id] = n; });
    var seen = {};
    var out = [];
    var q = [startId];
    while (q.length) {
      var id = q.shift();
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(id);
      var n = byId[id];
      if (n) allOutgoingIds(n).forEach(function(next) { q.push(next); });
    }
    return out;
  }

  function canvasRunTriggerNodeId() {
    var selected = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    if (selected) {
      var fromSel = isTriggerNode(selected) ? selected : ancestorTrigger(selected.id);
      if (fromSel && triggerModeOf(fromSel) !== 'block') return fromSel.id;
    }
    var button = state.nodes.find(function(n) {
      return isTriggerNode(n) && triggerModeOf(n) === 'button';
    });
    return button ? button.id : null;
  }

  function nodeLocalFields(n) {
    if (!n) return [];
    if (n.brickId === 'data') return contractFieldsForDataNode(n);
    if (n.brickId === 'action') return contractFieldsForActionNode(n);
    if (n.brickId === 'ia') {
      return contractFieldsForIaNode(n);
    }
    if (n.brickId === 'output') {
      var outFields = [
        { key: 'success', label: 'Succès', hint: describeContextField('success') },
        { key: 'provider', label: 'Destination', hint: describeContextField('provider') }
      ];
      if (isFlowOutput(n)) {
        ensureFlowExportFields(n);
        outFields.push(
          { key: 'exportName', label: 'Nom de sortie', hint: describeContextField('exportName') }
        );
        uniqueExportFields(n).forEach(function(path) {
          var local = String(path || '').split('.').pop();
          if (!local || outFields.some(function(f) { return f.key === local; })) return;
          outFields.push({
            key: local,
            label: humanizeFieldKey(local),
            hint: describeContextField(local)
          });
        });
      } else if (isCollectionOutput(n)) {
        outFields.push(
          { key: 'collectionId', label: 'Collection', hint: describeContextField('collectionId') },
          { key: 'elementId', label: 'Élément enregistré', hint: describeContextField('elementId') },
          { key: 'writeMode', label: 'Écriture', hint: describeContextField('writeMode') }
        );
      }
      return outFields;
    }
    if (n.brickId === 'validation' || n.brickId === 'human-doc-review') {
      return [
        { key: 'exportName', label: 'Nom de sortie', hint: describeContextField('exportName') },
        { key: 'html', label: 'HTML', hint: describeContextField('html') },
        { key: 'css', label: 'CSS', hint: describeContextField('css') },
        { key: 'decision', label: 'Décision', hint: describeContextField('decision') },
        { key: 'editedText', label: 'Texte validé', hint: describeContextField('editedText') },
        { key: 'editedHtml', label: 'HTML validé', hint: describeContextField('editedHtml') }
      ];
    }
    if (n.brickId === 'condition' || n.brickId === 'logic-if') {
      return [
        { key: 'condition', label: 'Résultat', hint: describeContextField('condition') },
        { key: 'field', label: 'Champ testé', hint: describeContextField('field') },
        { key: 'actual', label: 'Valeur trouvée', hint: describeContextField('actual') }
      ];
    }
    if (n.brickId === 'loop') {
      return [
        { key: 'loopIteration', label: 'Itération', hint: describeContextField('loopIteration') },
        { key: 'loopDone', label: 'Boucle terminée', hint: describeContextField('loopDone') }
      ];
    }
    if (n.brickId === 'visualization') {
      return [
        { key: 'surface', label: 'Valeur choisie', hint: describeContextField('surface') },
        { key: 'label', label: 'Libellé', hint: describeContextField('label') },
        { key: 'vizType', label: 'Type', hint: describeContextField('vizType') },
        { key: 'hookMounted', label: 'Accroché', hint: describeContextField('hookMounted') }
      ];
    }
    if (n.kind === 'trigger' || n.brickId === 'trigger') {
      return [
        { key: 'triggeredAt', label: 'Déclenché à', hint: describeContextField('triggeredAt') },
        { key: 'mode', label: 'Mode', hint: describeContextField('mode') }
      ];
    }
    return extractBrickContextFields(getBrick(n.brickId) || {});
  }

  /**
   * Champs de contexte disponibles = contrats des blocs amont, namespacés {{slug.champ}}.
   * @returns {{key:string,label:string,source:string,localKey:string,slug:string}[]}
   */
  function collectContextFieldsForNode(nodeId) {
    ensureAllSlugs();
    var byKey = {};
    var upstream = getUpstreamNodes(nodeId);
    var sources = upstream.length ? upstream : [];

    function pushField(f, n, own) {
      if (!f || !f.key) return;
      var slug = n ? ensureNodeSlug(n) : '';
      var sourceName = n ? (n.name || slug || n.brickId) : 'Ce bloc';
      var namespaced = own ? f.key : (slug ? (slug + '.' + f.key) : f.key);
      if (byKey[namespaced]) return;
      byKey[namespaced] = {
        key: namespaced,
        localKey: f.key,
        label: f.label || humanizeFieldKey(f.key),
        source: own ? 'Ce bloc' : sourceName,
        slug: own ? (state.nodes.find(function(x) { return x.id === nodeId; }) || {}).slug : slug,
        brickId: n ? n.brickId : '',
        provider: n && n.brickId === 'data' ? String(resolveDataProvider(n) || '') : '',
        type: f.type || '',
        example: f.example,
        hint: f.hint || describeContextField(f.key, f),
        own: !!own
      };
    }

    sources.forEach(function(n) {
      nodeLocalFields(n).forEach(function(f) { pushField(f, n, false); });
    });

    var self = state.nodes.find(function(n) { return n.id === nodeId; });
    if (self && self.brickId === 'action') {
      contractFieldsForActionNode(self).forEach(function(f) { pushField(f, self, true); });
    }

    if (!byKey.today) {
      byKey.today = {
        key: 'today',
        localKey: 'today',
        label: 'Date du jour',
        source: 'Système',
        slug: '',
        hint: describeContextField('today')
      };
    }
    if (!byKey.date) {
      byKey.date = {
        key: 'date',
        localKey: 'date',
        label: 'Date / heure',
        source: 'Système',
        slug: '',
        hint: describeContextField('date')
      };
    }

    return Object.keys(byKey).map(function(k) { return byKey[k]; })
      .sort(function(a, b) {
        if (!!a.own !== !!b.own) return a.own ? -1 : 1;
        var as = a.source || '';
        var bs = b.source || '';
        if (as !== bs) return as.localeCompare(bs, 'fr');
        return String(a.label || a.key).localeCompare(String(b.label || b.key), 'fr');
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
    var mode = String(cfg.mode || 'if').toLowerCase();
    var field = cfg.field ? humanizeFieldKey(cfg.field) : '…';
    if (mode === 'case' || mode === 'switch' || mode === 'cas') {
      if (String(cfg.caseSource || '') === 'collection') {
        var nCol = normalizeConditionCases(cfg.cases).length;
        var name = String(cfg.modelName || cfg.casePresetId || 'collection').trim();
        var ver = String(cfg.casesCollectionVersion || '').trim();
        var rev = cfg.casesCollectionRevision;
        var meta = name ? name : '';
        if (ver) meta += (meta ? ' ' : '') + 'v' + ver;
        if (rev != null && rev !== '') meta += (meta ? ' · ' : '') + 'r' + rev;
        return field + ' — ' + (meta ? meta + ' · ' : '') + nCol + ' cas';
      }
      var n = normalizeConditionCases(cfg.cases).length;
      return field + ' — ' + n + ' cas';
    }
    var op = logicOpLabel(cfg.op || 'contains');
    if (cfg.op === 'truthy' || cfg.op === 'falsy') {
      return field + ' ' + op;
    }
    var val = cfg.value != null && String(cfg.value) !== '' ? String(cfg.value) : '…';
    return field + ' ' + op + ' « ' + val + ' »';
  }

  function loopSummary(config) {
    var cfg = config || {};
    var mode = String(cfg.mode || 'items');
    if (mode === 'items' || mode === 'foreach' || mode === 'each') {
      return 'chaque ligne de ' + (cfg.field || 'items');
    }
    if (mode === 'until') {
      return 'jusqu’à ' + logicIfSummary({
        field: cfg.field || 'success',
        op: cfg.op || 'truthy',
        value: cfg.value
      });
    }
    var n = parseInt(cfg.times, 10);
    if (!n || n < 1) n = 10;
    return '× ' + n;
  }

  function syncLoopDefaults(node) {
    if (!isLoopNode(node)) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (!node.config.mode) node.config.mode = 'items';
    if (!node.config.times) node.config.times = 10;
    if (!node.config.op) node.config.op = 'truthy';
    if ((node.config.mode === 'items' || node.config.mode === 'foreach') && (!node.config.field || node.config.field === 'success')) {
      node.config.field = 'items';
    } else if (!node.config.field) {
      node.config.field = node.config.mode === 'until' ? 'success' : 'items';
    }
    if (!node.config.maxIterations) node.config.maxIterations = 50;
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
            + (String(selectedKey) === String(f.key) ? ' selected' : '')
            + ' title="' + escapeHtml(f.hint || describeContextField(f.key, f)) + '">'
            + (isExpertView()
              ? (escapeHtml(f.label) + ' (' + escapeHtml(f.key) + ')')
              : escapeHtml(f.label || f.key))
            + '</option>';
        });
        html += '</optgroup>';
      });
      // Valeur actuelle absente de la liste (ancien flow) → option conservée
      if (selectedKey && !fields.some(function(f) { return f.key === selectedKey; })) {
        html += '<option value="' + escapeHtml(selectedKey) + '" selected>'
          + (isExpertView()
            ? (escapeHtml(humanizeFieldKey(selectedKey)) + ' (' + escapeHtml(selectedKey) + ') — hors liste')
            : (escapeHtml(humanizeFieldKey(selectedKey)) + ' — hors liste'))
          + '</option>';
      }
    }
    html += '</select>';
    return html;
  }

  function syncLogicIfDefaults(node) {
    if (!node || (node.brickId !== 'logic-if' && node.brickId !== 'condition')) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (!node.config.op) node.config.op = 'contains';
    var fields = collectContextFieldsForNode(node.id);
    if (!node.config.field && fields.length) {
      var preferred = fields.find(function(f) { return f.localKey === 'subject' || f.key === 'subject'; })
        || fields.find(function(f) { return f.localKey === 'from' || f.key === 'from'; })
        || fields.find(function(f) { return f.localKey === 'intention_principale'; })
        || fields[0];
      if (preferred) node.config.field = preferred.key;
    }
  }

  function connectNodes(sourceId, targetId, portId) {
    if (Date.now() < state.suppressAutoConnectUntil) return false;
    if (!sourceId || !targetId || sourceId === targetId) return false;
    var source = state.nodes.find(function(n) { return n.id === sourceId; });
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (!source || !target) return false;
    if (target.kind === 'trigger') return false;
    if (wouldCreateCycle(sourceId, targetId)) return false;

    var port = portId || 'main';
    if (isConditionNode(source) && isCaseCondition(source)) {
      if (port !== 'default' && String(port).indexOf('case:') !== 0) port = 'default';
    } else if (isConditionNode(source) && port !== 'false') {
      port = 'true';
    }
    if (isLoopNode(source) && port !== 'done' && port !== 'false') port = 'body';

    if (isCasePort(port)) {
      if (!source.nextPortIds || typeof source.nextPortIds !== 'object') source.nextPortIds = {};
      var portList = nodeNextPortIds(source, port);
      if (portList.indexOf(targetId) === -1) portList.push(targetId);
      source.nextPortIds[port] = portList;
    } else if (isFalsePort(port)) {
      var falses = nodeNextFalseIds(source);
      if (falses.indexOf(targetId) === -1) falses.push(targetId);
      source.nextFalseIds = falses;
    } else {
      var ids = nodeNextIds(source);
      if (ids.indexOf(targetId) === -1) ids.push(targetId);
      source.nextIds = ids;
    }
    syncNextAliases(source);
    if (isConditionNode(target)) syncLogicIfDefaults(target);
    if (isLoopNode(target)) syncLoopDefaults(target);
    if (target.brickId === 'visualization') {
      syncVizRole(target);
      suggestVizFields(target);
    }
    if (isComposeAction(source) && (target.brickId === 'output' || target.brickId === 'ia' || isHookAction(target))) {
      wireNodeMappingFromAction(source, target);
    }
    if ((isFlowOutput(source) || source.brickId === 'ia') && isHookAction(target)) {
      wireNodeMappingFromAction(source, target);
    }
    if (source.brickId === 'data' && target.brickId === 'output') {
      wireMailOutputFromInput(target);
    }
    return true;
  }

  function clearPortOrientForNode(nodeId) {
    Object.keys(state.portOrientByLink).forEach(function(key) {
      var parts = key.split('>');
      var src = (parts[0] || '').split(':')[0];
      if (src === nodeId || parts[1] === nodeId) delete state.portOrientByLink[key];
    });
  }

  function disconnectOutgoing(nodeId) {
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    if (node) {
      node.nextIds = [];
      node.nextFalseIds = [];
      node.nextPortIds = {};
      syncNextAliases(node);
      clearPortOrientForNode(nodeId);
    }
  }

  function disconnectLink(sourceId, targetId, portId) {
    var source = state.nodes.find(function(n) { return n.id === sourceId; });
    if (!source) return false;
    if (!portId || portId === 'true' || portId === 'main' || portId === 'body') {
      source.nextIds = nodeNextIds(source).filter(function(id) { return id !== targetId; });
    }
    if (!portId || isFalsePort(portId)) {
      source.nextFalseIds = nodeNextFalseIds(source).filter(function(id) { return id !== targetId; });
    }
    if (!portId || isCasePort(portId)) {
      var map = nodeNextPortMap(source);
      Object.keys(map).forEach(function(p) {
        if (portId && p !== portId) return;
        map[p] = map[p].filter(function(id) { return id !== targetId; });
        if (!map[p].length) delete map[p];
      });
      source.nextPortIds = map;
    }
    syncNextAliases(source);
    clearPortOrientForNode(sourceId);
    return true;
  }

  function deleteSelectedLink() {
    var link = state.selectedLink;
    if (!link) return false;
    disconnectLink(link.sourceId, link.targetId, link.portId);
    state.selectedLink = null;
    render();
    return true;
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
      n.nextIds = nodeNextIds(n).filter(function(id) { return id !== nodeId; });
      n.nextFalseIds = nodeNextFalseIds(n).filter(function(id) { return id !== nodeId; });
      var pmap = nodeNextPortMap(n);
      Object.keys(pmap).forEach(function(p) {
        pmap[p] = pmap[p].filter(function(id) { return id !== nodeId; });
        if (!pmap[p].length) delete pmap[p];
      });
      n.nextPortIds = pmap;
      syncNextAliases(n);
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
      allOutgoingIds(t).forEach(function(id) { queue.push(id); });
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
      allOutgoingIds(n).forEach(function(next) { queue.push(next); });
    }
    return steps;
  }

  function buildPayload() {
    var triggerNodes = state.nodes.filter(function(n) { return n.kind === 'trigger'; });
    var triggers = triggerNodes.map(function(t) {
      return { id: t.id, brickId: t.brickId, config: t.config || {} };
    });
    var trigger = triggers[0] || { brickId: 'trigger', config: { mode: 'button' } };
    var steps = collectReachableSteps(triggerNodes);

    return {
      name: state.name,
      description: state.description,
      enabled: state.enabled,
      imageUrl: state.imageUrl || null,
      interactionMode: state.interactionMode || 'auto',
      agentContext: state.agentContext || '',
      vizDesign: currentVizDesign(),
      app: {
        publish: (state.app && state.app.publish) || 'auto',
        buttonLabel: (state.app && state.app.buttonLabel) || 'Lancer',
        pages: (state.app && Array.isArray(state.app.pages)) ? state.app.pages : []
      },
      palette: currentPalettePayload(),
      trigger: trigger,
      triggers: triggers,
      steps: steps,
      canvas: {
        nodes: state.nodes.map(function(n) {
          syncNextAliases(n);
          return {
            id: n.id,
            brickId: n.brickId,
            kind: n.kind,
            operation: n.operation,
            name: n.name,
            slug: n.slug || '',
            config: n.config,
            x: n.x,
            y: n.y,
            nextId: n.nextId,
            nextFalseId: n.nextFalseId || null,
            nextIds: nodeNextIds(n),
            nextFalseIds: nodeNextFalseIds(n),
            nextPortIds: nodeNextPortMap(n)
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
    syncAppFields();
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
    readAppFromDom();
  }

  function isButtonTriggerNode(node) {
    if (!node) return false;
    var id = String(node.brickId || '');
    if (id === 'manual-trigger') return true;
    if (id === 'cron-trigger') return false;
    if (id === 'trigger' || node.kind === 'trigger') {
      var mode = String((node.config && node.config.mode) || 'button').toLowerCase();
      return mode === 'button' || mode === 'manual';
    }
    return false;
  }

  function stateHasButtonTrigger() {
    return state.nodes.some(isButtonTriggerNode);
  }

  function stateHasValidation() {
    return state.nodes.some(function(n) {
      return n.brickId === 'validation' || n.brickId === 'human-doc-review';
    });
  }

  function stateHasUserSurface() {
    return stateHasButtonTrigger() || stateHasValidation();
  }

  function syncAppFields() {
    var nameEl = document.getElementById('appName');
    var descEl = document.getElementById('appDescription');
    var imgEl = document.getElementById('appImageUrl');
    var pubEl = document.getElementById('appPublish');
    var btnEl = document.getElementById('appButtonLabel');
    if (nameEl) nameEl.value = state.name || '';
    if (descEl) descEl.value = state.description || '';
    if (imgEl) imgEl.value = state.imageUrl || '';
    if (pubEl) pubEl.value = (state.app && state.app.publish) || 'auto';
    if (btnEl) btnEl.value = (state.app && state.app.buttonLabel) || 'Lancer';
    syncPaletteFields();
    updateAppPreview();
    renderAppPages();
  }

  function readAppFromDom() {
    var descEl = document.getElementById('appDescription');
    var pubEl = document.getElementById('appPublish');
    var btnEl = document.getElementById('appButtonLabel');
    if (descEl) state.description = descEl.value.trim();
    if (!state.app) state.app = { publish: 'auto', buttonLabel: 'Lancer' };
    if (pubEl) state.app.publish = pubEl.value || 'auto';
    if (btnEl) state.app.buttonLabel = btnEl.value.trim() || 'Lancer';
    readPaletteFromDom();
  }

  function updateAppPreview() {
    var nameEl = document.getElementById('appPreviewName');
    var descEl = document.getElementById('appPreviewDesc');
    var metaEl = document.getElementById('appPreviewMeta');
    var btnEl = document.getElementById('appPreviewBtn');
    var cover = document.getElementById('appPreviewCover');
    var btnRow = document.getElementById('appButtonRow');
    var pubHint = document.getElementById('appPublishHint');
    var surfaceHint = document.getElementById('appSurfaceHint');
    var hasBtn = stateHasButtonTrigger();
    var hasVal = stateHasValidation();
    var pageCount = (state.app && Array.isArray(state.app.pages)) ? state.app.pages.length : 0;
    var appSurface = pageCount > 1;
    var publish = (state.app && state.app.publish) || 'auto';
    var label = (state.app && state.app.buttonLabel) || 'Lancer';
    var published = publish === 'yes' || (publish !== 'no' && appSurface);

    if (nameEl) nameEl.textContent = state.name || 'Nouvel agent';
    if (descEl) descEl.textContent = state.description || 'Pas de description';
    if (metaEl) {
      metaEl.textContent = (hasBtn ? 'Manuel' : 'Planifié') +
        (hasVal ? ' · Validation' : '') +
        ' · ' + (state.enabled !== false ? 'Actif' : 'Inactif');
    }
    if (btnEl) {
      btnEl.textContent = label;
      btnEl.style.display = hasBtn ? '' : 'none';
    }
    if (btnRow) btnRow.style.display = hasBtn ? '' : 'none';
    if (cover) {
      cover.innerHTML = '';
      if (state.imageUrl) {
        var img = document.createElement('img');
        img.src = state.imageUrl;
        img.alt = '';
        cover.appendChild(img);
      }
    }
    if (pubHint) {
      if (publish === 'yes') {
        pubHint.textContent = 'Forcé : carte prévue dans Applications (quand le hub sera branché).';
      } else if (publish === 'no') {
        pubHint.textContent = 'Jamais d’App. Play et validation restent dans l’agent.';
      } else if (appSurface) {
        pubHint.textContent = 'Auto : plusieurs pages user — une App sera justifiée.';
      } else {
        pubHint.textContent = 'Auto : une seule surface (Play / run / modal) — pas d’App.';
      }
    }
    if (surfaceHint) {
      if (published) {
        surfaceHint.textContent = 'App : plusieurs pages. Play + validation ne suffisent pas à en créer une.';
      } else if (hasBtn && hasVal) {
        surfaceHint.textContent = 'Run : Play → sablier + progression du flux → modal de validation dans l’agent.';
      } else if (hasBtn) {
        surfaceHint.textContent = 'Play : bouton sur la liste Agents. Pas d’App pour un seul bouton.';
      } else if (hasVal) {
        surfaceHint.textContent = 'Validation : modal dans le run (À traiter reste la file globale). Pas d’App.';
      } else {
        surfaceHint.textContent = 'Rien à cliquer (cron / connecteur). Pas d’App.';
      }
    }
    updateAgentBlockPreview();
  }

  function ensureAppState() {
    if (!state.app || typeof state.app !== 'object') {
      state.app = { publish: 'auto', buttonLabel: 'Lancer', pages: [] };
    }
    if (!Array.isArray(state.app.pages)) state.app.pages = [];
    return state.app;
  }

  function normalizePaletteState(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var family = String(src.parentFamily || 'action').trim();
    if (['action', 'data', 'ia', 'output'].indexOf(family) < 0) family = 'action';
    return {
      publish: src.publish === true || src.publish === 'yes',
      iconEmoji: String(src.iconEmoji != null ? src.iconEmoji : '🪝').trim() || '🪝',
      parentFamily: family,
      hookSurface: String(src.hookSurface || 'palette').trim() || 'palette',
      rowId: String(src.rowId || '').trim(),
      description: String(src.description || '').trim()
    };
  }

  function ensurePaletteState() {
    state.palette = normalizePaletteState(state.palette);
    return state.palette;
  }

  function currentPalettePayload() {
    var pal = ensurePaletteState();
    return {
      publish: !!pal.publish,
      iconEmoji: pal.iconEmoji || '🪝',
      parentFamily: pal.parentFamily || 'action',
      hookSurface: pal.hookSurface || 'palette',
      rowId: pal.rowId || '',
      description: pal.description || state.description || ''
    };
  }

  function currentPaletteRow() {
    var fid = String(state.flowId || '').trim();
    var rid = String((state.palette && state.palette.rowId) || '').trim();
    return (state.paletteCatalog || []).filter(function(r) {
      if (!r) return false;
      if (rid && String(r.id || '') === rid) return true;
      if (fid && String(r.flowId || '') === fid) return true;
      return false;
    })[0] || null;
  }

  function applyPaletteRowToState(row) {
    var pal = ensurePaletteState();
    if (!row) return pal;
    pal.publish = true;
    pal.rowId = String(row.id || pal.rowId || '').trim();
    if (row.iconEmoji) pal.iconEmoji = String(row.iconEmoji).trim() || pal.iconEmoji;
    if (row.parentFamily) pal.parentFamily = String(row.parentFamily).trim() || pal.parentFamily;
    if (row.hookSurface) pal.hookSurface = String(row.hookSurface).trim() || pal.hookSurface;
    if (row.description) pal.description = String(row.description).trim();
    if (row.logoUrl && !state.imageUrl) state.imageUrl = String(row.logoUrl).trim();
    return pal;
  }

  function hookSurfaceLabel(surface) {
    var want = String(surface || '').trim();
    var row = (state.hookCatalog || []).filter(function(r) {
      return r && String(r.surface || '') === want;
    })[0];
    if (row && row.label) return String(row.label);
    if (want === 'palette') return 'Palette — bouton (nom + image)';
    if (want === 'panel') return 'Panneau droit';
    if (want === 'tab') return 'Onglet dédié';
    if (want === 'modal') return 'Modal (run)';
    if (want === 'config') return 'Onglet Configuration';
    if (want === 'app') return 'App (page user)';
    return want || 'palette';
  }

  function fillHookSurfaceSelect() {
    var sel = document.getElementById('paletteHookSurface');
    if (!sel) return;
    var current = String((state.palette && state.palette.hookSurface) || 'palette');
    var rows = Array.isArray(state.hookCatalog) ? state.hookCatalog.slice() : [];
    var seen = {};
    var html = '';
    rows.forEach(function(row) {
      var surface = String((row && row.surface) || '').trim();
      if (!surface || seen[surface]) return;
      seen[surface] = true;
      html += '<option value="' + escapeHtml(surface) + '">'
        + escapeHtml(row.label || surface)
        + (row.description ? ' — ' + escapeHtml(String(row.description).slice(0, 80)) : '')
        + '</option>';
    });
    if (!seen.palette) {
      html = '<option value="palette">Palette — bouton (nom + image)</option>' + html;
    }
    if (!html) {
      html = '<option value="palette">Palette — bouton (nom + image)</option>'
        + '<option value="panel">Panneau droit</option>'
        + '<option value="modal">Modal (run)</option>'
        + '<option value="tab">Onglet (éditeur)</option>'
        + '<option value="config">Onglet Configuration</option>'
        + '<option value="app">App (page user)</option>';
    }
    sel.innerHTML = html;
    if (!sel.querySelector('option[value="' + current.replace(/"/g, '') + '"]')) {
      sel.insertAdjacentHTML('beforeend', '<option value="' + escapeHtml(current) + '">' + escapeHtml(current) + '</option>');
    }
    sel.value = current;
  }

  function syncPaletteFields() {
    var pal = ensurePaletteState();
    var emoji = document.getElementById('paletteIconEmoji');
    var family = document.getElementById('paletteFamily');
    var hook = document.getElementById('paletteHookSurface');
    var btn = document.getElementById('btnPublishPalette');
    var status = document.getElementById('palettePublishStatus');
    if (emoji && document.activeElement !== emoji) emoji.value = pal.iconEmoji || '🪝';
    if (family && document.activeElement !== family) family.value = pal.parentFamily || 'action';
    fillHookSurfaceSelect();
    if (hook && document.activeElement !== hook) hook.value = pal.hookSurface || 'palette';
    if (btn) btn.textContent = pal.publish ? 'Mettre à jour le bloc palette' : 'Publier comme sous-agent';
    if (status) {
      if (pal.publish) {
        status.textContent = 'Accroché dans la palette · ' + hookSurfaceLabel(pal.hookSurface);
      } else {
        status.textContent = 'Pas encore publié comme sous-agent.';
      }
    }
    var hint = document.getElementById('paletteHookHint');
    if (hint) {
      hint.textContent = pal.hookSurface === 'palette'
        ? 'Tu ne le vois pas dans ce flux : nom + image deviennent le bouton palette, puis le bloc dans l’autre canvas.'
        : 'Tu ne le vois pas dans ce flux : le hook « ' + hookSurfaceLabel(pal.hookSurface)
          + ' » s’applique au bloc une fois l’agent posé ailleurs.';
    }
  }

  function readPaletteFromDom() {
    var pal = ensurePaletteState();
    var emoji = document.getElementById('paletteIconEmoji');
    var family = document.getElementById('paletteFamily');
    var hook = document.getElementById('paletteHookSurface');
    if (emoji) pal.iconEmoji = String(emoji.value || '').trim() || '🪝';
    if (family) pal.parentFamily = String(family.value || 'action').trim() || 'action';
    if (hook) pal.hookSurface = String(hook.value || 'palette').trim() || 'palette';
    pal.description = state.description || pal.description;
    return pal;
  }

  function updateAgentBlockPreview() {
    var pal = ensurePaletteState();
    var nodeEl = document.getElementById('agentBlockPreviewNode');
    var nameEl = document.getElementById('agentBlockPreviewName');
    var hookEl = document.getElementById('agentBlockPreviewHook');
    if (nameEl) nameEl.textContent = state.name || 'Nouvel agent';
    if (hookEl) hookEl.textContent = 'hook · ' + (pal.hookSurface || 'palette');
    if (nodeEl) {
      var head = nodeEl.querySelector('.agent-node-head');
      if (head) {
        var ident = head.querySelector('.agent-node-identity-mini');
        var identHtml = ident ? ident.outerHTML : '';
        var iconHtml = state.imageUrl
          ? '<img src="' + escapeHtml(state.imageUrl) + '" alt="" id="agentBlockPreviewEmoji">'
          : '<span class="emoji" id="agentBlockPreviewEmoji">' + escapeHtml(pal.iconEmoji || '🪝') + '</span>';
        head.innerHTML = iconHtml + identHtml;
      }
    }
    renderHookExportPreview();
  }

  function renderHookExportPreview() {
    var host = document.getElementById('agentHookExportPreview');
    if (!host) return;
    var exp = state.exports && state.exports.hook;
    if (exp && (exp.html || exp.css)) {
      host.innerHTML = '<p style="margin:0 0 6px;color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;">Sortie hook</p>'
        + '<iframe sandbox="" title="Aperçu hook"></iframe>';
      var frame = host.querySelector('iframe');
      if (frame) frame.srcdoc = combineFlowPreview(exp);
      return;
    }
    host.innerHTML = '<p class="text-muted small" style="margin:0;color:#64748b;">Pas encore de HTML hook. Lance l’agent Hook une fois, ou pose-le comme sous-action dans ce flux, pour générer le design.</p>';
  }

  function refreshCurrentFlowExports() {
    var id = String(state.flowId || '').trim();
    if (!id) return;
    fetch(API + '/flows/' + encodeURIComponent(id), { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data || !data.flow) return;
        state.exports = (data.flow.exports && typeof data.flow.exports === 'object') ? data.flow.exports : {};
        if (state.activeTab === 'app') renderHookExportPreview();
      })
      .catch(function() {});
  }

  function flattenHookRow(row) {
    if (!row || typeof row !== 'object') return null;
    var src = row.values && typeof row.values === 'object'
      ? Object.assign({}, row, row.values)
      : row;
    var surface = String(src.surface || src.value || '').trim();
    if (!surface) return null;
    return {
      surface: surface,
      label: String(src.label || src.name || surface).trim() || surface,
      description: String(src.description || '').trim()
    };
  }

  function loadHookCatalog() {
    return fetch(API + '/atelier/collections/ensure', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ presetId: 'hook', schemaSlug: 'hook', flowId: state.flowId || '' })
    })
      .then(parseJson)
      .then(function(data) {
        state.hookCatalog = ((data && Array.isArray(data.rows)) ? data.rows : [])
          .map(flattenHookRow)
          .filter(Boolean);
        return state.hookCatalog;
      })
      .catch(function() {
        if (!Array.isArray(state.hookCatalog)) state.hookCatalog = [];
        return state.hookCatalog;
      });
  }

  function viewForNode(node) {
    if (!node) return null;
    if (node.brickId === 'validation' || node.brickId === 'human-doc-review') return 'validation';
    if (node.brickId === 'data') return 'data';
    if (isButtonTriggerNode(node)) return 'play';
    return null;
  }

  function viewLabel(view) {
    if (view === 'play') return 'Play';
    if (view === 'validation') return 'Validation';
    if (view === 'data') return 'Entrées';
    if (view === 'run') return 'Run (sablier + flux)';
    return view || 'Vue';
  }

  function blockViewOptions() {
    var opts = [{ nodeId: '', view: 'run', label: 'Run — sablier + progression du flux' }];
    state.nodes.forEach(function(n) {
      var view = viewForNode(n);
      if (!view) return;
      opts.push({
        nodeId: n.id,
        view: view,
        label: (n.name || n.brickId) + ' — ' + viewLabel(view)
      });
    });
    return opts;
  }

  function appPageNamespace(page) {
    var fid = state.flowId || 'draft';
    var pid = (page && page.id) || 'page';
    return 'agent:app:' + fid + ':' + pid;
  }

  function renderAppPages() {
    var host = document.getElementById('appPagesList');
    if (!host) return;
    ensureAppState();
    var pages = state.app.pages;
    if (!pages.length) {
      host.innerHTML = '<p class="empty" style="margin:0; color:#64748b;">Aucune page. Ajoute-en une pour commencer une App.</p>';
      updateAppPreview();
      return;
    }
    var opts = blockViewOptions();
    host.innerHTML = pages.map(function(page, idx) {
      var ns = page.templateNamespace || appPageNamespace(page);
      var slots = Array.isArray(page.slots) ? page.slots : [];
      var slotHtml = slots.length
        ? slots.map(function(s) {
          return '<div class="agent-app-slot">' +
            '<span>' + escapeHtml(s.label || viewLabel(s.view)) + '</span>' +
            '<button type="button" class="btn-agent-ghost" data-app-rm-slot="' + idx + ':' + escapeHtml(s.id) + '">Retirer</button>' +
            '</div>';
        }).join('')
        : '<p class="empty" style="margin:0; color:#64748b;">Aucune vue insérée.</p>';
      var optHtml = opts.map(function(o) {
        return '<option value="' + escapeHtml(o.view + '|' + (o.nodeId || '')) + '">' + escapeHtml(o.label) + '</option>';
      }).join('');
      return '<article class="agent-app-page" data-page-idx="' + idx + '">' +
        '<div class="agent-app-page-head">' +
        '<input type="text" class="form-control" data-app-page-title="' + idx + '" value="' + escapeHtml(page.title || '') + '"' +
        ' style="background:#111827; color:#e2e8f0; border-color:#1f2937;" placeholder="Nom de la page">' +
        '<button type="button" class="btn-agent" data-app-edit-page="' + idx + '">Éditer</button>' +
        '<button type="button" class="btn-agent-ghost" data-app-sync-page="' + idx + '">Insérer les vues</button>' +
        '<button type="button" class="btn-agent-ghost btn-agent-danger" data-app-rm-page="' + idx + '">Suppr.</button>' +
        '</div>' +
        '<p class="empty" style="margin:0 0 8px; color:#64748b; font-size:0.75rem;"><code>' + escapeHtml(ns) + '</code></p>' +
        '<div class="agent-app-slots">' + slotHtml + '</div>' +
        '<div class="agent-app-slot-add">' +
        '<select class="form-control" data-app-slot-select="' + idx + '" style="background:#111827; color:#e2e8f0; border-color:#1f2937; max-width:320px;">' +
        optHtml + '</select>' +
        '<button type="button" class="btn-agent-ghost" data-app-add-slot="' + idx + '">+ Vue de bloc</button>' +
        '</div></article>';
    }).join('');
    pages.forEach(function(page) {
      var ns = page.templateNamespace || appPageNamespace(page);
      storePageEditorContext(collectAppPageContext(Object.assign({}, page, { templateNamespace: ns })));
    });
    updateAppPreview();
  }

  function addAppPage() {
    ensureAppState();
    function create() {
      var page = {
        id: createId(),
        title: 'Page ' + (state.app.pages.length + 1),
        templateNamespace: '',
        slots: []
      };
      page.templateNamespace = appPageNamespace(page);
      state.app.pages.push(page);
      renderAppPages();
      return ensureAppPageTemplate(page, false);
    }
    if (!state.flowId) {
      return saveFlow().then(function() {
        migrateValidationPageNamespaces();
        return create();
      });
    }
    return create();
  }

  function ensureAppPageTemplate(page, force) {
    if (!page) return Promise.resolve();
    if (!page.templateNamespace) page.templateNamespace = appPageNamespace(page);
    var ctx = collectAppPageContext(page);
    ctx.namespace = page.templateNamespace;
    storePageEditorContext(ctx);
    var apiDoc = (cfg.docApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/agent-documentaire-v2')).replace(/\/$/, '');
    return fetch(apiDoc + '/templates/' + encodeURIComponent(page.templateNamespace) + '/ensure-page', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        force: !!force,
        name: page.title || 'Page',
        slots: page.slots || [],
        productionTemplateId: page.productionTemplateId || 'page-web',
        agentPageContext: ctx
      })
    }).then(parseJson).then(function(data) {
      if (!data.success) throw new Error(data.error || data.message || 'Création de page impossible');
      return page.templateNamespace;
    });
  }

  function openAppPageEditor(page) {
    return ensureAppPageTemplate(page, false).then(function(ns) {
      openDocEditor(ns, collectAppPageContext(page));
    });
  }

  function bindAppPagesEvents() {
    var host = document.getElementById('appPagesList');
    var addBtn = document.getElementById('btnAppAddPage');
    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.addEventListener('click', function() {
        addAppPage().catch(function(e) { alert(e.message); });
      });
    }
    if (!host || host._bound) return;
    host._bound = true;
    host.addEventListener('input', function(e) {
      var input = e.target.closest('[data-app-page-title]');
      if (!input) return;
      var idx = parseInt(input.getAttribute('data-app-page-title'), 10);
      if (!state.app.pages[idx]) return;
      state.app.pages[idx].title = input.value.trim() || ('Page ' + (idx + 1));
      updateAppPreview();
    });
    host.addEventListener('click', function(e) {
      var edit = e.target.closest('[data-app-edit-page]');
      var sync = e.target.closest('[data-app-sync-page]');
      var rm = e.target.closest('[data-app-rm-page]');
      var addSlot = e.target.closest('[data-app-add-slot]');
      var rmSlot = e.target.closest('[data-app-rm-slot]');
      if (edit) {
        var p = state.app.pages[parseInt(edit.getAttribute('data-app-edit-page'), 10)];
        if (p) openAppPageEditor(p).catch(function(err) { alert(err.message); });
        return;
      }
      if (sync) {
        var ps = state.app.pages[parseInt(sync.getAttribute('data-app-sync-page'), 10)];
        if (!ps) return;
        if (!confirm('Régénérer la mise en page avec les vues actuelles ? Le contenu déjà édité de cette page sera remplacé.')) return;
        ensureAppPageTemplate(ps, true)
          .then(function(ns) { openDocEditor(ns, collectAppPageContext(ps)); })
          .catch(function(err) { alert(err.message); });
        return;
      }
      if (rm) {
        var ri = parseInt(rm.getAttribute('data-app-rm-page'), 10);
        if (!confirm('Supprimer cette page ?')) return;
        state.app.pages.splice(ri, 1);
        renderAppPages();
        return;
      }
      if (addSlot) {
        var si = parseInt(addSlot.getAttribute('data-app-add-slot'), 10);
        var page = state.app.pages[si];
        var sel = host.querySelector('[data-app-slot-select="' + si + '"]');
        if (!page || !sel) return;
        var parts = String(sel.value || '').split('|');
        var view = parts[0] || 'block';
        var nodeId = parts[1] || '';
        if (!Array.isArray(page.slots)) page.slots = [];
        var dup = page.slots.some(function(s) { return s.view === view && String(s.nodeId || '') === nodeId; });
        if (dup) return;
        var node = state.nodes.find(function(n) { return n.id === nodeId; });
        page.slots.push({
          id: createId(),
          nodeId: nodeId,
          view: view,
          label: node ? ((node.name || node.brickId) + ' — ' + viewLabel(view)) : viewLabel(view)
        });
        renderAppPages();
        return;
      }
      if (rmSlot) {
        var pair = String(rmSlot.getAttribute('data-app-rm-slot') || '').split(':');
        var pi = parseInt(pair[0], 10);
        var slotId = pair.slice(1).join(':');
        var pg = state.app.pages[pi];
        if (!pg || !Array.isArray(pg.slots)) return;
        pg.slots = pg.slots.filter(function(s) { return s.id !== slotId; });
        renderAppPages();
      }
    });
  }

  function isOfficialSystemTemplateId(templateId) {
    var tid = String(templateId || '').trim();
    return tid === 'agent-hook' || tid === 'agent-design-page-web';
  }

  function isSystemFlowPayload(flow) {
    if (!flow) return false;
    if (flow.official === true || flow.systemLocked === true) return true;
    return isOfficialSystemTemplateId(flow.templateId);
  }

  function canOpenSystemAgentEditor(node, packed) {
    if (isGdriAdmin) return true;
    if (packed && isSystemFlowPayload(packed)) return false;
    return !isOfficialSystemTemplateId(node && node.config && node.config.subTemplateId);
  }

  function systemAgentLockedCopy() {
    return 'Agent système GDRI : seuls les administrateurs GDRI peuvent l’ouvrir ou le modifier. Vous pouvez l’utiliser ici comme boîte noire.';
  }

  function showSystemAgentLocked(message) {
    var app = document.querySelector('.agent-editor-app');
    if (!app) return;
    var msg = message || 'Agent système GDRI : seuls les administrateurs GDRI peuvent l’ouvrir ou le modifier.';
    app.innerHTML =
      '<div class="agent-editor-toolbar">' +
      '<div>' +
      '<a href="' + escapeHtml(backUrl) + '" class="btn-agent-ghost" style="text-decoration:none;display:inline-block;margin-bottom:6px;">← Retour</a>' +
      '<h1>Agent système</h1>' +
      '<div class="sub">Réservé à un administrateur GDRI</div>' +
      '</div></div>' +
      '<div style="max-width:640px;padding:24px 16px;">' +
      '<p style="color:#e2e8f0;line-height:1.5;margin:0 0 12px;">' + escapeHtml(msg) + '</p>' +
      '<p class="empty" style="margin:0;">Un utilisateur classique ou un administrateur d’entité peut poser Hook / Design comme boîte noire, mais ne peut pas ouvrir le canvas interne.</p>' +
      '</div>';
  }

  function loadFromFlow(flow) {
    state.flowId = String(flow._id || '');
    state.imageUrl = flow.imageUrl || '';
    state.interactionMode = flow.interactionMode || 'auto';
    state.name = flow.name || 'Agent';
    state.description = flow.description || '';
    state.enabled = flow.enabled !== false;
    state.agentContext = flow.agentContext != null ? String(flow.agentContext) : '';
    state.vizDesign = normalizeVizDesign(flow.vizDesign);
    state.app = {
      publish: (flow.app && flow.app.publish) || 'auto',
      buttonLabel: (flow.app && flow.app.buttonLabel) || 'Lancer',
      pages: (flow.app && Array.isArray(flow.app.pages)) ? flow.app.pages : []
    };
    state.palette = normalizePaletteState(flow.palette);
    state.exports = (flow.exports && typeof flow.exports === 'object') ? flow.exports : {};
    syncIdentityFields();

    if (flow.canvas && Array.isArray(flow.canvas.nodes) && flow.canvas.nodes.length) {
      state.nodes = flow.canvas.nodes.map(function(n) {
        var brick = getBrick(n.brickId);
        var node = {
          id: n.id || createId(),
          brickId: n.brickId,
          kind: n.kind || (brick && brick.kind) || 'action',
          operation: n.operation || DEFAULT_OPS[n.brickId] || null,
          name: migrateDataBlockName(n.name, n.brickId, brick),
          slug: n.slug || '',
          config: n.config || {},
          x: n.x || 120,
          y: n.y || 80,
          nextId: n.nextId || null,
          nextFalseId: n.nextFalseId || null,
          nextIds: asIdList(n.nextIds, n.nextId),
          nextFalseIds: asIdList(n.nextFalseIds, n.nextFalseId),
          nextPortIds: n.nextPortIds && typeof n.nextPortIds === 'object' ? n.nextPortIds : {}
        };
        return syncNextAliases(node);
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
          slug: '',
          config: trigger.config || {},
          x: tx + ti * 240,
          y: 80,
          nextId: null,
          nextFalseId: null,
          nextIds: [],
          nextFalseIds: [],
          nextPortIds: {}
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
          slug: '',
          config: step.config || {},
          x: 120,
          y: y,
          nextId: null,
          nextFalseId: null,
          nextIds: [],
          nextFalseIds: [],
          nextPortIds: {}
        });
        y += 120;
      });
      var triggerNode = state.nodes.find(function(n) { return n.kind === 'trigger'; });
      var actionNodes = state.nodes.filter(function(n) { return n.kind !== 'trigger'; });
      chainLegacySteps(triggerNode, actionNodes);
    }
    state.selectedNodeId = state.nodes[0] ? state.nodes[0].id : null;
    migrateValidationPageNamespaces();
    ensureAllSlugs();
    initWebhookPresetTracking();
    render();
    prefetchBoundTemplates();
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
    ensureActionConfig(node);
    if (node.brickId === 'action' && !isFunctionAction(node)) {
      openActionComposeModal(node);
      renderConfig();
      renderCanvas();
      return;
    }
    var cfgUi = brickConfigUi(node.brickId);
    if (cfgUi && cfgUi.tabId) {
      setActiveTab(cfgUi.tabId);
      return;
    }
    setActiveTab('canvas');
    renderConfig();
    renderCanvas();
  }

  function runIoShortcutHtml(node) {
    if (!node) return '';
    var dbg = state.runDebug && state.runDebug.byNode ? state.runDebug.byNode[node.id] : null;
    if (!dbg || !dbg.status || dbg.status === 'pending' || dbg.status === 'skipped') return '';
    var err = dbg.error || (dbg.preview && dbg.preview.error) || '';
    var label = runPreviewLabel(dbg.preview, dbg.status, dbg.error, node);
    var html = '<div class="agent-io-shortcut' + (err ? ' is-err' : '') + '">';
    html += '<button type="button" class="btn-agent" data-open-node-io="1" data-io-node="'
      + escapeHtml(node.id) + '">Entrée / sortie</button>';
    if (err) {
      html += '<p class="agent-run-preview-error">' + escapeHtml(String(err)) + '</p>';
    } else if (label) {
      html += '<p class="empty">Dernier run : ' + escapeHtml(label) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function openNodeIoModal(node) {
    if (!node) return;
    var dbg = state.runDebug && state.runDebug.byNode ? state.runDebug.byNode[node.id] : null;
    var brick = getBrick(node.brickId) || {};
    var title = 'Entrée / sortie — ' + (node.name || brick.name || node.brickId);
    if (!dbg || (!dbg.preview && !dbg.error)) {
      openDataTestModal(title, 'Lancez l’agent pour voir l’entrée et la sortie de ce bloc.', '<p class="empty">Aucun run à afficher.</p>', false);
      return;
    }
    openDataTestModal(
      title,
      'Données réellement reçues et émises au dernier run.',
      runPreviewDetailHtml(dbg.preview, dbg.error, node),
      !!(dbg.error || (dbg.preview && dbg.preview.error))
    );
  }

  function getPaletteTipEl() {
    var el = document.getElementById('agentPaletteTip');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'agentPaletteTip';
    el.className = 'agent-palette-tip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
    return el;
  }

  function hidePaletteTip() {
    var el = document.getElementById('agentPaletteTip');
    if (el) el.classList.remove('is-visible');
  }

  function showPaletteTip(anchor) {
    var text = anchor.getAttribute('data-tip');
    if (!text) return;
    var el = getPaletteTipEl();
    el.textContent = text;
    el.classList.add('is-visible');
    var rect = anchor.getBoundingClientRect();
    var left = rect.right + 10;
    var top = rect.top;
    var tipW = 280;
    var tipH = el.offsetHeight || 80;
    if (left + tipW > window.innerWidth - 8) left = Math.max(8, rect.left - tipW - 10);
    if (top + tipH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - tipH - 8);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function renderPalette() {
    var host = document.getElementById('agentPalette');
    if (!host) return;

    var byFamily = {};
    FAMILY_ORDER.forEach(function(f) { byFamily[f] = []; });
    state.bricks.forEach(function(b) {
      var fam = b.family || b.id;
      if (!byFamily[fam]) byFamily[fam] = [];
      byFamily[fam].push(b);
    });

    function brickTooltip(brick) {
      var desc = String(brick.description || '').trim();
      var usage = 'Clic ou glisser pour ajouter. Double-clic pour paramétrer.';
      return desc ? (desc + '\n\n' + usage) : usage;
    }

    function brickHtml(brick) {
      var url = iconUrl(brick);
      var icon = url
        ? '<img src="' + url + '" alt="">'
        : '<span class="emoji">' + ((brick.canvas && brick.canvas.iconEmoji) || '🔧') + '</span>';
      return '<div class="agent-brick-item" draggable="true" data-brick-id="' + escapeHtml(brick.id) + '" data-tip="' + escapeHtml(brickTooltip(brick)) + '">'
        + icon
        + '<div class="meta"><strong>' + escapeHtml(brick.name) + '</strong>'
        + (brick.id === 'data' ? '<span class="agent-node-badge">tableau</span>' : '')
        + '</div>'
        + '</div>';
    }

    function shortcutHtml(parent, child) {
      var tip = String(child.description || '').trim()
        || ('Sous-élément de ' + (parent.name || parent.id) + '. Clic ou glisser pour placer.');
      var logo = String(child.logoUrl || '').trim();
      var icon = logo
        ? '<img src="' + escapeHtml(logo) + '" alt="">'
        : '<span class="emoji">' + escapeHtml(child.iconEmoji || '⚙') + '</span>';
      return '<div class="agent-brick-item is-child" draggable="true" data-brick-id="'
        + escapeHtml(parent.id) + '" data-shortcut-id="' + escapeHtml(child.id) + '" data-tip="'
        + escapeHtml(tip) + '">'
        + icon
        + '<div class="meta"><strong>' + escapeHtml(child.name || child.id) + '</strong>'
        + '<span class="agent-node-badge">ss-action</span>'
        + (child.hookSurface && child.hookSurface !== 'palette'
          ? '<span class="agent-node-badge">hook · ' + escapeHtml(child.hookSurface) + '</span>'
          : '')
        + '</div>'
        + '</div>';
    }

    function familyHtml(brick) {
      var html = brickHtml(brick);
      paletteChildrenOf(brick).forEach(function(child) {
        html += shortcutHtml(brick, child);
      });
      return html;
    }

    var html = '';
    FAMILY_ORDER.forEach(function(fam) {
      (byFamily[fam] || []).forEach(function(brick) {
        html += familyHtml(brick);
      });
    });
    var known = {};
    FAMILY_ORDER.forEach(function(f) { known[f] = true; });
    state.bricks.forEach(function(b) {
      if (known[b.family || b.id]) return;
      html += familyHtml(b);
    });

    host.innerHTML = html || '<p class="empty">Aucune brique disponible.</p>';
    if (!host.dataset.tipScrollBound) {
      host.dataset.tipScrollBound = '1';
      host.addEventListener('scroll', hidePaletteTip);
    }

    host.querySelectorAll('.agent-brick-item').forEach(function(el) {
      el.addEventListener('mouseenter', function() { showPaletteTip(el); });
      el.addEventListener('mouseleave', hidePaletteTip);
      el.addEventListener('dragstart', function(e) {
        state.paletteDragActive = true;
        hidePaletteTip();
        if (state.paletteClickTimer) {
          clearTimeout(state.paletteClickTimer);
          state.paletteClickTimer = null;
        }
        cancelLinkDrag();
        var brickId = el.getAttribute('data-brick-id');
        var shortcutId = el.getAttribute('data-shortcut-id') || '';
        e.dataTransfer.setData('text/brick-id', brickId);
        e.dataTransfer.setData('text/plain', shortcutId ? ('shortcut:' + shortcutId) : brickId);
        if (shortcutId) e.dataTransfer.setData('text/palette-shortcut', shortcutId);
      });
      el.addEventListener('dragend', function() {
        state.paletteDragActive = false;
        state.suppressAutoConnectUntil = Date.now() + 300;
      });
      el.addEventListener('click', function(e) {
        if (state.paletteDragActive) return;
        e.stopPropagation();
        var brickId = el.getAttribute('data-brick-id');
        var shortcutId = el.getAttribute('data-shortcut-id');
        if (state.paletteClickTimer) clearTimeout(state.paletteClickTimer);
        state.paletteClickTimer = setTimeout(function() {
          state.paletteClickTimer = null;
          if (shortcutId) {
            var parent = getBrick(brickId);
            var child = paletteChildrenOf(parent).filter(function(c) { return c.id === shortcutId; })[0];
            if (child) placePaletteShortcut(child);
            return;
          }
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
        var brickId = el.getAttribute('data-brick-id');
        var shortcutId = el.getAttribute('data-shortcut-id');
        if (shortcutId) {
          var parent = getBrick(brickId);
          var child = paletteChildrenOf(parent).filter(function(c) { return c.id === shortcutId; })[0];
          var placed = child ? placePaletteShortcut(child) : null;
          if (placed) openNodeConfig(placed);
          return;
        }
        var brick = getBrick(brickId);
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
    var w = el ? el.offsetWidth : NODE_WIDTH;
    var cx = node.x + w / 2;
    var cy = node.y + h / 2;
    var ports = {};
    if (el) {
      var cr = canvas.getBoundingClientRect();
      el.querySelectorAll('[data-port-id]').forEach(function(btn) {
        var id = btn.getAttribute('data-port-id');
        if (!id) return;
        var br = btn.getBoundingClientRect();
        var sideAttr = btn.getAttribute('data-port') || 'right';
        var side = sideAttr === 'bottom' ? 'bottom' : (sideAttr === 'left' ? 'left' : 'right');
        ports[id] = {
          x: br.left - cr.left + (br.width / 2),
          y: br.top - cr.top + (br.height / 2),
          side: side
        };
      });
    }
    return {
      top: { x: cx, y: node.y, side: 'top' },
      bottom: { x: cx, y: node.y + h, side: 'bottom' },
      left: { x: node.x, y: cy, side: 'left' },
      right: { x: node.x + w, y: cy, side: 'right' },
      trueOut: { x: node.x + w, y: node.y + h * 0.34, side: 'right' },
      falseOut: { x: node.x + w, y: node.y + h * 0.66, side: 'right' },
      bodyOut: { x: node.x + w * 0.22, y: node.y + h, side: 'bottom' },
      doneOut: { x: node.x + w, y: cy, side: 'right' },
      returnIn: { x: node.x + w * 0.78, y: node.y + h, side: 'bottom' },
      center: { x: cx, y: cy },
      ports: ports
    };
  }

  function linkOrientKey(sourceId, targetId, portId) {
    return sourceId + ':' + (portId || 'main') + '>' + targetId;
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
    var outSide = from.side || 'right';
    var inSide = to.side || 'left';
    var stem = PORT_STEM;

    if (outSide === 'bottom' && inSide === 'left') {
      var down = Math.max(stem, (y2 - y1) * 0.45 + stem);
      return 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + down) + ', ' + (x2 - stem) + ' ' + y2 + ', ' + x2 + ' ' + y2;
    }
    if (outSide === 'right' && inSide === 'bottom') {
      var lift = Math.max(stem, (y2 - y1) * 0.4 + stem);
      return 'M' + x1 + ' ' + y1 + ' C ' + (x1 + stem) + ' ' + y1 + ', ' + x2 + ' ' + (y2 + lift) + ', ' + x2 + ' ' + y2;
    }
    if (outSide === 'bottom' && inSide === 'bottom') {
      var dip = Math.max(y1, y2) + stem * 1.6;
      return 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + dip + ', ' + x2 + ' ' + dip + ', ' + x2 + ' ' + y2;
    }

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

  function pushOrthoPt(pts, x, y) {
    var last = pts[pts.length - 1];
    if (last && Math.abs(last.x - x) < 1 && Math.abs(last.y - y) < 1) return;
    pts.push({ x: x, y: y });
  }

  function roundedPolyline(pts, radius) {
    if (!pts || pts.length < 2) return '';
    var r = radius == null ? LOOP_U_RADIUS : radius;
    var d = 'M' + pts[0].x + ' ' + pts[0].y;
    if (pts.length === 2) {
      return d + ' L' + pts[1].x + ' ' + pts[1].y;
    }
    for (var i = 1; i < pts.length - 1; i++) {
      var prev = pts[i - 1];
      var curr = pts[i];
      var next = pts[i + 1];
      var inDx = curr.x - prev.x;
      var inDy = curr.y - prev.y;
      var outDx = next.x - curr.x;
      var outDy = next.y - curr.y;
      var inLen = Math.hypot(inDx, inDy) || 1;
      var outLen = Math.hypot(outDx, outDy) || 1;
      var rad = Math.min(r, inLen / 2, outLen / 2);
      var p1x = curr.x - (inDx / inLen) * rad;
      var p1y = curr.y - (inDy / inLen) * rad;
      var p2x = curr.x + (outDx / outLen) * rad;
      var p2y = curr.y + (outDy / outLen) * rad;
      d += ' L' + p1x + ' ' + p1y + ' Q' + curr.x + ' ' + curr.y + ' ' + p2x + ' ' + p2y;
    }
    var last = pts[pts.length - 1];
    d += ' L' + last.x + ' ' + last.y;
    return d;
  }

  function polylineMid(pts) {
    if (!pts || !pts.length) return { x: 0, y: 0 };
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
    var best = 0;
    var bestLen = -1;
    for (var i = 0; i < pts.length - 1; i++) {
      var len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      if (len > bestLen) {
        bestLen = len;
        best = i;
      }
    }
    return {
      x: (pts[best].x + pts[best + 1].x) / 2,
      y: (pts[best].y + pts[best + 1].y) / 2
    };
  }

  function pathFromOrthoPts(pts) {
    return {
      d: roundedPolyline(pts, LOOP_U_RADIUS),
      routed: true,
      mid: polylineMid(pts)
    };
  }

  /** Descente courte sous Répéter, puis arrivée à gauche du premier bloc. */
  function buildLoopBodyPath(from, to) {
    var x1 = from.x;
    var y1 = from.y;
    var x2 = to.x;
    var y2 = to.y;
    var downY = y1 + PORT_STEM;
    var inX = x2 - PORT_STEM;
    var pts = [];
    pushOrthoPt(pts, x1, y1);
    pushOrthoPt(pts, x1, downY);
    pushOrthoPt(pts, inX, downY);
    pushOrthoPt(pts, inX, y2);
    pushOrthoPt(pts, x2, y2);
    return pathFromOrthoPts(pts);
  }

  function hLaneHitsLoopBody(y, xA, xB, loopNode, canvas) {
    var left = Math.min(xA, xB);
    var right = Math.max(xA, xB);
    var ids = loopBodyIds(loopNode);
    for (var i = 0; i < ids.length; i++) {
      var n = state.nodes.find(function(nn) { return nn.id === ids[i]; });
      if (!n) continue;
      var r = getNodeRect(ids[i], canvas);
      if (!r) continue;
      if (y >= n.y - 2 && y <= r.bottom.y + 2 && right > n.x && left < r.right.x) return true;
    }
    return false;
  }

  /**
   * Sortie à droite du dernier bloc, puis arrivée dans Retour par le bas
   * (jamais par le haut du port).
   */
  function buildLoopReturnPath(from, to, loopNode, canvas, sourceId) {
    var x1 = from.x;
    var y1 = from.y;
    var x2 = to.x;
    var y2 = to.y;
    var stem = PORT_STEM;
    var last = getNodeRect(sourceId, canvas);
    var lastRight = last && last.right ? last.right.x : x1;
    var lastTop = last && last.top ? last.top.y : y1;
    var lastBottom = last && last.bottom ? last.bottom.y : y1;
    var laneX = Math.max(x1, lastRight) + stem;
    var fromBelow = y2 + stem;
    var rail = fromBelow;
    var crossesLast = x2 < laneX && rail > lastTop - 4 && rail < lastBottom + 4;
    if (crossesLast || hLaneHitsLoopBody(rail, laneX, x2, loopNode, canvas)) {
      rail = Math.max(loopCycleRailY(loopNode, canvas), lastBottom + stem, fromBelow);
    }
    var pts = [];
    pushOrthoPt(pts, x1, y1);
    pushOrthoPt(pts, laneX, y1);
    pushOrthoPt(pts, laneX, rail);
    pushOrthoPt(pts, x2, rail);
    pushOrthoPt(pts, x2, y2);
    return pathFromOrthoPts(pts);
  }

  function loopCycleRailY(loopNode, canvas) {
    var y = 0;
    function bump(rect) {
      if (!rect || !rect.bottom) return;
      if (rect.bottom.y > y) y = rect.bottom.y;
    }
    bump(getNodeRect(loopNode.id, canvas));
    loopBodyIds(loopNode).forEach(function(id) {
      bump(getNodeRect(id, canvas));
    });
    return y + LOOP_U_GAP;
  }

  function outgoingPortPoint(rect, sourcePort) {
    if (!rect) return null;
    if (rect.ports && sourcePort && rect.ports[sourcePort]) return rect.ports[sourcePort];
    if (sourcePort === 'body') return rect.bodyOut;
    if (sourcePort === 'done') return rect.doneOut;
    if (sourcePort === 'true') return rect.trueOut;
    if (sourcePort === 'false' || sourcePort === 'default') return rect.falseOut;
    return rect.right;
  }

  function incomingPortPoint(rect, sourceId, targetId) {
    if (!rect) return null;
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (isLoopNode(target) && isInLoopBody(target, sourceId)) {
      if (rect.ports && rect.ports.return) return rect.ports.return;
      return rect.returnIn;
    }
    return rect.left;
  }

  /**
   * Flux gauche → droite. Corps de boucle : U orthogonal sous les blocs
   * (descente Répéter → premier, rail, remontée Retour).
   */
  function buildConnectionPath(sourceId, targetId, canvas, sourcePort) {
    var s = getNodeRect(sourceId, canvas);
    var t = getNodeRect(targetId, canvas);
    if (!s || !t) return null;
    var portId = sourcePort || 'main';
    var out = outgoingPortPoint(s, portId);
    var inn = incomingPortPoint(t, sourceId, targetId);
    if (!out || !inn) return null;
    var source = state.nodes.find(function(n) { return n.id === sourceId; });
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (isLoopNode(source) && portId === 'body') {
      return buildLoopBodyPath(out, inn);
    }
    if (isLoopNode(target) && isInLoopBody(target, sourceId)) {
      return buildLoopReturnPath(out, inn, target, canvas, sourceId);
    }
    return {
      d: buildCurvePath(out, inn),
      routed: false,
      mid: { x: (out.x + inn.x) / 2, y: (out.y + inn.y) / 2 }
    };
  }

  function drawLink(svg, canvas, sourceId, targetId, cssClass, sourcePort) {
    var target = state.nodes.find(function(n) { return n.id === targetId; });
    if (!target) return;
    var portId = sourcePort || 'main';
    if (isLoopNode(target) && isInLoopBody(target, sourceId)) {
      cssClass = (cssClass ? cssClass + ' ' : '') + 'connection-return';
    }
    var route = buildConnectionPath(sourceId, targetId, canvas, portId);
    if (!route) return;
    var selected = state.selectedLink
      && state.selectedLink.sourceId === sourceId
      && state.selectedLink.targetId === targetId
      && (state.selectedLink.portId || 'main') === portId;
    var hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('d', route.d);
    hit.setAttribute('class', 'connection-hit');
    hit.setAttribute('data-link-source', sourceId);
    hit.setAttribute('data-link-target', targetId);
    hit.setAttribute('data-link-port', portId);
    hit.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      state.selectedNodeId = null;
      state.selectedLink = { sourceId: sourceId, targetId: targetId, portId: portId };
      render();
    });
    svg.appendChild(hit);
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', route.d);
    path.setAttribute('class', 'connection-direct' + (cssClass ? ' ' + cssClass : '') + (selected ? ' is-selected' : ''));
    svg.appendChild(path);
    if (route.mid && state.runDebug && state.runDebug.byNode && state.runDebug.byNode[sourceId]) {
      var srcDbg = state.runDebug.byNode[sourceId];
      var chipLabel = runPreviewLabel(srcDbg.preview, srcDbg.status, srcDbg.error);
      if (chipLabel) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'agent-link-debug is-run-' + escapeHtml((srcDbg.error || srcDbg.status === 'failed') ? 'failed' : (srcDbg.status || 'pending'));
        chip.style.left = Math.round(route.mid.x) + 'px';
        chip.style.top = Math.round(route.mid.y) + 'px';
        chip.textContent = chipLabel;
        chip.title = srcDbg.error
          ? String(srcDbg.error)
          : 'Données réellement sorties de ce bloc — cliquer pour le détail';
        chip.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          state.selectedNodeId = null;
          state.selectedLink = { sourceId: sourceId, targetId: targetId, portId: portId };
          render();
        });
        canvas.appendChild(chip);
      }
    }
  }

  function renderConnections(svg, canvas) {
    svg.innerHTML = '';
    canvas.querySelectorAll('.agent-link-debug').forEach(function(el) { el.remove(); });
    state.nodes.forEach(function(node) {
      if (isConditionNode(node) && isCaseCondition(node)) {
        namedOutputPorts(node).forEach(function(p) {
          var css = p.id === 'default' ? 'connection-false' : 'connection-true';
          nodeNextPortIds(node, p.id).forEach(function(targetId) {
            drawLink(svg, canvas, node.id, targetId, css, p.id);
          });
        });
        return;
      }
      var bodyPort = isLoopNode(node) ? 'body' : (isConditionNode(node) ? 'true' : 'main');
      var donePort = isLoopNode(node) ? 'done' : 'false';
      var bodyClass = isConditionNode(node) ? 'connection-true' : (isLoopNode(node) ? 'connection-body' : '');
      var doneClass = isLoopNode(node) ? 'connection-done' : 'connection-false';
      nodeNextIds(node).forEach(function(targetId) {
        drawLink(svg, canvas, node.id, targetId, bodyClass, bodyPort);
      });
      nodeNextFalseIds(node).forEach(function(targetId) {
        drawLink(svg, canvas, node.id, targetId, doneClass, donePort);
      });
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
      var runInfo = state.runDebug && state.runDebug.byNode ? state.runDebug.byNode[node.id] : null;
      if (runInfo && (runInfo.error || runInfo.status === 'failed')) el.classList.add('is-run-failed');
      else if (runInfo && runInfo.status) el.classList.add('is-run-' + runInfo.status);
      var setupWarns = nodeSetupWarnings(node);
      if (setupWarns.length) el.classList.add('is-incomplete');
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';
      el.dataset.id = node.id;

      var url = iconUrl(brick);
      var insertableLook = insertablePaletteLook(node);
      if (insertableLook && insertableLook.logoUrl) url = insertableLook.logoUrl;
      var icon = url
        ? '<img src="' + url + '" alt="">'
        : '<span class="emoji">' + (insertableLook && insertableLook.iconEmoji
          ? insertableLook.iconEmoji
          : ((brick.canvas && brick.canvas.iconEmoji) || '🔧')) + '</span>';

      var namedPorts = namedOutputPorts(node);
      var namedIns = namedInputPorts(node);
      var isTrigger = node.brickId === 'trigger' || node.kind === 'trigger';
      if (isConditionNode(node)) el.classList.add('agent-node--condition');
      var isCaseNode = isConditionNode(node) && isCaseCondition(node);
      if (isCaseNode) el.classList.add('agent-node--case');
      if (isLoopNode(node)) el.classList.add('agent-node--loop');
      if (node.brickId === 'ia') el.classList.add('agent-node--ia');
      if (isInsertableAction(node)) el.classList.add('agent-node--insertable');
      else if (isComposeAction(node)) el.classList.add('agent-node--compose');
      if (node.brickId === 'data') el.classList.add('agent-node--data');
      if (node.brickId === 'visualization') el.classList.add('agent-node--visualization');

      var inPorts = isTrigger
        ? ''
        : '<span class="agent-node-port agent-node-port--left agent-node-port--in" data-port="left" aria-hidden="true"></span>';
      if (namedIns) {
        inPorts += namedIns.map(function(p) { return namedPortHtml(p, 'in'); }).join('');
      }
      var outPorts;
      if (isCaseNode) {
        outPorts = '';
      } else if (namedPorts) {
        outPorts = namedPorts.map(function(p) { return namedPortHtml(p, 'out'); }).join('');
      } else {
        outPorts = '<span class="agent-node-port agent-node-port--right agent-node-port--out" data-port="right" data-port-id="main" aria-hidden="true"></span>';
      }
      var caseListHtml = isCaseNode ? conditionCaseListHtml(node) : '';

      var extraBits = [];
      if (node.brickId === 'trigger' && node.config && node.config.mode) {
        extraBits.push(triggerModeLabel(node.config.mode, node.config));
      }
      if (node.brickId === 'data' && node.config && (node.config.provider || node.config.instanceId)
          && String(node.config.provider || '') !== 'facebook') {
        extraBits.push(dataNodeSummary(node.config));
      }
      if (isInsertableAction(node)) {
        extraBits.push('boîte noire');
        if (insertableLook && insertableLook.hookSurface && insertableLook.hookSurface !== 'palette') {
          extraBits.push('hook · ' + hookSurfaceLabel(insertableLook.hookSurface));
        }
      } else if (node.brickId === 'action' && node.config && !isComposeAction(node)) {
        extraBits.push(actionNodeSummary(node.config));
      }
      if (isComposeAction(node) && ((node.config && node.config.variables) || []).length) {
        extraBits.push(actionNodeSummary(node.config));
      }
      if (node.brickId === 'output') {
        extraBits.push(outputNodeSummary(node.config || {}));
      }
      if ((node.brickId === 'data' && node.config && node.config.provider === 'facebook') || node.brickId === 'facebook') {
        extraBits.push(facebookNodeSummary(node.config || {}));
      }
      if (node.brickId === 'logic-if' || node.brickId === 'condition') {
        extraBits.push(logicIfSummary(node.config || {}));
      }
      if (isLoopNode(node)) {
        extraBits.push(loopSummary(node.config || {}));
      }
      if (node.brickId === 'visualization') {
        extraBits.push(visualizationNodeSummary(node));
      }
      var familyCaption = nodeFamilyCaption(node, brick);
      var tipParts = [familyCaption].concat(extraBits.filter(Boolean));
      var nodeTitle = node.name || brick.name || node.brickId;
      if (nodeTitle && tipParts[0] && String(tipParts[0]).toLowerCase() === String(nodeTitle).toLowerCase()) {
        tipParts.shift();
      }
      var nodeTip = tipParts.filter(Boolean).join(' · ');
      if (brick.description) {
        nodeTip = nodeTip ? (nodeTip + '\n\n' + brick.description) : brick.description;
      }
      if (setupWarns.length) {
        nodeTip = 'À compléter\n' + setupWarns.map(formatSetupWarning).join('\n')
          + (nodeTip ? '\n\n' + nodeTip : '');
      }
      var slug = ensureNodeSlug(node);
      if (isExpertView()) {
        var slugHint = '{{' + slug + '.*}}';
        nodeTip = nodeTip ? (nodeTip + '\n' + slugHint) : slugHint;
      }

      var nsHtml = '';
      if (isExpertView()) {
        nsHtml = '<div class="agent-node-ns" title="Namespace du bloc">{{' + escapeHtml(slug) + '}}'
          + (node.brickId === 'data' ? ' <span class="agent-node-badge">tableau</span>' : '')
          + '</div>';
      }

      el.setAttribute('data-tip', nodeTip);
      var extraBtns = '';
      if (runInfo && runInfo.status && runInfo.status !== 'pending' && runInfo.status !== 'skipped') {
        extraBtns += '<button type="button" class="agent-node-test agent-node-io-btn" data-open-node-io="1" title="Entrée et sortie du dernier run">I/O</button>';
      }
      el.innerHTML = inPorts
        + '<div class="agent-node-head">' + icon
        + (isCollectionCaseSource(node)
          ? '<button type="button" class="agent-node-refresh' + (isConditionCollectionStale(node) ? ' is-stale' : '') + '" data-refresh-cases="1" title="'
            + (isConditionCollectionStale(node) ? 'La collection a changé — mettre à jour les cas' : 'Mettre à jour les cas depuis la collection')
            + '">↻</button>'
          : '')
        + '<div class="agent-node-identity-mini">'
        + '<div class="agent-node-title-row">'
        + '<div class="agent-node-title">' + escapeHtml(nodeTitle)
        + runNodeBadgeHtml(node.id)
        + (isInsertableAction(node) && insertableLook && insertableLook.hookSurface
          && insertableLook.hookSurface !== 'palette'
          ? ' <span class="agent-node-badge">hook · ' + escapeHtml(hookSurfaceLabel(insertableLook.hookSurface)) + '</span>'
          : '')
        + '</div>'
        + (setupWarns.length
          ? '<span class="agent-node-warn-mark" aria-hidden="true">!</span>'
          : '')
        + '</div>'
        + nsHtml
        + runNodeErrorHtml(node.id)
        + '</div></div>'
        + caseListHtml
        + extraBtns
        + outPorts;

      el.addEventListener('mouseenter', function() { showPaletteTip(el); });
      el.addEventListener('mouseleave', hidePaletteTip);

      var ioBtn = el.querySelector('[data-open-node-io]');
      if (ioBtn) {
        ioBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          openNodeIoModal(node);
        });
      }

      var refreshBtn = el.querySelector('[data-refresh-cases]');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          refreshCasesFromCollection(node);
        });
      }

      el.addEventListener('click', function(e) {
        if (e.target.closest('[data-open-node-io], [data-refresh-cases]')) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        state.selectedNodeId = node.id;
        state.selectedLink = null;
        renderConfig();
        renderCanvas();
        refreshHookListForBlock(node, 'select');
      });

      el.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        e.preventDefault();
        openNodeConfig(node);
      });

      el.querySelectorAll('.agent-node-port--in').forEach(function(port) {
        port.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          openFlowContractModal(node, 'in');
        });
      });

      el.querySelectorAll('.agent-node-port--out').forEach(function(port) {
        port.addEventListener('pointerdown', function(e) {
          if (e.button !== 0) return;
          if (state.paletteDragActive) return;
          e.stopPropagation();
          e.preventDefault();
          startLinkDrag(e, node.id, port.getAttribute('data-port'), canvas, svg, port.getAttribute('data-port-id'));
        });
      });

      el.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        hidePaletteTip();
        if (e.target.closest('.agent-node-port, .agent-node-port-named, .agent-node-test, .agent-node-refresh')) return;
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

  function startLinkDrag(e, sourceId, side, canvas, svg, portId) {
    cancelLinkDrag();

    var rect = canvas.getBoundingClientRect();
    var preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    preview.setAttribute('class', 'connection-preview');
    svg.appendChild(preview);
    canvas.classList.add('is-linking');

    var startClientX = e.clientX;
    var startClientY = e.clientY;
    var moved = false;
    var sourcePort = portId || 'main';

    function portPoint() {
      var nr = getNodeRect(sourceId, canvas);
      return outgoingPortPoint(nr, sourcePort);
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
        side: 'left'
      };
      var previewPath = sourcePort === 'body'
        ? buildLoopBodyPath(from, to)
        : { d: buildCurvePath(from, to) };
      preview.setAttribute('d', previewPath.d);
    }

    function finishLink(ev) {
      cancelLinkDrag();

      if (!moved) {
        var srcNode = state.nodes.find(function(n) { return n.id === sourceId; });
        if (srcNode) openFlowContractModal(srcNode, 'out');
        renderConnections(svg, canvas);
        return;
      }

      var targetEl = document.elementFromPoint(ev.clientX, ev.clientY);
      var targetNodeEl = targetEl && targetEl.closest('.agent-node');
      if (targetNodeEl && targetNodeEl.dataset.id !== sourceId) {
        connectNodes(sourceId, targetNodeEl.dataset.id, sourcePort);
        render();
        return;
      }
      renderConnections(svg, canvas);
    }

    function onMove(ev) { updatePreview(ev); }

    state.linking = {
      sourceId: sourceId,
      side: side,
      portId: sourcePort,
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

  function findFacebookAccountByPageId(pageId) {
    var pid = String(pageId || '').trim();
    if (!pid) return null;
    return listDataAccounts('facebook').find(function(inst) {
      return inst && inst.settings && String(inst.settings.pageId) === pid;
    }) || null;
  }

  function applyFacebookAccountToNode(node, opts) {
    opts = opts || {};
    if (!node) return;
    if (!node.config) node.config = {};
    var pageId = opts.pageId != null ? String(opts.pageId).trim() : '';
    var instanceId = opts.instanceId != null ? String(opts.instanceId).trim() : '';
    node.config.provider = 'facebook';

    if (instanceId) {
      var picked = findConnectorInstance(instanceId);
      node.config.instanceId = picked ? instanceIdOf(picked) : instanceId;
      if (picked && picked.settings && picked.settings.pageId) {
        node.config.pageId = String(picked.settings.pageId);
        node.config.pageName = String(picked.settings.pageName || node.config.pageName || '');
      } else if (pageId) {
        node.config.pageId = pageId;
      }
      var pageFromInst = findFacebookPage(node.config.pageId);
      if (pageFromInst) node.config.pageName = pageFromInst.pageName || node.config.pageName || '';
      return;
    }

    node.config.pageId = pageId;
    var page = findFacebookPage(pageId);
    node.config.pageName = page ? (page.pageName || '') : (pageId ? (node.config.pageName || '') : '');
    var inst = pageId ? findFacebookAccountByPageId(pageId) : null;
    node.config.instanceId = inst ? instanceIdOf(inst) : '';
  }

  function syncFacebookAccountFromNode(node) {
    if (!node || !isFacebookListenNode(node) || !node.config) return;
    var pageId = String(node.config.pageId || '').trim();
    var instanceId = String(node.config.instanceId || '').trim();
    if (instanceId && !pageId) {
      applyFacebookAccountToNode(node, { instanceId: instanceId });
      return;
    }
    if (pageId && !instanceId) {
      applyFacebookAccountToNode(node, { pageId: pageId });
      return;
    }
    if (!instanceId || !pageId) return;
    var picked = findConnectorInstance(instanceId);
    var instPage = picked && picked.settings && picked.settings.pageId
      ? String(picked.settings.pageId)
      : '';
    if (instPage && instPage !== pageId) {
      var instForPage = findFacebookAccountByPageId(pageId);
      if (instForPage) applyFacebookAccountToNode(node, { pageId: pageId });
      else applyFacebookAccountToNode(node, { instanceId: instanceId });
    } else if (!instPage) {
      applyFacebookAccountToNode(node, { pageId: pageId });
    }
  }

  function syncAllFacebookAccounts() {
    state.nodes.forEach(function(n) {
      if (isFacebookListenNode(n)) syncFacebookAccountFromNode(n);
    });
  }

  function refreshFacebookAccountUi(node) {
    node = node || getFacebookNode();
    if (!node || !node.config) return;
    var pageEl = document.getElementById('fbPageId');
    if (pageEl) pageEl.value = String(node.config.pageId || '');
    var labelEl = document.getElementById('fbPageLabel');
    if (labelEl) {
      var page = findFacebookPage(node.config.pageId);
      var name = (page && page.pageName) || node.config.pageName || node.config.pageId || '';
      labelEl.textContent = name || 'Aucune page — choisissez-la dans le bloc Entrées (panneau de droite).';
    }
    if (state.selectedNodeId !== node.id) return;
    var instSel = document.querySelector('#agentConfig select[data-key="instanceId"]');
    if (instSel) {
      var want = String(node.config.instanceId || '');
      if (want) instSel.value = want;
    }
  }

  function resolveEditorEntrepriseId() {
    return state.entrepriseId || ENTREPRISE_ID || null;
  }

  function connectorTypeById(connectorId) {
    var id = String(connectorId || '');
    return (state.connectorTypes || []).find(function(t) { return String(t.id) === id; }) || null;
  }

  function providerFromConnectorId(connectorId) {
    var id = String(connectorId || '').toLowerCase();
    if (id === 'http-generic' || id === 'http') return 'http';
    if (id === 'mail-in' || id === 'mail-out' || id === 'mail') return 'mail';
    if (id === 'facebook' || id === 'facebook-out') return 'facebook';
    return id;
  }

  function connectorIdFromProvider(provider) {
    var p = String(provider || '').toLowerCase();
    if (p === 'http') return 'http-generic';
    if (p === 'mail') return 'mail-in';
    if (p === 'facebook') return 'facebook';
    return p;
  }

  function instanceIdOf(inst) {
    if (!inst) return '';
    return String(inst._id || inst.id || '');
  }

  function instanceLabel(inst) {
    if (!inst) return '';
    var type = connectorTypeById(inst.connectorId);
    var typeName = (type && type.name) || inst.connectorId || 'Canal';
    var name = inst.name || (inst.settings && (inst.settings.pageName || inst.settings.pageId || inst.settings.accountRef)) || instanceIdOf(inst);
    return typeName + ' — ' + name;
  }

  function connectorSupportsPush(connectorId) {
    var id = String(connectorId || '');
    if (id === 'facebook' || id === 'http-generic') return true;
    var type = connectorTypeById(id);
    var caps = (type && type.capabilities) || [];
    return caps.indexOf('ingest.push') >= 0;
  }

  function instanceHasPush(inst) {
    if (!inst) return false;
    if (connectorSupportsPush(inst.connectorId)) return true;
    var modes = Array.isArray(inst.ingestModes) ? inst.ingestModes : [];
    return modes.indexOf('push') >= 0;
  }

  function listWebhookInstances() {
    var byId = {};
    (state.connectorInstances || []).forEach(function(inst) {
      if (!inst || inst.enabled === false || !instanceHasPush(inst)) return;
      byId[instanceIdOf(inst)] = inst;
    });
    (state.facebookPages || []).forEach(function(page) {
      if (!page || !page.pageId || page.enabled === false) return;
      var existing = (state.connectorInstances || []).find(function(inst) {
        return inst && inst.connectorId === 'facebook' && inst.settings
          && String(inst.settings.pageId) === String(page.pageId);
      });
      if (existing) {
        byId[instanceIdOf(existing)] = existing;
        return;
      }
      var id = page.instanceId ? String(page.instanceId) : ('fb-page:' + page.pageId);
      if (byId[id]) return;
      byId[id] = {
        _id: id,
        connectorId: 'facebook',
        name: page.pageName || ('Page ' + page.pageId),
        enabled: true,
        settings: { pageId: page.pageId, pageName: page.pageName || '' },
        ingestModes: ['push', 'poll']
      };
    });
    return Object.keys(byId).map(function(k) { return byId[k]; });
  }

  function listMailAccountsFromConfig() {
    var cfg = state.mailConfig;
    if (!cfg) return [];
    var out = [];
    var seen = {};
    function pushAcc(id, label, email, mailbox) {
      var key = String(id || email || '');
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({
        id: key,
        label: String(label || email || key),
        email: String(email || ''),
        mailbox: mailbox || 'INBOX'
      });
    }
    (cfg.comptes || []).forEach(function(c) {
      if (!c || c.enabled === false) return;
      pushAcc(c.id || c.email, c.from_name || c.email, c.email, c.imap_mailbox);
    });
    var profiles = cfg.smtp_profiles || {};
    Object.keys(profiles).forEach(function(id) {
      var p = profiles[id] || {};
      var email = (p.smtp && p.smtp.auth && p.smtp.auth.user) || p.email || id;
      pushAcc(id, p.from_name || p.name || email, email, 'INBOX');
    });
    return out;
  }

  function listDataAccounts(provider) {
    var want = String(provider || '').toLowerCase();
    var byId = {};
    function add(inst) {
      if (!inst) return;
      var cid = String(inst.connectorId || '');
      var p = providerFromConnectorId(cid);
      if (p !== 'mail' && p !== 'facebook' && p !== 'http') return;
      if (p === 'mail' && cid !== 'mail-in' && cid !== 'mail') return;
      if (want && p !== want) return;
      if (inst.enabled === false) return;
      var id = instanceIdOf(inst);
      if (!id) return;
      byId[id] = inst;
    }
    (state.connectorInstances || []).forEach(add);
    if (!want || want === 'facebook') {
      (state.facebookPages || []).forEach(function(page) {
        if (!page || !page.pageId || page.enabled === false) return;
        var existing = (state.connectorInstances || []).find(function(inst) {
          return inst && inst.connectorId === 'facebook' && inst.settings
            && String(inst.settings.pageId) === String(page.pageId);
        });
        if (existing) {
          add(existing);
          return;
        }
        add({
          _id: page.instanceId ? String(page.instanceId) : ('fb-page:' + page.pageId),
          connectorId: 'facebook',
          name: page.pageName || ('Page ' + page.pageId),
          enabled: true,
          settings: { pageId: page.pageId, pageName: page.pageName || '' }
        });
      });
    }
    if (!want || want === 'mail') {
      listMailAccountsFromConfig().forEach(function(acc) {
        var existing = (state.connectorInstances || []).find(function(inst) {
          if (!inst || inst.connectorId !== 'mail-in' || !inst.settings) return false;
          return String(inst.settings.accountRef || '') === String(acc.id)
            || String(inst.settings.mailAccountKey || '') === ('mail-in:' + acc.id);
        });
        if (existing) {
          add(Object.assign({}, existing, { enabled: true, name: existing.name || acc.label }));
          return;
        }
        add({
          _id: 'mail-account:' + acc.id,
          connectorId: 'mail-in',
          name: acc.email ? (acc.label + ' <' + acc.email + '>') : acc.label,
          enabled: true,
          settings: { accountRef: acc.id, mailbox: acc.mailbox }
        });
      });
    }
    return Object.keys(byId).map(function(k) { return byId[k]; });
  }

  function listOutputAccounts(provider) {
    var want = String(provider || '').toLowerCase();
    if (want === 'webhook') want = 'http';
    var byId = {};
    function add(inst) {
      if (!inst) return;
      var cid = String(inst.connectorId || '');
      var p = providerFromConnectorId(cid);
      if (p !== 'mail' && p !== 'facebook' && p !== 'http') return;
      if (p === 'mail' && cid !== 'mail-out' && cid !== 'mail') return;
      if (want && p !== want) return;
      if (inst.enabled === false) return;
      var id = instanceIdOf(inst);
      if (!id) return;
      byId[id] = inst;
    }
    (state.connectorInstances || []).forEach(add);
    if (!want || want === 'facebook') {
      (state.facebookPages || []).forEach(function(page) {
        if (!page || !page.pageId || page.enabled === false) return;
        var existing = (state.connectorInstances || []).find(function(inst) {
          if (!inst || !inst.settings) return false;
          if (inst.connectorId !== 'facebook' && inst.connectorId !== 'facebook-out') return false;
          return String(inst.settings.pageId) === String(page.pageId);
        });
        if (existing) {
          add(existing);
          return;
        }
        add({
          _id: page.instanceId ? String(page.instanceId) : ('fb-page:' + page.pageId),
          connectorId: 'facebook-out',
          name: page.pageName || ('Page ' + page.pageId),
          enabled: true,
          settings: { pageId: page.pageId, pageName: page.pageName || '' }
        });
      });
    }
    if (!want || want === 'mail') {
      listMailAccountsFromConfig().forEach(function(acc) {
        var existing = (state.connectorInstances || []).find(function(inst) {
          if (!inst || inst.connectorId !== 'mail-out' || !inst.settings) return false;
          return String(inst.settings.accountRef || '') === String(acc.id)
            || String(inst.settings.mailAccountKey || '') === ('mail-out:' + acc.id);
        });
        if (existing) {
          add(Object.assign({}, existing, { enabled: true, name: existing.name || acc.label }));
          return;
        }
        add({
          _id: 'mail-out-account:' + acc.id,
          connectorId: 'mail-out',
          name: acc.email ? (acc.label + ' <' + acc.email + '>') : acc.label,
          enabled: true,
          settings: { accountRef: acc.id, mailbox: acc.mailbox }
        });
      });
    }
    return Object.keys(byId).map(function(k) { return byId[k]; });
  }

  function isLocalDataProvider(provider) {
    var p = String(provider || '').toLowerCase();
    return p === 'json' || p === 'database' || p === 'flow' || p === 'flux';
  }

  function listCreatedDataProviders() {
    var seen = {};
    listDataAccounts('').forEach(function(inst) {
      var p = providerFromConnectorId(inst.connectorId);
      if (p) seen[p] = true;
    });
    var connectors = ['mail', 'facebook', 'http'].filter(function(p) { return seen[p]; });
    return ['json', 'flow'].concat(connectors);
  }

  function dataProviderLabel(provider) {
    var contract = getConnectorContract(provider);
    if (contract && contract.label) return contract.label;
    if (provider === 'mail') return 'Mail';
    if (provider === 'facebook') return 'Facebook';
    if (provider === 'http') return 'HTTP';
    if (provider === 'json') return 'Collection / liste';
    if (provider === 'database') return 'Base (agent)';
    if (provider === 'flow' || provider === 'flux') return 'Flux (parent)';
    return provider || 'Canal';
  }

  function outputProviderLabel(provider) {
    var p = String(provider || '').toLowerCase();
    var type = connectorTypeById(outputConnectorIdForProvider(p)) || connectorTypeById(p);
    if (type && type.name) return type.name;
    if (p === 'mail') return 'Mail sortant';
    if (p === 'facebook') return 'Facebook (sortant)';
    if (p === 'webhook' || p === 'http') return 'HTTP générique';
    if (p === 'disk') return 'Fichier (disque)';
    if (p === 'collection') return 'Collection';
    if (p === 'flow' || p === 'flux') return 'Flux nommé';
    return provider || 'Destination';
  }

  function connectorEmitsOutbound(type) {
    if (!type) return false;
    var dir = String(type.direction || '').toLowerCase();
    var caps = Array.isArray(type.capabilities) ? type.capabilities : [];
    var hasSend = caps.some(function(c) {
      var cap = String(c || '');
      return cap === 'emit.mail' || cap === 'emit.http' || cap === 'emit.reply' || cap === 'emit.publish';
    });
    if (dir === 'output') return true;
    if (dir === 'bidirectional') return hasSend;
    return false;
  }

  function outputConnectorIdForProvider(provider) {
    var p = String(provider || '').toLowerCase();
    if (p === 'mail') return 'mail-out';
    if (p === 'facebook') return connectorTypeById('facebook-out') ? 'facebook-out' : 'facebook';
    if (p === 'webhook' || p === 'http') return 'http-generic';
    return p;
  }

  function outputConnectorIdFromNode(node) {
    var cid = String((node && node.config && node.config.connectorId) || '').trim();
    if (cid) return cid;
    return outputConnectorIdForProvider((node && node.config && node.config.provider) || '');
  }

  function listOutputConnectorTypes() {
    var byId = {};
    (state.connectorTypes || []).forEach(function(t) {
      if (!t || !t.id || !connectorEmitsOutbound(t)) return;
      byId[String(t.id)] = t;
    });
    if (byId['facebook-out'] && byId['facebook']) delete byId['facebook'];
    if (byId['mail-out'] && byId['mail-in']) delete byId['mail-in'];

    var usable = {};
    listOutputAccounts('').forEach(function(inst) {
      var cid = String((inst && inst.connectorId) || '');
      if (!cid) return;
      if (byId[cid]) {
        usable[cid] = byId[cid];
        return;
      }
      var p = providerFromConnectorId(cid);
      var mapped = outputConnectorIdForProvider(p);
      if (mapped && byId[mapped]) {
        usable[mapped] = byId[mapped];
        return;
      }
      var stubId = mapped || cid;
      if (!usable[stubId]) {
        usable[stubId] = connectorTypeById(stubId) || {
          id: stubId,
          name: outputProviderLabel(p || stubId)
        };
      }
    });

    var list = Object.keys(usable).map(function(id) { return usable[id]; });
    var order = ['flow', 'collection', 'mail-out', 'facebook-out', 'facebook', 'http-generic'];
    list.sort(function(a, b) {
      var ia = order.indexOf(a.id);
      var ib = order.indexOf(b.id);
      if (ia < 0 && ib < 0) return String(a.name || a.id).localeCompare(String(b.name || b.id));
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
    if (!list.some(function(t) { return String(t.id) === 'collection'; })) {
      list.unshift({ id: 'collection', name: 'Collection' });
    }
    if (!list.some(function(t) { return String(t.id) === 'flow'; })) {
      list.unshift({ id: 'flow', name: 'Flux nommé' });
    }
    return list;
  }

  function listOutputAccountsForType(connectorId) {
    var cid = String(connectorId || '').toLowerCase();
    var p = providerFromConnectorId(cid);
    var all = listOutputAccounts(p === 'http' ? 'webhook' : p);
    if (!cid) return all;
    return all.filter(function(inst) {
      var icid = String((inst && inst.connectorId) || '').toLowerCase();
      if (icid === cid) return true;
      if ((cid === 'facebook-out' || cid === 'facebook') && (icid === 'facebook' || icid === 'facebook-out')) return true;
      return false;
    });
  }

  function listOutputProviders() {
    return listOutputConnectorTypes().map(function(t) {
      var p = providerFromConnectorId(t.id);
      return p === 'http' ? 'webhook' : p;
    }).filter(function(p, i, arr) { return p && arr.indexOf(p) === i; });
  }

  function outputNeedsAccount(providerOrConnectorId) {
    var p = String(providerOrConnectorId || '').toLowerCase();
    if (!p || p === 'disk' || p === 'collection' || p === 'flow' || p === 'flux') return false;
    return true;
  }

  function isCollectionOutput(node) {
    if (!node || node.brickId !== 'output') return false;
    var p = nodeProvider(node);
    var cid = String((node.config && node.config.connectorId) || '').toLowerCase();
    return p === 'collection' || cid === 'collection';
  }

  function isFlowOutput(node) {
    if (!node || node.brickId !== 'output') return false;
    var p = nodeProvider(node);
    var cid = String((node.config && node.config.connectorId) || '').toLowerCase();
    return p === 'flow' || p === 'flux' || cid === 'flow' || cid === 'flux';
  }

  function uniqueExportFields(node) {
    var seen = {};
    var out = [];
    (node && node.config && Array.isArray(node.config.exportFields) ? node.config.exportFields : []).forEach(function(raw) {
      var k = String(raw || '').trim();
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(k);
    });
    return out;
  }

  function mappingExportFieldSources(node) {
    var mapping = node && node.config && node.config.mapping && typeof node.config.mapping === 'object'
      ? node.config.mapping
      : {};
    var out = [];
    Object.keys(mapping).forEach(function(slot) {
      var from = String(mapping[slot] || '').trim();
      if (!from || from === '__literal__' || from.indexOf('__llm__:') === 0) return;
      out.push(from);
    });
    return out;
  }

  function ensureFlowExportFields(node) {
    if (!node || !isFlowOutput(node)) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (Array.isArray(node.config.exportFields)) return;
    var fromMap = mappingExportFieldSources(node);
    if (fromMap.length) {
      node.config.exportFields = fromMap;
      return;
    }
    node.config.exportFields = collectContextFieldsForNode(node.id).filter(function(f) {
      if (!f || f.own) return false;
      var local = String(f.localKey || f.key || '').split('.').pop();
      return local === 'html' || local === 'css' || local === 'surface' || local === 'label';
    }).map(function(f) { return f.key; });
  }

  function setFlowExportField(node, key, on) {
    ensureFlowExportFields(node);
    var want = String(key || '').trim();
    if (!want) return;
    var next = uniqueExportFields(node).filter(function(k) { return k !== want; });
    if (on) next.push(want);
    node.config.exportFields = next;
  }

  function applyOutputConnectorType(node, connectorId) {
    if (!node) return;
    if (!node.config) node.config = {};
    var cid = String(connectorId || '').trim();
    node.config.connectorId = cid;
    if (cid === 'flow' || cid === 'flux') {
      node.config.provider = 'flow';
      node.config.connectorId = 'flow';
      node.config.instanceId = '';
      node.config.pageId = '';
      node.config.pageName = '';
      node.config.accountRef = '';
      node.config.templateId = '';
      if (!String(node.config.exportName || '').trim()) node.config.exportName = 'chrome';
      if (!Array.isArray(node.config.exportFields)) node.config.exportFields = [];
      return;
    }
    if (cid === 'collection') {
      node.config.provider = 'collection';
      node.config.instanceId = '';
      node.config.pageId = '';
      node.config.pageName = '';
      node.config.accountRef = '';
      node.config.templateId = '';
      if (!node.config.writeMode) node.config.writeMode = 'insert';
      return;
    }
    var p = providerFromConnectorId(cid);
    node.config.provider = p === 'http' ? 'webhook' : (p || '');
    var stillValid = listOutputAccountsForType(cid).some(function(inst) {
      return instanceIdOf(inst) === String(node.config.instanceId || '');
    });
    if (!stillValid) {
      node.config.instanceId = '';
      node.config.pageId = '';
      node.config.pageName = '';
      node.config.accountRef = '';
    }
  }

  function accountLabel(inst) {
    if (!inst) return '';
    return inst.name
      || (inst.settings && (inst.settings.pageName || inst.settings.accountRef || inst.settings.pageId))
      || instanceIdOf(inst);
  }

  function listDataInstances(provider) {
    return listDataAccounts(provider);
  }

  function findConnectorInstance(id) {
    var want = String(id || '').trim();
    if (!want) return null;
    var fromStore = (state.connectorInstances || []).find(function(inst) {
      return instanceIdOf(inst) === want;
    });
    if (fromStore) return fromStore;
    return listDataAccounts('').find(function(inst) {
      return instanceIdOf(inst) === want;
    }) || listOutputAccounts('').find(function(inst) {
      return instanceIdOf(inst) === want;
    }) || null;
  }

  function applyOutputAccountToNode(node, instanceId) {
    if (!node) return;
    if (!node.config) node.config = {};
    var picked = findConnectorInstance(instanceId);
    node.config.instanceId = picked ? instanceIdOf(picked) : String(instanceId || '');
    if (!picked) {
      if (!instanceId) {
        node.config.accountRef = '';
        node.config.pageId = '';
        node.config.pageName = '';
      }
      return;
    }
    var p = providerFromConnectorId(picked.connectorId);
    node.config.connectorId = String(picked.connectorId || node.config.connectorId || '');
    if (p === 'http') node.config.provider = 'webhook';
    else if (p) node.config.provider = p;
    if (picked.settings && picked.settings.accountRef) {
      node.config.accountRef = String(picked.settings.accountRef);
    }
    if (p === 'facebook' || node.config.provider === 'facebook') {
      applyFacebookAccountToNode(node, { instanceId: node.config.instanceId });
    } else if (picked.settings && picked.settings.pageId) {
      node.config.pageId = String(picked.settings.pageId);
    }
    if (picked.settings && picked.settings.emitUrl && !String(node.config.emitUrl || '').trim()) {
      node.config.emitUrl = String(picked.settings.emitUrl);
    }
  }

  function getTriggerNode(fromNode) {
    if (fromNode) {
      if (isTriggerNode(fromNode)) return fromNode;
      return ancestorTrigger(fromNode.id);
    }
    var selected = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    if (selected) {
      if (isTriggerNode(selected)) return selected;
      var anc = ancestorTrigger(selected.id);
      if (anc) return anc;
    }
    return state.nodes.find(isTriggerNode) || null;
  }

  function currentTriggerMode(fromNode) {
    return triggerModeOf(getTriggerNode(fromNode));
  }

  function dataIngestMode(fromNode) {
    return currentTriggerMode(fromNode) === 'webhook' ? 'push' : 'poll';
  }

  function resolveDataProvider(node) {
    if (node && node.config && node.config.provider) return String(node.config.provider);
    var inst = findConnectorInstance(node && node.config && node.config.instanceId);
    if (inst) return providerFromConnectorId(inst.connectorId);
    var trigger = getTriggerNode(node);
    if (trigger && trigger.config && trigger.config.webhookInstanceId) {
      var tw = findConnectorInstance(trigger.config.webhookInstanceId);
      if (tw) return providerFromConnectorId(tw.connectorId);
    }
    return '';
  }

  function getConnectorContract(provider) {
    var contracts = state.dataContracts;
    if (!contracts || !contracts.connectors) return null;
    var key = String(provider || '').toLowerCase();
    if (contracts.connectors[key]) return contracts.connectors[key];
    var found = null;
    Object.keys(contracts.connectors).forEach(function(k) {
      var c = contracts.connectors[k];
      if (!found && (String(c.provider) === key || String(c.connectorId) === key)) found = c;
    });
    return found;
  }

  function kindsForDataNode(node) {
    var contract = getConnectorContract(resolveDataProvider(node));
    if (!contract) return [];
    var ingest = dataIngestMode(node);
    return (contract.kinds || []).filter(function(k) {
      return !k.ingest || k.ingest.indexOf(ingest) !== -1;
    });
  }

  function defaultKindsForNode(node) {
    return kindsForDataNode(node).map(function(k) { return k.id; });
  }

  function facebookKindLabel(id) {
    var labels = {
      posts: 'Publications',
      comments: 'Commentaires',
      messages: 'Messages privés',
      notifications: 'Notifications'
    };
    return labels[id] || id;
  }

  function facebookListenKindIds(node) {
    if (!node || !node.config) return [];
    var webhook = dataIngestMode(node) === 'push';
    var ids = webhook
      ? (Array.isArray(node.config.webhookEvents) ? node.config.webhookEvents : [])
      : (Array.isArray(node.config.resources) ? node.config.resources : []);
    var available = kindsForDataNode(node).map(function(k) { return k.id; });
    ids = ids.filter(function(id) { return !available.length || available.indexOf(id) !== -1; });
    if (!ids.length && Array.isArray(node.config.kinds)) {
      ids = node.config.kinds.filter(function(id) { return !available.length || available.indexOf(id) !== -1; });
    }
    return ids;
  }

  function syncFacebookKindsFromListen(node) {
    if (!node || !isFacebookListenNode(node)) return;
    if (!node.config) node.config = {};
    node.config.kinds = facebookListenKindIds(node).slice();
  }

  function ensureDataKinds(node) {
    if (!node || node.brickId !== 'data') return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    var available = kindsForDataNode(node).map(function(k) { return k.id; });
    var ingestPush = dataIngestMode(node) === 'push';
    if (isFacebookListenNode(node)) {
      var listen = ingestPush ? node.config.webhookEvents : node.config.resources;
      if (Array.isArray(listen) && listen.length) {
        node.config.kinds = listen.filter(function(id) { return available.indexOf(id) !== -1; });
        return;
      }
      var currentFb = Array.isArray(node.config.kinds) ? node.config.kinds.filter(Boolean) : [];
      currentFb = currentFb.filter(function(id) { return available.indexOf(id) !== -1; });
      if (!currentFb.length && available.length) currentFb = defaultKindsForNode(node);
      node.config.kinds = currentFb;
      if (ingestPush) {
        node.config.webhookEvents = currentFb.slice();
        node.config.ingestModes = ['push'];
      } else {
        node.config.resources = currentFb.slice();
        node.config.ingestModes = ['poll'];
      }
      return;
    }
    var current = Array.isArray(node.config.kinds) ? node.config.kinds.filter(Boolean) : [];
    current = current.filter(function(id) { return available.indexOf(id) !== -1; });
    if (!current.length && available.length) current = defaultKindsForNode(node);
    node.config.kinds = current;
    if (ingestPush) {
      node.config.webhookEvents = current.slice();
      node.config.ingestModes = ['push'];
    } else {
      node.config.resources = current.slice();
      node.config.ingestModes = ['poll'];
    }
  }

  function envelopeFieldMatchesProvider(field, provider) {
    var allowed = field && Array.isArray(field.connectors) ? field.connectors : [];
    if (!allowed.length) return true;
    var key = String(provider || '').toLowerCase();
    if (!key) return false;
    var contract = getConnectorContract(key);
    var aliases = [key];
    if (contract) {
      aliases.push(String(contract.provider || '').toLowerCase());
      aliases.push(String(contract.connectorId || '').toLowerCase());
    }
    return allowed.some(function(item) { return aliases.indexOf(String(item).toLowerCase()) !== -1; });
  }

  function selectedKindsForNode(node) {
    var available = kindsForDataNode(node);
    var selected = ((node && node.config && node.config.kinds) || []).filter(Boolean);
    if (!selected.length) return available;
    return available.filter(function(kind) { return selected.indexOf(kind.id) !== -1; });
  }

  function exampleValueAt(obj, key) {
    if (!obj || !key) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    var cur = obj;
    String(key).split('.').forEach(function(part) {
      if (cur == null) return;
      cur = cur[part];
    });
    return cur;
  }

  function fieldsForKind(node, kind) {
    var contracts = state.dataContracts;
    var provider = resolveDataProvider(node);
    var sample = (kind && kind.example && typeof kind.example === 'object') ? kind.example : {};
    var exclusive = Boolean(kind && kind.schemaExclusive);
    var out = [];
    var seen = {};
    function pushField(f) {
      if (!f || !f.key || seen[f.key]) return;
      seen[f.key] = true;
      var ex = exampleValueAt(sample, f.key);
      if (ex === undefined) ex = f.example;
      out.push({
        key: f.key,
        label: f.label || humanizeFieldKey(f.key),
        type: f.type || 'string',
        graph: f.graph == null ? null : f.graph,
        enum: Array.isArray(f.enum) ? f.enum : null,
        example: ex,
        description: f.description || '',
        hint: describeContextField(f.key, { label: f.label, description: f.description, example: ex })
      });
    }
    if (!exclusive && contracts && contracts.envelope && contracts.envelope.fields) {
      contracts.envelope.fields.forEach(function(f) {
        if (!f || f.key === 'item' || f.key === 'items' || f.key === 'itemsCount' || f.key === 'itemIndex') return;
        if (envelopeFieldMatchesProvider(f, provider)) pushField(f);
      });
    }
    (kind && kind.fields ? kind.fields : []).forEach(pushField);
    return out;
  }

  function isCollectionListDataNode(node) {
    if (!node || node.brickId !== 'data') return false;
    var cfg = node.config || {};
    var p = String(cfg.provider || '').toLowerCase();
    if (p !== 'json' && p !== 'database') return false;
    if (isHookCollectionNode(node)) return true;
    if (String(cfg.presetId || '').trim()) return true;
    if (String(cfg.collectionNamespace || '').trim()) return true;
    if (String(cfg.collectionId || '').trim()) return true;
    return Array.isArray(cfg.modelFields) && cfg.modelFields.length > 0;
  }

  function collectionListFields(node) {
    var fields = [];
    var seen = {};
    ((node && node.config && node.config.modelFields) || []).forEach(function(f) {
      var key = f && (f.key || f.name);
      if (!key || seen[key]) return;
      seen[key] = true;
      fields.push({
        key: key,
        label: f.label || key,
        type: f.type || 'text',
        required: !!f.required,
        enum: Array.isArray(f.enum) && f.enum.length ? f.enum : null
      });
    });
    if (!fields.length && (isHookCollectionNode(node) || String((node && node.config && node.config.presetId) || '') === 'hook')) {
      [
        { key: 'surface', label: 'Surface' },
        { key: 'label', label: 'Libellé' },
        { key: 'description', label: 'Description' }
      ].forEach(function(f) {
        fields.push({ key: f.key, label: f.label, type: 'text' });
      });
    }
    return fields;
  }

  function contractFieldsForDataNode(node) {
    var out = [];
    var seen = {};
    function pushAlias(key, label, type) {
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        key: key,
        label: label,
        type: type,
        hint: describeContextField(key)
      });
    }
    pushAlias('item', 'Item (ligne courante)', 'object');
    pushAlias('items', 'Tableau (toutes les lignes)', 'array');
    pushAlias('itemsCount', 'Nombre de lignes', 'number');
    if (isCollectionListDataNode(node)) {
      collectionListFields(node).forEach(function(f) {
        if (!f || !f.key || seen[f.key]) return;
        seen[f.key] = true;
        out.push(f);
      });
      return out;
    }
    selectedKindsForNode(node).forEach(function(kind) {
      fieldsForKind(node, kind).forEach(function(f) {
        if (!f || !f.key || seen[f.key]) return;
        if (f.key === 'item' || f.key === 'items' || f.key === 'itemsCount') {
          return;
        }
        seen[f.key] = true;
        out.push(f);
      });
    });
    if (String((node.config && node.config.provider) || '') === 'json'
        || String((node.config && node.config.provider) || '') === 'database') {
      collectionListFields(node).forEach(function(f) {
        if (!f || !f.key || seen[f.key]) return;
        seen[f.key] = true;
        out.push(f);
      });
    }
    return out;
  }

  var ACTION_ALIASES = {
    'analyse-intention': 'ia.compose',
    'analyse.run': 'ia.compose',
    'ia.intention': 'ia.compose',
    'ia.generate': 'ia.compose',
    'mail-delete': 'mail.delete',
    'mail-save-attachments': 'mail.save-attachments',
    'mark-seen': 'mail.mark-seen',
    'mark-unseen': 'mail.mark-unseen'
  };

  function normalizeClientActionId(raw) {
    var id = String(raw || '').trim();
    if (!id) return '';
    return ACTION_ALIASES[id] || id;
  }

  function listIaActions() {
    var contracts = state.actionContracts;
    return (contracts && Array.isArray(contracts.ia)) ? contracts.ia : [];
  }

  function listFunctionActions(provider) {
    var contracts = state.actionContracts;
    if (!contracts || !contracts.connectors) return [];
    var key = String(provider || '').toLowerCase();
    var group = contracts.connectors[key] || null;
    if (!group) {
      Object.keys(contracts.connectors).forEach(function(k) {
        var c = contracts.connectors[k];
        if (!group && (String(c.provider) === key || String(c.connectorId) === key)) group = c;
      });
    }
    return (group && Array.isArray(group.actions)) ? group.actions : [];
  }

  function getActionDef(actionId) {
    var id = normalizeClientActionId(actionId);
    if (!id) return null;
    var ia = listIaActions().find(function(a) { return a.id === id; });
    if (ia) return ia;
    var contracts = state.actionContracts;
    if (!contracts) return null;
    var surfaces = Array.isArray(contracts.surfaces) ? contracts.surfaces : [];
    var surf = surfaces.find(function(a) { return a.id === id; });
    if (surf) return surf;
    if (!contracts.connectors) return null;
    var found = null;
    Object.keys(contracts.connectors).forEach(function(k) {
      (contracts.connectors[k].actions || []).forEach(function(a) {
        if (!found && a.id === id) found = a;
      });
    });
    return found;
  }

  function listSurfaceActions() {
    var contracts = state.actionContracts;
    var list = (contracts && Array.isArray(contracts.surfaces)) ? contracts.surfaces.slice() : [];
    if (!list.some(function(a) { return a && a.id === 'surface.hook'; })) {
      list.unshift({
        id: 'surface.hook',
        label: 'Accrocher la page',
        description: 'Accroche la page du flux (HTML + CSS) sur une surface.'
      });
    }
    return list;
  }

  function isInsertableAction(node) {
    if (!node || node.brickId !== 'action') return false;
    var cfg = node.config || {};
    return !!(cfg.insertable || cfg.subFlowId || cfg.subTemplateId);
  }

  function insertablePaletteLook(node) {
    if (!isInsertableAction(node)) return null;
    var pid = String((node.config && node.config.paletteId) || '').trim();
    var tid = String((node.config && node.config.subTemplateId) || '').trim();
    var fid = String((node.config && node.config.subFlowId) || '').trim();
    var cfgHook = String((node.config && node.config.hookSurface) || '').trim();
    var isHook = tid === 'agent-hook' || String(node.name || '').toLowerCase() === 'hook';
    var row = (state.paletteCatalog || []).filter(function(r) {
      if (!r) return false;
      if (pid && String(r.id || '') === pid) return true;
      if (fid && String(r.flowId || '') === fid) return true;
      if (tid && String(r.templateId || '') === tid) return true;
      return false;
    })[0];
    if (row) {
      return {
        iconEmoji: String(row.iconEmoji || '').trim() || '📦',
        logoUrl: String(row.logoUrl || '').trim(),
        hookSurface: cfgHook || (isHook ? '' : (String(row.hookSurface || 'palette').trim() || 'palette'))
      };
    }
    if (isHook) {
      return { iconEmoji: '🪝', logoUrl: '', hookSurface: cfgHook };
    }
    return { iconEmoji: '📦', logoUrl: '', hookSurface: cfgHook || 'palette' };
  }

  function isInsertableHookNode(node) {
    if (!isInsertableAction(node)) return false;
    var tid = String((node.config && node.config.subTemplateId) || '').toLowerCase();
    var name = String(node.name || '').toLowerCase();
    var pid = String((node.config && node.config.paletteId) || '').toLowerCase();
    return tid === 'agent-hook' || name === 'hook' || pid === 'hook';
  }

  function isHookAction(node) {
    if (!node || node.brickId !== 'action') return false;
    var id = normalizeClientActionId((node.config && (node.config.actionId || node.config.operation)) || '');
    return id === 'surface.hook';
  }

  function isHookCollectionNode(node) {
    if (!node || node.brickId !== 'data') return false;
    var cfg = node.config || {};
    var ns = String(cfg.collectionNamespace || cfg.presetId || cfg.collectionPreset || '').toLowerCase();
    var name = String(cfg.modelName || node.name || '').toLowerCase();
    return ns === 'atelier-hook' || ns === 'hook' || name === 'hook' || name === 'liste hooks';
  }

  function isHookComposeAction(node) {
    if (!isComposeAction(node)) return false;
    var preset = String((node.config && node.config.preset) || '').toLowerCase();
    if (preset === 'hook') return true;
    var slug = String(node.slug || '').toLowerCase();
    if (slug === 'hook' || slug.indexOf('hook') >= 0) return true;
    var keys = ((node.config && node.config.variables) || []).map(function(v) { return v && v.key; });
    var hasSurface = keys.indexOf('surface') >= 0;
    var designColor = keys.indexOf('primary') >= 0 || keys.indexOf('brand') >= 0;
    return hasSurface && !designColor;
  }

  function hookInputContractFields() {
    var def = getActionDef('surface.hook');
    var reads = def && Array.isArray(def.reads) ? def.reads : [];
    if (reads.length) {
      return reads.filter(function(f) { return f && f.key; }).map(function(f) {
        return {
          key: f.key,
          label: f.label || humanizeFieldKey(f.key),
          required: !!f.required,
          advanced: !!f.advanced,
          type: f.type || (f.key === 'html' || f.key === 'css' ? 'textarea' : 'text'),
          overlay: f.overlay !== false
        };
      });
    }
    return [
      { key: 'surface', label: 'Surface', required: true, advanced: false, type: 'text', overlay: true },
      { key: 'label', label: 'Libellé', required: false, advanced: false, type: 'text', overlay: true },
      { key: 'html', label: 'HTML', required: false, advanced: false, type: 'textarea', overlay: true },
      { key: 'css', label: 'CSS', required: false, advanced: false, type: 'textarea', overlay: true }
    ];
  }

  function hookConfiguredSurface(node) {
    var cfg = (node && node.config) || {};
    var mapped = String((cfg.mapping && cfg.mapping.surface) || '').trim();
    if (mapped === '__literal__') {
      return String((cfg.literals && cfg.literals.surface) || cfg.surface || '').trim();
    }
    if (mapped) return '';
    return String(cfg.surface || '').trim();
  }

  function ensureHookMappingDefaults(node) {
    if (!isHookAction(node)) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    ensureMappingConfig(node);
    var mapped = String((node.config.mapping && node.config.mapping.surface) || '').trim();
    var literal = String((node.config.literals && node.config.literals.surface) || '').trim();
    var legacy = String(node.config.surface || '').trim();
    if (!mapped && !literal) {
      node.config.mapping.surface = '__literal__';
      node.config.literals.surface = legacy || 'tab';
    } else if (mapped === '__literal__' && !literal && legacy) {
      node.config.literals.surface = legacy;
    }
    if (!String(node.config.surface || '').trim()) {
      node.config.surface = hookConfiguredSurface(node) || 'tab';
    }
    suggestDefaultMapping(node);
  }

  function actionKindSelectHtml(node) {
    var currentId = normalizeClientActionId((node.config && (node.config.actionId || node.config.operation)) || '') || 'ia.compose';
    if (!currentId) currentId = 'ia.compose';
    var provider = resolveUpstreamActionProvider(node.id);
    var fnActions = listFunctionActions(provider);
    var surfaces = listSurfaceActions();
    var html = '<div class="form-group"><label>Action</label>';
    html += '<select data-key="actionId">';
    html += '<optgroup label="Champs">';
    html += '<option value="ia.compose"' + (currentId === 'ia.compose' ? ' selected' : '') + '>Champs</option>';
    html += '</optgroup>';
    if (currentId && currentId.indexOf('surface.') === 0) {
      html += '<optgroup label="Accrocher">';
      surfaces.forEach(function(a) {
        html += '<option value="' + escapeHtml(a.id) + '"' + (currentId === a.id ? ' selected' : '') + '>'
          + escapeHtml(a.label || a.id) + '</option>';
      });
      html += '</optgroup>';
    }
    if (fnActions.length) {
      var groupLabel = provider === 'mail' ? 'Mail' : (provider === 'facebook' ? 'Facebook' : 'Connecteur');
      html += '<optgroup label="' + escapeHtml(groupLabel) + '">';
      fnActions.forEach(function(a) {
        html += '<option value="' + escapeHtml(a.id) + '"' + (currentId === a.id ? ' selected' : '') + '>'
          + escapeHtml(a.label || a.id) + '</option>';
      });
      html += '</optgroup>';
    }
    if (currentId && currentId !== 'ia.compose'
        && !surfaces.some(function(a) { return a.id === currentId; })
        && !fnActions.some(function(a) { return a.id === currentId; })) {
      html += '<option value="' + escapeHtml(currentId) + '" selected>'
        + escapeHtml(actionNodeSummary(node.config)) + ' — hors liste</option>';
    }
    html += '</select></div>';
    return html;
  }

  function actionFieldsHtml(node) {
    ensureActionConfig(node);
    if (isInsertableAction(node)) {
      return insertableActionFieldsHtml(node);
    }
    var html = actionKindSelectHtml(node);
    var currentId = normalizeClientActionId((node.config && (node.config.actionId || node.config.operation)) || '') || 'ia.compose';

    if (currentId === 'surface.hook') {
      ensureHookMappingDefaults(node);
      var hookDef = getActionDef('surface.hook');
      if (hookDef && hookDef.description) {
        html += '<p class="empty">' + escapeHtml(hookDef.description) + '</p>';
      }
      html += mappingPanelHtml(node);
      return html;
    }

    if (isFunctionAction(node)) {
      var def = getActionDef(currentId);
      if (def && def.description) {
        html += '<p class="empty">' + escapeHtml(def.description) + '</p>';
      }
      if (currentId === 'mail.move') {
        html += '<div class="form-group"><label>Dossier IMAP destination</label>';
        html += '<input type="text" data-key="folder" value="' + escapeHtml(node.config.folder || '') + '" placeholder="Archive"></div>';
      }
      if (currentId === 'mail.save-attachments') {
        html += '<div class="form-group"><label>Sous-dossier PJ</label>';
        html += '<input type="text" data-key="subfolder" value="' + escapeHtml(node.config.subfolder || 'factures') + '"></div>';
      }
      if (currentId === 'mail.delete') {
        var only = node.config.onlyOnApprove !== false;
        html += '<div class="form-group"><label class="agent-check">';
        html += '<input type="checkbox" data-key="onlyOnApprove" data-type="boolean"' + (only ? ' checked' : '') + '>';
        html += '<span>Supprimer seulement si validé</span></label></div>';
      }
      if (currentId === 'mail.pick') {
        var picked = Array.isArray(node.config.pickFields) && node.config.pickFields.length
          ? node.config.pickFields
          : ['subject', 'text'];
        html += '<div class="form-group"><label>Champs à récupérer</label>';
        ['subject', 'text', 'from'].forEach(function(key) {
          html += '<label class="agent-check" style="margin:6px 0;">';
          html += '<input type="checkbox" data-pick-field="' + key + '"' + (picked.indexOf(key) !== -1 ? ' checked' : '') + '>';
          html += '<span>' + escapeHtml(humanizeFieldKey(key)) + '</span></label>';
        });
        html += '</div>';
      }
      return html;
    }

    node.config.actionId = 'ia.compose';
    node.config.operation = 'ia.compose';
    ensureComposeZones(node);
    pruneOutputMaps(node);
    var vars = node.config.variables || [];
    var mappedIds = node.config.mappedOutputIds || [];
    html += '<h4 class="agent-config-section">Sorties mappées</h4>';
    if (!mappedIds.length) {
      html += '<p class="empty" style="margin:0 0 10px;">Aucun onglet sortie. Cliquez « Mapper une sortie » pour préparer le contenu d’un bloc Sortie branché derrière.</p>';
    } else {
      html += '<div class="agent-zone-list">';
      mappedIds.forEach(function(oid) {
        var target = state.nodes.find(function(n) { return n.id === oid; });
        var map = getOutputMap(node, oid);
        var mode = outputMapUsesObject(map) ? 'Objet repris' : outputMapNewLabel(target);
        html += '<button type="button" class="agent-zone-preview" data-open-output-map="'
          + escapeHtml(oid) + '">'
          + '<span class="agent-zone-preview-name">' + escapeHtml(outputMapTabLabel(target)) + '</span>'
          + '<span class="agent-zone-preview-value">' + escapeHtml(mode) + '</span>'
          + '</button>';
      });
      html += '</div>';
    }
    html += '<h4 class="agent-config-section">Champs libres</h4>';
    if (node.config.fieldsFrom) {
      html += '<p class="empty" style="margin:0 0 10px;">Tableau <code>'
        + escapeHtml(node.config.fieldsFrom)
        + '</code> (nom / type) → champs de cette action.</p>';
    }
    if (!vars.length) {
      html += '<p class="empty" style="margin:0 0 10px;">Hors sorties : aucun champ libre.</p>';
    } else {
      html += '<div class="agent-zone-list">';
      vars.forEach(function(v) {
        var preview = zoneValuePreview(zoneValue(node, v.key));
        var inherited = !preview && copyFromInherits(node, v.key);
        var missing = !!v.required && !preview && !inherited;
        html += '<button type="button" class="agent-zone-preview' + (missing ? ' is-warn' : '') + '" data-open-zone="'
          + escapeHtml(v.key) + '">'
          + '<span class="agent-zone-preview-name">' + escapeHtml(v.label || v.key);
        if (v.required) html += ' <span class="agent-zone-preview-req">*</span>';
        if (isExpertView()) {
          html += ' <code>{{' + escapeHtml(ensureNodeSlug(node) + '.' + v.key) + '}}</code>';
        }
        html += '</span>'
          + '<span class="agent-zone-preview-value' + (preview || inherited ? '' : ' is-empty') + '">'
          + (preview ? escapeHtml(preview) : (inherited ? 'Repris de l’objet' : (v.required ? 'Obligatoire — vide' : 'Vide'))) + '</span>'
          + '</button>';
      });
      html += '</div>';
    }
    html += '<button type="button" class="btn-agent" id="btnOpenActionCompose" data-open-action-compose="1">Éditer</button>';
    html += '<button type="button" class="btn-agent" data-map-an-output="1" style="margin-left:8px;">Mapper une sortie</button>';
    if (isHookComposeAction(node)) {
      html += hookVisualizationHtml(node);
    }
    return html;
  }

  function ensureHookVizFields(node) {
    if (!node || !node.config) return;
    var vars = Array.isArray(node.config.variables) ? node.config.variables.slice() : [];
    var have = {};
    vars.forEach(function(v) { if (v && v.key) have[v.key] = true; });
    [
      { key: 'name', label: 'Nom du bouton', type: 'text', placeholder: '{{liste_hooks.label}}' },
      { key: 'iconEmoji', label: 'Icône', type: 'text', placeholder: '🪝' },
      { key: 'logoUrl', label: 'Logo (URL)', type: 'text', placeholder: 'https://…' },
      { key: 'color', label: 'Couleur', type: 'text', placeholder: '#7c3aed' }
    ].forEach(function(v) {
      if (!have[v.key]) vars.push(v);
    });
    node.config.variables = vars;
    if (node.config.visualizationId == null) {
      node.config.visualizationId = 'palette-button';
    }
  }

  function hookPaletteButtonPreviewHtml(node) {
    var name = String(zoneValue(node, 'name') || zoneValue(node, 'label') || 'Hook').trim();
    if (name.indexOf('{{') >= 0) name = 'Hook';
    var emoji = String(zoneValue(node, 'iconEmoji') || '🪝').trim();
    if (emoji.indexOf('{{') >= 0) emoji = '🪝';
    var logo = String(zoneValue(node, 'logoUrl') || '').trim();
    var color = String(zoneValue(node, 'color') || '#7c3aed').trim() || '#7c3aed';
    var icon = (logo && logo.indexOf('{{') < 0)
      ? '<img src="' + escapeHtml(logo) + '" alt="" style="width:22px;height:22px;border-radius:6px;object-fit:cover;">'
      : '<span style="font-size:1.15rem;line-height:1;">' + escapeHtml(emoji) + '</span>';
    return '<div style="margin-top:8px;padding:8px;background:#020617;border-radius:8px;">'
      + '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#0f172a;border:1px dashed #334155;border-radius:10px;max-width:240px;color:#e2e8f0;">'
      + '<span style="width:8px;height:8px;border-radius:99px;flex-shrink:0;background:' + escapeHtml(color) + ';"></span>'
      + icon
      + '<span style="display:flex;flex-direction:column;gap:2px;min-width:0;"><strong style="font-size:.8rem;">'
      + escapeHtml(name) + '</strong>'
      + '<span style="font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;color:#c4b5fd;">ss-action</span></span>'
      + '</div></div>';
  }

  function hookVisualizationHtml(node) {
    ensureHookVizFields(node);
    if (!Array.isArray(state.productionTemplatesByUsage.hook)) {
      loadProductionTemplates('hook').then(function() { renderConfig(); });
    }
    var list = state.productionTemplatesByUsage.hook || [];
    var current = String((node.config && node.config.visualizationId) || '').trim();
    var html = '<div class="agent-hook-viz" style="margin-top:14px;padding:10px;border:1px dashed #334155;border-radius:8px;background:#0f172a;">';
    html += '<h4 style="margin:0 0 6px;color:#e2e8f0;">Visualisation</h4>';
    html += '<p class="empty" style="margin:0 0 8px;">Gabarit de ce que le hook accroche. <strong style="color:#cbd5e1;">Bouton palette</strong> = logo, nom, couleur. <strong style="color:#cbd5e1;">Page web</strong> = chrome tab / modal / app.</p>';
    html += '<div class="form-group"><label>Template</label>';
    html += '<select data-key="visualizationId">';
    html += '<option value="">— Aucun —</option>';
    list.forEach(function(t) {
      html += '<option value="' + escapeHtml(t.id) + '"' + (current === t.id ? ' selected' : '') + '>'
        + escapeHtml(t.title || t.id) + '</option>';
    });
    html += '</select></div>';
    if (current === 'palette-button') {
      html += hookPaletteButtonPreviewHtml(node);
    } else if (current) {
      var picked = list.filter(function(t) { return t.id === current; })[0];
      html += '<p class="empty" style="margin:8px 0 0;">'
        + escapeHtml((picked && picked.description) || current) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function contractFieldsForActionNode(node) {
    ensureActionConfig(node);
    if (isComposeAction(node)) {
      return ((node.config && node.config.variables) || []).map(function(v) {
        return {
          key: v.key,
          label: v.label || humanizeFieldKey(v.key),
          type: v.type || 'textarea',
          hint: v.description || describeContextField(v.key, v)
        };
      }).filter(function(f) { return f.key; });
    }
    var def = getActionDef(node && node.config && node.config.actionId);
    if (!def || !Array.isArray(def.writes)) return [];
    return def.writes.map(function(f) {
      if (typeof f === 'string') {
        return { key: f, label: humanizeFieldKey(f), hint: describeContextField(f) };
      }
      return {
        key: f.key,
        label: f.label || humanizeFieldKey(f.key),
        type: f.type || '',
        hint: describeContextField(f.key, f)
      };
    }).filter(function(f) { return f.key; });
  }

  function resolveUpstreamActionProvider(nodeId) {
    var upstream = getUpstreamNodes(nodeId);
    var data = upstream.find(function(n) { return n.brickId === 'data'; });
    if (data) return resolveDataProvider(data);
    var trigger = ancestorTrigger(nodeId) || getTriggerNode();
    if (trigger && trigger.config && trigger.config.webhookInstanceId) {
      var tw = findConnectorInstance(trigger.config.webhookInstanceId);
      if (tw) return providerFromConnectorId(tw.connectorId);
    }
    return '';
  }

  function isFunctionAction(node) {
    if (!node || node.brickId !== 'action') return false;
    var id = normalizeClientActionId((node.config && (node.config.actionId || node.config.operation)) || '');
    if (!id || id.indexOf('ia.') === 0) return false;
    if (node.config && node.config.kind === 'function') return true;
    return id.indexOf('mail.') === 0 || id.indexOf('facebook.') === 0
      || id.indexOf('surface.') === 0
      || id === 'route-intention' || id === 'http' || id === 'backup';
  }

  function isComposeAction(node) {
    if (!node || node.brickId !== 'action') return false;
    if (isInsertableAction(node)) return false;
    return !isFunctionAction(node);
  }

  function nodeCopyFrom(node) {
    return String((node && node.config && node.config.copyFrom) || '').trim();
  }

  function copyFromInherits(node, key) {
    return !!nodeCopyFrom(node);
  }

  function copySourceSlug(path) {
    return String(path || '').trim().replace(/\.item$/, '');
  }

  function copySourceFieldPath(node, path, key) {
    var p = String(path || '').trim();
    var k = String(key || '').trim();
    if (!p || !k) return '';
    var fields = node
      ? collectContextFieldsForNode(node.id).filter(function(f) { return f && !f.own; })
      : [];
    var aliases = { body: ['body', 'text', 'html'], text: ['text', 'body'], to: ['to', 'destinataire'] };
    var tries = aliases[k] || [k];
    function findKey(want) {
      var nested = p + '.' + want;
      if (fields.some(function(f) { return f.key === nested; })) return nested;
      var flat = copySourceSlug(p) + '.' + want;
      if (flat !== nested && fields.some(function(f) { return f.key === flat; })) return flat;
      var byLocal = fields.filter(function(f) { return f.localKey === want; })[0];
      return (byLocal && byLocal.key) || '';
    }
    for (var i = 0; i < tries.length; i++) {
      var hit = findKey(tries[i]);
      if (hit) return hit;
    }
    return p + '.' + k;
  }

  function copyFieldToken(path, key, node) {
    var ref = copySourceFieldPath(node, path, key);
    return ref ? ('{{' + ref + '}}') : '';
  }

  function looksLikeCopyPath(value, path) {
    var m = String(value || '').trim();
    var p = String(path || '').trim();
    if (!m || !p) return false;
    if (m === p || m.indexOf(p + '.') === 0) return true;
    var slug = copySourceSlug(p);
    return !!slug && slug !== p && (m === slug || m.indexOf(slug + '.') === 0);
  }

  function looksLikeCopyToken(value, path) {
    var t = String(value || '').trim();
    if (!t || !/^\{\{\s*[a-zA-Z0-9_.]+\s*\}\}$/.test(t)) return false;
    if (!path) return true;
    return looksLikeCopyPath(t.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim(), path);
  }

  function copySourceDataNode(path) {
    var slug = String(path || '').split('.')[0];
    if (!slug) return null;
    return state.nodes.filter(function(n) {
      return n && n.brickId === 'data' && ensureNodeSlug(n) === slug;
    })[0] || null;
  }

  function copySourceFieldDefs(path) {
    var src = copySourceDataNode(path);
    if (!src) return [];
    return contractFieldsForDataNode(src).filter(function(f) {
      return f && f.key && f.key !== 'item' && f.key !== 'items' && f.key !== 'itemsCount' && f.key !== 'itemIndex';
    });
  }

  function composeTypeForCopiedField(f) {
    var t = String((f && f.type) || '').toLowerCase();
    if (t === 'file' || t === 'array') return t === 'file' ? 'file' : 'array';
    if (t === 'number' || t === 'integer') return 'number';
    return 'textarea';
  }

  function ensureCopiedComposeFields(node, path) {
    if (!isComposeAction(node)) return;
    ensureComposeZones(node);
    var have = {};
    (node.config.variables || []).forEach(function(v) { if (v && v.key) have[v.key] = true; });
    copySourceFieldDefs(path).forEach(function(f) {
      if (!f || !f.key || have[f.key]) return;
      node.config.variables.push({
        key: f.key,
        label: f.label || humanizeFieldKey(f.key),
        type: composeTypeForCopiedField(f),
        required: false,
        description: '',
        placeholder: ''
      });
      have[f.key] = true;
    });
  }

  function prefillCopyFromFields(node, path, prevPath) {
    if (!node || !path) return;
    if (isComposeAction(node)) {
      ensureCopiedComposeFields(node, path);
      (node.config.variables || []).forEach(function(v) {
        if (!v || !v.key) return;
        var cur = zoneValue(node, v.key);
        var overwrite = !String(cur || '').trim()
          || looksLikeCopyToken(cur, prevPath)
          || looksLikeCopyToken(cur, path)
          || !prevPath;
        if (overwrite) setZoneValue(node, v.key, copyFieldToken(path, v.key, node));
      });
      wireDownstreamFromAction(node);
    }
    if (node.brickId === 'output') {
      ensureMappingConfig(node);
      mappingSlotsForNode(node).forEach(function(slot) {
        if (!slot || !slot.key) return;
        var mapped = String((node.config.mapping && node.config.mapping[slot.key]) || '').trim();
        var literal = String((node.config.literals && node.config.literals[slot.key]) || '').trim();
        if (mapped === '__literal__' && literal) return;
        var overwrite = !mapped
          || looksLikeCopyPath(mapped, prevPath)
          || looksLikeCopyToken(mapped, prevPath)
          || !prevPath;
        if (!overwrite) return;
        node.config.mapping[slot.key] = copySourceFieldPath(node, path, slot.key);
        if (node.config.literals) delete node.config.literals[slot.key];
      });
    }
  }

  function copyFromOptions(node) {
    var out = [];
    var seen = {};
    function push(key, label) {
      var k = String(key || '').trim();
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push({ key: k, label: label || k });
    }
    getUpstreamNodes(node && node.id).forEach(function(n) {
      if (!n || n.brickId !== 'data') return;
      var slug = ensureNodeSlug(n);
      var name = n.name || slug || 'Entrées';
      push(slug + '.item', name + ' — ligne courante');
      push(slug, name);
    });
    collectContextFieldsForNode(node && node.id).forEach(function(f) {
      if (!f || f.own) return;
      if (f.localKey === 'item' || f.type === 'object') {
        push(f.key, (f.source ? (f.source + ' · ') : '') + contextFieldLabel(f));
      }
    });
    return out;
  }

  function copyFromSelectHtml(node) {
    var opts = copyFromOptions(node);
    if (!opts.length) return '';
    var cur = nodeCopyFrom(node);
    var html = '<div class="form-group agent-copy-from"><label>Copier un objet du flux</label>';
    html += '<select data-key="copyFrom">';
    html += '<option value="">— Ne rien recopier —</option>';
    opts.forEach(function(o) {
      html += '<option value="' + escapeHtml(o.key) + '"' + (cur === o.key ? ' selected' : '') + '>'
        + escapeHtml(o.label) + '</option>';
    });
    if (cur && !opts.some(function(o) { return o.key === cur; })) {
      html += '<option value="' + escapeHtml(cur) + '" selected>' + escapeHtml(cur) + '</option>';
    }
    html += '</select>';
    html += '<p class="empty" style="margin-top:6px;">Chaque champ de l’entrée est branché sur la sortie. Réécrivez ensuite seulement le destinataire (valeur fixe).</p></div>';
    return html;
  }

  function setCopyFrom(node, path) {
    if (!node) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    var next = String(path || '').trim();
    var prev = String(node.config.copyFrom || '').trim();
    node.config.copyFrom = next;
    if (next) delete node.config.copyFromOff;
    else node.config.copyFromOff = true;
    if (next && next !== prev) prefillCopyFromFields(node, next, prev);
  }

  function upstreamMailData(node) {
    if (!node) return null;
    return getUpstreamNodes(node.id).filter(function(n) {
      return n && n.brickId === 'data' && resolveDataProvider(n) === 'mail';
    })[0] || null;
  }

  function suggestMailCopyFrom(node) {
    if (!node || nodeCopyFrom(node) || (node.config && node.config.copyFromOff)) return;
    var mail = upstreamMailData(node);
    var data = mail || getUpstreamNodes(node.id).filter(function(n) { return n && n.brickId === 'data'; })[0];
    if (!data) return;
    setCopyFrom(node, ensureNodeSlug(data) + '.item');
  }

  function wireMailOutputFromInput(node) {
    if (!node || node.brickId !== 'output') return;
    var mail = upstreamMailData(node);
    if (!mail) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (!nodeProvider(node) && !String(node.config.connectorId || '').trim()) {
      node.config.provider = 'mail';
    }
    if (nodeProvider(node) !== 'mail') return;
    suggestMailCopyFrom(node);
    suggestDefaultMapping(node);
  }

  function ensureOutputMaps(node) {
    if (!node) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (!node.config.outputMaps || typeof node.config.outputMaps !== 'object' || Array.isArray(node.config.outputMaps)) {
      node.config.outputMaps = {};
    }
    if (!Array.isArray(node.config.mappedOutputIds)) node.config.mappedOutputIds = [];
    if (!node.config.activeComposeTab) node.config.activeComposeTab = 'fields';
  }

  function isMappableOutput(node) {
    if (!node || node.brickId !== 'output') return false;
    if (isFlowOutput(node) || isCollectionOutput(node)) return false;
    return true;
  }

  function mappableOutgoingOutputs(action) {
    return outgoingNodes(action, 'output').filter(isMappableOutput);
  }

  function pruneOutputMaps(node) {
    if (!node) return;
    ensureOutputMaps(node);
    var live = {};
    mappableOutgoingOutputs(node).forEach(function(o) { live[o.id] = true; });
    node.config.mappedOutputIds = node.config.mappedOutputIds.filter(function(id) {
      return !!live[id];
    });
    Object.keys(node.config.outputMaps).forEach(function(id) {
      if (!live[id]) delete node.config.outputMaps[id];
    });
    if (node.config.activeComposeTab && node.config.activeComposeTab !== 'fields'
        && node.config.mappedOutputIds.indexOf(node.config.activeComposeTab) < 0) {
      node.config.activeComposeTab = 'fields';
    }
  }

  function unmappedOutgoingOutputs(action) {
    pruneOutputMaps(action);
    var have = {};
    (action.config.mappedOutputIds || []).forEach(function(id) { have[id] = true; });
    return mappableOutgoingOutputs(action).filter(function(o) { return !have[o.id]; });
  }

  function outputMapKindLabel(out) {
    var p = nodeProvider(out);
    if (p === 'mail') return 'Mail';
    if (p === 'facebook') return 'Facebook';
    if (p === 'webhook' || p === 'http') return 'Webhook';
    return 'Sortie';
  }

  function outputMapTabLabel(out) {
    if (!out) return 'Sortie';
    var name = String(out.name || '').trim();
    return name || outputMapKindLabel(out);
  }

  function outputMapNewLabel(out) {
    var p = nodeProvider(out);
    if (p === 'mail') return 'Nouveau mail';
    if (p === 'facebook') return 'Nouveau commentaire';
    return 'Nouveau contenu';
  }

  function outputMapUsesObject(map) {
    return !!String((map && map.copyFrom) || '').trim();
  }

  function outputMapOpenKeys(map) {
    return (map && Array.isArray(map.openKeys)) ? map.openKeys.filter(Boolean) : [];
  }

  function outputMapHasValue(map, key) {
    return !!(map && map.values && String(map.values[key] || '').trim());
  }

  function outputMapVisibleSlots(output, map) {
    var slots = brickInputContractFields(output);
    var copy = outputMapUsesObject(map);
    var extra = {};
    outputMapOpenKeys(map).forEach(function(k) { extra[k] = true; });
    return slots.filter(function(slot) {
      if (!slot || !slot.key) return false;
      if (outputMapHasValue(map, slot.key)) return true;
      if (extra[slot.key]) return true;
      if (!copy && slot.required) return true;
      return false;
    });
  }

  function outputMapHiddenSlots(output, map) {
    var shown = {};
    outputMapVisibleSlots(output, map).forEach(function(s) { shown[s.key] = true; });
    return brickInputContractFields(output).filter(function(s) { return s && s.key && !shown[s.key]; });
  }

  function outputMapCanRemoveField(map, slot) {
    if (!slot || !slot.key) return false;
    if (!outputMapUsesObject(map) && slot.required) return false;
    return true;
  }

  function getOutputMap(action, outputId) {
    ensureOutputMaps(action);
    return action.config.outputMaps[outputId] || null;
  }

  function defaultOutputMap() {
    return {
      mode: 'write',
      copyFrom: '',
      values: {},
      openKeys: []
    };
  }

  function ensureOutputMap(action, output) {
    if (!action || !output) return null;
    ensureOutputMaps(action);
    if (!action.config.outputMaps[output.id]) {
      action.config.outputMaps[output.id] = defaultOutputMap();
    }
    var map = action.config.outputMaps[output.id];
    if (!map.values || typeof map.values !== 'object') map.values = {};
    if (!Array.isArray(map.openKeys)) map.openKeys = [];
    map.mode = outputMapUsesObject(map) ? 'object' : 'write';
    if (action.config.mappedOutputIds.indexOf(output.id) < 0) {
      action.config.mappedOutputIds.push(output.id);
    }
    return map;
  }

  function addOutputMap(action, output) {
    var map = ensureOutputMap(action, output);
    action.config.activeComposeTab = output.id;
    action.config.pickingOutput = false;
    syncOutputMapToNode(action, output);
    return map;
  }

  function startMapOutput(action) {
    if (!action) return false;
    pruneOutputMaps(action);
    var available = unmappedOutgoingOutputs(action);
    var all = mappableOutgoingOutputs(action);
    if (!all.length) {
      window.alert('Branchez d’abord une sortie derrière cette action (mail, Facebook…).');
      return false;
    }
    if (!available.length) {
      window.alert('Toutes les sorties branchées ont déjà un onglet.');
      return false;
    }
    if (available.length === 1) {
      addOutputMap(action, available[0]);
      return true;
    }
    action.config.pickingOutput = true;
    return true;
  }

  function removeOutputMap(action, outputId) {
    if (!action) return;
    ensureOutputMaps(action);
    delete action.config.outputMaps[outputId];
    action.config.mappedOutputIds = action.config.mappedOutputIds.filter(function(id) { return id !== outputId; });
    if (action.config.activeComposeTab === outputId) action.config.activeComposeTab = 'fields';
  }

  function outputMapOwnerAction(output) {
    if (!output) return null;
    return getIncomingNodes(output.id).filter(function(n) {
      return isComposeAction(n) && n.config && (n.config.mappedOutputIds || []).indexOf(output.id) >= 0;
    })[0] || null;
  }

  function actionOwnsOutputMap(output) {
    return !!outputMapOwnerAction(output);
  }

  function syncOutputMapToNode(action, output) {
    var map = getOutputMap(action, output && output.id);
    if (!map || !output) return;
    if (!output.config || typeof output.config !== 'object') output.config = {};
    ensureMappingConfig(output);
    var slots = brickInputContractFields(output);
    if (outputMapUsesObject(map)) {
      output.config.copyFrom = String(map.copyFrom || '').trim();
      delete output.config.copyFromOff;
    } else {
      output.config.copyFrom = '';
      output.config.copyFromOff = true;
    }
    slots.forEach(function(slot) {
      if (!slot || !slot.key) return;
      var ov = map.values && map.values[slot.key] != null ? String(map.values[slot.key]) : '';
      if (ov.trim()) {
        output.config.mapping[slot.key] = '__literal__';
        output.config.literals[slot.key] = ov;
      } else {
        delete output.config.mapping[slot.key];
        if (output.config.literals) delete output.config.literals[slot.key];
      }
    });
  }

  function setOutputMapValue(action, output, key, value) {
    var map = ensureOutputMap(action, output);
    if (!map.values || typeof map.values !== 'object') map.values = {};
    map.values[key] = value;
    syncOutputMapToNode(action, output);
  }

  function setOutputMapCopyFrom(action, output, path) {
    var map = ensureOutputMap(action, output);
    map.copyFrom = String(path || '').trim();
    map.mode = outputMapUsesObject(map) ? 'object' : 'write';
    map.openKeys = outputMapOpenKeys(map).filter(function(k) {
      return outputMapHasValue(map, k);
    });
    syncOutputMapToNode(action, output);
  }

  function addOutputMapSlot(action, output, key) {
    var map = ensureOutputMap(action, output);
    var k = String(key || '').trim();
    if (!k) return;
    if (map.openKeys.indexOf(k) < 0) map.openKeys.push(k);
    syncOutputMapToNode(action, output);
  }

  function removeOutputMapSlot(action, output, key) {
    var map = ensureOutputMap(action, output);
    var k = String(key || '').trim();
    if (!k) return;
    map.openKeys = outputMapOpenKeys(map).filter(function(x) { return x !== k; });
    if (map.values) delete map.values[k];
    syncOutputMapToNode(action, output);
  }

  function outputMapFieldHtml(output, slot, map) {
    var key = slot.key;
    var val = (map.values && map.values[key] != null) ? String(map.values[key]) : '';
    var type = String(slot.type || '').toLowerCase();
    var isArea = type === 'textarea' || type === 'file' || type === 'array'
      || key === 'body' || key === 'message';
    var ph = outputMapUsesObject(map)
      ? 'Laissez vide pour garder la valeur de l’objet'
      : (slot.label || key);
    var html = '<div class="agent-compose-field-block agent-output-map-field" data-output-field="'
      + escapeHtml(key) + '">';
    html += '<div class="agent-compose-field-head"><label>' + escapeHtml(slot.label || key);
    if (slot.required && !outputMapUsesObject(map)) html += ' <span class="agent-zone-preview-req">*</span>';
    html += '</label>';
    if (outputMapUsesObject(map)) {
      html += String(val).trim()
        ? '<span class="agent-output-map-badge is-override">Écrit ici</span>'
        : '<span class="agent-output-map-badge">Surcharge</span>';
    }
    if (outputMapCanRemoveField(map, slot)) {
      html += '<button type="button" class="agent-compose-zone-remove" data-remove-output-slot="'
        + escapeHtml(key) + '" title="Retirer">×</button>';
    }
    html += '</div>';
    if (isArea) {
      html += '<textarea data-output-map-key="' + escapeHtml(key) + '" rows="'
        + (key === 'body' || key === 'message' ? '6' : '3')
        + '" class="form-control agent-compose-editor" placeholder="'
        + escapeHtml(ph) + '">' + escapeHtml(val) + '</textarea>';
    } else {
      html += '<input type="text" data-output-map-key="' + escapeHtml(key)
        + '" class="form-control agent-compose-editor" placeholder="'
        + escapeHtml(ph) + '" value="' + escapeHtml(val) + '">';
    }
    html += '</div>';
    return html;
  }

  function outputMapCopyFromHtml(action, output, map) {
    var opts = copyFromOptions(action);
    var cur = String((map && map.copyFrom) || '').trim();
    var html = '<div class="form-group agent-copy-from"><label>Contenu</label>';
    html += '<select data-output-copy-from>';
    html += '<option value="">' + escapeHtml(outputMapNewLabel(output)) + '</option>';
    opts.forEach(function(o) {
      html += '<option value="' + escapeHtml(o.key) + '"' + (cur === o.key ? ' selected' : '') + '>'
        + escapeHtml(o.label) + '</option>';
    });
    if (cur && !opts.some(function(o) { return o.key === cur; })) {
      html += '<option value="' + escapeHtml(cur) + '" selected>' + escapeHtml(cur) + '</option>';
    }
    html += '</select>';
    if (cur) {
      html += '<p class="empty" style="margin-top:6px;">L’objet est repris tel quel. Surchargez seulement ce que vous changez.</p>';
    } else {
      html += '<p class="empty" style="margin-top:6px;">Champs obligatoires. Ajoutez les autres si besoin.</p>';
    }
    html += '</div>';
    return html;
  }

  function outputMapAddSlotHtml(output, map) {
    var hidden = outputMapHiddenSlots(output, map);
    if (!hidden.length) return '';
    var label = outputMapUsesObject(map) ? 'Surcharger un champ' : 'Ajouter un champ';
    var html = '<div class="form-group agent-copy-from agent-output-map-add">';
    html += '<select data-add-output-slot>';
    html += '<option value="">' + escapeHtml(label) + '…</option>';
    hidden.forEach(function(slot) {
      html += '<option value="' + escapeHtml(slot.key) + '">'
        + escapeHtml(slot.label || slot.key) + '</option>';
    });
    html += '</select></div>';
    return html;
  }

  function outputMapEditorHtml(action, output) {
    var map = ensureOutputMap(action, output);
    var slots = brickInputContractFields(output);
    var visible = outputMapVisibleSlots(output, map);
    var html = '<div class="agent-output-map" data-output-map="' + escapeHtml(output.id) + '">';
    html += outputMapCopyFromHtml(action, output, map);
    if (!slots.length) {
      html += '<p class="empty">Cette sortie n’a pas encore de contrat (choisissez mail, Facebook… sur le bloc Sortie).</p>';
    }
    visible.forEach(function(slot) {
      html += outputMapFieldHtml(output, slot, map);
    });
    html += outputMapAddSlotHtml(output, map);
    html += '</div>';
    return html;
  }

  function composeTabsHtml(node) {
    pruneOutputMaps(node);
    var ids = node.config.mappedOutputIds || [];
    var tab = node.config.activeComposeTab || 'fields';
    var html = '<div class="agent-compose-tabs">';
    html += '<button type="button" class="agent-compose-tab' + (tab === 'fields' ? ' is-active' : '')
      + '" data-compose-tab="fields">Champs</button>';
    ids.forEach(function(id) {
      var out = state.nodes.find(function(n) { return n.id === id; });
      html += '<button type="button" class="agent-compose-tab' + (tab === id ? ' is-active' : '')
        + '" data-compose-tab="' + escapeHtml(id) + '">'
        + escapeHtml(outputMapTabLabel(out)) + '</button>';
    });
    html += '</div>';
    return html;
  }

  function outputPickerHtml(node) {
    var available = unmappedOutgoingOutputs(node);
    var html = '<div class="agent-output-picker">';
    html += '<p class="empty" style="margin:0 0 8px;">Quelle sortie mapper ?</p>';
    available.forEach(function(out) {
      html += '<button type="button" class="agent-compose-chip" data-pick-output="'
        + escapeHtml(out.id) + '">' + escapeHtml(outputMapTabLabel(out)) + '</button>';
    });
    html += '<button type="button" class="agent-compose-chip" data-cancel-pick-output>Annuler</button>';
    html += '</div>';
    return html;
  }

  function nodeFollowedByIa(node) {
    if (!node) return false;
    return nodeNextIds(node).some(function(id) {
      var n = state.nodes.find(function(x) { return x.id === id; });
      return n && n.brickId === 'ia';
    });
  }

  function nodeFamilyCaption(node, brick) {
    if (node.brickId === 'trigger' || node.kind === 'trigger') return 'Déclencher';
    if (node.brickId === 'data') {
      var dataCap = String((node.config && node.config.provider) || '').toLowerCase();
      if (dataCap === 'flow' || dataCap === 'flux') return 'Entrées · flux parent';
      return 'Entrées · tableau';
    }
    if (isLoopNode(node)) return 'Boucle';
    if (isConditionNode(node) || (brick && brick.category === 'logic')) return 'Condition';
    if (node.brickId === 'validation' || (brick && brick.interaction === 'human')) return 'Sous-agent';
    if (node.brickId === 'visualization') {
      var vt = String((node.config && node.config.vizType) || 'select');
      if (vt === 'select') return 'Visualisation · liste';
      if (vt === 'page') return 'Visualisation · page';
      return 'Visualisation';
    }
    if (node.brickId === 'output') return 'Sortie';
    if (node.brickId === 'ia') return 'IA · exécute le prompt';
    if (isInsertableAction(node)) return 'Action · sous-action';
    if (isHookAction(node) || isHookComposeAction(node)) return 'Action · surface';
    if (isFunctionAction(node)) return 'Action';
    if (isComposeAction(node)) {
      pruneOutputMaps(node);
      var maps = (node.config.mappedOutputIds || []).length;
      var n = ((node.config && node.config.variables) || []).length;
      var bits = [];
      if (maps) bits.push(maps + ' sortie' + (maps > 1 ? 's' : ''));
      if (n) bits.push(n + ' champ' + (n > 1 ? 's' : ''));
      return bits.length ? ('Action · ' + bits.join(' + ')) : 'Action · champs';
    }
    return 'Action';
  }

  function FALLBACK_ZONE_PRESETS() {
    return {
      ia: {
        id: 'ia',
        label: 'IA',
        variables: [
          { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, placeholder: 'À partir de {{text}}, produis le résultat demandé.' },
          { key: 'context', label: 'Contexte', type: 'textarea' },
          { key: 'rag', label: 'RAG', type: 'textarea', placeholder: '{{items}}' }
        ]
      },
      'output.mail': {
        id: 'output.mail',
        label: 'Sortie mail',
        variables: [
          { key: 'to', label: 'Destinataire', type: 'text', required: true, placeholder: '{{from}}' },
          { key: 'subject', label: 'Sujet', type: 'text', placeholder: 'Re: {{subject}}' },
          { key: 'body', label: 'Réponse', type: 'textarea', required: true, placeholder: '{{response}}' },
          { key: 'attachments', label: 'Pièces jointes', type: 'file', placeholder: '{{attachments}}' }
        ]
      },
      'output.mail.digest': {
        id: 'output.mail.digest',
        label: 'Digest mail (tableau)',
        variables: [
          { key: 'to', label: 'Destinataire', type: 'text', required: true, placeholder: 'autre@exemple.fr' },
          { key: 'subject', label: 'Sujet', type: 'text', placeholder: 'Nouveau mail ({{itemsCount}})' },
          {
            key: 'body',
            label: 'Réponse',
            type: 'textarea',
            required: true,
            placeholder: 'Nouveau mail\nde :\n{{#donnees}}\n\n{{/donnees}}'
          },
          { key: 'attachments', label: 'Pièces jointes', type: 'file', placeholder: '{{attachments}}' }
        ]
      },
      'output.facebook': {
        id: 'output.facebook',
        label: 'Sortie Facebook',
        variables: [
          { key: 'message', label: 'Message', type: 'textarea', required: true, placeholder: '{{response}}' }
        ]
      },
      hook: {
        id: 'hook',
        label: 'Surface hook',
        variables: [
          { key: 'surface', label: 'Surface', type: 'text', required: true, placeholder: '{{liste_hooks.surface}}' },
          { key: 'label', label: 'Libellé', type: 'text', placeholder: '{{liste_hooks.label}}' },
          { key: 'name', label: 'Nom du bouton', type: 'text', placeholder: '{{liste_hooks.label}}' },
          { key: 'iconEmoji', label: 'Icône', type: 'text', placeholder: '🪝' },
          { key: 'logoUrl', label: 'Logo (URL)', type: 'text', placeholder: 'https://…' },
          { key: 'color', label: 'Couleur', type: 'text', placeholder: '#7c3aed' }
        ]
      }
    };
  }

  function getZonePreset(id) {
    var want = String(id || '');
    var fromApi = state.zoneContracts && state.zoneContracts.presets && state.zoneContracts.presets[want];
    if (fromApi) return fromApi;
    return FALLBACK_ZONE_PRESETS()[want] || null;
  }

  function suggestZonePresetId(node) {
    var incoming = getIncomingNodes(node && node.id);
    if (incoming.some(isHookCollectionNode)) return 'hook';
    var nextIds = node ? nodeNextIds(node) : [];
    for (var i = 0; i < nextIds.length; i++) {
      var next = state.nodes.find(function(n) { return n.id === nextIds[i]; });
      if (!next) continue;
      if (next.brickId === 'ia') return 'ia';
      if (next.brickId === 'output' && isCollectionOutput(next)) continue;
      if (next.brickId === 'output' && next.config && next.config.provider === 'facebook') return 'output.facebook';
      if (next.brickId === 'output') return 'output.mail';
    }
    return '';
  }

  function slugZoneKey(raw) {
    return String(raw || '').trim().toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }

  function applyZonePreset(node, presetId, opts) {
    opts = opts || {};
    if (!node || !node.config) return;
    var preset = getZonePreset(presetId);
    if (!preset || !Array.isArray(preset.variables)) return;
    if (!Array.isArray(node.config.variables)) node.config.variables = [];
    if (!node.config.values || typeof node.config.values !== 'object') node.config.values = {};
    if (opts.onlyIfEmpty && node.config.variables.length) return;
    var have = {};
    node.config.variables.forEach(function(v) { if (v && v.key) have[v.key] = true; });
    preset.variables.forEach(function(v) {
      if (!v || !v.key) return;
      if (!have[v.key]) {
        node.config.variables.push({
          key: v.key,
          label: v.label || v.key,
          type: v.type || 'textarea',
          required: !!v.required,
          description: v.description || '',
          placeholder: v.placeholder || ''
        });
        have[v.key] = true;
      }
      var emptyVal = node.config.values[v.key] == null || String(node.config.values[v.key]).trim() === '';
      if (emptyVal) node.config.values[v.key] = presetFillValue(node, presetId, v);
    });
    node.config.preset = presetId;
    syncActionFieldsToContract(node);
    wireDownstreamFromAction(node);
  }

  function fillMailDigestBody(node) {
    if (!node) return;
    applyZonePreset(node, 'output.mail');
    var slug = upstreamDataSlug(node);
    if (!slug) return;
    if (!node.config.values || typeof node.config.values !== 'object') node.config.values = {};
    node.config.values.subject = 'Nouveau mail ({{' + slug + '.length}})';
    node.config.values.body = digestMailSnippet(slug);
    node.config.preset = 'output.mail.digest';
    wireDownstreamFromAction(node);
  }

  function outgoingNodes(node, brickId) {
    return nodeNextIds(node).map(function(id) {
      return state.nodes.find(function(n) { return n.id === id; });
    }).filter(function(n) { return n && (!brickId || n.brickId === brickId); });
  }

  function incomingComposeActions(node) {
    return getIncomingNodes(node && node.id).filter(isComposeAction);
  }

  function actionHasZone(actionNode, key) {
    return ((actionNode && actionNode.config && actionNode.config.variables) || []).some(function(v) {
      return v && v.key === key;
    });
  }

  function actionContractField(node, key) {
    var k = String(key || '');
    if (!k || !node) return null;
    var nextIds = nodeNextIds(node);
    for (var i = 0; i < nextIds.length; i++) {
      var next = state.nodes.find(function(n) { return n.id === nextIds[i]; });
      if (!next) continue;
      var fields = brickInputContractFields(next) || [];
      var found = fields.filter(function(f) { return f && f.key === k; })[0];
      if (found) return found;
    }
    var preset = getZonePreset(suggestZonePresetId(node));
    var fromPreset = ((preset && preset.variables) || []).filter(function(f) { return f && f.key === k; })[0];
    return fromPreset || null;
  }

  function syncActionFieldsToContract(node) {
    if (!node || !node.config || !Array.isArray(node.config.variables)) return;
    node.config.variables.forEach(function(v) {
      if (!v || !v.key) return;
      var c = actionContractField(node, v.key);
      if (c) v.required = !!c.required;
    });
  }

  function presetChipLabel(presetId, preset) {
    if (presetId === 'output.mail') return 'Champs du mail';
    if (presetId === 'output.facebook') return 'Champs Facebook';
    if (presetId === 'ia') return 'Champs IA';
    if (presetId === 'hook') return 'Surface hook';
    return (preset && preset.label) || presetId || 'Champs';
  }

  function upstreamFieldToken(node, localKey) {
    var want = String(localKey || '').trim();
    if (!want) return '';
    if (want === 'today' || want === 'date') return '{{' + want + '}}';
    var fields = collectContextFieldsForNode(node && node.id);
    var found = fields.filter(function(f) {
      if (!f || f.own) return false;
      return f.key === want || f.localKey === want;
    })[0];
    return found ? ('{{' + found.key + '}}') : '';
  }

  function fillFromPlaceholder(node, placeholder) {
    var raw = String(placeholder || '');
    if (!raw.trim()) return '';
    var missing = false;
    var out = raw.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, function(_, key) {
      var token = upstreamFieldToken(node, key);
      if (!token) {
        missing = true;
        return '';
      }
      return token;
    });
    return missing ? '' : out;
  }

  function presetFillValue(node, presetId, field) {
    if (!field) return '';
    var copy = nodeCopyFrom(node);
    if (copy) return copyFieldToken(copy, field.key, node);
    var slug = upstreamDataSlug(node);
    if (presetId === 'output.mail.digest' && field.key === 'body') {
      return slug ? digestMailSnippet(slug) : '';
    }
    if (presetId === 'output.mail.digest' && field.key === 'subject') {
      return slug ? ('Nouveau mail ({{' + slug + '.length}})') : '';
    }
    return fillFromPlaceholder(node, field.placeholder);
  }

  function composeInputPlaceholder(field, node) {
    var k = String((field && field.key) || '');
    if (node && copyFromInherits(node, k)) return 'Valeur de l’objet — modifiable';
    var hints = {
      to: 'Adresse e-mail',
      subject: 'Objet du mail',
      body: 'Texte du mail',
      attachments: 'Fichiers à joindre',
      message: 'Texte du message',
      prompt: 'Instruction pour le modèle',
      context: 'Cadre, ton, règles',
      rag: 'Extraits ou connaissances',
      surface: 'tab, modal, app…',
      label: 'Nom de la surface'
    };
    if (hints[k]) return hints[k];
    var ph = String((field && field.placeholder) || '');
    if (ph && ph.indexOf('{{') < 0) return ph;
    return (field && field.label) || '';
  }

  function wireNodeMappingFromAction(actionNode, target) {
    if (!actionNode || !target) return;
    if (!target.config || typeof target.config !== 'object') target.config = {};
    ensureMappingConfig(target);
    var actionSlug = ensureNodeSlug(actionNode);
    var overlay = templateOverlayForNode(target);
    var keys = {};
    ((actionNode.config && actionNode.config.variables) || []).forEach(function(v) {
      if (v && v.key) keys[v.key] = true;
    });
    if (isFlowOutput(actionNode) || actionNode.brickId === 'ia') {
      keys.html = true;
      keys.css = true;
    }
    var slotKeys = mappingSlotsForNode(target).map(function(s) { return s && s.key; }).filter(Boolean);
    if (!slotKeys.length) {
      slotKeys = Object.keys(keys).filter(function(k) {
        return k === 'to' || k === 'subject' || k === 'body' || k === 'attachments' || k === 'message'
          || k === 'prompt' || k === 'context' || k === 'rag'
          || k === 'html' || k === 'css';
      });
    }
    slotKeys.forEach(function(key) {
      if (!keys[key] || overlay[key]) return;
      if (isHookAction(target) && key === 'surface') return;
      var mapped = String((target.config.mapping && target.config.mapping[key]) || '').trim();
      var literal = String((target.config.literals && target.config.literals[key]) || '').trim();
      if (mapped === '__literal__' && literal) return;
      target.config.mapping[key] = actionSlug + '.' + key;
      if (target.config.literals) delete target.config.literals[key];
    });
  }

  function wireDownstreamFromAction(actionNode) {
    if (!isComposeAction(actionNode)) return;
    var preset = String((actionNode.config && actionNode.config.preset) || '');
    outgoingNodes(actionNode, 'output').forEach(function(out) {
      if (!out.config || typeof out.config !== 'object') out.config = {};
      if (!nodeProvider(out) && !String(out.config.connectorId || '').trim()) {
        if (preset === 'output.facebook') out.config.provider = 'facebook';
        else if (preset.indexOf('output.mail') === 0) out.config.provider = 'mail';
      }
      pruneOutputMaps(actionNode);
      if ((actionNode.config.mappedOutputIds || []).indexOf(out.id) >= 0) {
        syncOutputMapToNode(actionNode, out);
        return;
      }
      wireNodeMappingFromAction(actionNode, out);
    });
    outgoingNodes(actionNode, 'ia').forEach(function(ia) {
      wireNodeMappingFromAction(actionNode, ia);
    });
    outgoingNodes(actionNode, 'action').forEach(function(act) {
      if (isHookAction(act)) wireNodeMappingFromAction(actionNode, act);
    });
  }

  function addComposeZone(node, key, label) {
    ensureComposeZones(node);
    var k = slugZoneKey(key);
    if (!k) return null;
    if (node.config.variables.some(function(v) { return v.key === k; })) return k;
    node.config.variables.push({
      key: k,
      label: String(label || k),
      type: 'textarea',
      required: false,
      description: '',
      placeholder: ''
    });
    if (node.config.values[k] == null) node.config.values[k] = '';
    node.config.activeZone = k;
    return k;
  }

  function setComposeFieldRequired(node, key, on) {
    ensureComposeZones(node);
    if (actionContractField(node, key)) return;
    var found = (node.config.variables || []).find(function(v) { return v.key === key; });
    if (found) found.required = !!on;
  }

  function setComposeFieldType(node, key, type) {
    ensureComposeZones(node);
    var found = (node.config.variables || []).find(function(v) { return v.key === key; });
    if (!found) return;
    found.type = normalizeComposeFieldType(type);
    node.config.activeZone = key;
  }

  function rewriteComposeTokens(node, fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return;
    var tokenFrom = '{{' + fromKey + '}}';
    var tokenTo = '{{' + toKey + '}}';
    var values = node.config.values || {};
    Object.keys(values).forEach(function(k) {
      if (typeof values[k] === 'string' && values[k].indexOf(tokenFrom) !== -1) {
        values[k] = values[k].split(tokenFrom).join(tokenTo);
      }
    });
    if (typeof node.config.prompt === 'string' && node.config.prompt.indexOf(tokenFrom) !== -1) {
      node.config.prompt = node.config.prompt.split(tokenFrom).join(tokenTo);
    }
  }

  function renameComposeField(node, oldKey, newLabel) {
    ensureComposeZones(node);
    var found = (node.config.variables || []).find(function(v) { return v.key === oldKey; });
    if (!found) return oldKey;
    var label = String(newLabel == null ? '' : newLabel).trim();
    if (!label) return oldKey;
    found.label = label;
    var nextKey = slugZoneKey(label);
    if (!nextKey || nextKey === oldKey) return oldKey;
    if (node.config.variables.some(function(v) { return v.key === nextKey; })) return oldKey;
    if (!node.config.values || typeof node.config.values !== 'object') node.config.values = {};
    node.config.values[nextKey] = node.config.values[oldKey] != null ? node.config.values[oldKey] : '';
    delete node.config.values[oldKey];
    if (oldKey === 'prompt') delete node.config.prompt;
    if (nextKey === 'prompt') node.config.prompt = node.config.values[nextKey];
    found.key = nextKey;
    if (node.config.activeZone === oldKey) node.config.activeZone = nextKey;
    rewriteComposeTokens(node, oldKey, nextKey);
    return nextKey;
  }

  function removeComposeZone(node, key) {
    ensureComposeZones(node);
    node.config.variables = node.config.variables.filter(function(v) { return v.key !== key; });
    if (node.config.values) delete node.config.values[key];
    if (node.config.activeZone === key) {
      node.config.activeZone = node.config.variables[0] ? node.config.variables[0].key : '';
    }
  }

  function schemaSourceNode(node) {
    if (!node || !node.config) return null;
    var from = String(node.config.fieldsFrom || '').trim();
    if (!from) {
      var upstream = typeof getUpstreamNodes === 'function' ? getUpstreamNodes(node.id) : [];
      var data = (upstream || []).find(function(n) {
        return n && n.brickId === 'data' && n.config
          && (n.config.schemaSlug || n.slug === 'collection_design');
      });
      if (data && data.slug) {
        node.config.fieldsFrom = String(data.slug);
        from = node.config.fieldsFrom;
      }
    }
    if (!from) return null;
    return state.nodes.find(function(n) {
      return String(n.slug || '') === from || String(n.id || '') === from;
    }) || null;
  }

  function composeTypeFromSchemaRow(type) {
    var t = String(type || 'text').toLowerCase();
    if (t === 'textarea') return 'textarea';
    if (t === 'number') return 'number';
    if (t === 'array' || t === 'file') return t;
    return 'text';
  }

  function ensureComposeFromSchema(node) {
    if (!node || !node.config) return;
    var source = schemaSourceNode(node);
    if (!source || !source.config) return;
    var rows = Array.isArray(source.config.modelRows) ? source.config.modelRows : [];
    if (!rows.length) {
      if (source.config.schemaSlug && !source._schemaFieldsLoading) {
        source._schemaFieldsLoading = true;
        ensureAtelierCollectionForNode(source).then(function(pack) {
          source._schemaFieldsLoading = false;
          var contract = pack && (pack.fieldContract || pack.fields);
          if (!Array.isArray(contract) || !contract.length) return;
          source.config.modelRows = contract.map(function(f) {
            return { name: f.name || f.key, type: f.type || 'text', label: f.label || f.name || f.key };
          });
          source.config.modelFields = [
            { key: 'name', label: 'Nom', type: 'text' },
            { key: 'type', label: 'Type', type: 'text' },
            { key: 'label', label: 'Libellé', type: 'text' }
          ];
          renderConfig();
        });
      }
      return;
    }
    if (!Array.isArray(node.config.variables)) node.config.variables = [];
    var byKey = {};
    node.config.variables.forEach(function(v) {
      if (v && v.key) byKey[v.key] = v;
    });
    var merged = [];
    rows.forEach(function(r) {
      var key = String((r && (r.name || r.key)) || '').trim();
      if (!key) return;
      var next = {
        key: key,
        label: String((r && r.label) || key),
        type: composeTypeFromSchemaRow(r.type),
        required: !!(r && r.required),
        description: String((r && r.description) || ''),
        placeholder: String((r && r.placeholder) || '')
      };
      if (byKey[key]) {
        next = Object.assign({}, next, byKey[key], { key: key, type: byKey[key].type || next.type });
        delete byKey[key];
      }
      merged.push(next);
    });
    Object.keys(byKey).forEach(function(k) { merged.push(byKey[k]); });
    node.config.variables = merged;
    if (!node.config.values || typeof node.config.values !== 'object') node.config.values = {};
  }

  function ensureComposeZones(node) {
    ensureActionConfig(node);
    if (!node.config.values || typeof node.config.values !== 'object') node.config.values = {};
    if (!Array.isArray(node.config.variables)) node.config.variables = [];
    ensureComposeFromSchema(node);
    node.config.variables.forEach(function(v) {
      if (v) v.type = normalizeComposeFieldType(v.type);
    });
    var legacy = String(node.config.prompt || '').trim();
    if (legacy && !String(node.config.values.prompt || '').trim()) {
      node.config.values.prompt = node.config.prompt;
    }
    if (legacy && !node.config.variables.some(function(v) { return v.key === 'prompt'; })) {
      node.config.variables.unshift({
        key: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
        description: '',
        placeholder: ''
      });
    }
    if (!node.config.variables.length) return;
    syncActionFieldsToContract(node);
    if (!node.config.activeZone && node.config.variables[0]) {
      node.config.activeZone = node.config.variables[0].key;
    }
  }

  function zoneValue(node, key) {
    var values = (node.config && node.config.values) || {};
    if (values[key] != null) return String(values[key]);
    if (key === 'prompt') return String((node.config && node.config.prompt) || '');
    return '';
  }

  function zoneValuePreview(raw) {
    var s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length > 90) return s.slice(0, 89) + '…';
    return s;
  }

  function setZoneValue(node, key, value) {
    if (!node.config.values || typeof node.config.values !== 'object') node.config.values = {};
    node.config.values[key] = value;
    if (key === 'prompt') node.config.prompt = value;
  }

  function activeComposeZone(node) {
    ensureComposeZones(node);
    var key = node.config.activeZone;
    var found = (node.config.variables || []).find(function(v) { return v.key === key; });
    return found || node.config.variables[0] || null;
  }

  function ensureActionConfig(node) {
    if (!node || node.brickId !== 'action') return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    var raw = node.config.actionId || node.config.operation || 'ia.compose';
    var id = normalizeClientActionId(raw) || 'ia.compose';
    node.config.actionId = id;
    node.config.operation = id;
    if (node.config.kind === 'function') {
      node.config.kind = 'function';
      return;
    }
    if (id.indexOf('ia.') === 0 || !id) {
      node.config.actionId = 'ia.compose';
      node.config.operation = 'ia.compose';
      if (node.config.kind === 'ia') delete node.config.kind;
    }
    if (node.config.writeMode !== 'replace') node.config.writeMode = 'merge';
    if (id === 'ia.compose' || id.indexOf('ia.') === 0) ensureOutputMaps(node);
  }

  function actionNodeSummary(config) {
    var id = normalizeClientActionId((config && (config.actionId || config.operation)) || '');
    var def = getActionDef(id);
    if (def && def.label && id && id.indexOf('ia.') !== 0) return def.label;
    var vars = (config && Array.isArray(config.variables)) ? config.variables : [];
    if (vars.length) {
      var n = vars.length;
      return vars.map(function(v) { return v.label || v.key; }).slice(0, 3).join(', ')
        + (n > 3 ? '…' : '');
    }
    return 'Champs';
  }

  function composeFieldTypes() {
    var fromApi = state.zoneContracts && Array.isArray(state.zoneContracts.variableTypes)
      ? state.zoneContracts.variableTypes
      : null;
    if (fromApi && fromApi.length) return fromApi;
    return [
      { id: 'textarea', label: 'Zone de texte' },
      { id: 'text', label: 'Texte' },
      { id: 'number', label: 'Nombre' },
      { id: 'file', label: 'Fichier / PJ' },
      { id: 'array', label: 'Liste' }
    ];
  }

  function normalizeComposeFieldType(raw) {
    var t = String(raw || 'textarea').toLowerCase();
    if (t === 'int' || t === 'integer' || t === 'float' || t === 'currency'
      || t === 'nombre' || t === 'chiffre' || t === 'number') return 'number';
    if (t === 'string') return 'text';
    if (t === 'text' || t === 'textarea' || t === 'file' || t === 'array') return t;
    return 'textarea';
  }

  function isNumberFieldType(type) {
    return normalizeComposeFieldType(type) === 'number';
  }

  function isNumericContextField(f) {
    if (!f) return false;
    if (isNumberFieldType(f.type)) return true;
    if (typeof f.example === 'number') return true;
    var key = String(f.key || '').toLowerCase().replace(/[._-]/g, '');
    return /^(result|confidence|loopiteration|times|count|limit|qty|quantity|quantite|price|prix|amount|montant|total|ht|ttc|tva)$/.test(key);
  }

  function fieldTypeSelectHtml(current, attrName, attrValue) {
    var cur = normalizeComposeFieldType(current);
    var html = '<select class="agent-compose-type" ' + attrName + '="' + escapeHtml(attrValue) + '" title="Type du champ">';
    composeFieldTypes().forEach(function(t) {
      html += '<option value="' + escapeHtml(t.id) + '"' + (cur === t.id ? ' selected' : '') + '>'
        + escapeHtml(t.label) + '</option>';
    });
    html += '</select>';
    return html;
  }

  function MATH_OPS() {
    return [
      { insert: ' + ', label: '+' },
      { insert: ' - ', label: '−' },
      { insert: ' * ', label: '×' },
      { insert: ' / ', label: '÷' },
      { insert: ' % ', label: '%' },
      { insert: '(', label: '(' },
      { insert: ')', label: ')' },
      { insert: ' ** ', label: 'xⁿ' }
    ];
  }

  function contextFieldLabel(f) {
    if (!f) return '';
    if (f.label) return String(f.label);
    var local = f.localKey || String(f.key || '').split('.').pop();
    return humanizeFieldKey(local || f.key);
  }

  function contextFieldGroupName(f) {
    if (!f) return 'Flux';
    if (f.own) return 'Ce bloc';
    if (f.source === 'Système' || (!f.slug && (f.key === 'today' || f.key === 'date'))) return 'Système';
    if (isExpertView()) return f.slug || f.source || 'Flux';
    return f.source || f.slug || 'Flux';
  }

  function composeInsertItem(f) {
    var local = f.localKey || String(f.key || '').split('.').pop();
    return {
      key: f.key,
      localKey: local,
      slug: f.slug || '',
      label: contextFieldLabel(f),
      type: f.type || '',
      example: f.example,
      insert: '{{' + f.key + '}}',
      code: '{{' + f.key + '}}',
      hint: f.hint || describeContextField(f.key, f),
      numeric: isNumericContextField(f),
      dropKey: f.own ? '' : (f.key || ''),
      own: !!f.own
    };
  }

  function composeInsertGroups(node) {
    var fields = collectContextFieldsForNode(node.id);
    var groups = {};
    var order = [];
    function addToGroup(source, item) {
      var name = source || 'Flux';
      if (!groups[name]) {
        groups[name] = [];
        order.push(name);
      }
      groups[name].push(item);
    }
    fields.filter(function(f) { return f.own; }).forEach(function(f) {
      addToGroup('Ce bloc', composeInsertItem(f));
    });
    fields.filter(function(f) { return !f.own && f.brickId !== 'data' && f.brickId !== 'ia'; }).forEach(function(f) {
      addToGroup(contextFieldGroupName(f), composeInsertItem(f));
    });
    upstreamDataNodes(node).forEach(function(n) {
      var slug = ensureNodeSlug(n);
      var name = n.name || slug || 'Entrées';
      addToGroup(isExpertView() ? slug : name, {
        key: slug + '.length',
        localKey: 'length',
        slug: slug,
        label: 'Nombre de lignes',
        type: 'number',
        insert: '{{' + slug + '.length}}',
        hint: 'Nombre de lignes du tableau « ' + name + ' ».',
        numeric: true,
        mathOnly: true,
        brickId: 'data',
        dropKey: slug + '.length'
      });
    });
    return { fields: fields, groups: groups, order: order };
  }

  function composeFieldButtonsHtml(items) {
    var expert = isExpertView();
    var html = '';
    items.forEach(function(item) {
      var hint = item.hint || describeContextField(item.key, item);
      var code = item.code || item.insert || ('{{' + item.key + '}}');
      var label = item.label || humanizeFieldKey(item.localKey || item.key);
      html += '<button type="button" class="agent-compose-field"';
      if (item.snippet) {
        html += ' data-insert-snippet="' + escapeHtml(item.snippet) + '" data-ns-slug="' + escapeHtml(item.nsSlug || item.key) + '"';
      } else {
        html += ' data-insert="' + escapeHtml(item.insert || '') + '"';
      }
      html += ' data-hint="' + escapeHtml(hint) + '" aria-label="' + escapeHtml(label + (expert ? ' — ' + code : '')) + '">'
        + '<span class="agent-compose-field-text">'
        + '<span>' + escapeHtml(label) + '</span>'
        + (expert ? '<code>' + escapeHtml(code) + '</code>' : '')
        + '</span>'
        + '<span class="agent-compose-field-info" aria-hidden="true">i</span>'
        + '</button>';
    });
    return html;
  }

  function composeSourceGroupsHtml(pack, numericOnly, node) {
    var html = '';
    var any = false;
    pack.order.forEach(function(source) {
      var items = (pack.groups[source] || []).filter(function(item) {
        if (numericOnly) return item.numeric;
        return !item.mathOnly;
      });
      if (!items.length) return;
      any = true;
      html += '<div class="agent-compose-source">';
      html += '<div class="agent-compose-source-toggle">'
        + '<span class="agent-compose-source-name">' + escapeHtml(source) + '</span>'
        + '<span class="agent-compose-source-meta">' + items.length + '</span>'
        + '<button type="button" class="agent-compose-source-btn" data-toggle-source>Ouvrir</button>'
        + '</div>';
      html += '<div class="agent-compose-ns-fields">';
      html += composeFieldButtonsHtml(items, node);
      html += '</div>';
      html += '</div>';
    });
    if (!any) {
      if (numericOnly) {
        html += '<p class="empty">Aucun champ nombre. Passez un champ en type Nombre pour l’insérer ici.</p>';
      }
    }
    return html;
  }

  function ITEM_ENVELOPE_KEYS() {
    return {
      items: 1,
      itemsCount: 1,
      item: 1,
      itemIndex: 1,
      itemNumber: 1,
      json: 1,
      payload: 1,
      empty: 1,
      provider: 1,
      passthrough: 1,
      fetched: 1,
      note: 1,
      modelFields: 1,
      modelName: 1,
      modelRows: 1,
      collectionId: 1,
      collectionNamespace: 1,
      ok: 1,
      resourceType: 1,
      intentions: 1,
      source: 1,
      presetId: 1,
      referenceFields: 1,
      instanceId: 1
    };
  }

  function itemRowFieldsForCompose(node) {
    var skip = ITEM_ENVELOPE_KEYS();
    var seen = {};
    var fields = [];
    function pushLocal(local, label, type, hint) {
      var key = String(local || '').trim();
      if (!key || skip[key] || seen[key]) return;
      seen[key] = true;
      fields.push({
        key: 'item.' + key,
        localKey: key,
        label: label || humanizeFieldKey(key),
        insert: '{{item.' + key + '}}',
        hint: hint || describeContextField('item.' + key),
        type: type || ''
      });
    }
    getUpstreamNodes(node && node.id).forEach(function(n) {
      if (!n) return;
      if (n.brickId === 'data') {
        contractFieldsForDataNode(n).forEach(function(f) {
          pushLocal(f.key, f.label, f.type, f.hint);
        });
      }
      if (n.brickId === 'ia') {
        iaOutputFieldsForNode(n).forEach(function(f) {
          pushLocal(f.key, f.label, f.type, f.hint);
        });
      }
    });
    return fields;
  }

  function composeFieldAlias(local) {
    var map = {
      from: 'expediteur',
      subject: 'sujet',
      text: 'texte',
      body: 'texte',
      to: 'destinataire'
    };
    return map[String(local || '')] || local;
  }

  function upstreamDataNodes(node) {
    return getUpstreamNodes(node && node.id).filter(function(n) { return n && n.brickId === 'data'; });
  }

  function upstreamDataSlug(node) {
    var list = upstreamDataNodes(node);
    return list.length ? ensureNodeSlug(list[0]) : '';
  }

  function tableLoopSnippet(slug) {
    var s = String(slug || 'donnees').trim() || 'donnees';
    return '{{#' + s + '[i]}}\n\n{{/' + s + '}}';
  }

  function digestMailSnippet(slug) {
    return 'Nouveau mail\nde :\n' + tableLoopSnippet(slug || 'donnees');
  }

  function mergedDataRowFields(dataNodes) {
    var seen = {};
    var fields = [];
    (dataNodes || []).forEach(function(n) {
      contractFieldsForDataNode(n).forEach(function(f) {
        var local = String((f && (f.localKey || f.key)) || '').trim();
        if (!local || seen[local]) return;
        seen[local] = true;
        fields.push(f);
      });
    });
    return fields;
  }

  function tableRowFieldsHtml(nodeOrFields, slug, opts) {
    opts = opts || {};
    var skip = ITEM_ENVELOPE_KEYS();
    var fields = [];
    var seen = {};
    var expert = isExpertView();
    var useIndex = opts.indexed !== false && expert;
    var useAlias = opts.alias !== false && expert;
    function pushField(f) {
      var local = String((f && (f.localKey || f.key)) || '').trim();
      if (!local || skip[local] || seen[local]) return;
      seen[local] = true;
      var insertLocal = useAlias ? composeFieldAlias(local) : local;
      var path = useIndex
        ? (slug + '.item[i].' + insertLocal)
        : (slug + '.' + insertLocal);
      fields.push({
        key: path,
        localKey: local,
        slug: slug,
        label: f.label || humanizeFieldKey(local),
        insert: '{{' + path + '}}',
        hint: (f.hint || describeContextField(local))
          + (useIndex
            ? (' Dans {{#' + slug + '[i]}}, i est l’index. Vous pouvez le changer (0, 1, 2…).')
            : (' Champ du bloc « ' + slug + ' ».')),
        type: f.type || '',
        dropKey: slug + '.' + local,
        slug: slug
      });
    }
    if (Array.isArray(nodeOrFields)) {
      nodeOrFields.forEach(pushField);
    } else if (nodeOrFields) {
      contractFieldsForDataNode(nodeOrFields).forEach(pushField);
    }
    if (!fields.length) {
      if (opts.allowEmpty || !expert) return '';
      [
        { key: 'name', label: 'Nom' },
        { key: 'expediteur', label: 'Expediteur' },
        { key: 'sujet', label: 'Sujet' },
        { key: 'texte', label: 'Texte' }
      ].forEach(pushField);
    } else if (expert && !seen.name && !opts.allowEmpty) {
      fields.unshift({
        key: slug + '.item[i].name',
        localKey: 'name',
        slug: slug,
        label: 'Nom',
        insert: '{{' + slug + '.item[i].name}}',
        hint: 'Nom de la ligne. Dans {{#' + slug + '[i]}}.'
      });
    }
    return composeFieldButtonsHtml(fields, opts.node);
  }

  function envelopeExtrasHtml(slug, opts) {
    opts = opts || {};
    var items = [
      {
        key: slug,
        label: 'Boucle sur les lignes',
        snippet: 'ns-loop',
        nsSlug: slug,
        code: '{{#' + slug + '[i]}} … {{/' + slug + '}}',
        hint: 'Insère {{#' + slug + '[i]}} … {{/' + slug + '}}. Changez i (0, 1, 2…) ou gardez i pour parcourir.',
        dropKey: slug
      },
      {
        key: slug + '.item',
        label: 'Item (ligne courante / même index)',
        insert: '{{' + slug + '.item}}',
        hint: 'Dans {{#donnees}}, c’est la ligne n° itemIndex de ce tableau (mail 2 → 2e intention). Hors boucle : première ligne.',
        dropKey: slug + '.item'
      },
      {
        key: slug + '.items',
        label: 'Tableau (toutes les lignes)',
        insert: '{{' + slug + '.items}}',
        hint: describeContextField('items'),
        dropKey: slug + '.items'
      },
      {
        key: slug + '.length',
        label: 'Nombre de lignes',
        insert: '{{' + slug + '.length}}',
        hint: describeContextField('itemsCount'),
        dropKey: slug + '.length'
      },
      {
        key: 'itemIndex',
        label: 'Index de parcours (0…)',
        insert: '{{itemIndex}}',
        hint: describeContextField('itemIndex') + ' À coller dans une boucle {{#' + slug + '}}.'
      },
      {
        key: 'itemNumber',
        label: 'N° de ligne (1…)',
        insert: '{{itemNumber}}',
        hint: describeContextField('itemNumber')
      },
      {
        key: 'i',
        label: 'Index i',
        insert: '{{i}}',
        hint: 'Variable de parcours. Dans {{#' + slug + '[i]}}, i vaut 0, 1, 2… Vous pouvez écrire [0] ou [2] à la place.'
      },
      {
        key: slug + '.item[i]',
        label: 'Item à l’index i',
        insert: '{{' + slug + '.item[i]}}',
        hint: 'Ligne n° i de ce tableau. Ex. {{' + slug + '.item[i].intention}}.'
      },
    ];
    if (opts.globalLoop && slug !== 'donnees') {
      items.unshift({
        key: 'donnees',
        label: 'Boucle globale Entrées',
        snippet: 'ns-loop',
        nsSlug: 'donnees',
        code: '{{#donnees[i]}} … {{/donnees}}',
        hint: 'Alias global : {{#donnees[i]}} … {{/donnees}}.',
        dropKey: 'donnees'
      });
    }
    return composeFieldButtonsHtml(items, opts.node);
  }

  function namespaceGroupTitle(slug, name) {
    var s = String(slug || '').trim();
    var n = String(name || '').trim();
    if (isExpertView()) return s || n || 'Flux';
    return n || s || 'Flux';
  }

  function namespaceGroupHtml(slug, name, fieldsHtml, extrasHtml, node) {
    if (!fieldsHtml && !extrasHtml) return '';
    if (isExpertView()) return tableLoopPickerHtml(slug, name, fieldsHtml, extrasHtml, node);
    var title = namespaceGroupTitle(slug, name);
    var html = '<div class="agent-compose-source" data-item-picker="1">';
    html += '<div class="agent-compose-source-toggle">';
    html += '<span class="agent-compose-source-name">' + escapeHtml(title) + '</span>';
    html += '<button type="button" class="agent-compose-source-btn" data-toggle-source>Ouvrir</button>';
    html += '</div>';
    html += '<div class="agent-compose-ns-fields">';
    html += fieldsHtml || '';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function tableLoopPickerHtml(slug, name, fieldsHtml, extrasHtml, node) {
    var s = String(slug || 'donnees').trim() || 'donnees';
    var label = (name && name !== s) ? (name + ' · ' + s) : (name || s);
    var html = '<div class="agent-compose-source agent-compose-source--table" data-item-picker="1">';
    html += '<div class="agent-compose-source-head">';
    html += '<button type="button" class="agent-compose-source-toggle agent-compose-source-toggle--insert"'
      + ' data-insert-snippet="ns-loop" data-ns-slug="' + escapeHtml(s) + '"'
      + ' data-hint="Cliquez le groupe pour insérer {{#' + s + '[i]}} … {{/' + s + '}}. Changez i si besoin.">'
      + '<span class="agent-compose-source-badge">' + (s === 'donnees' ? 'global' : 'tableau') + '</span>'
      + '<span class="agent-compose-source-name">' + escapeHtml(label) + '</span>'
      + '<code class="agent-compose-source-loop">{{#' + escapeHtml(s) + '[i]}} … {{/' + s + '}}</code>'
      + '</button>';
    html += '<button type="button" class="agent-compose-source-btn" data-toggle-source>Ouvrir</button>';
    html += '</div>';
    if (extrasHtml) html += extrasHtml;
    html += '<div class="agent-compose-loop">';
    html += '<button type="button" class="agent-compose-loop-tag" data-insert-snippet="ns-loop" data-ns-slug="'
      + escapeHtml(s) + '" data-hint="Insère {{#' + s + '[i]}} … {{/' + s + '}}.">'
      + '<code>{{#' + escapeHtml(s) + '[i]}}</code></button>';
    html += '<div class="agent-compose-loop-body">';
    html += '<div class="agent-compose-loop-group">Champs de « ' + escapeHtml(label) + ' »</div>';
    html += fieldsHtml || '';
    html += '</div>';
    html += '<button type="button" class="agent-compose-loop-tag" data-insert-snippet="ns-loop-close" data-ns-slug="'
      + escapeHtml(s) + '" data-hint="Insère {{/' + s + '}}.">'
      + '<code>{{/' + escapeHtml(s) + '}}</code></button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function dataPickersHtml(node) {
    var dataNodes = getUpstreamNodes(node && node.id).filter(function(n) { return n && n.brickId === 'data'; });
    var iaNodes = getUpstreamNodes(node && node.id).filter(function(n) { return n && n.brickId === 'ia'; });
    if (!dataNodes.length && !iaNodes.length) {
      return '';
    }
    var html = '';
    var expert = isExpertView();
    if (expert && dataNodes.length) {
      var hasDonneesSlug = dataNodes.some(function(n) { return ensureNodeSlug(n) === 'donnees'; });
      if (!hasDonneesSlug) {
        html += tableLoopPickerHtml(
          'donnees',
          'Entrées',
          tableRowFieldsHtml(mergedDataRowFields(dataNodes), 'donnees', { node: node }),
          envelopeExtrasHtml('donnees', { node: node }),
          node
        );
      }
    }
    dataNodes.forEach(function(n) {
      var slug = ensureNodeSlug(n);
      var name = n.name || slug || 'Entrées';
      html += namespaceGroupHtml(
        slug,
        name,
        tableRowFieldsHtml(n, slug, { alias: expert, indexed: expert }),
        expert ? envelopeExtrasHtml(slug, { globalLoop: slug !== 'donnees' }) : ''
      );
    });
    iaNodes.forEach(function(n) {
      var slug = ensureNodeSlug(n);
      html += namespaceGroupHtml(
        slug,
        n.name || slug || 'IA',
        tableRowFieldsHtml(iaOutputFieldsForNode(n), slug, { allowEmpty: true, alias: false, indexed: expert }),
        expert ? envelopeExtrasHtml(slug) : ''
      );
    });
    return html;
  }

  function itemPickerHtml(node) {
    var rowFields = itemRowFieldsForCompose(node).map(function(f) {
      return {
        key: f.localKey || String(f.key || '').replace(/^item\./, ''),
        label: f.label,
        hint: f.hint,
        type: f.type
      };
    });
    if (!rowFields.length) return '';
    var slug = upstreamDataSlug(node);
    if (!slug) return '';
    return namespaceGroupHtml(slug, 'Entrées', tableRowFieldsHtml(rowFields, slug, { node: node }), isExpertView() ? envelopeExtrasHtml(slug, { node: node }) : '', node);
  }

  function composeSidebarHtml(pack, node) {
    var html = '<aside class="agent-compose-side">';
    html += '<div class="agent-compose-side-tabs" data-math-tabs>';
    html += '<button type="button" class="agent-compose-side-tab is-active" data-side-tab="flux">Flux</button>';
    html += '<button type="button" class="agent-compose-side-tab" data-side-tab="math">Math</button>';
    html += '</div>';
    html += '<div data-tab-panel="flux">';
    html += '<h3>Insérer depuis le flux</h3>';
    if (isExpertView()) {
      html += '<p class="empty" style="margin:0 0 10px;">Cliquez un groupe : <code>{{#donnees[i]}}</code>. Changez <code>i</code> (0, 1, 2…). Dedans : <code>{{ia.item[i].intention}}</code>.</p>';
    } else {
      html += '<p class="empty" style="margin:0 0 10px;">Champs groupés par bloc. Cliquez un nom pour l’insérer.</p>';
    }
    html += dataPickersHtml(node);
    html += composeSourceGroupsHtml(pack, false);
    html += '</div>';
    html += '<div data-tab-panel="math" hidden>';
    html += '<h3>Opérations</h3>';
    html += '<div class="agent-compose-ops">';
    MATH_OPS().forEach(function(op) {
      html += '<button type="button" class="agent-compose-chip agent-compose-chip--op" data-insert="'
        + escapeHtml(op.insert) + '" title="' + escapeHtml(op.label) + '">' + escapeHtml(op.label) + '</button>';
    });
    html += '</div>';
    html += '<h3 style="margin-top:14px;">Champs nombre</h3>';
    html += composeSourceGroupsHtml(pack, true);
    html += '</div>';
    html += '</aside>';
    return html;
  }

  function actionComposeEditorHtml(node) {
    ensureComposeZones(node);
    pruneOutputMaps(node);
    var pack = composeInsertGroups(node);
    var vars = node.config.variables || [];
    var presetId = suggestZonePresetId(node);
    var preset = getZonePreset(presetId);
    var tab = node.config.activeComposeTab || 'fields';
    var tabOutput = tab !== 'fields' ? state.nodes.find(function(n) { return n.id === tab; }) : null;
    if (tab !== 'fields' && !tabOutput) {
      tab = 'fields';
      node.config.activeComposeTab = 'fields';
    }
    var html = '<div class="agent-compose" data-side-tab="flux">';
    html += '<div class="agent-compose-main">';
    html += composeTabsHtml(node);
    if (node.config.pickingOutput) {
      html += outputPickerHtml(node);
    }
    html += '<div class="agent-compose-toolbar">';
    html += '<button type="button" class="agent-compose-chip" data-map-an-output="1">Mapper une sortie</button>';
    if (tab === 'fields') {
      html += '<button type="button" class="agent-compose-chip" data-add-zone="1">+ Champ</button>';
      if (preset && presetId !== 'output.mail' && presetId !== 'output.mail.digest' && presetId !== 'output.facebook') {
        html += '<button type="button" class="agent-compose-chip" data-apply-zone-preset="' + escapeHtml(presetId) + '">'
          + escapeHtml(presetChipLabel(presetId, preset)) + '</button>';
      }
      if (isExpertView() && presetId === 'output.mail') {
        html += '<button type="button" class="agent-compose-chip" data-fill-mail-digest="1" title="Un seul mail qui liste toutes les lignes reçues">Lister les mails dans le corps</button>';
      }
    } else {
      html += '<button type="button" class="agent-compose-chip" data-remove-output-map="'
        + escapeHtml(tab) + '">Retirer cet onglet</button>';
    }
    html += '</div>';
    if (tabOutput) {
      html += outputMapEditorHtml(node, tabOutput);
    } else {
      var dataSlug = upstreamDataSlug(node) || 'donnees';
      if (isExpertView()) {
        html += '<p class="empty" style="margin:0 0 10px;">Champs libres de l’action, disponibles ensuite en <code>{{'
          + escapeHtml(ensureNodeSlug(node)) + '.cle}}</code>. Les sorties ont leurs propres onglets.</p>';
      } else {
        html += '<p class="empty" style="margin:0 0 10px;">Champs hors sorties. Pour un mail ou un commentaire, utilisez <strong>Mapper une sortie</strong>.</p>';
      }
      if (!vars.length) {
        html += '<div class="agent-compose-empty">Aucun champ libre. Ajoutez-en avec + Champ'
          + (preset && presetId !== 'output.mail' && presetId !== 'output.facebook'
            ? ', ou « ' + escapeHtml(presetChipLabel(presetId, preset)) + ' »' : '')
          + '.</div>';
      }
      vars.forEach(function(v) {
        var type = normalizeComposeFieldType(v.type);
        var isArea = type === 'textarea' || type === 'array';
        var contractField = actionContractField(node, v.key);
        var requiredLocked = !!contractField;
        var required = requiredLocked ? !!contractField.required : !!v.required;
        html += '<div class="agent-compose-field-block" data-field-block="' + escapeHtml(v.key) + '" data-field-type="' + escapeHtml(type) + '">';
        html += '<div class="agent-compose-field-head">'
          + '<input type="text" class="agent-compose-name" data-field-label="' + escapeHtml(v.key) + '" value="'
          + escapeHtml(v.label || v.key) + '" placeholder="Nom du champ" title="Nom du champ">'
          + '<code data-field-slug="' + escapeHtml(v.key) + '">{{' + escapeHtml(ensureNodeSlug(node) + '.' + v.key) + '}}</code>'
          + fieldTypeSelectHtml(type, 'data-set-field-type', v.key);
        html += '<div class="agent-compose-flags">';
        if (requiredLocked) {
          if (required) {
            html += '<span class="agent-compose-req is-locked" title="Imposé par le contrat du bloc suivant">Obligatoire</span>';
          }
        } else {
          html += '<label class="agent-compose-req agent-check" title="Champ obligatoire">'
            + '<input type="checkbox" data-set-field-required="' + escapeHtml(v.key) + '"' + (required ? ' checked' : '') + '>'
            + '<span>Obligatoire</span></label>';
        }
        html += '</div>';
        html += '<button type="button" class="agent-compose-zone-remove" data-remove-zone="' + escapeHtml(v.key) + '" title="Retirer">×</button>'
          + '</div>';
        if (v.description) html += '<p class="empty" style="margin:0 0 6px;">' + escapeHtml(v.description) + '</p>';
        if (type === 'number') {
          html += '<input type="text" data-field-key="' + escapeHtml(v.key) + '" class="form-control agent-compose-editor agent-compose-editor--field agent-compose-editor--number" placeholder="'
            + escapeHtml(isExpertView() ? (v.placeholder || '{{prix}} * {{quantite}}') : 'Formule') + '" value="' + escapeHtml(zoneValue(node, v.key)) + '">';
        } else if (isArea) {
          html += '<textarea data-field-key="' + escapeHtml(v.key) + '" rows="5" class="form-control agent-compose-editor agent-compose-editor--field" placeholder="'
            + escapeHtml(composeInputPlaceholder(v, node)) + '">' + escapeHtml(zoneValue(node, v.key)) + '</textarea>';
        } else {
          html += '<input type="text" data-field-key="' + escapeHtml(v.key) + '" class="form-control agent-compose-editor agent-compose-editor--field" placeholder="'
            + escapeHtml(composeInputPlaceholder(v, node)) + '" value="' + escapeHtml(zoneValue(node, v.key)) + '">';
        }
        html += '</div>';
      });
    }
    html += '</div>';
    html += composeSidebarHtml(pack, node);
    html += '</div>';
    return html;
  }

  function templateUsageForNode(node) {
    if (!node) return '';
    if (node.brickId === 'ia') return 'ia';
    if (node.brickId === 'output' && isCollectionOutput(node)) return '';
    if (node.brickId === 'output') return 'output';
    if (node.brickId === 'validation' || node.brickId === 'human-doc-review') return 'validation';
    if (isHookComposeAction(node)) return 'hook';
    return '';
  }

  function nodeProvider(node) {
    var p = String((node && node.config && node.config.provider) || '').trim().toLowerCase();
    if (p === 'email') return 'mail';
    if (p) return p;
    if (!node || node.brickId !== 'output') return '';
    var cid = String((node.config && node.config.connectorId) || '').trim();
    if (!cid) return '';
    var fromCid = providerFromConnectorId(cid);
    if (fromCid === 'http') return 'webhook';
    return fromCid || '';
  }

  function normalizeListedKind(kind) {
    var k = String(kind || '').trim().toLowerCase();
    if (k === 'a4') return 'canvas';
    if (k.indexOf('prompt') >= 0) return 'prompt';
    if (k === 'html' || k === 'word' || k === 'canvas' || k === 'prompt') return k;
    return '';
  }

  function allowedKindsForUsage(usage, provider) {
    var u = String(usage || '').toLowerCase();
    var p = String(provider || '').toLowerCase();
    if (u === 'ia') return ['prompt'];
    if (u === 'output' && (p === 'mail' || p === 'email')) return ['html'];
    if (u === 'hook' || u === 'page') return ['html'];
    if (u === 'output' || u === 'validation') return ['html', 'word', 'canvas'];
    return [];
  }

  function templatesCacheKey(usage, provider) {
    var u = String(usage || '').trim();
    var p = String(provider || '').trim().toLowerCase();
    if (u === 'output' && p) return u + ':' + p;
    return u;
  }

  function templatesForUsage(usage, list, provider) {
    var allowed = allowedKindsForUsage(usage, provider);
    return (Array.isArray(list) ? list : []).filter(function(tpl) {
      return allowed.indexOf(normalizeListedKind(tpl && tpl.kind)) >= 0;
    });
  }

  function nodeTemplateId(node) {
    return String((node && node.config && node.config.templateId) || '').trim();
  }

  function prefetchBoundTemplates() {
    var pending = [];
    var seen = {};
    function queue(id) {
      var tid = String(id || '').trim();
      if (!tid || seen[tid] || state.blockTemplateDetails[tid]) return;
      seen[tid] = true;
      pending.push(loadBlockTemplateDetails(tid));
    }
    state.nodes.forEach(function(n) {
      queue(nodeTemplateId(n));
      var subs = n && n.config && n.config.subTemplates;
      if (subs && typeof subs === 'object') {
        Object.keys(subs).forEach(function(hole) { queue(subs[hole]); });
      }
    });
    if (!pending.length) return;
    Promise.all(pending).then(function() {
      renderCanvas();
      renderConfig();
    });
  }

  function nodeSubTemplates(node) {
    var raw = node && node.config && node.config.subTemplates;
    return (raw && typeof raw === 'object') ? raw : {};
  }

  function emptyVizDesign() {
    return {
      templateId: '',
      logoUrl: '',
      prompt: 'Page web claire : en-tête avec logo, barre d’onglets (données / pièces), cartes De / Sujet / Message / pièces jointes, boutons Valider et Rejeter.',
      colors: { primary: '#1d4ed8', background: '#f1f5f9', surface: '#ffffff', text: '#0f172a', muted: '#64748b' },
      zones: ['nav', 'data']
    };
  }

  function normalizeVizDesign(raw) {
    var base = emptyVizDesign();
    var src = raw && typeof raw === 'object' ? raw : {};
    var colors = src.colors && typeof src.colors === 'object' ? src.colors : {};
    var zones = Array.isArray(src.zones) ? src.zones : base.zones;
    var seen = {};
    var clean = [];
    zones.forEach(function(z) {
      var k = String(z || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      if (!k || seen[k]) return;
      seen[k] = true;
      clean.push(k);
    });
    if (clean.indexOf('data') < 0) clean.push('data');
    if (clean.indexOf('nav') < 0) clean.unshift('nav');
    return {
      templateId: String(src.templateId || '').trim(),
      logoUrl: String(src.logoUrl || '').trim(),
      prompt: String(src.prompt || '').trim() || base.prompt,
      colors: {
        primary: colors.primary || base.colors.primary,
        background: colors.background || base.colors.background,
        surface: colors.surface || base.colors.surface,
        text: colors.text || base.colors.text,
        muted: colors.muted || base.colors.muted
      },
      zones: clean
    };
  }

  function currentVizDesign() {
    state.vizDesign = normalizeVizDesign(state.vizDesign);
    return state.vizDesign;
  }

  function readVizDesignFromDom() {
    var d = currentVizDesign();
    var fallback = emptyVizDesign().prompt;
    var promptEl = document.getElementById('vizDesignPrompt');
    if (promptEl) {
      var typed = promptEl.value.trim();
      d.prompt = typed || fallback;
      if (!typed) promptEl.value = fallback;
    } else if (!String(d.prompt || '').trim()) {
      d.prompt = fallback;
    }
    var logo = document.getElementById('vizDesignLogo');
    if (logo) d.logoUrl = logo.value.trim();
    ['primary', 'background', 'surface', 'text', 'muted'].forEach(function(key) {
      var el = document.getElementById('vizColor_' + key);
      if (el && el.value) d.colors[key] = el.value;
    });
    state.vizDesign = normalizeVizDesign(d);
    return state.vizDesign;
  }

  function isVizNode(n) {
    return n && (n.brickId === 'validation' || n.brickId === 'human-doc-review');
  }

  function usesSharedDesign(n) {
    return isVizNode(n) && !(n.config && n.config.designShared === false);
  }

  function attachSharedDesign(node) {
    if (!node.config) node.config = {};
    node.config.designShared = true;
    var tid = currentVizDesign().templateId;
    if (tid) node.config.templateId = tid;
  }

  function syncSharedDesignToNodes(templateId) {
    var tid = String(templateId || '').trim();
    if (!tid) return;
    state.nodes.forEach(function(n) {
      if (!usesSharedDesign(n)) return;
      if (!n.config) n.config = {};
      n.config.templateId = tid;
    });
  }

  function vizDesignPreviewHtml(d) {
    var c = (d && d.colors) || emptyVizDesign().colors;
    var html = '<div id="vizDesignPreview" style="margin:0 0 16px;border-radius:10px;overflow:hidden;border:1px solid #334155;background:'
      + escapeHtml(c.background) + ';">';
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:'
      + escapeHtml(c.primary) + ';color:#fff;font-weight:700;font-size:0.8rem;">A · {{page_title}}</div>';
    html += '<div style="display:flex;gap:10px;padding:8px 12px;background:'
      + escapeHtml(c.surface) + ';border-bottom:1px solid #e2e8f0;font-size:0.72rem;font-weight:600;color:'
      + escapeHtml(c.primary) + ';">Données · Pièces · Valider</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px;">';
    html += '<div style="background:' + escapeHtml(c.surface) + ';border-radius:8px;padding:8px;"><span style="font-size:0.65rem;color:'
      + escapeHtml(c.muted) + ';">DE</span><div style="color:' + escapeHtml(c.text) + ';font-weight:700;font-size:0.8rem;">{{from}}</div></div>';
    html += '<div style="background:' + escapeHtml(c.surface) + ';border-radius:8px;padding:8px;"><span style="font-size:0.65rem;color:'
      + escapeHtml(c.muted) + ';">SUJET</span><div style="color:' + escapeHtml(c.text) + ';font-weight:700;font-size:0.8rem;">{{subject}}</div></div>';
    html += '<div style="grid-column:1/-1;background:' + escapeHtml(c.surface) + ';border-radius:8px;padding:8px;"><span style="font-size:0.65rem;color:'
      + escapeHtml(c.muted) + ';">MESSAGE</span><div style="color:' + escapeHtml(c.text) + ';font-size:0.78rem;">{{text}}</div></div>';
    html += '</div></div>';
    return html;
  }

  function vizDesignPanelHtml() {
    var d = currentVizDesign();
    var html = '<div class="agent-viz-design" style="margin:0 0 12px;padding:10px;border:1px solid #1f2937;border-radius:8px;background:#0f172a;">';
    html += '<h4 style="margin:0 0 6px;color:#e2e8f0;">Design de départ</h4>';
    html += '<p class="empty" style="margin:0 0 8px;">Déjà en place : en-tête, onglets, cartes De / Sujet / Message / pièces, boutons Valider et Rejeter. L’IA n’est là que pour ajuster couleurs et zones.</p>';
    html += vizDesignPreviewHtml(d);
    html += '<textarea id="vizDesignPrompt" rows="3" class="form-control" placeholder="Page web claire : en-tête, onglets, cartes…" style="width:100%;margin-bottom:8px;background:#111827;color:#e2e8f0;border-color:#1f2937;">'
      + escapeHtml(d.prompt || emptyVizDesign().prompt) + '</textarea>';
    html += '<button type="button" class="btn-agent" id="btnSuggestVizDesign">Suggérer avec l’IA</button>';
    html += '<p id="vizDesignSuggestStatus" class="empty" style="margin:8px 0 12px;color:#64748b;"></p>';
    html += '<h4 style="margin:16px 0 6px;color:#e2e8f0;">Couleurs, logo, zones</h4>';
    html += '<p class="empty" style="margin:0 0 8px;">Partagé par tous les blocs visualisation, sauf ceux que vous séparez.</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;">';
    [
      ['primary', 'Principal'],
      ['background', 'Fond'],
      ['surface', 'Cartes'],
      ['text', 'Texte'],
      ['muted', 'Secondaire']
    ].forEach(function(pair) {
      html += '<label style="color:#cbd5e1;font-size:0.75rem;">' + pair[1]
        + '<input type="color" id="vizColor_' + pair[0] + '" value="' + escapeHtml(d.colors[pair[0]])
        + '" style="display:block;width:42px;height:28px;padding:0;border:0;background:transparent;"></label>';
    });
    html += '</div>';
    html += '<label style="display:block;color:#cbd5e1;font-size:0.8rem;margin-bottom:8px;">Logo (URL)'
      + '<input id="vizDesignLogo" type="url" class="form-control" placeholder="https://… ou laisser vide" value="'
      + escapeHtml(d.logoUrl) + '" style="width:100%;margin-top:4px;background:#111827;color:#e2e8f0;border-color:#1f2937;"></label>';
    html += '<p class="empty" style="margin:0 0 4px;">Zones : ' + escapeHtml(d.zones.join(', ')) + '</p>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">';
    html += '<input id="vizZoneAdd" type="text" class="form-control" placeholder="Nom de zone (ex. aside)" style="flex:1;min-width:140px;background:#111827;color:#e2e8f0;border-color:#1f2937;">';
    html += '<button type="button" class="btn-agent-ghost" id="btnVizAddZone">Ajouter une zone</button>';
    html += '</div>';
    html += '<button type="button" class="btn-agent" id="btnApplyVizDesign">Appliquer le design partagé</button>';
    html += '<p id="vizDesignStatus" class="empty" style="margin:8px 0 0;color:#64748b;"></p>';
    html += '</div>';
    return html;
  }

  function combineFlowPreview(data) {
    var html = String((data && data.html) || '');
    var css = String((data && data.css) || '');
    if (!css.trim()) return html;
    if (/<style[\s>]/i.test(html)) return html;
    return '<style>' + css + '</style>\n' + html;
  }

  function pickSubAgentExport(flow) {
    var map = (flow && flow.exports && typeof flow.exports === 'object') ? flow.exports : {};
    var names = Object.keys(map);
    if (!names.length) return null;
    var name = map.hook ? 'hook' : (map.chrome ? 'chrome' : names[0]);
    return { name: name, data: map[name] };
  }

  function subAgentEditorHref(fid) {
    var id = String(fid || '').trim();
    var path = String(window.location.pathname || '');
    var params = new URLSearchParams(window.location.search || '');
    var q = 'flowId=' + encodeURIComponent(id);
    var ret = String(params.get('return') || '').trim();
    var space = String(params.get('space') || '').trim();
    if (ret) q += '&return=' + encodeURIComponent(ret);
    if (space) q += '&space=' + encodeURIComponent(space);
    return path + '?' + q;
  }

  function insertableActionFieldsHtml(node) {
    var tid = String((node.config && node.config.subTemplateId) || '');
    var fid = String((node.config && node.config.subFlowId) || '');
    var look = insertablePaletteLook(node);
    var html = '<div style="margin:0 0 12px;padding:10px;border:1px dashed #334155;border-radius:8px;background:#0f172a;">';
    html += '<p class="empty" style="margin:0 0 8px;">Boîte noire. Le flux interne (Entrées flux, actions, Sortie) n’apparaît pas ici — ouvrez le sous-agent.</p>';
    if (isInsertableHookNode(node) || subAgentWantsBlockTrigger(node)) {
      html += blockHookPickerHtml(node);
    }
    if (look && look.iconEmoji) {
      html += '<p style="margin:0 0 8px;font-size:1.2rem;">' + escapeHtml(look.iconEmoji)
        + ' <strong style="color:#e2e8f0;">' + escapeHtml(node.name || 'Sous-action') + '</strong>'
        + (look.hookSurface && look.hookSurface !== 'palette'
          ? ' <span class="agent-node-badge">hook · ' + escapeHtml(hookSurfaceLabel(look.hookSurface)) + '</span>' : '')
        + '</p>';
    }
    if (tid) {
      html += '<p class="empty" style="margin:0 0 8px;">Modèle : <code>' + escapeHtml(tid) + '</code></p>';
    }
    if (fid) {
      html += '<p class="empty" style="margin:0 0 8px;">Instance : <code>' + escapeHtml(fid) + '</code></p>';
      var packedOpen = state.subAgentById[fid];
      if (canOpenSystemAgentEditor(node, packedOpen && !packedOpen._pending ? packedOpen : null)) {
        html += '<a class="btn-agent" href="' + escapeHtml(subAgentEditorHref(fid)) + '">Ouvrir le sous-agent</a>';
      } else {
        html += '<p class="empty" style="margin:0 0 8px;">' + escapeHtml(systemAgentLockedCopy()) + '</p>';
      }
      var packed = packedOpen;
      if (!packed || packed._pending) {
        html += '<p class="empty" id="subAgentPreviewStatus" style="margin:8px 0 0;">Chargement de la sortie flux…</p>';
        if (!packed) {
          loadSubAgentPreview(fid).then(function() { renderConfig(); });
        }
      } else {
        var picked = pickSubAgentExport(packed);
        if (picked && picked.data && (picked.data.html || picked.data.css || picked.data.surface)) {
          html += '<p class="empty" style="margin:8px 0 4px;">Sortie flux <code>' + escapeHtml(picked.name) + '</code>'
            + (picked.data.surface ? ' · surface ' + escapeHtml(String(picked.data.surface)) : '')
            + (picked.data.updatedAt ? ' · ' + escapeHtml(String(picked.data.updatedAt).slice(0, 19).replace('T', ' ')) : '')
            + '</p>';
          if (picked.data.html || picked.data.css) {
            html += '<iframe id="subAgentPreviewFrame" sandbox="" title="Aperçu sortie flux" style="width:100%;height:180px;border:1px solid #1f2937;border-radius:8px;background:#fff;margin-top:4px;"></iframe>';
          }
        } else {
          html += '<p class="empty" style="margin:8px 0 0;">Pas encore de sortie flux. Lancez le sous-agent une fois.</p>';
        }
      }
    } else if (tid) {
      html += '<p class="empty">Pas encore importé — création dans Agents IA.</p>';
      html += '<button type="button" class="btn-agent" id="btnImportSubAgent">Importer / créer l’agent</button>';
    } else {
      html += '<p class="empty">Aucun flux lié. Accrochez un agent à la palette, puis replacez ce bouton.</p>';
    }
    html += '<p id="subAgentStatus" class="empty" style="margin:8px 0 0;color:#64748b;"></p>';
    html += '</div>';
    return html;
  }

  function loadSubAgentPreview(flowId) {
    var id = String(flowId || '').trim();
    if (!id) return Promise.resolve(null);
    var cached = state.subAgentById[id];
    if (cached && !cached._pending) return Promise.resolve(cached);
    if (cached && cached._pending) return Promise.resolve(null);
    state.subAgentById[id] = { _pending: true };
    return fetch(API + '/flows/' + encodeURIComponent(id), { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        var flow = (data && data.flow) || { _id: id, exports: {} };
        if (data && data.systemLocked) flow.systemLocked = true;
        state.subAgentById[id] = flow;
        return flow;
      })
      .catch(function() {
        state.subAgentById[id] = { _id: id, exports: {} };
        return state.subAgentById[id];
      });
  }

  function hookCatalogOptions() {
    var byKey = {};
    (state.hookCatalog || []).forEach(function(row) {
      var surface = String((row && (row.surface || row.value)) || '').trim();
      if (!surface || surface === 'palette') return;
      byKey[surface] = {
        surface: surface,
        label: String(row.label || row.name || surface),
        description: String(row.description || '')
      };
    });
    return Object.keys(byKey).map(function(k) { return byKey[k]; });
  }

  function visualizationSurfaceOptions() {
    return hookCatalogOptions();
  }

  function vizRoleOf(node) {
    if (!node) return 'apply';
    var ups = getUpstreamNodes(node.id);
    var triggers = ups.filter(isTriggerNode);
    var hasRun = triggers.some(function(t) { return triggerModeOf(t) !== 'block'; });
    if (hasRun) return 'apply';
    var hasBlock = triggers.some(function(t) { return triggerModeOf(t) === 'block'; });
    if (hasBlock) return 'choose';
    return 'apply';
  }

  function syncVizRole(node) {
    if (!node || node.brickId !== 'visualization' || !node.config) return;
    node.config.vizRole = vizRoleOf(node);
  }

  function visualizationNodeSummary(node) {
    var config = (node && node.config) || node || {};
    var t = String(config.vizType || 'select');
    if (t === 'page') return 'page (complexe)';
    var role = node && node.id ? vizRoleOf(node) : String(config.vizRole || 'apply');
    var field = String(config.valueField || '').trim();
    var picked = String(config.surface || '').trim();
    if (role === 'apply') return field ? ('ajouter · ' + field) : 'ajouter · champ manquant';
    if (!field) return 'liste · attacher un champ';
    if (!picked) return 'liste · ' + field + ' · non choisi';
    return 'liste · ' + picked;
  }

  function vizCanAttachFrom(n) {
    if (!n) return false;
    if (n.brickId === 'visualization') return true;
    if (n.brickId !== 'data') return false;
    if (isHookCollectionNode(n)) return true;
    var prov = String(resolveDataProvider(n) || '').toLowerCase();
    return prov === 'json' || prov === 'database' || prov === 'flow' || prov === 'flux';
  }

  function vizDirectSources(node) {
    if (!node) return [];
    var seen = {};
    var out = [];
    function push(n) {
      if (!n || seen[n.id] || !vizCanAttachFrom(n)) return;
      seen[n.id] = true;
      out.push(n);
    }
    getIncomingNodes(node.id).forEach(function(n) {
      if (!n) return;
      if (n.brickId === 'data' || n.brickId === 'visualization') {
        push(n);
        return;
      }
      getIncomingNodes(n.id).forEach(push);
    });
    return out;
  }

  function vizContextFields(node) {
    var byKey = {};
    vizDirectSources(node).forEach(function(n) {
      var slug = ensureNodeSlug(n);
      var sourceName = n.name || slug || n.brickId;
      var locals = [];
      if (n.brickId === 'data') {
        var model = (n.config && n.config.modelFields) || [];
        if (model.length) {
          model.forEach(function(f) {
            var key = f && (f.key || f.name);
            if (key) locals.push({ key: key, label: f.label || key });
          });
        } else if (isHookCollectionNode(n) || String((n.config && n.config.presetId) || '') === 'hook') {
          locals = [
            { key: 'surface', label: 'Surface' },
            { key: 'label', label: 'Libellé' },
            { key: 'description', label: 'Description' }
          ];
        }
      } else if (n.brickId === 'visualization') {
        locals = [
          { key: 'surface', label: 'Valeur choisie' },
          { key: 'label', label: 'Libellé' }
        ];
      }
      locals.forEach(function(f) {
        if (!f || !f.key || byKey[slug + '.' + f.key]) return;
        byKey[slug + '.' + f.key] = {
          key: slug + '.' + f.key,
          localKey: f.key,
          label: f.label || f.key,
          source: sourceName,
          slug: slug,
          own: false
        };
      });
    });
    return Object.keys(byKey).map(function(k) { return byKey[k]; });
  }

  function vizPathSlug(path) {
    var s = String(path || '').trim();
    var i = s.indexOf('.');
    return i > 0 ? s.slice(0, i) : '';
  }

  function vizPathLocal(path) {
    var s = String(path || '').trim();
    var i = s.indexOf('.');
    return i > 0 ? s.slice(i + 1) : s;
  }

  function vizSourceNode(node, fieldPath) {
    var slug = vizPathSlug(fieldPath);
    if (!slug) return null;
    return state.nodes.find(function(n) { return String(n.slug || '') === slug; }) || null;
  }

  function vizRowValue(row, localKey) {
    if (!row) return '';
    var key = String(localKey || 'surface').trim() || 'surface';
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
    if (row.surface != null && String(row.surface).trim()) return String(row.surface).trim();
    if (row.id != null && String(row.id).trim()) return String(row.id).trim();
    return '';
  }

  function vizRowLabel(row, localKey) {
    if (!row) return '';
    var key = String(localKey || 'label').trim() || 'label';
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
    if (row.label != null && String(row.label).trim()) return String(row.label).trim();
    if (row.name != null && String(row.name).trim()) return String(row.name).trim();
    return vizRowValue(row, 'surface');
  }

  function vizRowsFromUpstream(node) {
    var src = vizSourceNode(node, node && node.config && node.config.valueField);
    if (src && !vizCanAttachFrom(src)) src = null;
    if (!src) {
      src = vizDirectSources(node).filter(function(n) { return n.brickId === 'data'; })[0] || null;
    }
    if (src && Array.isArray(src.config && src.config.modelRows) && src.config.modelRows.length) {
      return src.config.modelRows;
    }
    if (src && isHookCollectionNode(src)) {
      if (!Array.isArray(state.hookCatalog)) loadHookCatalog();
      return Array.isArray(state.hookCatalog) ? state.hookCatalog : [];
    }
    if (isHookCollectionNode(src) || (node && String((node.config && node.config.collectionPreset) || '') === 'hook')) {
      if (!Array.isArray(state.hookCatalog)) loadHookCatalog();
      return Array.isArray(state.hookCatalog) ? state.hookCatalog : [];
    }
    return [];
  }

  function suggestVizFields(node) {
    if (!node || node.brickId !== 'visualization' || !node.config) return;
    var fields = vizContextFields(node);
    var allowed = {};
    fields.forEach(function(f) { if (f && f.key) allowed[f.key] = true; });
    if (node.config.valueField && !allowed[String(node.config.valueField)]) node.config.valueField = '';
    if (node.config.labelField && !allowed[String(node.config.labelField)]) node.config.labelField = '';
    if (!fields.length) return;
    if (!String(node.config.valueField || '').trim()) {
      var valueHit = fields.find(function(f) { return f.localKey === 'surface'; });
      if (valueHit) node.config.valueField = valueHit.key;
    }
    if (!String(node.config.labelField || '').trim()) {
      var labelHit = fields.find(function(f) { return f.localKey === 'label'; });
      if (labelHit) node.config.labelField = labelHit.key;
    }
  }

  function visualizationFieldsHtml(node) {
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (!node.config.vizType) node.config.vizType = 'select';
    syncVizRole(node);
    suggestVizFields(node);
    if (!Array.isArray(state.hookCatalog)) {
      loadHookCatalog().then(function() { renderConfig(); });
    }
    var vizType = String(node.config.vizType || 'select');
    var vizRole = vizRoleOf(node);
    var valueField = String(node.config.valueField || '').trim();
    var labelField = String(node.config.labelField || '').trim();
    var surface = String(node.config.surface || '').trim();
    var sources = vizDirectSources(node);
    var ctxFields = vizContextFields(node);
    var html = '<div class="agent-viz-simple" style="margin:0 0 12px;padding:10px;border:1px solid #1f2937;border-radius:8px;background:#0f172a;">';
    html += '<p class="empty" style="margin:0 0 10px;">Sans IA. On attache un champ du flux amont, puis on choisit une ligne.</p>';
    html += '<div class="form-group"><label>Type de visualisation</label>';
    html += '<select data-key="vizType">';
    html += '<option value="select"' + (vizType === 'select' ? ' selected' : '') + '>Liste déroulante</option>';
    html += '<option value="page"' + (vizType === 'page' ? ' selected' : '') + '>Page (complexe)</option>';
    html += '</select></div>';
    html += '<p class="empty" style="margin:0 0 10px;">Rôle : <strong style="color:#e2e8f0;">'
      + (vizRole === 'choose' ? 'choisir' : 'ajouter au flux')
      + '</strong> — d’après le déclencheur amont'
      + (vizRole === 'choose' ? ' (sélection de bloc).' : ' (exécution).')
      + '</p>';
    if (vizType === 'page') {
      html += '<p class="empty" style="margin:8px 0 0;">Page complexe = sous-agent Design (chrome, zones). Ce bloc ne la génère pas.</p>';
      html += '</div>';
      return html;
    }
    if (!sources.length) {
      html += '<p class="empty" style="margin:8px 0 0;color:#fbbf24;">Reliez d’abord une liste (ex. Liste hooks) pour proposer Surface / Libellé / Description.</p>';
      html += '</div>';
      return html;
    }
    html += '<div class="form-group"><label>Attacher — valeur</label>';
    html += contextFieldSelectHtml(ctxFields, valueField, 'valueField');
    html += '</div>';
    html += '<div class="form-group"><label>Attacher — libellé</label>';
    html += contextFieldSelectHtml(ctxFields, labelField, 'labelField');
    html += '</div>';
    if (!valueField) {
      html += '<p class="empty" style="margin:8px 0 0;color:#fbbf24;">Choisissez un champ valeur parmi l’amont.</p>';
      html += '</div>';
      return html;
    }
    if (vizRole === 'apply') {
      html += '<p class="empty" style="margin:8px 0 0;">À l’exécution, écrit dans le flux le hook déjà choisi (ce bloc ou le parent). Pas de nouvelle liste.</p>';
      if (surface) {
        html += '<p class="empty" style="margin:6px 0 0;">État sauvé : <strong style="color:#e2e8f0;">'
          + escapeHtml(surface) + '</strong></p>';
      }
      html += '</div>';
      return html;
    }
    var rows = vizRowsFromUpstream(node);
    var localVal = vizPathLocal(valueField);
    var localLab = vizPathLocal(labelField) || 'label';
    html += '<div class="form-group"><label>Hook</label>';
    html += '<select data-key="surface">';
    html += '<option value="">— Choisir —</option>';
    rows.forEach(function(row) {
      var val = vizRowValue(row, localVal);
      if (!val) return;
      var lab = vizRowLabel(row, localLab) || val;
      html += '<option value="' + escapeHtml(val) + '"' + (val === surface ? ' selected' : '') + '>'
        + escapeHtml(lab) + '</option>';
    });
    if (surface && !rows.some(function(row) { return vizRowValue(row, localVal) === surface; })) {
      html += '<option value="' + escapeHtml(surface) + '" selected>' + escapeHtml(surface) + ' — hors liste</option>';
    }
    html += '</select></div>';
    if (!rows.length) {
      html += '<p class="empty" style="margin:6px 0 0;">Aucun hook dans l’amont. Vérifiez la collection du bloc relié.</p>';
    } else if (!surface) {
      html += '<p class="empty" style="margin:6px 0 0;color:#fbbf24;">Aucun hook choisi — l’exécution n’aura pas d’accroche.</p>';
    }
    html += '</div>';
    return html;
  }

  function isBlockTriggerNode(node) {
    return isTriggerNode(node) && triggerModeOf(node) === 'block';
  }

  function blockTriggerAllows(reason) {
    var tr = state.nodes.find(isBlockTriggerNode);
    if (!tr) return false;
    var cfg = tr.config || {};
    if (reason === 'select') return cfg.blockOnSelect !== false;
    if (reason === 'import') return cfg.blockOnImport !== false;
    return true;
  }

  function subAgentWantsBlockTrigger(node) {
    if (!isInsertableAction(node)) return false;
    if (isInsertableHookNode(node)) return true;
    var fid = String((node.config && node.config.subFlowId) || '').trim();
    var packed = fid ? state.subAgentById[fid] : null;
    if (!packed || packed._pending) return false;
    var tcfg = (packed.trigger && packed.trigger.config) || packed.trigger || {};
    var mode = String(tcfg.mode || '').toLowerCase();
    if (mode === 'block' || mode === 'select' || mode === 'import') return true;
    var nodes = packed.canvas && Array.isArray(packed.canvas.nodes) ? packed.canvas.nodes : [];
    return nodes.some(function(n) {
      if (!n || (n.brickId !== 'trigger' && n.kind !== 'trigger')) return false;
      return String((n.config && n.config.mode) || '').toLowerCase() === 'block';
    });
  }

  function shouldRefreshHookList(node, reason) {
    if (!node) return false;
    var wants = node.brickId === 'visualization' || subAgentWantsBlockTrigger(node);
    if (!wants) return false;
    var tr = state.nodes.find(isBlockTriggerNode);
    if (!tr) return true;
    return blockTriggerAllows(reason);
  }

  function refreshHookListForBlock(node, reason) {
    if (!shouldRefreshHookList(node, reason)) return Promise.resolve();
    if (state._hookListRefresh) return state._hookListRefresh;
    state._hookListRefresh = loadHookCatalog().then(function() {
      state._hookListRefresh = null;
      if (node && state.selectedNodeId === node.id) renderConfig();
    }).catch(function() {
      state._hookListRefresh = null;
    });
    return state._hookListRefresh;
  }

  function blockHookPickerHtml(node) {
    if (!node || !node.config) return '';
    if (!Array.isArray(state.hookCatalog)) {
      loadHookCatalog().then(function() { renderConfig(); });
    }
    var current = String(node.config.hookSurface || node.config.surface || '').trim();
    if (current === 'palette') current = '';
    var rows = hookCatalogOptions();
    var html = '<div class="form-group" style="margin:0 0 10px;"><label>Hook</label>';
    html += '<select data-key="hookSurface">';
    html += '<option value="">— Choisir —</option>';
    rows.forEach(function(row) {
      html += '<option value="' + escapeHtml(row.surface) + '"' + (row.surface === current ? ' selected' : '')
        + (row.description ? ' title="' + escapeHtml(row.description) + '"' : '') + '>'
        + escapeHtml(row.label) + '</option>';
    });
    html += '</select>';
    if (!rows.length) {
      html += '<p class="empty" style="margin:6px 0 0;">Chargement de la liste Hook (Surface / Libellé)…</p>';
    } else {
      html += '<p class="empty" style="margin:6px 0 0;">Même liste que la collection Hook — pas le lieu d’accroche du bloc.</p>';
    }
    html += '</div>';
    return html;
  }

  function vizBlockDataHtml(node) {
    var tid = String((node.config && node.config.subTemplateId) || 'agent-design-page-web');
    var fid = String((node.config && node.config.subFlowId) || '');
    var html = '<div style="margin:0 0 12px;padding:10px;border:1px solid #1f2937;border-radius:8px;background:#0f172a;">';
    html += '<p class="empty" style="margin:0 0 8px;">Importe un <strong style="color:#e2e8f0;">vrai agent</strong> (liste Agents IA). Rien n’est caché dans cette brique.</p>';
    html += '<label style="display:block;color:#cbd5e1;font-size:0.8rem;margin-bottom:8px;">Agent GDRI';
    html += '<select data-key="subTemplateId" class="form-control" style="width:100%;margin-top:4px;background:#111827;color:#e2e8f0;border-color:#1f2937;">';
    html += '<option value="agent-design-page-web"' + (tid === 'agent-design-page-web' ? ' selected' : '') + '>Design page web</option>';
    html += '</select></label>';
    if (fid) {
      html += '<p class="empty" style="margin:0 0 8px;">Instance : <code>' + escapeHtml(fid) + '</code></p>';
      var packedOpen = state.subAgentById[fid];
      if (canOpenSystemAgentEditor(node, packedOpen && !packedOpen._pending ? packedOpen : null)) {
        html += '<a class="btn-agent" href="' + escapeHtml(subAgentEditorHref(fid)) + '">Ouvrir l’agent</a>';
      } else {
        html += '<p class="empty" style="margin:0 0 8px;">' + escapeHtml(systemAgentLockedCopy()) + '</p>';
      }
      var packed = packedOpen;
      if (!packed || packed._pending) {
        html += '<p class="empty" id="subAgentPreviewStatus" style="margin:8px 0 0;">Chargement de la sortie flux…</p>';
        if (!packed) {
          loadSubAgentPreview(fid).then(function() { renderConfig(); });
        }
      } else {
        var picked = pickSubAgentExport(packed);
        if (picked && picked.data && (picked.data.html || picked.data.css)) {
          html += '<p class="empty" style="margin:8px 0 4px;">Sortie flux <code>' + escapeHtml(picked.name) + '</code>'
            + (picked.data.updatedAt ? ' · ' + escapeHtml(String(picked.data.updatedAt).slice(0, 19).replace('T', ' ')) : '')
            + '</p>';
          html += '<iframe id="subAgentPreviewFrame" sandbox="" title="Aperçu sortie flux" style="width:100%;height:220px;border:1px solid #1f2937;border-radius:8px;background:#fff;margin-top:4px;"></iframe>';
        } else {
          html += '<p class="empty" style="margin:8px 0 0;">Pas encore de sortie flux. Lancez l’agent Design une fois — on affiche ici le HTML + CSS, pas la collection.</p>';
        }
      }
    } else {
      html += '<p class="empty">Pas encore importé — création dans Agents IA.</p>';
      html += '<button type="button" class="btn-agent" id="btnImportSubAgent">Importer / créer l’agent</button>';
    }
    html += '<p id="subAgentStatus" class="empty" style="margin:8px 0 0;color:#64748b;"></p>';
    html += '</div>';
    return html;
  }

  function importOfficialSubAgent(node) {
    if (!node || !node.config) return Promise.resolve(null);
    var templateId = node.config.subTemplateId || 'agent-design-page-web';
    var statusEl = document.getElementById('subAgentStatus');
    if (statusEl) statusEl.textContent = 'Import de l’agent GDRI…';
    return fetch(API + '/templates/' + encodeURIComponent(templateId) + '/create', {
      method: 'POST',
      headers: headers(),
      body: '{}'
    })
      .then(parseJson)
      .then(function(data) {
        var flow = data && data.flow;
        if (!flow || !(flow._id || flow.id)) {
          throw new Error((data && data.message) || 'Import impossible');
        }
        var importedId = String(flow._id || flow.id);
        delete state.subAgentById[importedId];
        if (state.flowId && importedId === String(state.flowId)) {
          if (statusEl) statusEl.textContent = 'Vous êtes déjà sur cet agent GDRI.';
          return data;
        }
        node.config.subFlowId = importedId;
        node.config.subTemplateId = templateId;
        if (statusEl) statusEl.textContent = (data.created ? 'Agent créé : ' : 'Agent déjà là : ') + (flow.name || templateId);
        renderConfig();
        refreshHookListForBlock(node, 'import');
        return saveFlow({ silent: true });
      })
      .catch(function(err) {
        if (statusEl) statusEl.textContent = err.message;
        return null;
      });
  }

  function hasSurfaceHook(surface) {
    var legacy = state.nodes.some(function(n) {
      if (!isHookAction(n)) return false;
      if (!surface) return true;
      var configured = hookConfiguredSurface(n);
      if (!configured) return true;
      return configured === surface;
    });
    if (legacy) return true;
    var hasList = state.nodes.some(isHookCollectionNode);
    var hookActs = state.nodes.filter(isHookComposeAction);
    if (!surface) return hasList || hookActs.length > 0;
    return hookActs.some(function(n) {
      var raw = String(zoneValue(n, 'surface') || '').trim();
      if (!raw || raw.indexOf('{{') >= 0) return true;
      return raw === surface;
    }) || (!hookActs.length && hasList && surface === 'tab')
      || state.nodes.some(isInsertableHookNode)
      || state.nodes.some(function(n) {
        if (!n || n.brickId !== 'visualization') return false;
        if (String((n.config && n.config.vizType) || 'select') === 'page') return false;
        if (!surface) return true;
        return String((n.config && n.config.surface) || 'panel') === surface;
      });
  }

  function loadPaletteCatalog() {
    return fetch(API + '/atelier/collections/ensure', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ presetId: 'palette', schemaSlug: 'palette', flowId: state.flowId || '' })
    })
      .then(parseJson)
      .then(function(data) {
        state.paletteCatalog = (data && Array.isArray(data.rows)) ? data.rows : [];
        var row = currentPaletteRow();
        if (row) {
          applyPaletteRowToState(row);
          syncPaletteFields();
        }
        return state.paletteCatalog;
      })
      .catch(function() {
        if (!Array.isArray(state.paletteCatalog)) state.paletteCatalog = [];
        return state.paletteCatalog;
      });
  }

  function paletteHookFormHtml() {
    var name = String(state.name || '').trim() || 'Nouvelle sous-action';
    var html = '<div class="agent-palette-hook-form">';
    html += '<h4 style="margin:0 0 8px;color:#e2e8f0;">Accrocher à la palette</h4>';
    html += '<p class="empty" style="margin:0 0 10px;">Ce flux devient un bouton (nom, logo) sous une famille. On le pose ensuite comme une boîte noire — le détail reste dans ce flux.</p>';
    html += '<div class="form-group"><label>Nom du bouton</label>';
    html += '<input type="text" id="paletteHookName" value="' + escapeHtml(name) + '" placeholder="Hook"></div>';
    html += '<div class="form-group"><label>Icône (emoji)</label>';
    html += '<input type="text" id="paletteHookEmoji" value="🪝" placeholder="🪝" maxlength="8"></div>';
    html += '<div class="form-group"><label>Logo (URL)</label>';
    html += '<input type="url" id="paletteHookLogo" placeholder="https://…"></div>';
    html += '<div class="form-group"><label>Famille (où l’accrocher)</label>';
    html += '<select id="paletteHookFamily">';
    [
      ['action', 'Action'],
      ['data', 'Entrées'],
      ['ia', 'IA'],
      ['output', 'Sortie']
    ].forEach(function(pair) {
      html += '<option value="' + pair[0] + '"' + (pair[0] === 'action' ? ' selected' : '') + '>'
        + pair[1] + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form-group"><label>Description</label>';
    html += '<textarea id="paletteHookDesc" rows="2" placeholder="Ce que fait cette sous-action."></textarea></div>';
    html += '<button type="button" class="btn-agent" id="btnConfirmPaletteHook">Accrocher ce flux</button>';
    html += '<button type="button" class="btn-agent-ghost" id="btnCancelPaletteHook" style="margin-left:6px;">Annuler</button>';
    html += '<p id="paletteHookStatus" class="empty" style="margin:8px 0 0;color:#64748b;"></p>';
    html += '</div>';
    return html;
  }

  function bindPaletteHookForm(host) {
    if (!host) return;
    var cancel = host.querySelector('#btnCancelPaletteHook');
    if (cancel) {
      cancel.addEventListener('click', function() {
        state.paletteHookForm = false;
        renderConfig();
      });
    }
    var confirm = host.querySelector('#btnConfirmPaletteHook');
    if (confirm) {
      confirm.addEventListener('click', function() {
        hookCurrentFlowToPalette(host);
      });
    }
  }

  function hookCurrentFlowToPalette(host) {
    readIdentityFromDom();
    var pal = readPaletteFromDom();
    var status = (host && host.querySelector('#paletteHookStatus'))
      || document.getElementById('palettePublishStatus');
    var name = String(state.name || '').trim();
    if (!name) {
      if (status) status.textContent = 'Nom du bloc obligatoire.';
      return Promise.resolve(null);
    }
    var payload = {
      name: name,
      iconEmoji: pal.iconEmoji || '🪝',
      logoUrl: String(state.imageUrl || '').trim(),
      parentFamily: pal.parentFamily || 'action',
      description: String(state.description || pal.description || '').trim(),
      flowId: String(state.flowId || '').trim(),
      templateId: '',
      hookSurface: pal.hookSurface || 'palette',
      rowId: pal.rowId || ''
    };
    function postRow() {
      payload.flowId = String(state.flowId || '').trim();
      if (!payload.flowId) {
        if (status) status.textContent = 'Enregistrez l’agent avant de l’accrocher.';
        return Promise.resolve(null);
      }
      if (status) status.textContent = 'Accroche dans la palette…';
      return fetch(API + '/atelier/palette', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      })
        .then(parseJson)
        .then(function(data) {
          if (!data || !data.success) {
            throw new Error((data && data.message) || 'Accroche impossible');
          }
          state.paletteCatalog = Array.isArray(data.rows) ? data.rows : state.paletteCatalog;
          pal.publish = true;
          pal.rowId = String((data && data.elementId) || pal.rowId || '').trim();
          state.palette = pal;
          state.paletteHookForm = false;
          renderPalette();
          syncPaletteFields();
          updateAgentBlockPreview();
          renderConfig();
          return data;
        })
        .catch(function(err) {
          if (status) status.textContent = err.message;
          return null;
        });
    }
    if (!payload.flowId) {
      if (status) status.textContent = 'Enregistrement de l’agent…';
    }
    return saveFlow({ silent: true }).then(postRow).catch(function(err) {
      if (status) status.textContent = err.message;
      return null;
    });
  }

  function openPaletteHookForm() {
    state.selectedNodeId = null;
    state.selectedLink = null;
    state.paletteHookForm = false;
    setActiveTab('app');
    var section = document.getElementById('agentBlockSection');
    if (section && section.scrollIntoView) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function ensureAtelierCollectionForNode(node) {
    var preset = (node && node.config && (node.config.schemaSlug || node.config.collectionPreset)) || 'design';
    return fetch(API + '/atelier/collections/ensure', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ presetId: preset, schemaSlug: preset, flowId: state.flowId || '' })
    })
      .then(parseJson)
      .then(function(data) {
        if (!data || !data.success) return data;
        if (node && node.config) {
          if (data.catalogId) node.config.collectionId = data.catalogId;
          else if (data.collectionId) node.config.collectionId = data.collectionId;
          if (data.schemaSlug) node.config.schemaSlug = data.schemaSlug;
          if (data.slug) node.config.collectionNamespace = data.slug;
        }
        state._atelierPack = data;
        return loadDocCollections(true).then(function() {
          renderConfig();
          return data;
        });
      })
      .catch(function() { return null; });
  }

  function visualizationIncludeHoles(node) {
    var packed = nodeTemplateId(node) && state.blockTemplateDetails[nodeTemplateId(node)];
    var fromTpl = (packed && packed.template && Array.isArray(packed.template.includes))
      ? packed.template.includes.filter(Boolean)
      : [];
    var fromCfg = Object.keys(nodeSubTemplates(node));
    var seen = {};
    var out = [];
    fromTpl.concat(fromCfg).concat(currentVizDesign().zones || ['nav', 'data']).forEach(function(name) {
      var k = String(name || '').trim();
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(k);
    });
    return out;
  }

  function visualizationFillSlots(node) {
    var collected = [];
    var seen = {};
    function addSlots(slots) {
      (slots || []).forEach(function(s) {
        var k = s && s.key ? String(s.key).trim() : '';
        if (!k || seen[k]) return;
        seen[k] = true;
        collected.push(s);
      });
    }
    var subs = nodeSubTemplates(node);
    Object.keys(subs).forEach(function(hole) {
      var packed = state.blockTemplateDetails[String(subs[hole] || '').trim()];
      if (packed) addSlots(packed.slots);
    });
    if (!collected.length) addSlots(templateSlotsForNode(node));
    return collected;
  }

  function buildFillPromptFromSlots(slots) {
    var list = (slots || []).map(function(s) {
      return '- "' + s.key + '" : ' + (s.label || s.key);
    }).join('\n');
    return 'Remplis UNIQUEMENT le JSON demandé. N’invente rien : si une info manque, laisse "".\n\n'
      + 'Champs :\n' + list + '\n\n'
      + 'Sujet : {{subject}}\nDe : {{from}}\nTexte :\n{{text}}\nAnalyse amont :\n{{response}}';
  }

  function stampIaFromDocSlots(iaNode, slots) {
    if (!iaNode || iaNode.brickId !== 'ia') return;
    var fillable = (slots || []).filter(function(s) { return s && s.key; });
    if (!fillable.length) return;
    var hint = '{\n' + fillable.map(function(s) {
      return '  "' + s.key + '": ""';
    }).join(',\n') + '\n}';
    stampIaOutputContract(iaNode, fillable.map(function(s) {
      return { key: s.key, label: s.label || s.key, type: s.type || 'text' };
    }), hint, 'json');
    ensureMappingConfig(iaNode);
    var hasPrompt = String((iaNode.config.literals && iaNode.config.literals.prompt) || '').trim()
      || (iaNode.config.mapping && iaNode.config.mapping.prompt && iaNode.config.mapping.prompt !== '__literal__');
    if (!hasPrompt) {
      iaNode.config.mapping.prompt = '__literal__';
      iaNode.config.literals.prompt = buildFillPromptFromSlots(fillable);
    }
  }

  function stampPairedPromptFromDocSlots(vizNode) {
    var slots = visualizationFillSlots(vizNode);
    if (!slots.length) return;
    iaNodesForVisualization(vizNode).forEach(function(ia) {
      stampIaFromDocSlots(ia, slots);
    });
  }

  function brickInputContractFields(node) {
    if (!node) return [];
    var brick = getBrick(node.brickId) || {};
    var fields = (brick.inputContract && Array.isArray(brick.inputContract.fields))
      ? brick.inputContract.fields
      : [];
    if (!fields.length && node.brickId === 'ia') {
      fields = [
        { key: 'prompt', label: 'Prompt', required: true },
        { key: 'context', label: 'Contexte', required: false },
        { key: 'rag', label: 'RAG', required: false },
        { key: 'llmId', label: 'Modèle', required: false },
        { key: 'temperature', label: 'Température', required: false, advanced: true, type: 'number' },
        { key: 'maxTokens', label: 'Max tokens', required: false, advanced: true, type: 'number' }
      ];
    }
    if (isHookAction(node)) {
      return hookInputContractFields();
    }
    if (node.brickId === 'output' && isFlowOutput(node)) {
      ensureFlowExportFields(node);
      return [];
    }
    if (!fields.length && node.brickId === 'output') {
      fields = [
        { key: 'to', label: 'Destinataire', required: true, providers: ['mail'] },
        { key: 'subject', label: 'Sujet', required: false, providers: ['mail'] },
        { key: 'body', label: 'Corps', required: true, providers: ['mail'] },
        { key: 'attachments', label: 'Pièces jointes', required: false, providers: ['mail'] },
        { key: 'message', label: 'Message', required: true, providers: ['facebook'] }
      ];
    }
    if (node.brickId === 'output' && isCollectionOutput(node)) {
      ensureJsonModel(node);
      return (node.config.modelFields || []).filter(function(f) {
        return f && f.key;
      }).map(function(f) {
        return {
          key: f.key,
          label: f.label || f.key,
          required: !!f.required,
          advanced: false,
          type: f.type || 'text',
          overlay: true
        };
      });
    }
    var provider = nodeProvider(node);
    return fields.filter(function(f) {
      if (!f || !f.key) return false;
      var allowed = Array.isArray(f.providers) ? f.providers : [];
      if (!allowed.length) return true;
      if (!provider) return false;
      return allowed.indexOf(provider) !== -1;
    }).map(function(f) {
      return {
        key: f.key,
        label: f.label || f.key,
        required: !!f.required,
        advanced: !!f.advanced,
        type: f.type || 'text',
        overlay: f.overlay !== false
      };
    });
  }

  function templateStudioBase() {
    return String(cfg.docTemplateUrl || '').replace(/\/$/, '');
  }

  function templateStudioEditUrl(template) {
    var id = String((template && (template.id || template._id)) || '').trim();
    var base = templateStudioBase();
    if (!id) return base + '/templates';
    var kind = String((template && template.kind) || '').toLowerCase();
    if (kind === 'canvas' || kind === 'a4') {
      var editor = String(cfg.docEditorBaseUrl || '').trim();
      if (editor) {
        var sep = editor.indexOf('?') >= 0 ? '&' : '?';
        return editor + sep + 'template=' + encodeURIComponent('v3:' + id)
          + '&return=' + encodeURIComponent(window.location.href);
      }
    }
    if (kind === 'prompt') return base + '/templates/edit/' + encodeURIComponent(id);
    if (kind === 'html') return base + '/templates/edit/' + encodeURIComponent(id);
    if (kind === 'word') return base + '/templates/edit/' + encodeURIComponent(id);
    return base + '/templates/edit/' + encodeURIComponent(id);
  }

  function loadBlockTemplates(usage, force, provider) {
    usage = String(usage || '').trim();
    provider = String(provider || '').trim().toLowerCase();
    if (!usage) return Promise.resolve([]);
    var cacheKey = templatesCacheKey(usage, provider);
    if (!force && Array.isArray(state.blockTemplatesByUsage[cacheKey])) {
      state.blockTemplatesByUsage[cacheKey] = templatesForUsage(usage, state.blockTemplatesByUsage[cacheKey], provider);
      return Promise.resolve(state.blockTemplatesByUsage[cacheKey]);
    }
    var key = '_tplList_' + cacheKey;
    if (state[key] && !force) return state[key];
    var url = API + '/block-templates?usage=' + encodeURIComponent(usage);
    if (provider) url += '&provider=' + encodeURIComponent(provider);
    state[key] = fetch(url, { headers: headers() })
      .then(parseJson)
      .then(function(payload) {
        var list = (payload && payload.templates) || [];
        if (!Array.isArray(list)) list = [];
        list = templatesForUsage(usage, list, provider);
        state.blockTemplatesByUsage[cacheKey] = list;
        state[key] = null;
        return list;
      })
      .catch(function() {
        state.blockTemplatesByUsage[cacheKey] = state.blockTemplatesByUsage[cacheKey] || [];
        state[key] = null;
        return state.blockTemplatesByUsage[cacheKey];
      });
    return state[key];
  }

  function loadBlockTemplateDetails(id, force) {
    id = String(id || '').trim();
    if (!id) return Promise.resolve(null);
    if (!force && state.blockTemplateDetails[id]) return Promise.resolve(state.blockTemplateDetails[id]);
    var key = '_tplDet_' + id;
    if (state[key] && !force) return state[key];
    state[key] = fetch(API + '/block-templates/' + encodeURIComponent(id), { headers: headers() })
      .then(parseJson)
      .then(function(payload) {
        if (!payload || !payload.success) throw new Error((payload && payload.message) || 'Template introuvable');
        var packed = { template: payload.template || {}, slots: payload.slots || [] };
        state.blockTemplateDetails[id] = packed;
        state[key] = null;
        state.nodes.forEach(function(n) {
          if (n && n.brickId === 'ia' && nodeTemplateId(n) === id) {
            iaOutputFieldsForNode(n);
          }
        });
        refreshOpenActionComposeModal();
        return packed;
      })
      .catch(function() {
        state.blockTemplateDetails[id] = { template: { id: id, name: id, kind: '' }, slots: [] };
        state[key] = null;
        return state.blockTemplateDetails[id];
      });
    return state[key];
  }

  function templateSlotsForNode(node) {
    var id = nodeTemplateId(node);
    var packed = id && state.blockTemplateDetails[id];
    return packed && Array.isArray(packed.slots) ? packed.slots : [];
  }

  function parseJsonOutputFields(hint) {
    var text = String(hint || '').trim();
    if (!text) return [];
    var iArr = text.indexOf('[');
    var iObj = text.indexOf('{');
    var slice = text;
    if (iArr >= 0 && (iObj < 0 || iArr < iObj)) {
      var arrEnd = text.lastIndexOf(']');
      if (arrEnd > iArr) slice = text.slice(iArr, arrEnd + 1);
    } else {
      var start = text.lastIndexOf('{');
      var end = text.lastIndexOf('}');
      if (start >= 0 && end > start) slice = text.slice(start, end + 1);
    }
    var obj = null;
    try {
      var parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) {
        obj = parsed.filter(function(row) { return row && typeof row === 'object' && !Array.isArray(row); })[0] || null;
      } else if (parsed && typeof parsed === 'object') {
        obj = parsed;
      }
    } catch (err) {
      obj = null;
    }
    var keys = [];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      keys = Object.keys(obj);
    } else {
      var re = /["“”']([a-zA-Z_][a-zA-Z0-9_]*)["“”']\s*:/g;
      var m = re.exec(slice);
      while (m) {
        keys.push(m[1]);
        m = re.exec(slice);
      }
    }
    var skip = {
      prompt: true, context: true, rag: true, llmId: true, llm: true, model: true,
      temperature: true, maxTokens: true, response: true, rendered: true, success: true,
      type: true, mode: true, item: true, items: true, itemsCount: true, itemIndex: true
    };
    var labels = {
      intention: 'Intention',
      intention_principale: 'Intention',
      confiance: 'Confiance',
      confidence: 'Confiance',
      resume: 'Résumé',
      summary: 'Résumé'
    };
    var seen = {};
    var out = [];
    keys.forEach(function(key) {
      var k = String(key || '').trim();
      if (!k || seen[k] || skip[k]) return;
      seen[k] = true;
      var sample = obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
      var type = 'text';
      if (typeof sample === 'number') type = 'number';
      else if (typeof sample === 'boolean') type = 'boolean';
      else if (sample && typeof sample === 'object') type = Array.isArray(sample) ? 'array' : 'object';
      out.push({
        key: k,
        label: labels[k] || labels[String(k).toLowerCase()] || humanizeFieldKey(k),
        type: type,
        example: sample,
        hint: describeContextField(k)
      });
    });
    return out;
  }

  function stampIaOutputContract(node, fields, hint, format) {
    if (!node || node.brickId !== 'ia') return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (Array.isArray(fields) && fields.length) node.config.outputFields = fields;
    if (hint) node.config.outputHint = String(hint);
    if (format) node.config.outputFormat = String(format);
  }

  function iaOutputFieldsForNode(node) {
    var id = nodeTemplateId(node);
    if (id && !state.blockTemplateDetails[id] && !state['_tplDet_' + id]) {
      loadBlockTemplateDetails(id).then(function() {
        renderConfig();
        refreshOpenActionComposeModal();
      });
    }
    var packed = id && state.blockTemplateDetails[id];
    var tpl = packed && packed.template;
    var prod = findProductionTemplate(node && node.config && node.config.productionTemplateId);
    var cached = node && node.config && Array.isArray(node.config.outputFields)
      ? node.config.outputFields
      : [];
    var fromApi = (tpl && Array.isArray(tpl.outputs)) ? tpl.outputs : [];
    var parsed = parseJsonOutputFields(
      (tpl && tpl.outputHint)
      || (prod && prod.outputHint)
      || (node && node.config && node.config.outputHint)
      || (tpl && tpl.content)
      || ''
    );
    var raw = fromApi.length ? fromApi : (parsed.length ? parsed : cached);
    var fields = (raw || []).map(function(f) {
      if (!f) return null;
      var key = String(f.key || '').trim();
      if (!key) return null;
      return {
        key: key,
        label: f.label || humanizeFieldKey(key),
        type: f.type || 'text',
        example: f.example,
        hint: f.hint || describeContextField(key, f)
      };
    }).filter(Boolean);
    if (fields.length) {
      stampIaOutputContract(
        node,
        fields,
        (tpl && tpl.outputHint) || (prod && prod.outputHint),
        (tpl && tpl.outputFormat) || (prod && prod.outputFormat)
      );
    }
    return fields;
  }

  function contractFieldsForIaNode(node) {
    var out = [];
    var seen = {};
    function push(f) {
      if (!f || !f.key || seen[f.key]) return;
      seen[f.key] = true;
      out.push(f);
    }
    push({ key: 'item', label: 'Item (ligne courante / même index)', type: 'object', hint: describeContextField('item') });
    push({ key: 'items', label: 'Tableau (toutes les lignes)', type: 'array', hint: describeContextField('items') });
    push({ key: 'itemsCount', label: 'Nombre de lignes', type: 'number', hint: describeContextField('itemsCount') });
    push({ key: 'itemIndex', label: 'Index de parcours', type: 'number', hint: describeContextField('itemIndex') });
    push({ key: 'itemNumber', label: 'N° de ligne', type: 'number', hint: describeContextField('itemNumber') });
    iaOutputFieldsForNode(node).forEach(push);
    push({ key: 'response', label: 'Réponse IA (texte brut)', type: 'textarea', hint: describeContextField('response') });
    push({ key: 'rendered', label: 'Prompt envoyé', type: 'textarea', hint: describeContextField('rendered') });
    push({ key: 'success', label: 'Succès', hint: describeContextField('success') });
    push({ key: 'model', label: 'Modèle utilisé', hint: describeContextField('model') });
    return out;
  }

  function loadProductionTemplates(usage, force) {
    var u = String(usage || '').toLowerCase();
    if (!u) return Promise.resolve([]);
    if (!force && Array.isArray(state.productionTemplatesByUsage[u])) {
      return Promise.resolve(state.productionTemplatesByUsage[u]);
    }
    return fetch(API + '/production-templates?usage=' + encodeURIComponent(u), { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        var list = (data && data.templates) || [];
        state.productionTemplatesByUsage[u] = list;
        return list;
      })
      .catch(function() {
        state.productionTemplatesByUsage[u] = state.productionTemplatesByUsage[u] || [];
        return state.productionTemplatesByUsage[u];
      });
  }

  function findProductionTemplate(id) {
    var key = String(id || '').trim();
    if (!key) return null;
    var found = null;
    Object.keys(state.productionTemplatesByUsage || {}).forEach(function(u) {
      (state.productionTemplatesByUsage[u] || []).forEach(function(t) {
        if (t && t.id === key) found = t;
      });
    });
    return found;
  }

  function isUnsuitableEntityLlm(llm, profile) {
    var hay = ((llm && llm.model) || '') + ' ' + ((llm && llm.name) || '') + ' ' + ((llm && llm.id) || '');
    hay = hay.toLowerCase().replace(/[\s_]+/g, ':');
    if (!hay.trim()) return true;
    if (/nomic-embed|embed-text|:embed\b|embedding/.test(hay)) return true;
    if (/llava|vision/.test(hay)) return true;
    if (/deepseek-r1|deepseek-reasoner/.test(hay)) return true;
    if (profile === 'code' && /coder/.test(hay) && /:0\.5b|:1\.5b|:3b\b/.test(hay)) return true;
    return false;
  }

  function scoreLlmAgainstPrefer(llm, prefer, profile) {
    if (isUnsuitableEntityLlm(llm, profile)) return -1;
    var hay = ((llm && llm.model) || '') + ' ' + ((llm && llm.name) || '') + ' ' + ((llm && llm.id) || '');
    hay = hay.toLowerCase().replace(/[\s_]+/g, ':');
    var best = -1;
    (prefer || []).forEach(function(raw, i) {
      var needle = String(raw || '').toLowerCase().replace(/[\s_]+/g, ':');
      if (!needle || hay.indexOf(needle) < 0) return;
      var score = 120 - i * 5 + Math.min(12, needle.length);
      if (score > best) best = score;
    });
    if (llm && llm.isDefault && best < 0) best = 8;
    return best;
  }

  function pickEntityLlmForTemplate(tpl) {
    var prefer = (tpl && tpl.model && Array.isArray(tpl.model.prefer)) ? tpl.model.prefer : [];
    var profile = (tpl && tpl.model && tpl.model.profile) || '';
    var list = (state.entityLlms || []).filter(function(llm) {
      return llm && !isUnsuitableEntityLlm(llm, profile);
    });
    var best = null;
    var bestScore = -1;
    list.forEach(function(llm) {
      var score = scoreLlmAgainstPrefer(llm, prefer, profile);
      if (score > bestScore) {
        bestScore = score;
        best = llm;
      }
    });
    if (!best && list.length) {
      best = list.filter(function(l) { return l.isDefault; })[0] || list[0];
    }
    return best;
  }

  function applyProductionTemplateToNode(node, tpl) {
    if (!node || !tpl) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    node.config.productionTemplateId = String(tpl.id || '').trim();
    if (node.brickId === 'ia') {
      ensureMappingConfig(node);
      if (tpl.outputHint) node.config.outputHint = String(tpl.outputHint);
      if (tpl.outputFormat) node.config.outputFormat = String(tpl.outputFormat);
      var parsed = parseJsonOutputFields(tpl.outputHint || '');
      if (parsed.length) stampIaOutputContract(node, parsed, tpl.outputHint, tpl.outputFormat);
      var llm = pickEntityLlmForTemplate(tpl);
      if (llm && llm.id) {
        node.config.mapping.llmId = '__literal__';
        node.config.literals.llmId = llm.id;
      }
      if (tpl.model && tpl.model.temperature != null) {
        node.config.mapping.temperature = '__literal__';
        node.config.literals.temperature = String(tpl.model.temperature);
      }
      if (tpl.model && tpl.model.maxTokens) {
        node.config.mapping.maxTokens = '__literal__';
        node.config.literals.maxTokens = String(tpl.model.maxTokens);
      }
    }
  }

  function docApiBase() {
    return (cfg.docApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/agent-documentaire-v2')).replace(/\/$/, '');
  }

  function iaNodesForVisualization(vizNode) {
    var incoming = getIncomingNodes(vizNode && vizNode.id).filter(function(n) {
      return n && n.brickId === 'ia';
    });
    if (incoming.length) return incoming;
    return state.nodes.filter(function(n) { return n && n.brickId === 'ia'; });
  }

  function stampPairedPromptFromViz(vizNode, vizTpl) {
    var pairId = String((vizTpl && vizTpl.pairsWith) || '').trim();
    if (!pairId) return Promise.resolve();
    return loadProductionTemplates('ia').then(function() {
      var pair = findProductionTemplate(pairId);
      if (!pair) return;
      iaNodesForVisualization(vizNode).forEach(function(ia) {
        applyProductionTemplateToNode(ia, pair);
      });
    });
  }

  function instantiateVisualizationPage(node, tpl) {
    if (!node || !tpl || tpl.kind === 'prompt') return Promise.resolve('');
    function run() {
      var ns = resolveBlockPageNamespace(node);
      var ctx = collectPageGenerationContext(node, { namespace: ns });
      storePageEditorContext(ctx);
      return fetch(API + '/production-templates/' + encodeURIComponent(tpl.id), { headers: headers() })
        .then(parseJson)
        .then(function(data) {
          if (!data.success || !data.html) throw new Error('Gabarit HTML introuvable');
          return fetch(docApiBase() + '/templates/' + encodeURIComponent(ns) + '/ensure-page', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              force: true,
              name: tpl.title || (node.name || 'Page'),
              productionTemplateId: tpl.id,
              html: data.html,
              agentPageContext: ctx
            })
          });
        })
        .then(parseJson)
        .then(function(data) {
          if (!data.success) throw new Error(data.error || data.message || 'Création de page impossible');
          if (!node.config) node.config = {};
          node.config.templateNamespace = ns;
          node.config.visualizationBound = String(tpl.id);
          return ns;
        });
    }
    if (!state.flowId) {
      return saveFlow().then(function() {
        migrateValidationPageNamespaces();
        return run();
      });
    }
    return run();
  }

  function applyVisualizationChoice(node, tpl, opts) {
    opts = opts || {};
    if (!node || !tpl) return Promise.resolve();
    applyProductionTemplateToNode(node, tpl);
    if (node.brickId === 'ia' || tpl.kind === 'prompt') return Promise.resolve();
    var prev = String((node.config && node.config.visualizationBound) || '').trim();
    if (prev && prev === tpl.id && !opts.force) {
      return stampPairedPromptFromViz(node, tpl);
    }
    if (prev && prev !== tpl.id && !opts.force) {
      if (!confirm('Ce bloc a déjà une page. La recréer avec « ' + (tpl.title || tpl.id) + ' » ? Les exécutions suivantes rempliront cette nouvelle page, elles ne la reconstruiront pas à chaque run.')) {
        return Promise.resolve();
      }
    }
    return instantiateVisualizationPage(node, tpl).then(function() {
      return stampPairedPromptFromViz(node, tpl);
    });
  }

  function productionTemplatePanelHtml(node) {
    var usage = templateUsageForNode(node) || (node && node.brickId === 'ia' ? 'ia' : 'validation');
    if (!Array.isArray(state.productionTemplatesByUsage[usage])) {
      loadProductionTemplates(usage).then(function() { renderConfig(); });
    }
    if (node && node.brickId === 'ia' && !state.entityLlmsLoaded) {
      loadEntityLlms().then(function() {
        var cur = findProductionTemplate(node.config && node.config.productionTemplateId);
        if (cur) applyProductionTemplateToNode(node, cur);
        renderConfig();
      });
    }
    var list = state.productionTemplatesByUsage[usage] || [];
    var current = String((node.config && node.config.productionTemplateId) || '').trim();
    var html = '<div class="agent-template-bind" style="margin-bottom:12px;">';
    html += '<h4>Modèle de production</h4>';
    html += '<p class="empty">' + (usage === 'ia'
      ? 'Prompt plateforme : le format de sortie et le modèle LLM suivent le couple choisi. Catalogue : console super-admin → Agents IA.'
      : 'Mise en page plateforme selon la demande. L’IA remplit les champs — elle n’invente pas la page.') + '</p>';
    html += '<select data-production-template-id>';
    html += '<option value=""' + (!current ? ' selected' : '') + '>'
      + (usage === 'ia'
        ? '— Aucun (mapping ou template entité) —'
        : '— Automatique (selon la demande) —')
      + '</option>';
    list.forEach(function(tpl) {
      var modelTag = (tpl.model && tpl.model.label) ? (' · ' + tpl.model.label) : '';
      html += '<option value="' + escapeHtml(tpl.id) + '"' + (tpl.id === current ? ' selected' : '') + '>'
        + escapeHtml(tpl.title) + escapeHtml(modelTag) + '</option>';
    });
    html += '</select>';
    var selected = null;
    list.forEach(function(t) { if (t.id === current) selected = t; });
    if (!selected && current) selected = findProductionTemplate(current);
    if (selected) {
      html += '<p class="empty" style="margin-top:8px;">' + escapeHtml(selected.description || '') + '</p>';
      var bits = [];
      if (selected.model && selected.model.label) {
        var prefer = (selected.model.prefer || []).slice(0, 3).join(', ');
        bits.push('Modèle : ' + selected.model.label + (prefer ? ' (' + prefer + ')' : ''));
      }
      if (selected.pairTitle) {
        bits.push((selected.kind === 'prompt' ? 'Mise en page' : 'Prompt') + ' : ' + selected.pairTitle);
      }
      if (bits.length) {
        html += '<p class="empty" style="margin-top:4px;">' + escapeHtml(bits.join(' · ')) + '</p>';
      }
      var llm = node.brickId === 'ia' ? pickEntityLlmForTemplate(selected) : null;
      if (llm) {
        html += '<p class="empty" style="margin-top:4px;">LLM de l’entité : '
          + escapeHtml(llm.name || llm.model || llm.id)
          + (llm.unmatched ? ' (approximation)' : '') + '</p>';
      }
    } else if (usage === 'ia') {
      html += '<p class="empty" style="margin-top:8px;">Choisissez un prompt de production pour caler la sortie et le modèle (JSON page, intention, extraction…). Sinon le mapping du bloc s’applique.</p>';
    } else {
      html += '<p class="empty" style="margin-top:8px;">Sans choix, le modèle est sélectionné d’après le contexte de l’agent et de cette page. « Page web agent » est le gabarit d’application.</p>';
    }
    html += '</div>';
    return html;
  }

  function templateBindPanelHtml(node) {
    var usage = templateUsageForNode(node);
    if (!usage) return '';
    var provider = nodeProvider(node);
    var cacheKey = templatesCacheKey(usage, provider);
    if (!Array.isArray(state.blockTemplatesByUsage[cacheKey])) {
      loadBlockTemplates(usage, false, provider).then(function() { renderConfig(); });
    }
    var id = nodeTemplateId(node);
    if (id && !state.blockTemplateDetails[id]) {
      loadBlockTemplateDetails(id).then(function() { renderConfig(); });
    }
    var list = templatesForUsage(usage, state.blockTemplatesByUsage[cacheKey] || [], provider);
    var packed = id ? state.blockTemplateDetails[id] : null;
    var boundKind = normalizeListedKind(
      (packed && packed.template && packed.template.kind)
        || (list.filter(function(tpl) { return tpl.id === id; })[0] || {}).kind
    );
    var allowed = allowedKindsForUsage(usage, provider);
    var boundOk = !id || !boundKind || allowed.indexOf(boundKind) >= 0;
    var isMail = usage === 'output' && (provider === 'mail' || provider === 'email');
    var hint = usage === 'ia'
      ? ''
      : (isMail
        ? 'Un template HTML recouvre le corps du mail. Destinataire, sujet et pièces jointes restent à brancher.'
        : 'Un template document recouvre le contenu. Le reste du contrat du bloc se mappe ci-dessous.');
    var html = '<div class="agent-template-bind">';
    html += '<h4>Template</h4>';
    if (hint) html += '<p class="empty">' + hint + '</p>';
    if (id && !boundOk) {
      html += '<p class="empty" style="color:#fb923c;">Ce template (« '
        + escapeHtml((packed && packed.template && packed.template.name) || id)
        + ' » · ' + escapeHtml(templateKindLabel(boundKind || 'prompt'))
        + ') ne convient pas à ce bloc. Choisissez un type autorisé ou « Aucun ».</p>';
    }
    html += '<select data-template-id>';
    html += '<option value="">— Aucun —</option>';
    var groups = usage === 'ia'
      ? [{ kind: 'prompt', label: 'Prompt IA' }]
      : allowed.map(function(kind) {
          return {
            kind: kind,
            label: kind === 'html' ? 'HTML (mail / page)' : (kind === 'word' ? 'Word' : 'Canvas A4')
          };
        });
    groups.forEach(function(group) {
      var items = list.filter(function(tpl) { return normalizeListedKind(tpl.kind) === group.kind; });
      if (!items.length) return;
      html += '<optgroup label="' + escapeHtml(group.label) + '">';
      items.forEach(function(tpl) {
        html += '<option value="' + escapeHtml(tpl.id) + '"' + (tpl.id === id && boundOk ? ' selected' : '') + '>'
          + escapeHtml(tpl.name || 'Sans nom') + '</option>';
      });
      html += '</optgroup>';
    });
    html += '</select>';
    html += templateContractSummaryHtml(node);
    if (!list.length && usage !== 'ia') {
      html += '<p class="empty">Aucun template '
        + escapeHtml(allowed.map(templateKindLabel).join(' / ') || 'compatible')
        + ' pour l’instant.</p>';
    }
    html += '<div class="agent-template-bind-actions">';
    if (usage !== 'ia') {
      html += '<label class="agent-template-kind-label">Type</label>';
    }
    html += '<select data-template-create-kind aria-label="Type de template"'
      + (usage === 'ia' ? ' hidden' : '') + '>';
    if (usage === 'ia') {
      html += '<option value="prompt" selected>Prompt IA</option>';
    } else if (isMail) {
      html += '<option value="html" selected>HTML (mail / page)</option>';
    } else {
      html += '<option value="html">HTML (mail / page)</option>';
      html += '<option value="word">Word (sections)</option>';
      html += '<option value="canvas">Canvas A4</option>';
    }
    html += '</select>';
    html += '<button type="button" class="btn-agent" data-template-create="1">Créer</button>';
    if (id) {
      var editTpl = (packed && packed.template) || {};
      if (!editTpl.kind) {
        var listed = list.find(function(tpl) { return tpl.id === id; });
        editTpl = { id: id, kind: listed ? listed.kind : editTpl.kind, name: editTpl.name };
      }
      html += '<a class="btn-agent-ghost" data-template-edit="1" href="'
        + escapeHtml(templateStudioEditUrl(editTpl))
        + '" target="_blank" rel="noopener">Modifier</a>';
    }
    html += '</div>';
    if (usage === 'validation') html += subTemplatePanelHtml(node, list);
    html += '</div>';
    return html;
  }

  function subTemplateHoleLabel(hole) {
    if (hole === 'data' || hole === 'donnees') return 'Zone données';
    if (hole === 'nav' || hole === 'tabs' || hole === 'onglets') return 'Navigation / onglets';
    return 'Zone « ' + hole + ' »';
  }

  function subTemplatePanelHtml(node, list) {
    var holes = visualizationIncludeHoles(node);
    var packed = nodeTemplateId(node) && state.blockTemplateDetails[nodeTemplateId(node)];
    var declared = (packed && packed.template && packed.template.includes) || [];
    var html = '<div class="agent-subtemplates" style="margin-top:12px;">';
    html += '<h4 style="margin:0 0 6px;">Sous-templates</h4>';
    if (!declared.length) {
      html += '<p class="empty">Dans le template de design, une zone s’écrit <code>{{&gt;nav}}</code> ou <code>{{&gt;data}}</code>. Plusieurs visualisations partagent couleurs et cadre ; seul le contenu des zones change.</p>';
    } else {
      html += '<p class="empty">Même page de base. Seule la zone branchée ici change d’une visualisation à l’autre.</p>';
    }
    var items = (list || []).filter(function(tpl) {
      return normalizeListedKind(tpl.kind) !== 'prompt';
    });
    holes.forEach(function(hole) {
      var current = String(nodeSubTemplates(node)[hole] || '').trim();
      html += '<label style="display:block;margin:8px 0 4px;">' + escapeHtml(subTemplateHoleLabel(hole)) + '</label>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">';
      html += '<select data-sub-template="' + escapeHtml(hole) + '" style="flex:1;min-width:160px;">';
      html += '<option value="">— Même contenu que la base —</option>';
      items.forEach(function(tpl) {
        if (tpl.id === nodeTemplateId(node)) return;
        html += '<option value="' + escapeHtml(tpl.id) + '"' + (tpl.id === current ? ' selected' : '') + '>'
          + escapeHtml(tpl.name || 'Sans nom') + '</option>';
      });
      html += '</select>';
      html += '<button type="button" class="btn-agent-ghost" data-sub-template-create="'
        + escapeHtml(hole) + '">Créer</button>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function templateKindLabel(kind) {
    var k = String(kind || '').toLowerCase();
    if (k === 'prompt') return 'Prompt IA';
    if (k === 'html') return 'HTML';
    if (k === 'canvas' || k === 'a4') return 'Canvas A4';
    if (k === 'word') return 'Word';
    return k || 'Document';
  }

  var DEFAULT_PROMPT_TEMPLATE = 'Tu es l’assistant de tri des messages de l’entreprise. Réponds en français, de façon factuelle.\n\n'
    + 'Classe chaque message dans la liste d’intentions. Le champ JSON "intention" doit être EXACTEMENT un identifiant de la liste (ex. commercial, sav, generic). Le champ "confiance" est un nombre entre 0 et 1 (ne recopie pas la valeur d’exemple). Le champ "resume" est un résumé libre.\n'
    + 'S’il y a N messages, le JSON contient N objets, dans le même ordre.\n\n'
    + '{{#donnees[i]}}\n--- Message {{itemNumber}} ---\nSujet : {{sujet}}\nTexte / corps : {{texte}}\nExpéditeur : {{expediteur}}\n{{/donnees}}\n\n'
    + 'Liste d’intentions :\n{{intentions}}\n\n'
    + 'Réponds uniquement en JSON (tableau, un objet par message) :\n'
    + '[\n  { "intention": "commercial", "confiance": 0.8, "resume": "…" }\n]\n';

  function createBoundTemplate(node) {
    var usage = templateUsageForNode(node);
    var provider = nodeProvider(node);
    var kindSel = document.querySelector('#agentConfig [data-template-create-kind]');
    var kind = String((kindSel && kindSel.value) || (usage === 'ia' ? 'prompt' : 'html')).toLowerCase();
    if (usage === 'ia') kind = 'prompt';
    else if (kind === 'prompt' || allowedKindsForUsage(usage, provider).indexOf(kind) < 0) kind = 'html';
    var names = { prompt: 'Prompt agent', html: 'Template HTML', word: 'Template Word', canvas: 'Template Canvas' };
    var name = names[kind] || 'Template agent';
    var brick = getBrick(node.brickId) || {};
    var contract = {
      brickId: node.brickId,
      version: String((brick.inputContract && brick.inputContract.version) || brick.version || '1.0.0')
    };
    var body = { name: name, kind: kind, blockContract: contract };
    if (kind === 'prompt') {
      body.content = DEFAULT_PROMPT_TEMPLATE;
      body.promptConfig = {
        preset: 'intention',
        contract: contract,
        values: {
          context: 'Tu es l’assistant de tri des messages de l’entreprise. Réponds en français, de façon factuelle.',
          prompt: 'Classe chaque message dans la liste d’intentions. Le champ "intention" doit être EXACTEMENT un identifiant de la liste (ex. commercial, sav, generic). Le champ "confiance" est un nombre entre 0 et 1 (ne recopie pas la valeur d’exemple). Le champ "resume" est un résumé libre.\nS’il y a N messages, le JSON contient N objets, dans le même ordre.\n\n{{#donnees[i]}}\n--- Message {{itemNumber}} ---\nSujet : {{sujet}}\nTexte / corps : {{texte}}\nExpéditeur : {{expediteur}}\n{{/donnees}}\n\nListe d’intentions :\n{{intentions}}',
          rag: ''
        },
        role: 'Tu es l’assistant de tri des messages de l’entreprise. Réponds en français, de façon factuelle.',
        instruction: 'Identifie l’intention de chaque message parmi la liste fournie. Si aucune ne convient, utilise « generic ». S’il y a N messages, le JSON contient N objets, même ordre.',
        outputFormat: 'json',
        outputHint: '[\n  { "intention": "commercial", "confiance": 0.8, "resume": "…" }\n]',
        variables: ['subject', 'text', 'from', 'intentions'],
        fills: { prompt: true, context: true, rag: false }
      };
      body.inputSources = [];
      body.defaultCollection = {
        alias: 'prompt',
        fields: []
      };
    } else if (node.brickId === 'output' || node.brickId === 'validation') {
      body.fills = node.brickId === 'output'
        ? { body: true, message: true }
        : { body: true };
      body.promptConfig = {
        contract: contract,
        fills: body.fills
      };
      if (kind === 'html' && node.brickId === 'validation') {
        body.content = '<article class="agent-viz-page">\n'
          + '  <header class="viz-top"><div class="viz-brand">{{page_title}}</div></header>\n'
          + '  <section class="viz-zone viz-zone-nav" data-zone="nav">{{>nav}}</section>\n'
          + '  <section class="viz-zone viz-zone-data" data-zone="data">{{>data}}</section>\n'
          + '</article>\n';
      }
    }
    return docTemplateFetch('/templates', { method: 'POST', body: body })
      .then(function(res) {
        if (!res || !res.success || !res.data) throw new Error((res && (res.error || res.message)) || 'Création impossible');
        var created = res.data;
        var newId = String(created._id || created.id || '');
        if (!node.config) node.config = {};
        node.config.templateId = newId;
        state.blockTemplatesByUsage[templatesCacheKey(usage, provider)] = null;
        window.open(templateStudioEditUrl({ id: newId, kind: kind, name: created.name }), '_blank', 'noopener');
        return loadBlockTemplates(usage, true, provider).then(function() {
          return loadBlockTemplateDetails(newId, true);
        }).then(function() {
          renderConfig();
        });
      })
      .catch(function(err) {
        alert((err && err.message) || 'Impossible de créer le template');
      });
  }

  function createSubTemplate(node, hole) {
    var zone = String(hole || 'data').trim() || 'data';
    var usage = templateUsageForNode(node);
    var provider = nodeProvider(node);
    var brick = getBrick(node.brickId) || {};
    var contract = {
      brickId: node.brickId,
      version: String((brick.inputContract && brick.inputContract.version) || brick.version || '1.0.0')
    };
    var body = {
      name: zone === 'data' ? 'Zone données' : ('Zone ' + zone),
      kind: 'html',
      blockContract: contract,
      fills: { body: true },
      content: '<section class="agent-zone-' + zone + '">\n'
        + '  <h2>{{title}}</h2>\n'
        + '  <p>{{text}}</p>\n'
        + '</section>\n'
    };
    return docTemplateFetch('/templates', { method: 'POST', body: body })
      .then(function(res) {
        if (!res || !res.success || !res.data) throw new Error((res && (res.error || res.message)) || 'Création impossible');
        var created = res.data;
        var newId = String(created._id || created.id || '');
        if (!node.config) node.config = {};
        if (!node.config.subTemplates || typeof node.config.subTemplates !== 'object') {
          node.config.subTemplates = {};
        }
        node.config.subTemplates[zone] = newId;
        state.blockTemplatesByUsage[templatesCacheKey(usage, provider)] = null;
        window.open(templateStudioEditUrl({ id: newId, kind: 'html', name: created.name }), '_blank', 'noopener');
        return loadBlockTemplates(usage, true, provider).then(function() {
          return loadBlockTemplateDetails(newId, true);
        }).then(function() {
          stampPairedPromptFromDocSlots(node);
          renderConfig();
        });
      })
      .catch(function(err) {
        alert((err && err.message) || 'Impossible de créer le sous-template');
      });
  }

  function listedTemplateForNode(node) {
    var id = nodeTemplateId(node);
    if (!id) return null;
    var usage = templateUsageForNode(node);
    var cacheKey = templatesCacheKey(usage, nodeProvider(node));
    var list = state.blockTemplatesByUsage[cacheKey] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function applyFillsOverlay(overlay, fills) {
    if (!fills || typeof fills !== 'object') return false;
    var any = false;
    Object.keys(fills).forEach(function(k) {
      if (fills[k]) {
        overlay[k] = true;
        any = true;
      }
    });
    return any;
  }

  function templateOverlayForNode(node) {
    var overlay = {};
    var id = nodeTemplateId(node);
    if (!id) return overlay;
    var packed = state.blockTemplateDetails[id];
    var fills = packed && packed.template && packed.template.fills;
    if (!fills) {
      var listed = listedTemplateForNode(node);
      if (listed && listed.fills) fills = listed.fills;
    }
    if (fills && typeof fills === 'object') {
      applyFillsOverlay(overlay, fills);
    }
    if (!packed) {
      if (node.brickId === 'ia' && !Object.keys(overlay).length) overlay.prompt = true;
      if ((node.brickId === 'output' || node.brickId === 'validation') && !overlay.body) {
        overlay.body = true;
        overlay.message = true;
      }
      return overlay;
    }
    var kind = String((packed.template && packed.template.kind) || '').toLowerCase();
    if ((kind === 'prompt' || node.brickId === 'ia') && Object.keys(overlay).length) {
      return overlay;
    }
    var content = packed.template ? String(packed.template.content || '').trim() : '';
    if (kind === 'prompt' || node.brickId === 'ia') {
      if (!overlay.prompt) overlay.prompt = !!content;
      return overlay;
    }
    if (content || kind === 'html' || kind === 'word' || kind === 'canvas' || kind === 'a4') {
      overlay.body = true;
      overlay.message = true;
    }
    return overlay;
  }

  function templateContractSummaryHtml(node) {
    var id = nodeTemplateId(node);
    if (!id) return '';
    var fields = brickInputContractFields(node);
    if (!fields.length) return '';
    var overlay = templateOverlayForNode(node);
    var filled = [];
    var pending = [];
    fields.forEach(function(f) {
      if (f.advanced) return;
      if (overlay[f.key]) filled.push(f.label);
      else if (f.required || f.key === 'rag') pending.push(f.label + (f.required ? ' *' : ''));
    });
    if (!filled.length && !pending.length) return '';
    var html = '<p class="empty agent-template-contract" style="margin-top:8px;">';
    if (pending.length) html += 'À brancher : <strong>' + escapeHtml(pending.join(', ')) + '</strong>';
    else html += 'Template complet';
    html += '</p>';
    return html;
  }

  function iaInputSlots(node) {
    var overlay = templateOverlayForNode(node);
    return brickInputContractFields(node).filter(function(f) {
      return !overlay[f.key];
    });
  }

  function templateDataSlotsForNode(node) {
    var contractKeys = {};
    brickInputContractFields(node).forEach(function(f) { contractKeys[f.key] = true; });
    return templateSlotsForNode(node).filter(function(s) {
      return s && s.key && !contractKeys[s.key];
    }).map(function(s) {
      return {
        key: s.key,
        label: s.label || s.key,
        required: false,
        group: 'template',
        collection: s.group || 'Template',
        premap: s.premap || (s.completeItem ? 'item' : s.key),
        type: s.type || (s.completeItem ? 'array' : ''),
        completeItem: !!s.completeItem,
        provider: s.provider || '',
        sourceSlug: s.sourceSlug || ''
      };
    });
  }

  function mappingSlotsForNode(node) {
    if (!node) return [];
    if (node.brickId !== 'ia' && node.brickId !== 'output'
      && node.brickId !== 'validation' && node.brickId !== 'human-doc-review'
      && !isHookAction(node)) {
      return [];
    }
    var overlay = templateOverlayForNode(node);
    var contract = brickInputContractFields(node).filter(function(f) {
      return !overlay[f.key];
    }).map(function(f) {
      return {
        key: f.key,
        label: f.label,
        required: !!f.required,
        advanced: !!f.advanced,
        type: f.type || 'text',
        group: 'contract'
      };
    });
    var data = templateDataSlotsForNode(node).filter(function(s) {
      return !contract.some(function(c) { return c.key === s.key; });
    });
    return contract.concat(data);
  }

  function ensureMappingConfig(node) {
    if (!node || !node.config || typeof node.config !== 'object') return;
    if (!node.config.mapping || typeof node.config.mapping !== 'object') node.config.mapping = {};
    if (!node.config.literals || typeof node.config.literals !== 'object') node.config.literals = {};
  }

  function mappingSlotFilled(node, slot) {
    if (!node || !slot) return true;
    ensureMappingConfig(node);
    var mapped = String((node.config.mapping && node.config.mapping[slot.key]) || '').trim();
    var literal = String((node.config.literals && node.config.literals[slot.key]) || '').trim();
    if (mapped === '__literal__') return !!literal;
    if (mapped) return true;
    if (literal) return true;
    return copyFromInherits(node, slot.key);
  }

  function mappingSourceMissing(node, slot, fields) {
    if (!node || !slot) return false;
    ensureMappingConfig(node);
    var mapped = String((node.config.mapping && node.config.mapping[slot.key]) || '').trim();
    if (!mapped || mapped === '__literal__') return false;
    if (mapped.indexOf('__llm__:') === 0) return false;
    var list = fields;
    if (!Array.isArray(list)) {
      list = collectContextFieldsForNode(node.id).filter(function(f) { return !f.own; });
    }
    return !list.some(function(f) { return f && f.key === mapped; });
  }

  function outputAccountChosen(node) {
    var cfg = (node && node.config) || {};
    return !!(String(cfg.instanceId || '').trim()
      || String(cfg.accountRef || '').trim()
      || String(cfg.pageId || '').trim());
  }

  function nodeSetupWarnings(node) {
    var out = [];
    if (!node) return out;
    var cfg = node.config && typeof node.config === 'object' ? node.config : {};

    if (node.brickId === 'output') {
      if (isFlowOutput(node)) {
        ensureFlowExportFields(node);
        if (!String(cfg.exportName || '').trim()) {
          out.push({ label: 'Nom', reason: 'vide' });
        }
        if (!uniqueExportFields(node).length) {
          out.push({ label: 'Données', reason: 'non choisies' });
        }
      } else if (isCollectionOutput(node)) {
        if (!linkedCollectionId(node)) {
          out.push({ label: 'Collection', reason: 'non choisie' });
        } else if (!(node.config.modelFields || []).length) {
          out.push({ label: 'Champs', reason: 'collection sans schéma' });
        }
      } else {
        var cid = outputConnectorIdFromNode(node);
        var provider = nodeProvider(node);
        if (!cid && !provider) {
          out.push({ label: 'Type', reason: 'non choisi' });
        } else if (outputNeedsAccount(cid || provider) && !outputAccountChosen(node)) {
          out.push({ label: 'Compte', reason: 'non choisi' });
        }
        if ((provider === 'webhook' || provider === 'http') && !String(cfg.emitUrl || '').trim()) {
          out.push({ label: 'URL', reason: 'vide' });
        }
      }
    }

    if (node.brickId === 'data') {
      var dataProvider = resolveDataProvider(node);
      if (!dataProvider) {
        out.push({ label: 'Canal', reason: 'non choisi' });
      } else if (!isLocalDataProvider(dataProvider) && !String(cfg.instanceId || '').trim()) {
        out.push({ label: 'Compte', reason: 'non choisi' });
      }
    }

    if (isInsertableAction(node)
        && !String(cfg.subFlowId || '').trim()
        && !String(cfg.subTemplateId || '').trim()) {
      out.push({ label: 'Flux', reason: 'non lié' });
    }

    if ((node.brickId === 'trigger' || node.kind === 'trigger')
        && String(cfg.mode || 'button') === 'webhook'
        && !String(cfg.webhookInstanceId || '').trim()) {
      out.push({ label: 'Connecteur', reason: 'non choisi' });
    }

    if (isComposeAction(node)) {
      pruneOutputMaps(node);
      var vars = cfg.variables || [];
      var mappedOuts = cfg.mappedOutputIds || [];
      if (!vars.length && !mappedOuts.length) out.push({ label: 'Champs', reason: 'non définis' });
      vars.forEach(function(v) {
        if (!v || !v.required) return;
        if (String(zoneValue(node, v.key) || '').trim()) return;
        if (copyFromInherits(node, v.key)) return;
        out.push({ label: v.label || v.key, reason: 'vide' });
      });
      mappedOuts.forEach(function(oid) {
        var target = state.nodes.find(function(n) { return n.id === oid; });
        var map = getOutputMap(node, oid);
        if (!target || !map) return;
        brickInputContractFields(target).forEach(function(slot) {
          if (!slot || !slot.required) return;
          var ov = map.values && String(map.values[slot.key] || '').trim();
          if (ov) return;
          if (outputMapUsesObject(map)) return;
          out.push({
            label: outputMapTabLabel(target) + ' · ' + (slot.label || slot.key),
            reason: 'vide'
          });
        });
      });
    }

    if (isCollectionCaseSource(node)) {
      if (!conditionCaseCollectionId(node) && !String(cfg.casePresetId || '').trim()) {
        out.push({ label: 'Collection', reason: 'non choisie' });
      } else if (isConditionCollectionStale(node)) {
        out.push({ label: 'Liste', reason: 'collection à jour, cas périmés' });
      }
    }

    if (node.brickId === 'visualization' && String(cfg.vizType || 'select') !== 'page') {
      var vizSrc = vizDirectSources(node);
      if (!vizSrc.length) {
        out.push({ label: 'Liste amont', reason: 'non reliée' });
      } else if (!String(cfg.valueField || '').trim()) {
        out.push({ label: 'Champ valeur', reason: 'non attaché' });
      } else if (vizRoleOf(node) === 'choose' && !String(cfg.surface || '').trim()) {
        out.push({ label: 'Hook', reason: 'non choisi' });
      }
    }

    var mapFields = collectContextFieldsForNode(node.id).filter(function(f) { return !f.own; });
    if (!(node.brickId === 'output' && actionOwnsOutputMap(node))) {
      mappingSlotsForNode(node).forEach(function(slot) {
        if (!slot) return;
        if (mappingSourceMissing(node, slot, mapFields)) {
          out.push({ label: slot.label || slot.key, reason: 'source introuvable' });
          return;
        }
        if (!slot.required) return;
        if (mappingSlotFilled(node, slot)) return;
        out.push({ label: slot.label || slot.key, reason: 'non mappé' });
      });
    }
    return out;
  }

  function formatSetupWarning(w) {
    if (!w) return '';
    return String(w.label || '') + ' — ' + String(w.reason || '');
  }

  function nodeWarningsHtml(node) {
    var warns = nodeSetupWarnings(node);
    if (!warns.length) return '';
    return '<div class="agent-node-warnings"><strong>À compléter</strong><ul style="margin:0; padding-left:1.1rem;">'
      + warns.map(function(w) { return '<li>' + escapeHtml(formatSetupWarning(w)) + '</li>'; }).join('')
      + '</ul></div>';
  }

  function suggestDefaultMapping(node) {
    ensureMappingConfig(node);
    migrateFixedOutputSlots(node);
    migrateCompleteItemMapping(node);
    migrateIntentionCatalogMapping(node);
    var slots = mappingSlotsForNode(node);
    if (!slots.length) return;
    var fields = collectContextFieldsForNode(node.id).filter(function(f) { return !f.own; });
    slots.forEach(function(slot) {
      if (node.config.mapping[slot.key] || String(node.config.literals[slot.key] || '').trim()) return;
      if (isHookAction(node) && slot.key === 'surface') {
        node.config.mapping.surface = '__literal__';
        node.config.literals.surface = String(node.config.surface || '').trim() || 'tab';
        return;
      }
      if (slot.key === 'llmId') {
        var def = (state.entityLlms || []).filter(function(l) { return l.isDefault; })[0]
          || (state.entityLlms || [])[0];
        if (def) {
          node.config.mapping.llmId = '__literal__';
          node.config.literals.llmId = def.id;
        }
        return;
      }
      var hit = pickDefaultMappingField(slot, fields, node);
      if (hit) node.config.mapping[slot.key] = hit.key;
    });
  }

  function normalizeMappingProvider(raw) {
    var p = String(raw || '').toLowerCase();
    if (!p) return '';
    if (p === 'mail-in' || p === 'mail-out' || p === 'mail') return 'mail';
    if (p.indexOf('facebook') === 0) return 'facebook';
    if (p === 'http-generic' || p === 'webhook' || p === 'http') return 'http';
    if (p === 'json' || p === 'database' || p === 'collection') return 'json';
    return p;
  }

  function inferSlotProvider(slot) {
    var fromSlot = normalizeMappingProvider(slot && slot.provider);
    if (fromSlot) return fromSlot;
    var t = String((slot && (slot.sourceSlug + ' ' + slot.key + ' ' + (slot.group || '') + ' ' + (slot.label || ''))) || '').toLowerCase();
    if (/\bmail\b|courrier|imap/.test(t)) return 'mail';
    if (/facebook|messenger/.test(t)) return 'facebook';
    if (/intention/.test(t) && !/^intention(_principale)?$/.test(String((slot && slot.key) || '').toLowerCase())) {
      return 'json';
    }
    if (/liste|collection|modele/.test(t)) return 'json';
    return '';
  }

  function pickPreferredField(slot, fields, predicate) {
    var list = (fields || []).filter(predicate);
    if (!list.length) return null;
    var want = inferSlotProvider(slot);
    if (want) {
      var matched = list.filter(function(f) {
        return normalizeMappingProvider(f.provider) === want;
      });
      if (matched.length) list = matched;
    }
    var slug = String((slot && (slot.sourceSlug || (slot.key && slot.key.indexOf('.') >= 0 ? slot.key.split('.')[0] : ''))) || '').toLowerCase();
    if (slug && slug !== 'item' && slug !== 'items') {
      var bySlug = list.filter(function(f) {
        return String(f.slug || '').toLowerCase() === slug
          || String(f.source || '').toLowerCase().indexOf(slug) >= 0;
      });
      if (bySlug.length) list = bySlug;
    }
    return list[0] || null;
  }

  function isItemField(f) {
    return f && (f.localKey === 'item' || /(^|\.)item$/.test(f.key));
  }

  function isItemsField(f) {
    return f && (f.localKey === 'items' || /(^|\.)items$/.test(f.key));
  }

  function isIntentionCatalogSlot(slot) {
    var key = String((slot && slot.key) || '').toLowerCase();
    if (key === 'intention' || key === 'intention_principale') return false;
    var t = (key + ' ' + String((slot && slot.group) || '') + ' ' + String((slot && slot.label) || '')).toLowerCase();
    return t.indexOf('intention') >= 0;
  }

  function isMessageSourceField(f) {
    if (!f) return false;
    var p = normalizeMappingProvider(f.provider);
    if (p === 'mail' || p === 'facebook' || p === 'http') return true;
    var slug = String(f.slug || '').toLowerCase();
    var source = String(f.source || '').toLowerCase();
    return /^(mail|facebook|donnees|messages?)\b/.test(slug)
      || /\b(mail|facebook)\b/.test(source);
  }

  function isIntentionSourceField(f) {
    if (!f || isMessageSourceField(f)) return false;
    var p = String(f.provider || '').toLowerCase();
    if (p === 'json' || p === 'database') return true;
    var slug = String(f.slug || '').toLowerCase();
    var source = String(f.source || '').toLowerCase();
    var key = String(f.key || '').toLowerCase();
    return slug.indexOf('intention') >= 0 || source.indexOf('intention') >= 0 || key.indexOf('intention') >= 0;
  }

  function migrateIntentionCatalogMapping(node) {
    if (!node || !node.config || !node.config.mapping) return;
    var fields = collectContextFieldsForNode(node.id).filter(function(f) { return !f.own; });
    mappingSlotsForNode(node).forEach(function(slot) {
      if (!isIntentionCatalogSlot(slot)) return;
      var cur = String(node.config.mapping[slot.key] || '');
      if (!cur || cur === '__literal__') return;
      var mapped = (fields || []).find(function(f) { return f && f.key === cur; });
      if (mapped && !isMessageSourceField(mapped) && isIntentionSourceField(mapped)) return;
      var hit = pickPreferredField(slot, fields, function(f) {
        return isItemsField(f) && isIntentionSourceField(f);
      }) || pickPreferredField(slot, fields, function(f) {
        return isItemsField(f) && !isMessageSourceField(f);
      });
      if (hit && hit.key !== cur) node.config.mapping[slot.key] = hit.key;
    });
  }

  function migrateCompleteItemMapping(node) {
    if (!node || !node.config || !node.config.mapping) return;
    var fields = collectContextFieldsForNode(node.id).filter(function(f) { return !f.own; });
    mappingSlotsForNode(node).forEach(function(slot) {
      if (!slot) return;
      if (slot.key === 'items' || completeItemWantsTable(slot)) return;
      var wantsItem = slot.completeItem || slot.key === 'item' || slot.premap === 'item';
      if (!wantsItem) return;
      var cur = String(node.config.mapping[slot.key] || '');
      if (!cur || !/(^|\.)items$/.test(cur)) return;
      var itemHit = pickPreferredField(slot, fields, isItemField);
      if (itemHit) node.config.mapping[slot.key] = itemHit.key;
    });
  }

  function completeItemWantsTable(slot) {
    var t = String((slot && (slot.key + ' ' + (slot.group || '') + ' ' + (slot.label || ''))) || '').toLowerCase();
    return /intention|liste|collection|modele/.test(t);
  }

  function pickIncomingActionField(slot, fields, targetNode) {
    var key = String((slot && slot.key) || '');
    if (!key || !targetNode) return null;
    var actions = incomingComposeActions(targetNode);
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!actionHasZone(action, key)) continue;
      var slug = ensureNodeSlug(action);
      var hit = (fields || []).find(function(f) {
        return f && f.slug === slug && f.localKey === key;
      });
      if (hit) return hit;
      return { key: slug + '.' + key, localKey: key, slug: slug, source: action.name || slug };
    }
    return null;
  }

  function pickDefaultMappingField(slot, fields, targetNode) {
    var key = String((slot && slot.key) || '');
    var fromAction = pickIncomingActionField(slot, fields, targetNode);
    if (fromAction) return fromAction;
    var premap = String((slot && slot.premap) || '').trim();
    if (slot && (slot.completeItem || key === 'item' || key === 'items')) {
      var itemHit = pickPreferredField(slot, fields, isItemField);
      var itemsHit = pickPreferredField(slot, fields, isItemsField);
      if (isIntentionCatalogSlot(slot)) {
        return pickPreferredField(slot, fields, function(f) {
          return isItemsField(f) && isIntentionSourceField(f);
        }) || pickPreferredField(slot, fields, function(f) {
          return isItemsField(f) && !isMessageSourceField(f);
        });
      }
      if (key === 'items' || completeItemWantsTable(slot)) return itemsHit || itemHit;
      return itemHit || itemsHit
        || pickPreferredField(slot, fields, function(f) {
          return f.brickId === 'data' && (f.localKey === premap || f.key === premap);
        });
    }
    if (premap) {
      var pre = pickPreferredField(slot, fields, function(f) {
        return f.localKey === premap || f.key === premap || new RegExp('\\.' + premap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(f.key);
      });
      if (pre) return pre;
    }
    if (key === 'to') {
      return pickPreferredField(slot, fields, function(f) { return f.localKey === 'to' || /(^|\.)to$/.test(f.key); })
        || pickPreferredField(slot, fields, function(f) { return f.localKey === 'destinataire'; })
        || pickPreferredField(slot, fields, function(f) { return f.localKey === 'from' || /\.from$/.test(f.key); })
        || pickPreferredField(slot, fields, function(f) { return f.localKey === slot.key || f.key === slot.key; });
    }
    if (key === 'body') {
      return pickPreferredField(slot, fields, function(f) { return f.localKey === 'body' || /(^|\.)body$/.test(f.key); })
        || pickPreferredField(slot, fields, function(f) { return f.localKey === 'text' || /(^|\.)text$/.test(f.key); })
        || pickPreferredField(slot, fields, function(f) { return f.localKey === slot.key || f.key === slot.key; });
    }
    if (key === 'prompt' || key === 'context' || key === 'rag') {
      return pickPreferredField(slot, fields, function(f) {
        return f.localKey === key || f.key === key || new RegExp('\\.' + key + '$').test(f.key);
      });
    }
    if (key === 'llmId') return null;
    return pickPreferredField(slot, fields, function(f) { return f.localKey === slot.key || f.key === slot.key; })
      || (slot.key.indexOf('.') >= 0
        ? pickPreferredField(slot, fields, function(f) { return f.localKey === slot.key.split('.').pop(); })
        : null);
  }

  function migrateFixedOutputSlots(node) {
    if (!node || node.brickId !== 'output' || !node.config) return;
    ensureMappingConfig(node);
    ['to', 'subject', 'body', 'message'].forEach(function(key) {
      var fixed = String(node.config[key] || '').trim();
      if (!fixed) return;
      if (fixed === '{{' + key + '}}' || fixed === '{{body}}' || fixed === '{{subject}}') return;
      var mapped = String(node.config.mapping[key] || '').trim();
      if (mapped && mapped !== '__literal__') return;
      if (String(node.config.literals[key] || '').trim()) return;
      node.config.mapping[key] = '__literal__';
      node.config.literals[key] = fixed;
    });
  }

  function slotToken(node, slotKey) {
    var slug = ensureNodeSlug(node);
    return slug ? (slug + '.' + slotKey) : slotKey;
  }

  function mappingFieldsForSlot(slot, fields) {
    var list = (fields || []).slice();
    if (!(slot && (slot.completeItem || slot.key === 'item' || slot.key === 'items'))) {
      return list;
    }
    var rank = { item: 0, items: 1 };
    list.sort(function(a, b) {
      var ra = rank[a.localKey];
      var rb = rank[b.localKey];
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    });
    return list;
  }

  function mappingSelectHtml(fields, selected, slot, isLiteral) {
    var slotKey = (slot && typeof slot === 'object') ? slot.key : slot;
    var sel = isLiteral ? '__literal__' : String(selected || '');
    var html = '<select data-mapping-slot="' + escapeHtml(slotKey) + '">';
    html += '<option value="">— Non mappé —</option>';
    html += '<option value="__literal__"' + (sel === '__literal__' ? ' selected' : '') + '>Valeur fixe…</option>';
    var quick = [];
    var skip = {};
    if (slot && typeof slot === 'object' && (slot.completeItem || slot.key === 'item' || slot.key === 'items')) {
      var itemF = pickPreferredField(slot, fields, isItemField);
      var itemsF = pickPreferredField(slot, fields, isItemsField);
      if (itemF) {
        quick.push(itemF);
        skip[itemF.key] = true;
      }
      if (itemsF) {
        quick.push(itemsF);
        skip[itemsF.key] = true;
      }
    }
    if (quick.length) {
      html += '<optgroup label="Choix rapide">';
      quick.forEach(function(f) {
        html += '<option value="' + escapeHtml(f.key) + '"'
          + (sel === f.key ? ' selected' : '')
          + '>' + escapeHtml(contextFieldLabel(f) || f.key) + '</option>';
      });
      html += '</optgroup>';
    }
    var groups = {};
    var order = [];
    fields.forEach(function(f) {
      if (skip[f.key]) return;
      var g = contextFieldGroupName(f);
      if (!groups[g]) {
        groups[g] = [];
        order.push(g);
      }
      groups[g].push(f);
    });
    order.forEach(function(g) {
      html += '<optgroup label="' + escapeHtml(g) + '">';
      groups[g].forEach(function(f) {
        html += '<option value="' + escapeHtml(f.key) + '"'
          + (sel === f.key ? ' selected' : '')
          + '>' + (isExpertView()
            ? ('{{' + escapeHtml(f.key) + '}} — ' + escapeHtml(contextFieldLabel(f)))
            : escapeHtml(contextFieldLabel(f)))
          + '</option>';
      });
      html += '</optgroup>';
    });
    if (sel && sel !== '__literal__' && !fields.some(function(f) { return f.key === sel; })) {
      html += '<option value="' + escapeHtml(sel) + '" selected>'
        + (isExpertView() ? ('{{' + escapeHtml(sel) + '}} — hors liste') : (escapeHtml(sel) + ' — hors liste'))
        + '</option>';
    }
    html += '</select>';
    return html;
  }

  function entityLlmLabel(llm, grouped) {
    if (!llm) return '';
    var name = String(llm.name || '').trim();
    var model = String(llm.model || '').trim();
    var label = name && model && name !== model ? (name + ' (' + model + ')') : (name || model || llm.id);
    var server = String(llm.serverName || '').trim();
    if (!grouped && server && label.indexOf(server) < 0) label = label + ' — ' + server;
    return llm.isDefault ? (label + ' — défaut') : label;
  }

  function llmsGroupedByServer(llms) {
    var groups = [];
    var map = {};
    (llms || []).forEach(function(llm) {
      var key = String(llm.serverName || '').trim() || 'Autres';
      if (!map[key]) {
        map[key] = { label: key, items: [] };
        groups.push(map[key]);
      }
      map[key].items.push(llm);
    });
    return groups;
  }

  function mappingLiteralControlHtml(slot, literal, token, compact) {
    var key = String((slot && slot.key) || '');
    var html = '';
    if (!compact) {
      html += isExpertView()
        ? '<p class="agent-mapping-ns">Valeur fixe écrite dans <code>{{' + escapeHtml(token) + '}}</code>.</p>'
        : '<p class="agent-mapping-ns">Valeur fixe.</p>';
    }
    if (key === 'llmId') {
      html += '<select data-mapping-literal="' + escapeHtml(key) + '">';
      html += '<option value="">Modèle par défaut</option>';
      llmsGroupedByServer(state.entityLlms || []).forEach(function(group) {
        html += '<optgroup label="' + escapeHtml(group.label) + '">';
        group.items.forEach(function(llm) {
          html += '<option value="' + escapeHtml(llm.id) + '"'
            + (literal === llm.id ? ' selected' : '') + '>'
            + escapeHtml(entityLlmLabel(llm, true)) + '</option>';
        });
        html += '</optgroup>';
      });
      if (literal && !(state.entityLlms || []).some(function(l) { return l.id === literal; })) {
        html += '<option value="' + escapeHtml(literal) + '" selected>' + escapeHtml(literal) + '</option>';
      }
      html += '</select>';
      if (!state.entityLlmsLoaded || !(state.entityLlms || []).length) {
        html += '<p class="empty">Aucun modèle listé. Activez des modèles sur un serveur IA et attribuez-les aux rôles (admin / utilisateur).</p>';
      }
      return html;
    }
    if (slot && slot.type === 'number') {
      html += '<input type="number" step="any" data-mapping-literal="' + escapeHtml(key) + '" value="'
        + escapeHtml(literal) + '" placeholder="' + escapeHtml(literalPlaceholder(null, key)) + '">';
      return html;
    }
    html += '<textarea data-mapping-literal="' + escapeHtml(key) + '" rows="2" placeholder="'
      + escapeHtml(literalPlaceholder(null, key)) + '">'
      + escapeHtml(literal) + '</textarea>';
    return html;
  }

  function mappingLlmRowHtml(node, slot, fields) {
    var mapped = String((node.config.mapping && node.config.mapping[slot.key]) || '');
    var literal = String((node.config.literals && node.config.literals[slot.key]) || '');
    var isLiteral = mapped === '__literal__' || (!mapped && !!literal);
    var sel = '';
    if (isLiteral) sel = literal ? ('__llm__:' + literal) : '';
    else if (mapped) sel = mapped;
    var llms = state.entityLlms || [];
    var defaultLlm = llms.filter(function(l) { return l.isDefault; })[0] || llms[0] || null;
    if (!sel && defaultLlm) sel = '__llm__:' + defaultLlm.id;
    var html = '<div class="agent-mapping-row">';
    html += '<label>' + escapeHtml(slot.label);
    if (isExpertView()) {
      html += ' <code class="agent-mapping-token">{{' + escapeHtml(slotToken(node, slot.key)) + '}}</code>';
    }
    html += '</label>';
    html += '<select data-mapping-llm="' + escapeHtml(slot.key) + '">';
    if (!llms.length) {
      html += '<option value="" selected>Aucun modèle — activez-en sur un serveur IA</option>';
    } else {
      llmsGroupedByServer(llms).forEach(function(group) {
        html += '<optgroup label="' + escapeHtml(group.label) + '">';
        group.items.forEach(function(llm) {
          var v = '__llm__:' + llm.id;
          html += '<option value="' + escapeHtml(v) + '"' + (sel === v ? ' selected' : '') + '>'
            + escapeHtml(entityLlmLabel(llm, true)) + '</option>';
        });
        html += '</optgroup>';
      });
    }
    if (isExpertView() || node.brickId !== 'ia') {
      var llmGroups = {};
      var llmOrder = [];
      (fields || []).forEach(function(f) {
        var g = contextFieldGroupName(f);
        if (!llmGroups[g]) {
          llmGroups[g] = [];
          llmOrder.push(g);
        }
        llmGroups[g].push(f);
      });
      if (!llmOrder.length) {
        html += '<optgroup label="Cas actuel">';
        html += '<option value="" disabled>Aucun champ amont</option>';
        html += '</optgroup>';
      } else {
        llmOrder.forEach(function(g) {
          html += '<optgroup label="' + escapeHtml(g) + '">';
          llmGroups[g].forEach(function(f) {
            html += '<option value="' + escapeHtml(f.key) + '"'
              + (sel === f.key ? ' selected' : '')
              + '>' + (isExpertView()
                ? ('{{' + escapeHtml(f.key) + '}} — ' + escapeHtml(contextFieldLabel(f)))
                : escapeHtml(contextFieldLabel(f)))
              + '</option>';
          });
          html += '</optgroup>';
        });
      }
    }
    if (sel && sel.indexOf('__llm__:') !== 0 && sel !== '' && !(fields || []).some(function(f) { return f.key === sel; })) {
      html += '<option value="' + escapeHtml(sel) + '" selected>' + escapeHtml(sel) + ' — hors liste</option>';
    }
    html += '</select>';
    if (node.brickId !== 'ia') {
      if (!sel) {
        html += '<p class="agent-mapping-ns">Modèle par défaut. Vous pouvez en fixer un sur ce bloc, ou prendre un champ du cas.</p>';
      } else if (isLiteral) {
        html += '<p class="agent-mapping-ns">Fixé sur ce bloc.</p>';
      } else {
        html += '<p class="agent-mapping-ns">Pris dans le cas en cours.</p>';
      }
    }
    if (!state.entityLlmsLoaded) {
      html += '<p class="empty">Chargement des LLM…</p>';
    } else if (!llms.length) {
      html += '<p class="empty">Aucun modèle listé. Activez des modèles sur un serveur IA et attribuez-les aux rôles (admin / utilisateur).</p>';
    }
    html += '</div>';
    return html;
  }

  function mappingRowHtml(node, slot, fields) {
    if (slot && slot.key === 'llmId') return mappingLlmRowHtml(node, slot, fields);
    var mapped = String((node.config.mapping && node.config.mapping[slot.key]) || '');
    var literal = String((node.config.literals && node.config.literals[slot.key]) || '');
    var isLiteral = mapped === '__literal__' || (!mapped && !!literal);
    var unmapped = !mappingSlotFilled(node, slot);
    var missing = mappingSourceMissing(node, slot, fields);
    var token = slotToken(node, slot.key);
    var html = '<div class="agent-mapping-row' + ((slot.required && unmapped) || missing ? ' is-warn' : '') + '">';
    html += '<label>' + escapeHtml(slot.label) + (slot.required ? ' *' : '');
    if (isExpertView()) {
      html += ' <code class="agent-mapping-token">{{' + escapeHtml(token) + '}}</code>';
    }
    html += '</label>';
    html += mappingSelectHtml(mappingFieldsForSlot(slot, fields), mapped, slot, isLiteral);
    if (isLiteral) {
      html += mappingLiteralControlHtml(slot, literal, token, node.brickId === 'ia');
    } else if (node.brickId !== 'ia') {
      if (mapped) {
        var mappedField = fields.filter(function(f) { return f.key === mapped; })[0];
        if (slot.key === 'to' && node.brickId === 'output') {
          html += '<p class="agent-mapping-ns">Recopié de l’entrée. Passez en <strong>valeur fixe</strong> pour changer le destinataire.</p>';
        } else {
          html += isExpertView()
            ? '<p class="agent-mapping-ns">Source : <code>{{' + escapeHtml(mapped) + '}}</code> → <code>{{'
              + escapeHtml(token) + '}}</code></p>'
            : '<p class="agent-mapping-ns">Relié à « ' + escapeHtml(contextFieldLabel(mappedField) || mapped) + ' ».</p>';
        }
      } else {
        html += isExpertView()
          ? '<p class="agent-mapping-ns">Choisissez un champ amont <code>{{slug.champ}}</code> ou « Valeur fixe… ».</p>'
          : (copyFromInherits(node, slot.key)
            ? '<p class="agent-mapping-ns">Prérempli depuis l’objet. Changez-le si besoin.</p>'
            : '<p class="agent-mapping-ns">Choisissez un champ des blocs précédents, ou « Valeur fixe… ».</p>');
      }
    }
    if (slot.required && unmapped) {
      html += '<p class="agent-mapping-warn">Champ non branché</p>';
    } else if (missing) {
      html += isExpertView()
        ? '<p class="agent-mapping-warn">Source introuvable (<code>{{' + escapeHtml(mapped) + '}}</code>)</p>'
        : '<p class="agent-mapping-warn">Source introuvable</p>';
    }
    html += '</div>';
    return html;
  }

  function mappingPanelHtml(node) {
    if (node && node.brickId === 'output' && actionOwnsOutputMap(node)) {
      var owner = outputMapOwnerAction(node);
      var html = '<div class="agent-mapping-panel">';
      html += '<p class="empty">Contenu préparé dans l’action'
        + (owner ? ' « ' + escapeHtml(owner.name || 'Action') + ' »' : '')
        + ', onglet <strong>' + escapeHtml(outputMapTabLabel(node)) + '</strong>. Ici : compte d’envoi uniquement.</p>';
      html += '</div>';
      return html;
    }
    var slots = mappingSlotsForNode(node);
    if (!slots.length) return '';
    ensureMappingConfig(node);
    if (node.brickId === 'output' && nodeProvider(node) === 'mail'
        && !isFlowOutput(node) && !isCollectionOutput(node)
        && !actionOwnsOutputMap(node)) {
      wireMailOutputFromInput(node);
    }
    suggestDefaultMapping(node);
    var fields = collectContextFieldsForNode(node.id).filter(function(f) { return !f.own; });
    var iaSlots = slots.filter(function(s) { return s.group !== 'template' && !s.advanced; });
    var advancedSlots = isExpertView()
      ? slots.filter(function(s) { return s.group !== 'template' && s.advanced; })
      : [];
    var tplSlots = slots.filter(function(s) { return s.group === 'template'; });
    var compact = node.brickId === 'ia';
    var html = '<div class="agent-mapping-panel">';
    if (node.brickId === 'output' && !isFlowOutput(node) && !isCollectionOutput(node)) {
      html += copyFromSelectHtml(node);
    }
    if (iaSlots.length) {
      html += compact ? '<h4>Entrées</h4>' : (isHookAction(node) ? '<h4>Entrées flux</h4>' : (isCollectionOutput(node) ? '<h4>Champs de la collection</h4>' : '<h4>Contrat du bloc</h4>'));
      if (!compact) html += '<p class="empty">' + mappingHintForNode(node) + '</p>';
      iaSlots.forEach(function(slot) { html += mappingRowHtml(node, slot, fields); });
    } else if (tplSlots.length && !compact) {
      html += '<p class="empty">' + mappingHintForNode(node) + '</p>';
    }
    if (advancedSlots.length) {
      html += '<h4>Paramètres avancés</h4>';
      if (!compact) html += '<p class="empty">Température et max tokens. Vides = défauts du serveur IA (800 tokens).</p>';
      advancedSlots.forEach(function(slot) { html += mappingRowHtml(node, slot, fields); });
    }
    if (tplSlots.length) {
      html += '<h4>Données du template</h4>';
      if (!compact) {
        html += '<p class="empty">Items et champs {{…}} du template. Un item se branche sur <strong>Item (ligne courante)</strong>, une liste (intentions…) sur le tableau.</p>';
      }
      tplSlots.forEach(function(slot) { html += mappingRowHtml(node, slot, fields); });
    }
    html += '</div>';
    return html;
  }

  function mappingHintForNode(node) {
    var overlay = templateOverlayForNode(node);
    var pending = brickInputContractFields(node).filter(function(f) {
      return !overlay[f.key] && (!f.advanced || isExpertView());
    });
    var labels = pending.map(function(f) { return f.label; });
    if (!isExpertView()) {
      if (node.brickId === 'ia') {
        if (!nodeTemplateId(node)) {
          return 'Branchez le <strong>prompt</strong>, le <strong>contexte</strong> et le <strong>RAG</strong>. Le <strong>modèle</strong> se choisit sur ce bloc (serveurs IA de l’entité) ou depuis le cas.';
        }
        if (!pending.length) {
          return 'Le template couvre le contrat du bloc. Branchez uniquement les <strong>données du template</strong> ci-dessous.';
        }
        return 'Le template recouvre une partie du contrat. Il reste : <strong>'
          + labels.join('</strong>, <strong>') + '</strong>.';
      }
      if (isHookAction(node)) {
        return 'Branchez <strong>surface</strong> (onglet, modal, app…), le <strong>libellé</strong>, et la page <strong>HTML / CSS</strong> déjà dessinée dans le flux. Pas de liste : une valeur fixe ou un champ amont.';
      }
      if (node.brickId === 'output' && isFlowOutput(node)) {
        return 'Cochez les <strong>données déjà présentes dans le flux</strong>. Elles seront publiées sous le nom choisi — pas de contrat HTML/CSS à remplir.';
      }
      if (node.brickId === 'output' && isCollectionOutput(node)) {
        if (!linkedCollectionId(node)) {
          return 'Choisissez une collection client. Ses champs deviennent le contrat de sortie.';
        }
        if (!pending.length) {
          return 'Ouvrez l’éditeur de collection pour définir les champs à enregistrer.';
        }
        return 'Branchez chaque champ de la collection sur une donnée des blocs précédents, ou une valeur fixe.';
      }
      if (node.brickId === 'output' && actionOwnsOutputMap(node)) {
        return 'Le contenu est préparé dans l’action (onglet de cette sortie). Ici : compte d’envoi.';
      }
      if (node.brickId === 'output' && nodeTemplateId(node)) {
        if (!pending.length) {
          return 'Le template fournit le contenu. Branchez destinataire / sujet, et les champs du template.';
        }
        return 'Le template fournit le corps. Il reste : <strong>'
          + labels.join('</strong>, <strong>') + '</strong>.';
      }
      return 'Branchez chaque champ sur une donnée des blocs précédents, ou saisissez une valeur fixe.';
    }
    var token = '{{' + ensureNodeSlug(node) + '.champ}}';
    if (node.brickId === 'ia') {
      if (!nodeTemplateId(node)) {
        return 'Contrat du bloc IA : <strong>prompt</strong>, <strong>contexte</strong>, <strong>RAG</strong>, <strong>modèle</strong>. Branchez un champ namespacé amont <code>' + escapeHtml(token) + '</code>.';
      }
      if (!pending.length) {
        return 'Le template fournit tout le contrat IA. Il reste le mapping des <strong>données</strong> du template.';
      }
      return 'Overlay template : le contrat de base reste pour <strong>'
        + labels.join('</strong>, <strong>') + '</strong>. Les champs du template se mappent à part.';
    }
    if (isHookAction(node)) {
      return 'Surface, libellé, HTML et CSS se branchent sur un champ namespacé amont <code>{{slug.champ}}</code>, ou une valeur fixe.';
    }
    if (node.brickId === 'output') {
      if (isFlowOutput(node)) {
        return 'Cochez les champs namespacés amont à publier sous ce nom.';
      }
      if (isCollectionOutput(node)) {
        return 'Chaque champ de la collection se branche sur un champ namespacé amont <code>{{slug.champ}}</code>.';
      }
      return nodeTemplateId(node)
        ? 'Le template remplit le corps. Les autres slots du contrat se branchent en <code>{{slug.champ}}</code>.'
        : 'Chaque slot du contrat de ce bloc est branché sur un champ namespacé amont <code>{{slug.champ}}</code>.';
    }
    return 'Chaque slot du contrat de ce bloc est branché sur un champ namespacé amont <code>{{slug.champ}}</code>.';
  }

  function literalPlaceholder(node, slotKey) {
    if (slotKey === 'to') return 'ex. contact@exemple.fr ou {{donnees_mail.from}}';
    if (slotKey === 'prompt') return 'ex. À partir de {{donnees_mail.text}}, rédige une réponse.';
    if (slotKey === 'context') return 'ex. Tu es l’assistant de l’entreprise. Ton : professionnel.';
    if (slotKey === 'rag') return 'ex. {{liste_intentions.items}}';
    if (slotKey === 'llmId') return 'Modèle du serveur IA, ou identifiant depuis les données';
    if (slotKey === 'temperature') return '0.2';
    if (slotKey === 'maxTokens') return '800';
    return 'ex. {{slug.champ}}';
  }

  function pruneMappingToSlots(node) {
    if (!node || node.brickId !== 'ia' || !node.config) return;
    var tplId = nodeTemplateId(node);
    if (tplId && !state.blockTemplateDetails[tplId]) return;
    var allowed = {};
    brickInputContractFields(node).forEach(function(f) { allowed[f.key] = true; });
    templateDataSlotsForNode(node).forEach(function(s) { allowed[s.key] = true; });
    ['mapping', 'literals'].forEach(function(bag) {
      var obj = node.config[bag];
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function(k) {
        if (!allowed[k]) delete obj[k];
      });
    });
  }

  function ensureIaConfig(node) {
    if (!node || node.brickId !== 'ia') return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (node.config.source === 'custom' && node.config.prompt && !String((node.config.literals && node.config.literals.prompt) || '').trim()) {
      ensureMappingConfig(node);
      if (!node.config.mapping.prompt) {
        node.config.mapping.prompt = '__literal__';
        node.config.literals.prompt = String(node.config.prompt || '');
      }
    }
    if (node.config.source !== 'custom') node.config.source = 'mapped';
    if (node.config.writeMode !== 'replace') node.config.writeMode = 'merge';
    node.operation = node.operation || 'ia.run';
    ensureMappingConfig(node);
    pruneMappingToSlots(node);
  }

  function iaOutputContractHtml(node) {
    var fields = iaOutputFieldsForNode(node);
    var html = '<details class="agent-mapping-panel agent-ia-output">';
    html += '<summary>Sortie</summary>';
    html += '<ul class="agent-mapping-ns" style="margin:8px 0 0; padding-left:1.1rem;">';
    if (fields.length) {
      fields.forEach(function(f) {
        html += '<li>' + escapeHtml(f.label || f.key);
        if (isExpertView()) {
          html += ' <code>{{' + escapeHtml(slotToken(node, f.key)) + '}}</code>';
        }
        html += '</li>';
      });
    } else {
      html += '<li>Réponse IA</li>';
    }
    html += '</ul></details>';
    return html;
  }

  function iaFieldsHtml(node) {
    ensureIaConfig(node);
    if (!state.entityLlmsLoaded) {
      loadEntityLlms().then(function() { renderConfig(); });
    }
    var html = productionTemplatePanelHtml(node);
    html += templateBindPanelHtml(node);
    html += mappingPanelHtml(node);
    html += iaOutputContractHtml(node);
    if (isExpertView()) {
      html += '<div class="form-group"><label>Écriture dans le flux</label>';
      html += '<select data-key="writeMode">';
      html += '<option value="merge"' + (node.config.writeMode !== 'replace' ? ' selected' : '') + '>Compléter (champ response)</option>';
      html += '<option value="replace"' + (node.config.writeMode === 'replace' ? ' selected' : '') + '>Écraser le texte du message</option>';
      html += '</select></div>';
    }
    return html;
  }

  var COLLECTION_META_KEYS = { id: true, _id: true, createdAt: true, updatedAt: true, values: true };

  function docTemplateApi() {
    return (cfg.docTemplateApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/doc-template')).replace(/\/$/, '');
  }

  function docTemplateFetch(path, opts) {
    opts = opts || {};
    var init = {
      method: opts.method || 'GET',
      headers: headers(),
      credentials: 'include'
    };
    if (opts.body) init.body = JSON.stringify(opts.body);
    return fetch(docTemplateApi() + path, init).then(parseJson);
  }

  function normalizeCollectionType(type) {
    var t = String(type || 'text');
    var aliases = {
      string: 'text',
      texte: 'text',
      Texte: 'text',
      TextArea: 'textarea',
      textarea: 'textarea',
      Lien: 'url',
      lien: 'url',
      currency: 'number',
      nombre: 'number',
      Number: 'number',
      html: 'textarea',
      bool: 'boolean',
      Boolean: 'boolean',
      fichier: 'file',
      Fichier: 'file',
      Image: 'image',
      couleur: 'color',
      Couleur: 'color',
      Date: 'date',
      DateTime: 'datetime',
      'date-time': 'datetime',
      Enum: 'enum',
      Connection: 'connection',
      Secret: 'secret'
    };
    if (aliases[t]) return aliases[t];
    return String(t || 'text').toLowerCase() || 'text';
  }

  function typeFromV3Field(f) {
    if (!f) return 'text';
    return normalizeCollectionType(f.typeRef || f.uiType || f.type || 'text');
  }

  function collectionKeyOf(col) {
    if (!col) return '';
    var raw = col._id || col.id || col.collectionId;
    if (raw && typeof raw === 'object') raw = raw.$oid || raw.toString();
    return String(raw || '').replace(/^ObjectId\("([^"]+)"\)$/, '$1');
  }

  function fieldEnumFromCollection(f) {
    if (!f || typeof f !== 'object') return [];
    if (Array.isArray(f.enum) && f.enum.length) return f.enum.map(String);
    if (Array.isArray(f.allowedValues) && f.allowedValues.length) return f.allowedValues.map(String);
    var fromVal = f.validation && f.validation.allowedValues;
    var fromOv = f.validationOverrides && f.validationOverrides.allowedValues;
    if (Array.isArray(fromVal) && fromVal.length) return fromVal.map(String);
    if (Array.isArray(fromOv) && fromOv.length) return fromOv.map(String);
    return [];
  }

  function fieldsFromCollection(model) {
    return ((model && model.fields) || []).map(function(f) {
      var key = String((f && (f.name || f.key)) || '');
      var type = typeFromV3Field(f);
      var choices = fieldEnumFromCollection(f);
      if (choices.length && (type === 'text' || type === 'string')) type = 'enum';
      return {
        key: key,
        label: String((f && (f.label || f.name || f.key)) || key),
        type: type,
        unit: String((f && (f.unit || (f.validationOverrides && f.validationOverrides.unit))) || ''),
        required: !!(f && f.required),
        enum: choices.length ? choices : undefined
      };
    }).filter(function(f) { return f.key; });
  }

  function rowFromV3Element(el, fields) {
    var values = (el && el.values && typeof el.values === 'object') ? el.values : null;
    var src = values || (el && typeof el === 'object' ? el : {});
    var row = { id: String((el && (el._id || el.id)) || src.id || '') };
    var keys = (fields && fields.length)
      ? fields.map(function(f) { return f.key || f.name; }).filter(Boolean)
      : Object.keys(src).filter(function(k) { return !COLLECTION_META_KEYS[k]; });
    keys.forEach(function(k) {
      if (src[k] !== undefined) row[k] = src[k];
      else if (el && el[k] !== undefined && !COLLECTION_META_KEYS[k]) row[k] = el[k];
    });
    return row;
  }

  function rowsFromCollection(model) {
    var raw = (model && (model.elements || model.variants || model.items)) || [];
    var fields = fieldsFromCollection(model);
    return raw.map(function(row) { return rowFromV3Element(row, fields); });
  }

  function applyCollectionToNode(node, model) {
    if (!node || !model) return;
    if (!node.config) node.config = {};
    var id = collectionKeyOf(model);
    node.config.collectionId = id;
    node.config.collectionNamespace = String(model.slug || model.namespace || model.name || id);
    node.config.modelName = String(model.name || model.slug || '');
    node.config.modelFields = fieldsFromCollection(model);
    node.config.modelRows = rowsFromCollection(model);
    node.config.referenceFields = Array.isArray(model.referenceFields) ? model.referenceFields.slice() : [];
    if (isSchemaCatalogCollection(model)) {
      var nodeSlug = String(node.slug || '');
      node.config.schemaSlug = (nodeSlug === 'collection_design' || nodeSlug === 'design')
        ? 'design'
        : (node.config.schemaSlug || 'design');
      node.config.collectionNamespace = String(model.slug || 'atelier-schemas');
    } else if (node.config.schemaSlug && String(model.slug || '') !== 'atelier-schemas') {
      delete node.config.schemaSlug;
    }
    syncJsonPayloadFromModel(node);
  }

  function loadV3CollectionDetail(id) {
    return docTemplateFetch('/collections/' + encodeURIComponent(id)).then(function(payload) {
      if (!payload || !payload.success || !payload.data) {
        throw new Error((payload && (payload.error || payload.message)) || 'Collection introuvable');
      }
      var model = payload.data;
      return docTemplateFetch('/collections/' + encodeURIComponent(id) + '/elements').then(function(elPayload) {
        model.elements = (elPayload && elPayload.data) || [];
        if (!Array.isArray(model.elements)) model.elements = [];
        return model;
      }).catch(function() {
        model.elements = [];
        return model;
      });
    });
  }

  function loadDocCollections(force) {
    if (state.docCollectionsLoaded && !force) return Promise.resolve(state.docCollections);
    if (state._docCollectionsLoading && !force) return state._docCollectionsLoading;
    state._docCollectionsLoading = fetch(API + '/atelier/schemas', { headers: headers() })
      .then(parseJson)
      .catch(function() { return null; })
      .then(function() {
        return docTemplateFetch('/collections');
      })
      .then(function(payload) {
        state.docCollections = (payload && payload.data) || [];
        if (!Array.isArray(state.docCollections)) state.docCollections = [];
        state.docCollectionsLoaded = true;
        state.docCollectionsError = (payload && payload.success === false)
          ? ((payload.error || payload.message) || 'Collections indisponibles')
          : null;
        state._docCollectionsLoading = null;
        return state.docCollections;
      })
      .catch(function(err) {
        state.docCollections = [];
        state.docCollectionsLoaded = true;
        state.docCollectionsError = (err && err.message) || 'Collections indisponibles';
        state._docCollectionsLoading = null;
        return [];
      });
    return state._docCollectionsLoading;
  }

  function loadIntentionPresets(force) {
    if (state.intentionPresetsLoaded && !force) return Promise.resolve(state.intentionPresets);
    if (state._intentionPresetsLoading && !force) return state._intentionPresetsLoading;
    state._intentionPresetsLoading = fetch(API + '/intention-presets', { headers: headers() })
      .then(parseJson)
      .then(function(payload) {
        state.intentionPresets = (payload && payload.presets) || [];
        if (!Array.isArray(state.intentionPresets)) state.intentionPresets = [];
        state.intentionPresetsLoaded = true;
        state._intentionPresetsLoading = null;
        return state.intentionPresets;
      })
      .catch(function() {
        state.intentionPresets = [
          { id: 'mail', label: 'Mail', slug: 'preset-intentions-mail' },
          { id: 'reseaux-sociaux', label: 'Réseaux sociaux', slug: 'preset-intentions-reseaux-sociaux' },
          { id: 'contact', label: 'Contact / formulaire', slug: 'preset-intentions-contact' }
        ];
        state.intentionPresetsLoaded = true;
        state._intentionPresetsLoading = null;
        return state.intentionPresets;
      });
    return state._intentionPresetsLoading;
  }

  function isPresetCollection(col) {
    var slug = String((col && col.slug) || '');
    return slug.indexOf('preset-intentions-') === 0
      || (Array.isArray(col && col.tags) && col.tags.indexOf('preset') !== -1);
  }

  function isSchemaCatalogCollection(col) {
    var slug = String((col && col.slug) || '');
    if (slug === 'atelier-schemas') return true;
    return Array.isArray(col && col.tags) && col.tags.indexOf('schema') !== -1
      && col.tags.indexOf('atelier') !== -1;
  }

  function collectionOptionLabel(col) {
    var name = String((col && (col.name || col.slug)) || '');
    var slug = String((col && col.slug) || '');
    if (slug && slug !== name) return name + ' (' + slug + ')';
    return name || slug;
  }

  function collectionV3OptionsHtml(colId, presetId) {
    var html = '';
    var schemas = [];
    var others = [];
    (state.docCollections || []).forEach(function(col) {
      var id = collectionKeyOf(col);
      if (!id || isPresetCollection(col)) return;
      if (isSchemaCatalogCollection(col)) schemas.push(col);
      else others.push(col);
    });
    if (schemas.length) {
      html += '<optgroup label="Schémas (nom / type)">';
      schemas.forEach(function(col) {
        var id = collectionKeyOf(col);
        html += '<option value="' + escapeHtml(id) + '"' + (colId === id && !presetId ? ' selected' : '') + '>'
          + escapeHtml(collectionOptionLabel(col)) + '</option>';
      });
      html += '</optgroup>';
    }
    html += '<optgroup label="Collections V3">';
    others.forEach(function(col) {
      var id = collectionKeyOf(col);
      html += '<option value="' + escapeHtml(id) + '"' + (colId === id && !presetId ? ' selected' : '') + '>'
        + escapeHtml(collectionOptionLabel(col)) + '</option>';
    });
    return html;
  }

  function collectionMatchesPreset(colId, preset) {
    if (!preset) return false;
    var hit = (state.docCollections || []).find(function(c) { return collectionKeyOf(c) === colId; });
    if (!hit) return false;
    var slug = String(hit.slug || '');
    return slug === String(preset.slug || '') || slug === ('preset-intentions-' + preset.id);
  }

  function migrateLegacyDatabaseNode(node) {
    if (!node || !node.config) return;
    if (String(node.config.provider || '') !== 'database') return;
    var presetId = String(node.config.presetId || 'mail').trim() || 'mail';
    node.config.provider = 'json';
    node.config.presetId = presetId;
    node.config.dbSource = '';
    if (!linkedCollectionId(node)) applyPresetCollection(node, presetId);
  }

  function applyPresetCollection(node, presetId) {
    var id = String(presetId || '').trim();
    if (!id || !node) return Promise.resolve();
    if (!node.config) node.config = {};
    node.config.provider = 'json';
    node.config.presetId = id;
    return fetch(API + '/intention-presets/' + encodeURIComponent(id) + '/collection', {
      method: 'POST',
      headers: headers()
    }).then(parseJson).then(function(res) {
      var model = res && res.data;
      if (!model) throw new Error((res && (res.message || res.error)) || 'Collection introuvable');
      applyCollectionToNode(node, model);
      var rows = node.config.modelRows || [];
      if (rows.length && typeof syncRouteRulesFromIntentions === 'function') {
        syncRouteRulesFromIntentions(rows);
      }
      return loadDocCollections(true).then(function() {
        renderCanvas();
        renderConfig();
        return model;
      });
    }).catch(function(err) {
      window.alert('Impossible de créer la liste : ' + ((err && err.message) || err));
      renderConfig();
    });
  }

  function slugifyCollectionName(name) {
    var s = String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s || 'collection';
  }

  function createDocCollection(name, node) {
    var payload = {
      name: name,
      slug: slugifyCollectionName(name) + '-' + Date.now().toString(36),
      description: 'Créée depuis un agent IA',
      tags: ['agent'],
      fields: []
    };
    return docTemplateFetch('/collections', { method: 'POST', body: payload }).then(function(res) {
      if (!res || !res.success || !res.data) {
        throw new Error((res && (res.error || res.message)) || 'Création impossible');
      }
      applyCollectionToNode(node, res.data);
      node.config.presetId = '';
      return loadDocCollections(true).then(function() { return res.data; });
    });
  }

  function linkedCollectionId(node) {
    return String((node && node.config && (node.config.collectionId || '')) || '').trim();
  }

  function applyCollectionChoice(node, val) {
    if (!node) return Promise.resolve();
    if (!node.config) node.config = {};
    if (!val || val === '__local__') {
      node.config.collectionId = '';
      node.config.collectionNamespace = '';
      node.config.presetId = '';
      if (node.brickId === 'output') {
        node.config.modelName = '';
        node.config.modelFields = [];
        node.config.modelRows = [];
      }
      renderCanvas();
      renderConfig();
      return Promise.resolve();
    }
    if (val.indexOf('__preset__:') === 0) {
      return applyPresetCollection(node, val.slice('__preset__:'.length));
    }
    if (val === '__new__') {
      var suggested = String((node.config && node.config.modelName) || '').trim() || 'Nouvelle collection';
      var name = window.prompt('Nom de la collection (éditeur documentaire V3)', suggested);
      if (!name) {
        renderConfig();
        return Promise.resolve();
      }
      return createDocCollection(name.trim(), node).then(function() {
        renderCanvas();
        renderConfig();
        openCollectionEditor(node, 'edit');
      }).catch(function(err) {
        window.alert('Impossible de créer la collection : ' + ((err && err.message) || err));
        renderConfig();
      });
    }
    return loadV3CollectionDetail(val)
      .then(function(model) {
        node.config.presetId = '';
        applyCollectionToNode(node, model);
        renderCanvas();
        renderConfig();
      })
      .catch(function(err) {
        window.alert('Impossible de charger la collection : ' + ((err && err.message) || err));
        renderConfig();
      });
  }

  function ensureJsonModel(node) {
    if (!node) return;
    if (!node.config) node.config = {};
    if (!Array.isArray(node.config.modelFields)) node.config.modelFields = [];
    if (!Array.isArray(node.config.modelRows)) node.config.modelRows = [];
    if (node.config.modelName == null) node.config.modelName = '';
    if (node.config.modelFields.length || node.config.modelRows.length) {
      syncJsonPayloadFromModel(node);
      return;
    }
    var raw = String(node.config.payload || '').trim();
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      var sample = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return;
      node.config.modelFields = Object.keys(sample).filter(function(k) {
        return !COLLECTION_META_KEYS[k];
      }).map(function(k) {
        var v = sample[k];
        var type = 'text';
        if (typeof v === 'number') type = 'number';
        else if (typeof v === 'boolean') type = 'boolean';
        else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) type = 'date';
        return { key: k, label: k, type: type };
      });
      node.config.modelRows = Array.isArray(parsed) ? parsed.map(function(row) {
        return row && typeof row === 'object' ? Object.assign({}, row) : {};
      }) : [Object.assign({}, sample)];
      if (!node.config.modelName) node.config.modelName = 'Liste';
      syncJsonPayloadFromModel(node);
    } catch (e) { /* texte brut : le modal part d’un modèle vide */ }
  }

  function syncJsonPayloadFromModel(node) {
    if (!node || !node.config) return;
    var rows = Array.isArray(node.config.modelRows) ? node.config.modelRows : [];
    node.config.payload = rows.length ? JSON.stringify(rows, null, 2) : (node.config.payload || '');
  }

  function jsonModelPreviewHtml(node) {
    var fields = (node && node.config && node.config.modelFields) || [];
    var rows = (node && node.config && node.config.modelRows) || [];
    if (!fields.length || !rows.length) return '';
    var max = Math.min(rows.length, 5);
    var html = '<div class="json-model-preview">';
    html += '<table class="json-model-table json-model-table--preview"><thead><tr>';
    fields.forEach(function(f) {
      html += '<th>' + escapeHtml(f.label || f.key) + (f.required ? ' *' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    for (var i = 0; i < max; i += 1) {
      var row = rows[i] || {};
      html += '<tr>';
      fields.forEach(function(f) {
        var val = row[f.key];
        if (f.type === 'boolean') val = val === true || val === 'true' ? 'oui' : 'non';
        html += '<td>' + escapeHtml(val == null || val === '' ? '—' : String(val)) + '</td>';
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    if (rows.length > max) {
      html += '<p class="empty" style="margin:6px 0 0;">+' + (rows.length - max) + ' autre(s) — ouvrir le modèle pour tout voir.</p>';
    }
    html += '</div>';
    return html;
  }

  function dataChannelFieldsHtml(node) {
    if (node && node.config && node.config.instanceId) {
      var linked = findConnectorInstance(node.config.instanceId);
      if (linked) {
        var fromInst = providerFromConnectorId(linked.connectorId);
        if (fromInst) node.config.provider = fromInst;
      }
    }
    if (node && node.config && String(node.config.provider || '') === 'database') {
      migrateLegacyDatabaseNode(node);
    }
    var provider = String((node && node.config && node.config.provider) || '');
    var providers = listCreatedDataProviders();
    if (provider && providers.indexOf(provider) === -1) providers = [provider].concat(providers);
    var html = '<div class="form-group"><label>Type</label>';
    html += '<select data-key="provider">';
    html += '<option value="">— Choisir —</option>';
    providers.forEach(function(p) {
      html += '<option value="' + escapeHtml(p) + '"' + (provider === p ? ' selected' : '') + '>'
        + escapeHtml(dataProviderLabel(p)) + '</option>';
    });
    html += '</select></div>';

    if (provider === 'flow' || provider === 'flux') {
      html += '<div class="form-group"><label>Nom d’import</label>';
      html += '<input type="text" data-key="importName" value="'
        + escapeHtml(String((node.config && node.config.importName) || 'parent'))
        + '" placeholder="parent"></div>';
      html += '<p class="empty">Lit le flux parent (html, css, surface, label). À placer en tête d’une sous-action accrochée à la palette.</p>';
      return html;
    }

    if (provider === 'json') {
      ensureJsonModel(node);
      if (!state.docCollectionsLoaded) loadDocCollections().then(function() { renderConfig(); });
      if (!state.intentionPresetsLoaded) loadIntentionPresets().then(function() { renderConfig(); });
      var fieldsN = (node.config.modelFields || []).length;
      var rowsN = (node.config.modelRows || []).length;
      var modelName = String(node.config.modelName || '').trim();
      var colId = linkedCollectionId(node);
      var presetId = String((node.config && node.config.presetId) || '');
      html += '<div class="form-group"><label>Collection</label>';
      html += '<select data-collection-pick="1">';
      html += '<option value="__local__"' + (!colId && !presetId ? ' selected' : '') + '>Liste locale (ce bloc seulement)</option>';
      var presets = state.intentionPresets || [];
      if (presets.length) {
        html += '<optgroup label="Listes préconstruites">';
        presets.forEach(function(p) {
          var selected = presetId === p.id || (colId && collectionMatchesPreset(colId, p));
          html += '<option value="__preset__:' + escapeHtml(p.id) + '"' + (selected ? ' selected' : '') + '>'
            + escapeHtml(p.label || p.id) + '</option>';
        });
        html += '</optgroup>';
      }
      html += collectionV3OptionsHtml(colId, presetId);
      html += '<option value="__new__">+ Nouvelle collection V3</option>';
      html += '</optgroup>';
      html += '</select>';
      if (state.docCollectionsError) {
        html += '<p class="empty" style="margin-top:6px; color:#fbbf24;">' + escapeHtml(state.docCollectionsError) + '</p>';
      } else if (node.config.schemaSlug) {
        html += '<p class="empty" style="margin-top:6px; color:#93c5fd;">Schéma · <code>'
          + escapeHtml(node.config.schemaSlug) + '</code> — champs nom / type (pas une collection vide).</p>';
      } else if (colId) {
        html += '<p class="empty" style="margin-top:6px; color:#93c5fd;">Collection · <code>'
          + escapeHtml(node.config.collectionNamespace || colId) + '</code></p>';
      } else if (presetId) {
        html += '<p class="empty" style="margin-top:6px;">Liste préconstruite — sera créée comme collection au premier chargement.</p>';
      } else {
        html += '<p class="empty" style="margin-top:6px;">Liste locale, ou une collection existante.</p>';
      }
      html += '</div>';
      html += '<div class="form-group"><label>Modèle</label>';
      html += '<p class="empty" style="margin:6px 0 8px;">'
        + (modelName ? escapeHtml(modelName) + ' · ' : '')
        + fieldsN + ' champ(s) · ' + rowsN + ' ligne(s)'
        + '</p>';
      html += '<button type="button" class="btn-agent" data-open-collection-editor="1">Ouvrir l’éditeur de collection</button>';
      if (cfg.docTemplateUrl) {
        html += ' <a class="btn-agent-ghost" href="' + escapeHtml(String(cfg.docTemplateUrl).replace(/\/$/, '') + '/collections') + '" target="_blank" rel="noopener">Toutes les collections</a>';
      }
      html += '<p class="empty" style="margin-top:8px;">L’éditeur V3 s’ouvre dans un autre onglet. Au retour, le bloc se met à jour.</p>';
      html += jsonModelPreviewHtml(node);
      html += '</div>';
      return html;
    }

    var sel = String((node && node.config && node.config.instanceId) || '');
    html += '<div class="form-group"><label>Compte</label>';
    html += '<select data-key="instanceId">';
    html += '<option value="">— Choisir —</option>';
    if (!provider) {
      html += '<option value="" disabled>Choisissez d’abord un type</option>';
    } else if (!state.connectorInstancesLoaded) {
      html += '<option value="" disabled>Chargement…</option>';
    } else {
      var accounts = listDataAccounts(provider);
      if (!accounts.length) {
        html += '<option value="" disabled>Aucun compte pour ce type</option>';
      } else {
        accounts.forEach(function(inst) {
          var id = instanceIdOf(inst);
          html += '<option value="' + escapeHtml(id) + '"' + (sel === id ? ' selected' : '') + '>'
            + escapeHtml(accountLabel(inst)) + '</option>';
        });
        if (sel && !accounts.some(function(inst) { return instanceIdOf(inst) === sel; })) {
          html += '<option value="' + escapeHtml(sel) + '" selected>' + escapeHtml(sel) + '</option>';
        }
      }
    }
    html += '</select></div>';
    if (provider === 'facebook') {
      html += channelTabOpenButtonHtml('btnOpenFacebookTab', 'Facebook', node);
    }
    if (provider === 'mail') {
      html += channelTabOpenButtonHtml('btnOpenMailTab', 'Mail', node);
    }
    return html;
  }

  function channelTabOpenButtonHtml(id, channelLabel, node) {
    var name = String((node && node.name) || '').trim() || 'Entrées';
    var label = isExpertView()
      ? (String(channelLabel).toLowerCase() + '.' + ensureNodeSlug(node))
      : (channelLabel + ' / ' + name);
    return '<button type="button" class="btn-agent" id="' + escapeHtml(id) + '" style="margin-bottom:10px;">'
      + escapeHtml(label) + '</button>';
  }

  function outputCollectionFieldsHtml(node) {
    if (!state.docCollectionsLoaded) loadDocCollections().then(function() { renderConfig(); });
    ensureJsonModel(node);
    var colId = linkedCollectionId(node);
    var fieldsN = (node.config.modelFields || []).length;
    var modelName = String(node.config.modelName || '').trim();
    var writeMode = String((node.config && node.config.writeMode) || 'insert');
    if (writeMode !== 'upsert') writeMode = 'insert';
    var html = '<div class="form-group"><label>Collection</label>';
    html += '<select data-collection-pick="1">';
    html += '<option value="">— Choisir —</option>';
    html += collectionV3OptionsHtml(colId, '');
    html += '<option value="__new__">+ Nouvelle collection</option>';
    html += '</optgroup>';
    html += '</select>';
    if (state.docCollectionsError) {
      html += '<p class="empty" style="margin-top:6px; color:#fbbf24;">' + escapeHtml(state.docCollectionsError) + '</p>';
    } else if (colId) {
      html += '<p class="empty" style="margin-top:6px; color:#93c5fd;">Collection · <code>'
        + escapeHtml(node.config.collectionNamespace || colId) + '</code>'
        + (modelName ? ' · ' + escapeHtml(modelName) : '')
        + ' · ' + fieldsN + ' champ(s)</p>';
    } else {
      html += '<p class="empty" style="margin-top:6px;">Une collection existante, ou créez-en une dans l’éditeur.</p>';
    }
    html += '</div>';
    html += '<div class="form-group"><label>Écriture</label>';
    html += '<select data-key="writeMode">';
    html += '<option value="insert"' + (writeMode === 'insert' ? ' selected' : '') + '>Toujours créer une ligne</option>';
    html += '<option value="upsert"' + (writeMode === 'upsert' ? ' selected' : '') + '>Mettre à jour si même événement</option>';
    html += '</select>';
    html += '<p class="empty" style="margin-top:6px;">Une ligne par passage de ce bloc. La mise à jour reprend le même mail / commentaire (sourceRef).</p></div>';
    html += '<div class="form-group">';
    html += '<button type="button" class="btn-agent" data-open-collection-editor="1">Ouvrir l’éditeur de collection</button>';
    if (cfg.docTemplateUrl) {
      html += ' <a class="btn-agent-ghost" href="' + escapeHtml(String(cfg.docTemplateUrl).replace(/\/$/, '') + '/collections') + '" target="_blank" rel="noopener">Toutes les collections</a>';
    }
    html += '<p class="empty" style="margin-top:8px;">L’éditeur V3 s’ouvre dans un autre onglet. Au retour, le schéma se met à jour — branchez ensuite les champs ci-dessous.</p>';
    html += jsonModelPreviewHtml(node);
    html += '</div>';
    return html;
  }

  function flowOutputFieldsHtml(node) {
    ensureFlowExportFields(node);
    var name = String((node && node.config && node.config.exportName) || 'chrome');
    var selected = {};
    uniqueExportFields(node).forEach(function(k) { selected[k] = true; });
    var fields = collectContextFieldsForNode(node && node.id).filter(function(f) {
      return f && f.key && !f.own && f.source !== 'Système' && f.key !== 'today' && f.key !== 'date';
    });
    var html = '<div class="form-group"><label>Nom de la sortie</label>';
    html += '<input type="text" data-key="exportName" value="' + escapeHtml(name) + '" placeholder="chrome">';
    html += '<p class="empty" style="margin-top:6px;">Nom sous lequel un parent / hook relit ce paquet.</p></div>';
    html += '<div class="form-group"><label>Données du flux</label>';
    html += '<p class="empty" style="margin-top:6px;">Cochez les champs déjà présents dans le run. Rien à composer : on publie une sélection.</p>';
    if (!fields.length) {
      html += '<p class="empty" style="margin-top:8px;">Aucun champ amont. Reliez ce bloc à des données du flux.</p></div>';
      return html;
    }
    html += '<div class="agent-export-fields">';
    html += '<div class="agent-export-fields__actions">';
    html += '<button type="button" class="btn-agent-ghost" data-export-fields-all="1">Tout</button>';
    html += '<button type="button" class="btn-agent-ghost" data-export-fields-none="1">Aucun</button>';
    html += '</div>';
    var groups = {};
    var order = [];
    fields.forEach(function(f) {
      var g = contextFieldGroupName(f);
      if (!groups[g]) {
        groups[g] = [];
        order.push(g);
      }
      groups[g].push(f);
    });
    order.forEach(function(g) {
      html += '<div class="agent-export-fields__group"><strong>' + escapeHtml(g) + '</strong>';
      groups[g].forEach(function(f) {
        var checked = selected[f.key] ? ' checked' : '';
        html += '<label class="agent-check"><input type="checkbox" data-export-field="'
          + escapeHtml(f.key) + '"' + checked + '><span>'
          + escapeHtml(contextFieldLabel(f));
        if (isExpertView()) {
          html += ' <code>{{' + escapeHtml(f.key) + '}}</code>';
        }
        html += '</span></label>';
      });
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function outputChannelFieldsHtml(node) {
    if (!isFlowOutput(node) && node && node.config && node.config.instanceId) {
      var linked = findConnectorInstance(node.config.instanceId);
      if (linked) {
        var fromInst = providerFromConnectorId(linked.connectorId);
        node.config.connectorId = String(linked.connectorId || node.config.connectorId || '');
        if (fromInst === 'http') node.config.provider = 'webhook';
        else if (fromInst) node.config.provider = fromInst;
      }
    }
    var connectorId = outputConnectorIdFromNode(node);
    var types = listOutputConnectorTypes();
    if (connectorId && !types.some(function(t) { return String(t.id) === connectorId; })) {
      types = [{
        id: connectorId,
        name: (connectorTypeById(connectorId) && connectorTypeById(connectorId).name) || outputProviderLabel(connectorId)
      }].concat(types);
    }
    var html = '<div class="form-group"><label>Type</label>';
    html += '<select data-key="connectorId">';
    html += '<option value="">— Choisir —</option>';
    if (!state.connectorInstancesLoaded && !types.length) {
      html += '<option value="" disabled>Chargement…</option>';
    } else if (!types.length) {
      html += '<option value="" disabled>Aucun connecteur sortant</option>';
    } else {
      types.forEach(function(t) {
        html += '<option value="' + escapeHtml(t.id) + '"' + (connectorId === String(t.id) ? ' selected' : '') + '>'
          + escapeHtml(t.name || t.id) + '</option>';
      });
    }
    html += '</select>';
    html += '<p class="empty" style="margin-top:6px;">Flux nommé (données du run), collection client, ou connecteur sortant.</p></div>';

    if (isFlowOutput(node)) {
      html += flowOutputFieldsHtml(node);
      return html;
    }

    if (isCollectionOutput(node)) {
      html += outputCollectionFieldsHtml(node);
      return html;
    }

    if (!outputNeedsAccount(connectorId || (node && node.config && node.config.provider))) return html;

    var sel = String((node && node.config && node.config.instanceId) || '');
    var accounts = listOutputAccountsForType(connectorId);
    if (!sel && node && node.config) {
      var wantRef = String(node.config.accountRef || '').trim();
      var wantPage = String(node.config.pageId || '').trim();
      var matched = accounts.find(function(inst) {
        if (!inst || !inst.settings) return false;
        if (wantRef && String(inst.settings.accountRef || '') === wantRef) return true;
        if (wantPage && String(inst.settings.pageId || '') === wantPage) return true;
        return false;
      });
      if (matched) {
        sel = instanceIdOf(matched);
        node.config.instanceId = sel;
      }
    }
    html += '<div class="form-group"><label>Compte</label>';
    html += '<select data-key="instanceId">';
    html += '<option value="">— Choisir —</option>';
    if (!connectorId) {
      html += '<option value="" disabled>Choisissez d’abord un type</option>';
    } else if (!state.connectorInstancesLoaded) {
      html += '<option value="" disabled>Chargement…</option>';
    } else if (!accounts.length) {
      html += '<option value="" disabled>Aucun compte pour ce connecteur</option>';
    } else {
      accounts.forEach(function(inst) {
        var id = instanceIdOf(inst);
        html += '<option value="' + escapeHtml(id) + '"' + (sel === id ? ' selected' : '') + '>'
          + escapeHtml(accountLabel(inst)) + '</option>';
      });
      if (sel && !accounts.some(function(inst) { return instanceIdOf(inst) === sel; })) {
        html += '<option value="' + escapeHtml(sel) + '" selected>' + escapeHtml(sel) + '</option>';
      }
    }
    html += '</select>';
    html += '<p class="empty" style="margin-top:6px;">Comptes de ce connecteur (page, boîte, instance HTTP).</p></div>';
    return html;
  }

  function dataKindsHtml(node) {
    var provider = resolveDataProvider(node);
    if (isLocalDataProvider(provider)) return '';
    if (isFacebookListenNode(node)) {
      syncFacebookKindsFromListen(node);
      var ingest = dataIngestMode(node);
      var ids = facebookListenKindIds(node);
      var title = ingest === 'push' ? 'Événements' : 'À lire';
      var html = '<div class="form-group"><label>' + escapeHtml(title) + '</label>';
      html += '<p class="empty" style="margin:6px 0 0;">'
        + (ids.length
          ? escapeHtml(ids.map(facebookKindLabel).join(' · '))
          : 'Réglez-les dans l’onglet Facebook.')
        + '</p></div>';
      return html;
    }
    var kinds = kindsForDataNode(node);
    if (!kinds.length) return '';
    ensureDataKinds(node);
    if (kinds.length <= 1) return '';
    var selected = {};
    (node.config.kinds || []).forEach(function(id) { selected[id] = true; });
    var ingest = dataIngestMode(node);
    var title = ingest === 'push' ? 'Événements à traiter' : 'À lire';
    var help = ingest === 'push'
      ? 'Parmi ce que le webhook connecteur peut pousser.'
      : 'Plusieurs types possibles pour ce canal.';
    var html = '<div class="form-group"><label>' + escapeHtml(title) + '</label>';
    kinds.forEach(function(kind) {
      html += '<label class="agent-check" style="margin:6px 0;">'
        + '<input type="checkbox" data-kind="' + escapeHtml(kind.id) + '"'
        + (selected[kind.id] ? ' checked' : '') + '>'
        + '<span>' + escapeHtml(kind.label || kind.id) + '</span>'
        + '</label>';
    });
    html += '<p class="empty" style="margin-top:6px;">' + escapeHtml(help) + '</p></div>';
    return html;
  }

  function formatFieldExample(value) {
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function emptyFlowContract() {
    return { fields: [], example: {}, sources: [] };
  }

  function unionFlowContracts(list) {
    var acc = emptyFlowContract();
    (list || []).forEach(function(c) {
      if (!c) return;
      var seen = {};
      acc.fields.forEach(function(f) { if (f && f.key) seen[f.key] = true; });
      (c.fields || []).forEach(function(f) {
        if (!f || !f.key || seen[f.key]) return;
        seen[f.key] = true;
        acc.fields.push(f);
      });
      acc.example = Object.assign({}, acc.example, c.example || {});
      (c.sources || []).forEach(function(s) {
        if (s && acc.sources.indexOf(s) === -1) acc.sources.push(s);
      });
    });
    return acc;
  }

  function nodeEnrichmentFields(node) {
    if (!node) return [];
    if (node.brickId === 'data') return contractFieldsForDataNode(node);
    var brick = getBrick(node.brickId) || {};
    var out = extractBrickContextFields(brick).slice();
    if (node.brickId === 'action') {
      contractFieldsForActionNode(node).forEach(function(f) {
        if (!f || !f.key) return;
        if (out.some(function(x) { return x.key === f.key; })) return;
        out.push(f);
      });
    }
    var op = node.config && node.config.operation;
    if (node.brickId === 'action' && op === 'analyse-intention') {
      out.push(
        { key: 'intention_principale', label: 'Intention principale', example: 'demande-devis' },
        { key: 'confidence', label: 'Confiance', example: 0.86, type: 'number' },
        { key: 'reponse_requise', label: 'Réponse requise', example: true }
      );
    }
    if (node.brickId === 'ia') {
      contractFieldsForIaNode(node).forEach(function(f) {
        if (!f || !f.key) return;
        if (out.some(function(x) { return x.key === f.key; })) return;
        out.push(f);
      });
    }
    if (node.brickId === 'validation') {
      out.push(
        { key: 'exportName', label: 'Nom de sortie', example: 'chrome' },
        { key: 'html', label: 'HTML', example: '<header>…</header>' },
        { key: 'css', label: 'CSS', example: 'header { … }' },
        { key: 'decision', label: 'Décision', example: 'approved' },
        { key: 'editedText', label: 'Texte validé', example: '…' }
      );
    }
    if (node.brickId === 'visualization') {
      out.push(
        { key: 'vizType', label: 'Type', example: 'select' },
        { key: 'surface', label: 'Surface', example: 'panel' },
        { key: 'label', label: 'Libellé', example: 'Panneau droit' },
        { key: 'hookMounted', label: 'Accroché', example: true }
      );
    }
    return out;
  }

  function nodeEnrichmentExample(node) {
    if (!node) return {};
    if (node.brickId === 'data') {
      var sample = {};
      selectedKindsForNode(node).forEach(function(kind) {
        if (!kind || !kind.example || typeof kind.example !== 'object') return;
        Object.keys(kind.example).forEach(function(k) {
          if (sample[k] === undefined) sample[k] = kind.example[k];
        });
      });
      return sample;
    }
    var extra = {};
    nodeEnrichmentFields(node).forEach(function(f) {
      if (f && f.key && f.example !== undefined) extra[f.key] = f.example;
    });
    return extra;
  }

  function mergeFlowContract(base, node) {
    var fields = ((base && base.fields) || []).slice();
    var seen = {};
    fields.forEach(function(f) { if (f && f.key) seen[f.key] = true; });
    nodeEnrichmentFields(node).forEach(function(f) {
      if (!f || !f.key || seen[f.key]) return;
      seen[f.key] = true;
      fields.push({
        key: f.key,
        label: f.label || humanizeFieldKey(f.key),
        example: f.example,
        type: f.type
      });
    });
    var sources = ((base && base.sources) || []).slice();
    var brick = getBrick(node.brickId) || {};
    var name = node.name || brick.name || node.brickId;
    if (name && sources.indexOf(name) === -1) sources.push(name);
    return {
      fields: fields,
      example: Object.assign({}, (base && base.example) || {}, nodeEnrichmentExample(node)),
      sources: sources
    };
  }

  function contractAtNode(node, side, memo) {
    memo = memo || {};
    if (!node) return emptyFlowContract();
    var key = node.id + ':' + side;
    if (memo[key]) return memo[key];
    var incoming = getIncomingNodes(node.id);
    var input = incoming.length
      ? unionFlowContracts(incoming.map(function(n) { return contractAtNode(n, 'out', memo); }))
      : emptyFlowContract();
    var result = side === 'in' ? input : mergeFlowContract(input, node);
    memo[key] = result;
    return result;
  }

  function flowContractPreviewHtml(contract) {
    contract = contract || emptyFlowContract();
    var html = '<div style="margin-top:8px;">';
    if (contract.sources && contract.sources.length) {
      html += '<p style="margin:0 0 8px; color:#93c5fd; font-size:0.85rem;">Enrichi par : '
        + escapeHtml(contract.sources.join(' → ')) + '</p>';
    }
    if (!(contract.fields || []).length) {
      html += '<p class="empty">Aucun message à ce point. Reliez un bloc Entrées en amont.</p></div>';
      return html;
    }
    html += '<details style="margin:0 0 10px; color:#94a3b8; font-size:0.85rem; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;">';
    html += '<summary style="color:#e2e8f0;"><strong>Champs</strong></summary><ul style="margin:8px 0 0; padding-left:1.1rem;">';
    contract.fields.forEach(function(f) {
      html += '<li><strong>' + escapeHtml(f.label || f.key) + '</strong> <code>' + escapeHtml(f.key) + '</code>';
      if (f.example != null) {
        html += ' <span style="color:#64748b;">ex. ' + escapeHtml(formatFieldExample(f.example)) + '</span>';
      }
      html += '</li>';
    });
    html += '</ul></details>';
    html += '<p style="margin:10px 0 4px; color:#93c5fd;">JSON du message</p>';
    html += '<pre style="margin:0; padding:10px; border-radius:8px; background:#020617; color:#cbd5e1; overflow:auto; font-size:0.75rem;">'
      + escapeHtml(JSON.stringify(contract.example || {}, null, 2)) + '</pre></div>';
    return html;
  }

  function setContractModalTitle(text) {
    var title = document.getElementById('dataContractModalTitle');
    if (title) title.textContent = text || 'Structure des données';
  }

  function openContractModalContent(title, hint, html) {
    var el = ensureDataContractModal();
    setContractModalTitle(title);
    var hintEl = el.querySelector('#dataContractModalHint');
    var body = el.querySelector('#dataContractModalBody');
    if (hintEl) hintEl.textContent = hint || '';
    if (body) body.innerHTML = html || '';
    el.removeAttribute('hidden');
    el.classList.add('is-open');
    el.style.display = 'flex';
  }

  function openFlowContractModal(node, side) {
    if (!node) return;
    var brick = getBrick(node.brickId) || {};
    var name = node.name || brick.name || node.brickId;
    var isOut = side !== 'in';
    var dbg = state.runDebug && state.runDebug.byNode ? state.runDebug.byNode[node.id] : null;
    var live = runPreviewDetailHtml(
      dbg ? dbg.preview : null,
      dbg ? dbg.error : null,
      node,
      isOut ? 'out' : 'in'
    );
    if (isOut && node.brickId === 'data' && !live) {
      openDataContractModal(node);
      setContractModalTitle('Sortie — ' + name);
      return;
    }
    var schemaHtml = (isOut && node.brickId === 'data')
      ? dataContractPreviewHtml(node)
      : flowContractPreviewHtml(contractAtNode(node, isOut ? 'out' : 'in'));
    var hint = live
      ? (isOut
        ? 'Données réellement sorties au dernier run, puis contrat du bloc.'
        : 'Données réellement reçues au dernier run, puis contrat du bloc.')
      : (isOut
        ? 'Message émis par ce bloc (données amont + champs ajoutés ici).'
        : (node.brickId === 'ia'
          ? 'Données reçues (souvent le contrat mail / tableau amont). Le mapping du bloc IA reste prompt / contexte / RAG ; les champs du template se mappent à part.'
          : 'Message reçu par ce bloc, avant son traitement.'));
    openContractModalContent(
      (isOut ? 'Sortie' : 'Entrée') + ' — ' + name,
      hint,
      (live || '') + (schemaHtml || '')
    );
  }

  function openLinkContract(link) {
    if (!link) return;
    var source = state.nodes.find(function(n) { return n.id === link.sourceId; });
    var target = state.nodes.find(function(n) { return n.id === link.targetId; });
    if (!source) return;
    var srcName = source.name || source.brickId;
    var tgtName = target ? (target.name || target.brickId) : '…';
    var live = runPreviewDetailHtml(
      state.runDebug && state.runDebug.byNode && state.runDebug.byNode[source.id]
        ? state.runDebug.byNode[source.id].preview
        : null,
      state.runDebug && state.runDebug.byNode && state.runDebug.byNode[source.id]
        ? state.runDebug.byNode[source.id].error
        : null,
      source
    );
    var schemaHtml = source.brickId === 'data'
      ? dataContractPreviewHtml(source)
      : flowContractPreviewHtml(contractAtNode(source, 'out'));
    openContractModalContent(
      'Lien — ' + srcName + ' → ' + tgtName,
      live
        ? 'Données réellement sorties au dernier run, puis contrat du bloc amont.'
        : 'Contrat qui circule sur ce lien (sortie du bloc amont).',
      (live || '') + (schemaHtml || '')
    );
  }

  function dataContractButtonHtml(node) {
    var kinds = allKindsForPreview(node);
    var html = '<div class="agent-data-test-actions">';
    html += '<button type="button" class="btn-agent" data-test-data="1">Tester la lecture</button>';
    if (kinds.length) {
      html += '<button type="button" class="btn-agent-ghost agent-expert-only" id="btnOpenDataContract" data-open-data-contract="1">Voir la structure des données</button>';
    }
    html += '</div>';
    html += '<p class="empty" style="margin-top:6px;">Lit le compte ou la collection de ce bloc, sans lancer l’agent.</p>';
    return html;
  }

  function ensureDataContractModal() {
    var el = document.getElementById('dataContractModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'dataContractModal';
    el.className = 'agent-contract-modal';
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<div class="agent-contract-modal-backdrop" data-close-contract-modal="1"></div>'
      + '<div class="agent-contract-modal-card" role="dialog" aria-modal="true" aria-labelledby="dataContractModalTitle">'
      + '<div class="agent-contract-modal-header">'
      + '<h2 id="dataContractModalTitle">Structure des données</h2>'
      + '<button type="button" class="btn-agent-ghost" data-close-contract-modal="1">Fermer</button>'
      + '</div>'
      + '<p class="empty" id="dataContractModalHint" style="margin:0 0 8px;"></p>'
      + '<div id="dataContractModalBody"></div>'
      + '</div>';
    var host = document.querySelector('.agent-editor-app') || document.body;
    host.appendChild(el);
    return el;
  }

  function closeDataContractModal() {
    var el = document.getElementById('dataContractModal');
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('hidden', '');
    el.style.display = 'none';
  }

  function ensureDataTestModal() {
    var el = document.getElementById('dataTestModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'dataTestModal';
    el.className = 'agent-contract-modal';
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<div class="agent-contract-modal-backdrop" data-close-data-test-modal="1"></div>'
      + '<div class="agent-contract-modal-card agent-contract-modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="dataTestModalTitle">'
      + '<div class="agent-contract-modal-header">'
      + '<h2 id="dataTestModalTitle">Test de lecture</h2>'
      + '<button type="button" class="btn-agent-ghost" data-close-data-test-modal="1">Fermer</button>'
      + '</div>'
      + '<p class="empty" id="dataTestModalHint" style="margin:0 0 8px;"></p>'
      + '<div id="dataTestModalBody" class="agent-data-test-body"></div>'
      + '</div>';
    var host = document.querySelector('.agent-editor-app') || document.body;
    host.appendChild(el);
    return el;
  }

  function closeDataTestModal() {
    var el = document.getElementById('dataTestModal');
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('hidden', '');
    el.style.display = 'none';
  }

  function openDataTestModal(title, hint, bodyHtml, isError) {
    var el = ensureDataTestModal();
    var titleEl = document.getElementById('dataTestModalTitle');
    var hintEl = document.getElementById('dataTestModalHint');
    var bodyEl = document.getElementById('dataTestModalBody');
    if (titleEl) titleEl.textContent = title || 'Test de lecture';
    if (hintEl) {
      hintEl.textContent = hint || '';
      hintEl.style.color = isError ? '#fca5a5' : '';
    }
    if (bodyEl) bodyEl.innerHTML = bodyHtml || '';
    el.removeAttribute('hidden');
    el.classList.add('is-open');
    el.style.display = 'flex';
  }

  function formatDataTestCell(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'oui' : 'non';
    if (Array.isArray(value)) {
      if (!value.length) return '—';
      if (value[0] && typeof value[0] === 'object' && (value[0].filename || value[0].name)) {
        return value.map(function(att) { return att.filename || att.name; }).filter(Boolean).join(', ') || String(value.length);
      }
      return String(value.length) + ' élément(s)';
    }
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (e) { return String(value); }
    }
    var text = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      var d = new Date(text);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      }
    }
    if (text.length > 160) return text.slice(0, 157) + '…';
    return text;
  }

  function dataTestColumns(preview) {
    var fields = Array.isArray(preview && preview.modelFields) ? preview.modelFields : [];
    if (fields.length) {
      return fields.map(function(f) {
        return { key: f.key, label: f.label || f.key };
      }).filter(function(c) { return c.key; });
    }
    var preferred = [
      { key: 'from', label: 'De' },
      { key: 'subject', label: 'Sujet' },
      { key: 'text', label: 'Texte' },
      { key: 'name', label: 'Nom' },
      { key: 'timestamp', label: 'Date' }
    ];
    var present = {};
    (preview && preview.items || []).forEach(function(row) {
      Object.keys(row || {}).forEach(function(k) { present[k] = true; });
    });
    var cols = preferred.filter(function(c) { return present[c.key]; });
    if (!cols.length) {
      Object.keys(present).filter(function(k) {
        return k !== 'attachments' && k !== 'author' && k !== 'metadata' && k !== 'id';
      }).slice(0, 6).forEach(function(k) {
        cols.push({ key: k, label: k });
      });
    }
    if (present.attachments) cols.push({ key: 'attachments', label: 'Pièces jointes' });
    return cols;
  }

  function renderDataTestPreview(preview) {
    var html = '';
    var err = preview && preview.error;
    var count = preview && preview.itemsCount != null ? Number(preview.itemsCount) : 0;
    if (!Number.isFinite(count)) count = 0;
    var shown = (preview && Array.isArray(preview.items)) ? preview.items.length : 0;
    html += '<div class="agent-data-test-summary' + (err ? ' is-err' : '') + '">';
    html += '<p><strong>' + escapeHtml(String(count)) + '</strong> ligne' + (count > 1 ? 's' : '') + ' récupérée' + (count > 1 ? 's' : '');
    if (preview && preview.truncated) html += ' (affichage des ' + shown + ' premières)';
    if (preview && preview.provider) html += ' · ' + escapeHtml(dataProviderLabel(preview.provider) || preview.provider);
    html += '</p>';
    if (err) html += '<p class="agent-run-preview-error">' + escapeHtml(err) + '</p>';
    if (preview && preview.note) html += '<p class="empty">' + escapeHtml(preview.note) + '</p>';
    html += '</div>';
    var items = (preview && preview.items) || [];
    if (!items.length) {
      html += '<p class="empty">Aucune ligne. Vérifiez le compte, le dossier et les filtres de ce bloc.</p>';
    } else {
      var cols = dataTestColumns(preview);
      html += '<div class="json-model-table-wrap agent-data-test-table-wrap">';
      html += '<table class="json-model-table json-model-table--preview"><thead><tr>';
      html += '<th>#</th>';
      cols.forEach(function(c) {
        html += '<th>' + escapeHtml(c.label) + '</th>';
      });
      html += '</tr></thead><tbody>';
      items.forEach(function(row, i) {
        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        cols.forEach(function(c) {
          html += '<td>' + escapeHtml(formatDataTestCell(row ? row[c.key] : null)) + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      if (isExpertView()) {
        html += '<details class="agent-run-io" style="margin-top:12px;"><summary>JSON brut</summary>';
        html += '<pre class="agent-run-preview-body agent-data-test-json">' + escapeHtml(JSON.stringify(items, null, 2)) + '</pre>';
        html += '</details>';
      }
    }
    if (isExpertView() && preview && preview.debug) {
      html += '<details class="agent-run-io">';
      html += '<summary>Requête envoyée</summary>';
      html += '<pre class="agent-run-preview-body">' + escapeHtml(JSON.stringify(preview.debug.request || {}, null, 2)) + '</pre>';
      html += '</details>';
      html += '<details class="agent-run-io">';
      html += '<summary>Réponse reçue</summary>';
      html += '<pre class="agent-run-preview-body">' + escapeHtml(JSON.stringify(preview.debug.response || {}, null, 2)) + '</pre>';
      html += '</details>';
    }
    return html;
  }

  function setDataTestButtonsBusy(busy) {
    document.querySelectorAll('[data-test-data]').forEach(function(btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? 'Lecture…' : 'Tester la lecture';
    });
  }

  function testDataNode(node) {
    if (!node || node.brickId !== 'data') return Promise.resolve();
    if (state._dataTestBusy) return Promise.resolve();
    state._dataTestBusy = true;
    setDataTestButtonsBusy(true);
    var title = 'Test — ' + (node.name || 'Entrées');
    openDataTestModal(title, 'Lecture en cours…', '<p class="empty">Récupération des lignes avec les filtres de ce bloc.</p>', false);

    function go() {
      return fetch(API + '/flows/' + encodeURIComponent(state.flowId) + '/preview-data', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          nodeId: node.id,
          brickId: 'data',
          name: node.name || '',
          config: node.config || {}
        })
      })
        .then(parseJson)
        .then(function(data) {
          if (!data.success) throw new Error(data.message || 'Échec du test');
          var preview = data.preview || {};
          var hint = preview.empty
            ? 'Aucune ligne pour ces filtres.'
            : 'Lecture seule — les messages ne sont pas marqués comme lus, l’agent n’est pas lancé.';
          openDataTestModal(title, hint, renderDataTestPreview(preview), !!preview.error);
        });
    }

    var start = (!state.flowId)
      ? saveFlow({ silent: true })
      : Promise.resolve();
    return start
      .then(go)
      .catch(function(err) {
        openDataTestModal(title, err.message || 'Impossible de tester ce bloc.', '', true);
      })
      .then(function() {
        state._dataTestBusy = false;
        setDataTestButtonsBusy(false);
      });
  }

  function ensureActionComposeModal() {
    var el = document.getElementById('actionComposeModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'actionComposeModal';
    el.className = 'agent-contract-modal';
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<div class="agent-contract-modal-backdrop" data-close-compose-modal="1"></div>'
      + '<div class="agent-contract-modal-card agent-contract-modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="actionComposeModalTitle">'
      + '<div class="agent-contract-modal-header">'
      + '<h2 id="actionComposeModalTitle">Champs de l’action</h2>'
      + '<button type="button" class="btn-agent-ghost" data-close-compose-modal="1">Fermer</button>'
      + '</div>'
      + '<div id="actionComposeModalBody"></div>'
      + '</div>';
    document.body.appendChild(el);
    applyExpertViewClass();
    return el;
  }

  function closeActionComposeModal() {
    var el = document.getElementById('actionComposeModal');
    if (!el) return;
    var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    if (node && node.config) {
      el.querySelectorAll('[data-field-key]').forEach(function(input) {
        setZoneValue(node, input.getAttribute('data-field-key'), input.value);
      });
    }
    el.classList.remove('is-open');
    el.setAttribute('hidden', '');
    el.style.display = 'none';
    hideComposeFieldTip();
    renderCanvas();
    renderConfig();
  }

  function hideComposeFieldTip() {
    var tip = document.getElementById('agentComposeFieldTip');
    if (tip) tip.hidden = true;
  }

  function bindComposeFieldTips(container) {
    var tip = document.getElementById('agentComposeFieldTip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'agentComposeFieldTip';
      tip.className = 'agent-compose-field-tip';
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    function show(btn) {
      var text = btn.getAttribute('data-hint') || '';
      if (!text) return;
      tip.textContent = text;
      tip.hidden = false;
      var r = btn.getBoundingClientRect();
      var width = Math.min(300, window.innerWidth - 16);
      tip.style.width = width + 'px';
      var left = r.left - width - 12;
      if (left < 8) left = Math.min(window.innerWidth - width - 8, r.right + 12);
      var top = r.top;
      if (top + 88 > window.innerHeight) top = Math.max(8, window.innerHeight - 96);
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }
    container.querySelectorAll('.agent-compose-field[data-hint], [data-insert-snippet][data-hint]').forEach(function(btn) {
      btn.addEventListener('mouseenter', function() { show(btn); });
      btn.addEventListener('mouseleave', hideComposeFieldTip);
      btn.addEventListener('focus', function() { show(btn); });
      btn.addEventListener('blur', hideComposeFieldTip);
    });
    var side = container.querySelector('.agent-compose-side');
    if (side) side.addEventListener('scroll', hideComposeFieldTip);
  }

  function focusedComposeField(container, node) {
    var active = container.querySelector('[data-field-key]:focus');
    if (active) return active;
    var key = node.config && node.config.activeZone;
    if (key) {
      var el = container.querySelector('[data-field-key="' + key.replace(/"/g, '') + '"]');
      if (el) return el;
    }
    return container.querySelector('[data-field-key]');
  }

  function composeFieldTypeOf(node, key) {
    var found = ((node.config && node.config.variables) || []).find(function(v) { return v.key === key; });
    return normalizeComposeFieldType(found && found.type);
  }

  function setComposeSideTab(container, tab) {
    var root = container.querySelector('.agent-compose') || container;
    if (tab !== 'math') tab = 'flux';
    root.setAttribute('data-side-tab', tab);
    container.querySelectorAll('button[data-side-tab]').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-side-tab') === tab);
    });
    container.querySelectorAll('[data-tab-panel]').forEach(function(panel) {
      var show = panel.getAttribute('data-tab-panel') === tab;
      if (show) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
  }

  function composeSourceLabel(el) {
    var name = el && el.querySelector('.agent-compose-source-name');
    return name ? String(name.textContent || '').trim() : '';
  }

  function readComposeOpenSources(container) {
    var open = [];
    if (!container) return open;
    container.querySelectorAll('.agent-compose-source.is-open').forEach(function(el) {
      var k = composeSourceLabel(el);
      if (k) open.push(k);
    });
    return open;
  }

  function applyComposeOpenSources(container, keys) {
    if (!container) return;
    var want = {};
    (keys || []).forEach(function(k) { want[k] = true; });
    container.querySelectorAll('.agent-compose-source').forEach(function(el) {
      var open = !!want[composeSourceLabel(el)];
      el.classList.toggle('is-open', open);
      var btn = el.querySelector('[data-toggle-source]');
      if (btn) btn.textContent = open ? 'Replier' : 'Ouvrir';
    });
  }

  function refreshComposeModal(node) {
    var body = document.getElementById('actionComposeModalBody');
    if (!body) return;
    var keepKey = node.config && node.config.activeZone;
    var openSources = readComposeOpenSources(body);
    body.innerHTML = actionComposeEditorHtml(node);
    bindComposeEditor(body, node);
    applyComposeOpenSources(body, openSources);
    if (keepKey) {
      var el = body.querySelector('[data-field-key="' + keepKey.replace(/"/g, '') + '"]');
      if (el) el.focus();
    }
  }

  function bindComposeEditor(container, node) {
    if (!container || !node) return;
    container._node = node;
    bindComposeFieldTips(container);
    container.querySelectorAll('.agent-compose-source').forEach(function(source) {
      var bar = source.querySelector('.agent-compose-source-head') || source.querySelector('.agent-compose-source-toggle');
      if (!bar) return;
      bar.addEventListener('click', function(ev) {
        if (ev.target.closest('[data-insert-snippet], [data-insert]')) return;
        ev.preventDefault();
        ev.stopPropagation();
        var open = source.classList.toggle('is-open');
        var btn = source.querySelector('[data-toggle-source]');
        if (btn) btn.textContent = open ? 'Replier' : 'Ouvrir';
      });
    });
    container.querySelectorAll('[data-toggle-ns-fields]').forEach(function(btn) {
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = btn.getAttribute('data-toggle-ns-fields') || '';
        var box = container.querySelector('[data-ns-fields="' + String(id).replace(/"/g, '') + '"]');
        if (!box) return;
        var collapsed = box.classList.toggle('is-collapsed');
        btn.textContent = collapsed ? 'Champs de la ligne ▸' : 'Champs de la ligne ▾';
      });
    });
    container.querySelectorAll('[data-toggle-item-fields]').forEach(function(btn) {
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var box = container.querySelector('[data-item-fields]');
        if (!box) return;
        var collapsed = box.classList.toggle('is-collapsed');
        btn.textContent = collapsed ? 'Champs de la ligne ▸' : 'Champs de la ligne ▾';
      });
    });
    container.querySelectorAll('select[data-key="copyFrom"]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        setCopyFrom(node, sel.value);
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-field-key]').forEach(function(input) {
      input.addEventListener('focus', function() {
        node.config.activeZone = input.getAttribute('data-field-key');
      });
      input.addEventListener('input', function() {
        setZoneValue(node, input.getAttribute('data-field-key'), input.value);
      });
    });
    container.querySelectorAll('button[data-side-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setComposeSideTab(container, btn.getAttribute('data-side-tab'));
      });
    });
    container.querySelectorAll('[data-set-field-type]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var key = sel.getAttribute('data-set-field-type');
        setComposeFieldType(node, key, sel.value);
        refreshComposeModal(node);
      });
    });
    container.querySelectorAll('[data-set-field-required]').forEach(function(box) {
      box.addEventListener('change', function() {
        setComposeFieldRequired(node, box.getAttribute('data-set-field-required'), box.checked);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-field-label]').forEach(function(input) {
      input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          input.blur();
        }
      });
      input.addEventListener('input', function() {
        var oldKey = input.getAttribute('data-field-label');
        var found = (node.config.variables || []).find(function(v) { return v.key === oldKey; });
        if (found) found.label = input.value;
        var slugEl = container.querySelector('[data-field-slug="' + String(oldKey).replace(/"/g, '') + '"]');
        var next = slugZoneKey(input.value);
        if (slugEl && next) slugEl.textContent = '{{' + ensureNodeSlug(node) + '.' + next + '}}';
      });
      input.addEventListener('change', function() {
        var oldKey = input.getAttribute('data-field-label');
        var next = renameComposeField(node, oldKey, input.value);
        if (next !== oldKey) {
          refreshComposeModal(node);
          return;
        }
        var slugEl = container.querySelector('[data-field-slug="' + String(oldKey).replace(/"/g, '') + '"]');
        if (slugEl) slugEl.textContent = '{{' + ensureNodeSlug(node) + '.' + oldKey + '}}';
      });
    });
    container.querySelectorAll('[data-insert], [data-insert-snippet]').forEach(function(btn) {
      btn.addEventListener('mousedown', function(ev) { ev.preventDefault(); });
      btn.addEventListener('click', function() {
        var snippetId = btn.getAttribute('data-insert-snippet') || '';
        var nsSlug = btn.getAttribute('data-ns-slug') || '';
        var dataInsert = btn.getAttribute('data-insert') || '';
        var ta = focusedComposeField(container, node);
        if (!ta && !((node.config && node.config.variables) || []).length) {
          addComposeZone(node, 'texte', 'Texte');
          refreshComposeModal(node);
          ta = focusedComposeField(container, node);
        }
        if (!ta) return;
        var token = '';
        var cursorOffset = null;
        if (snippetId === 'ns-loop-open' || snippetId === 'ns-loop' || snippetId === 'items-digest') {
          var slug = nsSlug || upstreamDataSlug(node) || 'donnees';
          var open = '{{#' + slug + '[i]}}';
          var close = '{{/' + slug + '}}';
          var current = ta.value || '';
          var selStart = typeof ta.selectionStart === 'number' ? ta.selectionStart : current.length;
          var selEnd = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : selStart;
          var selected = current.slice(selStart, selEnd);
          if (selected) {
            token = open + '\n' + selected + '\n' + close;
          } else {
            token = open + '\n\n' + close;
            cursorOffset = open.length + 1;
          }
        } else if (snippetId === 'ns-loop-close') {
          var closeSlug = nsSlug || upstreamDataSlug(node) || 'donnees';
          token = '{{/' + closeSlug + '}}';
        } else {
          token = dataInsert;
        }
        var start = typeof ta.selectionStart === 'number' ? ta.selectionStart : String(ta.value || '').length;
        var end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : start;
        var v = ta.value || '';
        ta.value = v.slice(0, start) + token + v.slice(end);
        var caret = start + (cursorOffset != null ? cursorOffset : token.length);
        ta.selectionStart = ta.selectionEnd = caret;
        ta.focus();
        setZoneValue(node, ta.getAttribute('data-field-key'), ta.value);
        node.config.activeZone = ta.getAttribute('data-field-key');
      });
    });
    var addZone = container.querySelector('[data-add-zone]');
    if (addZone) {
      addZone.addEventListener('click', function() {
        var label = window.prompt('Nom du champ (ex. Destinataire, Prompt, RAG)', '');
        if (!label) return;
        addComposeZone(node, label, label);
        refreshComposeModal(node);
      });
    }
    container.querySelectorAll('[data-apply-zone-preset]').forEach(function(applyPreset) {
      applyPreset.addEventListener('click', function() {
        applyZonePreset(node, applyPreset.getAttribute('data-apply-zone-preset'));
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    var fillDigest = container.querySelector('[data-fill-mail-digest]');
    if (fillDigest) {
      fillDigest.addEventListener('click', function() {
        fillMailDigestBody(node);
        refreshComposeModal(node);
        renderCanvas();
      });
    }
    container.querySelectorAll('[data-remove-zone]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        removeComposeZone(node, btn.getAttribute('data-remove-zone'));
        refreshComposeModal(node);
      });
    });
    container.querySelectorAll('[data-compose-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        node.config.activeComposeTab = btn.getAttribute('data-compose-tab') || 'fields';
        node.config.pickingOutput = false;
        refreshComposeModal(node);
      });
    });
    container.querySelectorAll('[data-map-an-output]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        startMapOutput(node);
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-pick-output]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var out = state.nodes.find(function(n) { return n.id === btn.getAttribute('data-pick-output'); });
        if (out) addOutputMap(node, out);
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    var cancelPick = container.querySelector('[data-cancel-pick-output]');
    if (cancelPick) {
      cancelPick.addEventListener('click', function() {
        node.config.pickingOutput = false;
        refreshComposeModal(node);
      });
    }
    container.querySelectorAll('[data-remove-output-map]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        removeOutputMap(node, btn.getAttribute('data-remove-output-map'));
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-output-copy-from]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var out = state.nodes.find(function(n) { return n.id === node.config.activeComposeTab; });
        if (!out) return;
        setOutputMapCopyFrom(node, out, sel.value);
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-add-output-slot]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var out = state.nodes.find(function(n) { return n.id === node.config.activeComposeTab; });
        var key = sel.value;
        if (!out || !key) return;
        addOutputMapSlot(node, out, key);
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-remove-output-slot]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var out = state.nodes.find(function(n) { return n.id === node.config.activeComposeTab; });
        if (!out) return;
        removeOutputMapSlot(node, out, btn.getAttribute('data-remove-output-slot'));
        refreshComposeModal(node);
        renderCanvas();
      });
    });
    container.querySelectorAll('[data-output-map-key]').forEach(function(input) {
      input.addEventListener('input', function() {
        var out = state.nodes.find(function(n) { return n.id === node.config.activeComposeTab; });
        if (!out) return;
        setOutputMapValue(node, out, input.getAttribute('data-output-map-key'), input.value);
      });
      input.addEventListener('change', function() {
        renderCanvas();
      });
    });
  }

  function refreshOpenActionComposeModal() {
    var el = document.getElementById('actionComposeModal');
    if (!el || !el.classList.contains('is-open')) return;
    var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    if (node && node.brickId === 'action' && !isFunctionAction(node)) {
      refreshComposeModal(node);
    }
  }

  function openActionComposeModal(node, focusKey) {
    if (!node) return;
    try {
      ensureActionConfig(node);
      if (isFunctionAction(node)) return;
      getUpstreamNodes(node.id).forEach(function(n) {
        var tid = n && n.brickId === 'ia' ? nodeTemplateId(n) : '';
        if (tid) loadBlockTemplateDetails(tid);
      });
      node.config.actionId = 'ia.compose';
      node.config.operation = 'ia.compose';
      if (node.config.kind === 'ia') delete node.config.kind;
      ensureComposeZones(node);
      var el = ensureActionComposeModal();
      applyExpertViewClass();
      var title = el.querySelector('#actionComposeModalTitle');
      if (title) title.textContent = (node.name && node.name !== 'Action') ? node.name : 'Champs de l’action';
      var body = el.querySelector('#actionComposeModalBody');
      if (body) {
        body.innerHTML = actionComposeEditorHtml(node);
        bindComposeEditor(body, node);
      }
      el.removeAttribute('hidden');
      el.classList.add('is-open');
      el.style.display = 'flex';
      var focus = null;
      if (focusKey) {
        el.querySelectorAll('[data-field-key]').forEach(function(inp) {
          if (!focus && inp.getAttribute('data-field-key') === focusKey) focus = inp;
        });
      }
      if (!focus) focus = el.querySelector('[data-field-key]');
      if (focus) {
        var block = focus.closest('[data-field-block]');
        if (block && block.scrollIntoView) block.scrollIntoView({ block: 'nearest' });
        setTimeout(function() { focus.focus(); }, 0);
      }
    } catch (err) {
      console.error('Éditeur de champs', err);
      window.alert('Impossible d’ouvrir l’éditeur : ' + ((err && err.message) || err));
    }
  }

  function initActionComposeModal() {
    if (state._composeModalBound) return;
    state._composeModalBound = true;
    document.addEventListener('click', function(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-open-action-compose]')) {
        ev.preventDefault();
        ev.stopPropagation();
        var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
        if (node && node.brickId === 'action') openActionComposeModal(node);
        return;
      }
      if (t.closest('[data-close-compose-modal]')) {
        ev.preventDefault();
        closeActionComposeModal();
      }
    });
    document.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Escape') return;
      var el = document.getElementById('actionComposeModal');
      if (el && el.classList.contains('is-open')) {
        ev.preventDefault();
        closeActionComposeModal();
      }
    });
  }

  function collectionEditorUrl(id, mode) {
    var base = String(cfg.docTemplateUrl || '').replace(/\/index\.php$/i, '').replace(/\/$/, '');
    if (!base) return '';
    if (!id) return base + '/collections/create';
    if (mode === 'edit') return base + '/collections/edit/' + encodeURIComponent(id);
    return base + '/collections/' + encodeURIComponent(id) + '/elements/list';
  }

  function refreshSelectedCollectionFromDoc() {
    var n = state.nodes.find(function(x) { return x.id === state.selectedNodeId; });
    if (!n || !n.config) return;
    if (n.brickId !== 'data' && !isCollectionOutput(n)) return;
    var id = linkedCollectionId(n);
    if (!id) return;
    loadV3CollectionDetail(id)
      .then(function(model) {
        applyCollectionToNode(n, model);
        return loadDocCollections(true);
      })
      .then(function() {
        renderCanvas();
        renderConfig();
      })
      .catch(function() { /* l’éditeur n’est pas encore refermé */ });
  }

  function openCollectionEditor(node, mode) {
    if (!node) return;
    var id = linkedCollectionId(node);
    function go(collectionId, pageMode) {
      state._collectionEditorOpen = true;
      saveFlow({ silent: true }).catch(function() { /* on ouvre quand même */ }).then(function() {
        var url = collectionEditorUrl(collectionId, pageMode);
        var win = window.open(url, 'gdriCollectionEditor');
        if (!win) window.location.href = url;
      });
    }
    if (id) {
      var hasFields = Array.isArray(node.config.modelFields) && node.config.modelFields.length;
      go(id, mode || (hasFields ? 'elements' : 'edit'));
      return;
    }
    var suggested = String((node.config && node.config.modelName) || '').trim() || 'Nouvelle collection';
    var name = window.prompt('Nom de la collection (éditeur V3)', suggested);
    if (!name) return;
    createDocCollection(name.trim(), node).then(function(model) {
      renderCanvas();
      renderConfig();
      go(collectionKeyOf(model) || linkedCollectionId(node), 'edit');
    }).catch(function(err) {
      window.alert('Impossible de créer la collection : ' + ((err && err.message) || err));
    });
  }

  function initCollectionEditorBridge() {
    if (state._collectionEditorBound) return;
    state._collectionEditorBound = true;
    document.addEventListener('click', function(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-open-collection-editor]')) {
        ev.preventDefault();
        ev.stopPropagation();
        var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
        if (node && (node.brickId === 'data' || isCollectionOutput(node))) openCollectionEditor(node);
      }
    });
    window.addEventListener('message', function(ev) {
      if (!ev || !ev.data || ev.data.type !== 'gdri-collection-updated') return;
      if (ev.origin && ev.origin !== window.location.origin) return;
      state._collectionEditorOpen = false;
      refreshSelectedCollectionFromDoc();
    });
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && state._collectionEditorOpen) {
        refreshSelectedCollectionFromDoc();
      }
    });
  }

  function fillDataContractModal(node) {
    var el = ensureDataContractModal();
    var hint = el.querySelector('#dataContractModalHint');
    var body = el.querySelector('#dataContractModalBody');
    var provider = resolveDataProvider(node);
    if (hint) {
      var providerLabel = dataProviderLabel(provider) || provider || 'ce bloc';
      hint.textContent = 'Champs renvoyés par « ' + providerLabel + ' ».';
    }
    if (body) {
      try {
        body.innerHTML = dataContractPreviewHtml(node) || '<p class="empty">Aucune structure pour ce canal.</p>';
      } catch (err) {
        body.innerHTML = '<p class="empty">Impossible d’afficher la structure.</p>';
      }
    }
  }

  function openDataContractModal(node) {
    if (!node) return;
    var el = ensureDataContractModal();
    fillDataContractModal(node);
    setContractModalTitle('Structure des données');
    el.removeAttribute('hidden');
    el.classList.add('is-open');
    el.style.display = 'flex';
  }

  function initDataContractModal() {
    if (state._contractModalBound) return;
    state._contractModalBound = true;
    document.addEventListener('click', function(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-test-data]')) {
        ev.preventDefault();
        ev.stopPropagation();
        var testNode = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
        if (testNode && testNode.brickId === 'data') testDataNode(testNode);
        return;
      }
      if (t.closest('[data-open-node-io]')) {
        ev.preventDefault();
        ev.stopPropagation();
        var ioBtn = t.closest('[data-open-node-io]');
        var ioNodeEl = ioBtn.closest('.agent-node');
        var ioNodeId = ioBtn.getAttribute('data-io-node')
          || (ioNodeEl && ioNodeEl.getAttribute('data-id'))
          || state.selectedNodeId;
        var ioNode = state.nodes.find(function(n) { return n.id === ioNodeId; });
        if (ioNode) openNodeIoModal(ioNode);
        return;
      }
      if (t.closest('[data-open-data-contract]')) {
        ev.preventDefault();
        ev.stopPropagation();
        var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
        if (node && node.brickId === 'data') openDataContractModal(node);
        return;
      }
      if (t.closest('[data-open-link-contract]')) {
        ev.preventDefault();
        ev.stopPropagation();
        if (state.selectedLink) openLinkContract(state.selectedLink);
        return;
      }
      var portBtn = t.closest('[data-open-port-contract]');
      if (portBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        var side = portBtn.getAttribute('data-open-port-contract');
        var selected = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
        if (selected) openFlowContractModal(selected, side);
        return;
      }
      if (t.closest('[data-close-data-test-modal]')) {
        ev.preventDefault();
        closeDataTestModal();
        return;
      }
      if (t.closest('[data-close-contract-modal]')) {
        ev.preventDefault();
        closeDataContractModal();
      }
    });
    document.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape') {
        var testModal = document.getElementById('dataTestModal');
        if (testModal && testModal.classList.contains('is-open')) {
          closeDataTestModal();
          return;
        }
        var compose = document.getElementById('actionComposeModal');
        if (compose && compose.classList.contains('is-open')) return;
        closeDataContractModal();
      }
    });
  }

  function allKindsForPreview(node) {
    var contract = getConnectorContract(resolveDataProvider(node));
    return (contract && contract.kinds) || [];
  }

  function dataContractPreviewHtml(node) {
    var kinds = allKindsForPreview(node);
    if (!kinds.length) kinds = selectedKindsForNode(node);
    if (!kinds.length) return '';
    var html = '<div style="margin-top:12px;">';
    html += '<p style="margin:0 0 8px; color:#93c5fd; font-size:0.85rem;">Structure par type — Graph / webhook brut, puis message agent (après mapping).</p>';
    kinds.forEach(function(kind) {
      var fields = fieldsForKind(node, kind);
      var sample = (kind.example && typeof kind.example === 'object') ? kind.example : null;
      var graphSample = (kind.graphExample && typeof kind.graphExample === 'object') ? kind.graphExample : null;
      var webhookSample = (kind.webhookExample && typeof kind.webhookExample === 'object') ? kind.webhookExample : null;
      var ingestLabel = Array.isArray(kind.ingest) && kind.ingest.length
        ? kind.ingest.join(' / ')
        : '';
      html += '<details style="margin:0 0 10px; color:#94a3b8; font-size:0.85rem; padding:10px; border:1px solid #1f2937; border-radius:8px; background:#0f172a;">';
      html += '<summary style="color:#e2e8f0;"><strong>' + escapeHtml(kind.label || kind.id) + '</strong> <code>'
        + escapeHtml(kind.id) + '</code>';
      if (kind.example && kind.example.type) {
        html += ' · type=<code>' + escapeHtml(String(kind.example.type)) + '</code>';
      }
      if (ingestLabel) {
        html += ' <span style="color:#64748b;">(' + escapeHtml(ingestLabel) + ')</span>';
      }
      html += '</summary>';
      if (kind.graphPath) {
        html += '<p style="margin:8px 0 0; color:#64748b;">Graph <code>' + escapeHtml(kind.graphPath) + '</code>';
        if (Array.isArray(kind.graphFields) && kind.graphFields.length) {
          html += ' · fields=' + escapeHtml(kind.graphFields.join(','));
        }
        html += '</p>';
      }
      html += '<ul style="margin:8px 0 0; padding-left:1.1rem;">';
      fields.forEach(function(f) {
        html += '<li><strong>' + escapeHtml(f.label) + '</strong> <code>' + escapeHtml(f.key) + '</code>';
        if (f.required) html += ' <span style="color:#f97316;">*</span>';
        if (f.type && f.type !== 'string' && f.type !== 'text') {
          html += ' <span style="color:#64748b;">' + escapeHtml(f.type) + '</span>';
        }
        if (Array.isArray(f.enum) && f.enum.length) {
          html += ' <span style="color:#38bdf8;">' + escapeHtml(f.enum.join(' | ')) + '</span>';
        }
        if (f.graph) {
          html += ' <span style="color:#38bdf8;">← Graph ' + escapeHtml(String(f.graph)) + '</span>';
        }
        if (f.example != null) {
          html += ' <span style="color:#64748b;">ex. ' + escapeHtml(formatFieldExample(f.example)) + '</span>';
        }
        html += '</li>';
      });
      html += '</ul>';
      if (graphSample) {
        html += '<p style="margin:10px 0 4px; color:#93c5fd;">Réponse Graph (brut)</p>';
        html += '<pre style="margin:0; padding:10px; border-radius:8px; background:#020617; color:#cbd5e1; overflow:auto; font-size:0.75rem;">'
          + escapeHtml(JSON.stringify(graphSample, null, 2)) + '</pre>';
      }
      if (webhookSample) {
        html += '<p style="margin:10px 0 4px; color:#93c5fd;">Webhook (brut)</p>';
        html += '<pre style="margin:0; padding:10px; border-radius:8px; background:#020617; color:#cbd5e1; overflow:auto; font-size:0.75rem;">'
          + escapeHtml(JSON.stringify(webhookSample, null, 2)) + '</pre>';
      }
      if (sample) {
        html += '<p style="margin:10px 0 4px; color:#93c5fd;">Après mapping — channel=' + escapeHtml(String((sample.channel || '') || 'facebook'))
          + ' · type=' + escapeHtml(String(sample.type || '')) + '</p>';
        html += '<pre style="margin:0; padding:10px; border-radius:8px; background:#020617; color:#cbd5e1; overflow:auto; font-size:0.75rem;">'
          + escapeHtml(JSON.stringify(sample, null, 2)) + '</pre>';
      }
      html += '</details>';
    });
    html += '</div>';
    return html;
  }

  function inheritedChannelHintHtml(node) {
    if (currentTriggerMode(node) !== 'webhook') return '';
    var trigger = getTriggerNode(node);
    var id = trigger && trigger.config ? String(trigger.config.webhookInstanceId || '') : '';
    var inst = findConnectorInstance(id) || findConnectorInstance(node && node.config && node.config.instanceId);
    var label = inst ? instanceLabel(inst) : (id || 'aucun webhook choisi');
    return '<p class="empty" style="margin-bottom:12px; color:#93c5fd;">Canal hérité du déclencheur : <strong>'
      + escapeHtml(label) + '</strong></p>';
  }

  function triggerModeLabel(mode, config) {
    var m = String(mode || 'button');
    if (m === 'webhook') {
      var inst = findConnectorInstance(config && config.webhookInstanceId);
      return inst ? ('webhook · ' + (inst.name || instanceIdOf(inst))) : 'webhook';
    }
    if (m === 'cron') return 'cron';
    if (m === 'block' || m === 'select' || m === 'import') return 'bloc · sélection / import';
    return 'bouton';
  }

  function dataNodeSummary(config) {
    var provider = String((config && config.provider) || '');
    if (provider === 'flow' || provider === 'flux') {
      return 'flux parent';
    }
    if (provider === 'json') {
      var raw = String((config && config.payload) || '').trim();
      var rows = Array.isArray(config && config.modelRows) ? config.modelRows.length : 0;
      var name = String((config && config.modelName) || '').trim();
      var id = String((config && (config.collectionId || config.collectionNamespace)) || '').trim();
      var prefix = id ? 'collection' : 'liste';
      if (name && rows) return prefix + ' · ' + name + ' (' + rows + ')';
      if (rows) return prefix + ' · ' + rows + ' ligne(s)';
      if (id) return 'collection · ' + (name || id);
      return raw ? 'liste · saisi' : 'liste';
    }
    if (provider === 'database') {
      var src = String((config && config.dbSource) || 'intentions');
      if (src === 'intention-preset') return 'base · preset ' + String((config && config.presetId) || 'mail');
      return 'base · intentions';
    }
    var inst = findConnectorInstance(config && config.instanceId);
    var base = inst
      ? (providerFromConnectorId(inst.connectorId) + ' · ' + (inst.name || instanceIdOf(inst)))
      : (provider || 'canal');
    var kinds = Array.isArray(config && config.kinds) ? config.kinds : [];
    if (kinds.length) base += ' · ' + kinds.join(', ');
    if (provider === 'mail') {
      var bits = [];
      if (config && config.mailbox) bits.push(config.mailbox);
      if (config && config.unseenOnly !== false) bits.push('non lus');
      if (config && config.fromContains) bits.push('de ' + String(config.fromContains).slice(0, 18));
      if (config && config.pollByDate) bits.push(formatLookbackLabel(config.lookbackHours != null ? config.lookbackHours : 168));
      if (config && config.pollByCount !== false) bits.push('N=' + (config.pollLimit != null ? config.pollLimit : 20));
      if (bits.length) base += ' · ' + bits.join(' · ');
    }
    return base;
  }

  function outputNodeSummary(config) {
    var provider = String((config && config.provider) || '').toLowerCase();
    var connectorId = String((config && config.connectorId) || '').trim();
    if (provider === 'flow' || provider === 'flux' || connectorId === 'flow' || connectorId === 'flux') {
      var exportName = String((config && config.exportName) || '').trim();
      var nFields = Array.isArray(config && config.exportFields) ? config.exportFields.filter(Boolean).length : 0;
      var label = exportName ? ('Flux · ' + exportName) : 'Flux nommé';
      if (nFields) label += ' · ' + nFields + ' champ' + (nFields > 1 ? 's' : '');
      return label;
    }
    if (provider === 'collection' || connectorId === 'collection') {
      var name = String((config && (config.modelName || config.collectionNamespace || config.collectionId)) || '').trim();
      return name ? ('Collection · ' + name) : 'Collection';
    }
    var type = connectorTypeById(connectorId);
    var typeName = (type && type.name) || outputProviderLabel(provider || connectorId);
    var inst = findConnectorInstance(config && config.instanceId);
    if (inst) {
      return typeName + ' · ' + (inst.name || instanceIdOf(inst));
    }
    if (config && config.accountRef) return typeName + ' · ' + String(config.accountRef);
    if (config && config.pageId) return typeName + ' · ' + String(config.pageName || config.pageId);
    if (config && config.emitUrl) return typeName + ' · ' + String(config.emitUrl);
    return typeName || 'Sortie';
  }

  function connectorMismatch(dataNode) {
    var provider = String((dataNode && dataNode.config && dataNode.config.provider) || '');
    if (isLocalDataProvider(provider)) return null;
    var trigger = getTriggerNode(dataNode);
    if (!trigger || String((trigger.config && trigger.config.mode) || '') !== 'webhook') return null;
    var webhookId = String((trigger.config && trigger.config.webhookInstanceId) || '').trim();
    if (!webhookId) return null;
    var node = dataNode || state.nodes.find(function(n) { return n.brickId === 'data'; });
    if (!node) return null;
    var dataId = String((node.config && node.config.instanceId) || '').trim();
    if (!dataId) return { kind: 'empty', webhookId: webhookId };
    if (dataId !== webhookId) return { kind: 'mismatch', webhookId: webhookId, dataId: dataId };
    return null;
  }

  function connectorMismatchHtml(dataNode) {
    var info = connectorMismatch(dataNode);
    if (!info) return '';
    var webhookInst = findConnectorInstance(info.webhookId);
    var dataInst = info.dataId ? findConnectorInstance(info.dataId) : null;
    var msg = info.kind === 'empty'
      ? 'Entrées n’est pas encore aligné sur le webhook du déclencheur (' + instanceLabel(webhookInst || { name: info.webhookId }) + ').'
      : 'Le connecteur d’Entrées (' + instanceLabel(dataInst || { name: info.dataId }) + ') est différent du webhook du déclencheur (' + instanceLabel(webhookInst || { name: info.webhookId }) + ').';
    return '<div class="agent-conn-panel" style="margin:12px 0; border-color:#b45309; background:#431407;">'
      + '<p style="margin:0 0 8px; color:#fdba74; font-size:0.85rem;">' + escapeHtml(msg) + '</p>'
      + '<button type="button" class="btn-agent" id="btnAlignDataWebhook">Aligner Entrées sur le webhook</button>'
      + '</div>';
  }

  function applyWebhookPresetToData(opts) {
    opts = opts || {};
    var onlyId = opts.nodeId ? String(opts.nodeId) : '';
    var dataNodeHint = onlyId ? state.nodes.find(function(n) { return n.id === onlyId; }) : null;
    var trigger = opts.trigger || getTriggerNode(dataNodeHint);
    if (!trigger || triggerModeOf(trigger) !== 'webhook') {
      var webhooks = state.nodes.filter(function(n) {
        return isTriggerNode(n) && triggerModeOf(n) === 'webhook';
      });
      if (onlyId && webhooks.length === 1) trigger = webhooks[0];
      else return;
    }
    if (!trigger || triggerModeOf(trigger) !== 'webhook') return;
    var instanceId = String((trigger.config && trigger.config.webhookInstanceId) || '').trim();
    if (!instanceId) return;
    var subgraph = nodeDescendantIds(trigger.id);
    var inst = findConnectorInstance(instanceId);
    var provider = inst ? providerFromConnectorId(inst.connectorId) : null;
    var previousId = opts.previousId != null ? String(opts.previousId || '') : String(state.lastWebhookPresetId || '');
    var updated = false;
    state.nodes.forEach(function(dataNode) {
      if (dataNode.brickId !== 'data') return;
      if (onlyId && dataNode.id !== onlyId) return;
      if (!onlyId && subgraph.indexOf(dataNode.id) === -1) return;
      if (!dataNode.config || typeof dataNode.config !== 'object') dataNode.config = {};
      var current = String(dataNode.config.instanceId || '').trim();
      var wasPreset = previousId && current === previousId;
      var aligned = !current || current === instanceId || wasPreset;
      if (!opts.force && !aligned) return;
      updated = true;
      dataNode.config.instanceId = instanceId;
      if (provider) dataNode.config.provider = provider;
      if (inst && inst.settings) {
        if (inst.settings.accountRef) dataNode.config.accountRef = String(inst.settings.accountRef);
      }
      if (provider === 'facebook') {
        applyFacebookAccountToNode(dataNode, { instanceId: instanceId });
        ensureFacebookListenConfig(dataNode);
      } else if (inst && inst.settings && inst.settings.pageId) {
        dataNode.config.pageId = String(inst.settings.pageId);
        if (inst.settings.pageName) dataNode.config.pageName = String(inst.settings.pageName);
      }
      ensureDataKinds(dataNode);
    });
    if (updated) {
      state.lastWebhookPresetId = instanceId;
      fillFacebookPageSelects();
    }
  }

  function initWebhookPresetTracking() {
    var trigger = state.nodes.find(function(n) {
      return isTriggerNode(n) && triggerModeOf(n) === 'webhook';
    }) || getTriggerNode();
    var dataNode = state.nodes.find(function(n) { return n.brickId === 'data'; });
    var webhookId = trigger && trigger.config ? String(trigger.config.webhookInstanceId || '').trim() : '';
    var dataId = dataNode && dataNode.config ? String(dataNode.config.instanceId || '').trim() : '';
    state.lastWebhookPresetId = (webhookId && dataId && webhookId === dataId) ? webhookId : null;
  }

  function connectorInstanceSelectHtml(opts) {
    var sel = String(opts.value || '');
    var instances = opts.instances || [];
    var html = '<div class="form-group"><label>' + escapeHtml(opts.title) + '</label>';
    html += '<select data-key="' + escapeHtml(opts.key) + '">';
    html += '<option value="">— Choisir —</option>';
    if (!state.connectorInstancesLoaded) {
      html += '<option value="" disabled>Chargement…</option>';
    } else if (!instances.length) {
      html += '<option value="" disabled>Aucune instance</option>';
    } else {
      instances.forEach(function(inst) {
        var id = instanceIdOf(inst);
        html += '<option value="' + escapeHtml(id) + '"' + (sel === id ? ' selected' : '') + '>'
          + escapeHtml(instanceLabel(inst)) + '</option>';
      });
      if (sel && !instances.some(function(inst) { return instanceIdOf(inst) === sel; })) {
        html += '<option value="' + escapeHtml(sel) + '" selected>' + escapeHtml(sel) + ' (hors liste)</option>';
      }
    }
    html += '</select>';
    if (!state.connectorInstancesLoaded) {
      html += '<p class="empty" style="margin-top:6px;">Chargement des connecteurs…</p>';
    } else if (!instances.length) {
      html += '<p class="empty" style="margin-top:6px; color:#fb923c;">' + escapeHtml(opts.emptyHint || 'Aucune instance.') + '</p>';
    } else if (opts.help) {
      html += '<p class="empty" style="margin-top:6px;">' + escapeHtml(opts.help) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function loadMailAccounts() {
    return fetch(API_ROOT + '/mail/config/mail', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        state.mailConfig = (data && (data.effective_config || data.config)) || null;
        state.mailConfigLoaded = true;
        return state.mailConfig;
      })
      .catch(function() {
        state.mailConfigLoaded = true;
        state.mailConfig = state.mailConfig || null;
        return state.mailConfig;
      });
  }

  function loadConnectorCatalog() {
    var typesUrl = API_ROOT + '/connectors';
    var listUrl = API_ROOT + '/connectors/instances/list/all';
    var contractsUrl = API + '/data-contracts';
    var actionsUrl = API + '/action-contracts';
    return Promise.all([
      fetch(typesUrl, { headers: headers() }).then(parseJson).catch(function() { return null; }),
      fetch(listUrl, { headers: headers() }).then(parseJson).catch(function() { return null; }),
      fetch(contractsUrl, { headers: headers() }).then(parseJson).catch(function() { return null; }),
      fetch(actionsUrl, { headers: headers() }).then(parseJson).catch(function() { return null; })
    ]).then(function(results) {
      var typesData = results[0];
      var listData = results[1];
      var contractsData = results[2];
      var actionsData = results[3];
      state.dataContracts = (contractsData && contractsData.contracts) || state.dataContracts;
      state.actionContracts = (actionsData && actionsData.contracts) || state.actionContracts;
      state.zoneContracts = (actionsData && actionsData.zones) || state.zoneContracts;
      state.connectorTypes = (typesData && (typesData.data || typesData.connectors)) || [];
      if (!Array.isArray(state.connectorTypes)) state.connectorTypes = [];
      state.connectorInstances = (listData && (listData.data || listData.instances)) || [];
      if (!Array.isArray(state.connectorInstances)) state.connectorInstances = [];
      state.connectorInstancesLoaded = true;
      return state.connectorInstances;
    }).catch(function() {
      state.connectorInstancesLoaded = true;
      state.connectorInstances = state.connectorInstances || [];
      return state.connectorInstances;
    });
  }

  function normalizeEntityLlms(raw) {
    return (raw || []).map(function(doc) {
      if (!doc) return null;
      var id = String(doc.id || doc._id || '').trim();
      if (!id) return null;
      return {
        id: id,
        name: String(doc.name || doc.model || 'LLM'),
        model: String(doc.model || ''),
        provider: String(doc.provider || ''),
        serverName: String(doc.serverName || doc.server_name || ''),
        serverId: String(doc.serverId || doc.server_id || ''),
        isDefault: !!(doc.isDefault || doc.is_default)
      };
    }).filter(Boolean);
  }

  function loadEntityLlms() {
    if (state.entityLlmsLoaded) return Promise.resolve(state.entityLlms || []);
    if (state.entityLlmsPromise) return state.entityLlmsPromise;
    var qs = ENTREPRISE_ID
      ? ('?entrepriseId=' + encodeURIComponent(ENTREPRISE_ID) + '&entity_id=' + encodeURIComponent(ENTREPRISE_ID))
      : '';
    function apply(list) {
      state.entityLlms = normalizeEntityLlms(list);
      state.entityLlmsLoaded = true;
      state.entityLlmsPromise = null;
      return state.entityLlms;
    }
    function fromIaModule() {
      return fetch(API_ROOT + '/ia/available-llms' + qs, { headers: headers(), credentials: 'include' })
        .then(parseJson)
        .then(function(data) {
          return apply((data && data.success && Array.isArray(data.llms)) ? data.llms : []);
        });
    }
    state.entityLlmsPromise = fetch(API + '/llms' + qs, { headers: headers(), credentials: 'include' })
      .then(parseJson)
      .then(function(data) {
        var list = (data && data.success && Array.isArray(data.llms)) ? data.llms : [];
        if (list.length) return apply(list);
        return fromIaModule();
      })
      .catch(function() {
        return fromIaModule().catch(function() {
          return apply([]);
        });
      });
    return state.entityLlmsPromise;
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
    var node = getFacebookNode();
    if (node) syncFacebookAccountFromNode(node);
    var pageId = (node && node.config && node.config.pageId) || '';
    var pageEl = document.getElementById('fbPageId');
    if (pageEl) pageEl.value = pageId;
    var labelEl = document.getElementById('fbPageLabel');
    if (labelEl) {
      var page = findFacebookPage(pageId);
      var name = (page && page.pageName) || (node && node.config && node.config.pageName) || '';
      if (name && pageId && name !== pageId) {
        labelEl.textContent = name;
      } else if (pageId) {
        labelEl.textContent = pageId;
      } else {
        labelEl.textContent = 'Aucune page — choisissez-la dans le bloc Entrées (panneau de droite).';
      }
    }
    var hint = document.getElementById('fbPageHint');
    if (hint) {
      if (state.facebookPagesError) {
        hint.textContent = 'Erreur : ' + state.facebookPagesError + ' — vérifiez que le backend est redémarré.';
        hint.style.color = '#f87171';
      } else if (!(state.facebookPages || []).length) {
        hint.textContent = 'Aucune page pour cette entité. Connecteurs → Facebook.';
        hint.style.color = '#fb923c';
      } else {
        hint.textContent = 'Changez la page dans le bloc Entrées (panneau de droite). Ici : ce que l’agent écoute.';
        hint.style.color = '#64748b';
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
    if (key === 'webhookInstanceId') {
      return connectorInstanceSelectHtml({
        key: 'webhookInstanceId',
        title: title || 'Webhook',
        value: value,
        instances: listWebhookInstances(),
        emptyHint: 'Aucun webhook enregistré. Créez une instance Facebook ou HTTP dans Connecteurs (mode push).',
        help: 'Webhooks déjà posés sur les connecteurs. Entrées s’aligne sur le même canal.'
      });
    }
    if (key === 'instanceId' && opts.brickId === 'data') {
      return connectorInstanceSelectHtml({
        key: 'instanceId',
        title: title || 'Canal / instance',
        value: value,
        instances: listDataInstances(''),
        emptyHint: 'Aucune instance de ce type. Enregistrez le canal dans Connecteurs.',
        help: 'Instance connecteur utilisée pour lire les données.'
      });
    }
    if (key === 'pageId' && (opts.brickId === 'facebook' || opts.brickId === 'facebook-out' || opts.provider === 'facebook')) {
      var allowEmpty = opts.brickId !== 'facebook-out';
      return '<div class="form-group"><label>' + escapeHtml(title || 'Compte / page Facebook') + '</label>'
        + '<select data-key="pageId" data-fb-page-select="1" data-allow-empty="' + (allowEmpty ? '1' : '0') + '">'
        + facebookPageOptionsHtml(value, allowEmpty)
        + '</select>'
        + '<p class="empty" style="margin-top:6px;">Pages connectées de l\'entité (facebook_configs).</p>'
        + '</div>';
    }
    if (schema && (schema.format === 'context-field' || key === 'field' && (opts.brickId === 'logic-if' || opts.brickId === 'condition') || key === 'messageField')) {
      var ctxFields = opts.contextFields || [];
      var help = (schema && schema.description)
        || 'Liste des champs fournis par les blocs connectés en amont.';
      return '<div class="form-group"><label>' + escapeHtml(title) + '</label>'
        + contextFieldSelectHtml(ctxFields, value, key)
        + (isExpertView() ? ('<p class="empty" style="margin-top:6px;">' + escapeHtml(help) + '</p>') : '')
        + '</div>';
    }
    if (schema && schema.type === 'boolean') {
      var checked = value !== false && value !== 'false' ? ' checked' : '';
      return '<div class="form-group"><label class="agent-check"><input type="checkbox" data-key="' + key + '" data-type="boolean"' + checked + '><span>' + title + '</span></label></div>';
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

  function triggerFieldVisible(key, config) {
    if (key === 'mode') return true;
    if (key === 'pollIntervalMinutes' || key === 'webhookPath') return false;
    var mode = String((config && config.mode) || 'button');
    if (key === 'webhookInstanceId') return mode === 'webhook';
    if (key === 'blockOnSelect' || key === 'blockOnImport') return mode === 'block';
    if (mode !== 'cron') return false;
    var preset = String((config && config.preset) || 'daily');
    if (key === 'preset' || key === 'hour' || key === 'minute') return true;
    if (key === 'dayOfWeek') return preset === 'weekly';
    if (key === 'dayOfMonth') return preset === 'monthly';
    if (key === 'cron') return preset === 'custom';
    return false;
  }

  function loopFieldVisible(key, config) {
    if (key === 'mode') return true;
    var mode = String((config && config.mode) || 'items');
    if (mode === 'items' || mode === 'foreach' || mode === 'each') {
      return key === 'field' || key === 'maxIterations';
    }
    if (mode === 'times') return key === 'times';
    if (key === 'times') return false;
    if (key === 'value') {
      var opNow = (config && config.op) || 'truthy';
      return opNow !== 'truthy' && opNow !== 'falsy';
    }
    return key === 'field' || key === 'op' || key === 'maxIterations';
  }

  function conditionFieldVisible(/* key, node */) {
    return false;
  }

  function conditionOpSelectHtml(key, value, enumValues, enumLabels) {
    var labels = enumLabels || {};
    return '<select data-key="' + escapeHtml(key) + '">'
      + (enumValues || []).map(function(opt) {
        var lab = labels[opt] || (key === 'op' ? logicOpLabel(opt) : opt);
        return '<option value="' + escapeHtml(opt) + '"'
          + (String(value) === String(opt) ? ' selected' : '') + '>'
          + escapeHtml(lab) + '</option>';
      }).join('')
      + '</select>';
  }

  function conditionCollectionSelectHtml(node) {
    if (!state.docCollectionsLoaded) loadDocCollections().then(function() { renderConfig(); });
    var colId = conditionCaseCollectionId(node);
    var flowCols = collectionsInFlowForCondition(node);
    var html = '<div class="form-group"><label>Collection du flux</label>';
    html += '<select data-case-collection-pick="1">';
    html += '<option value="">— Choisir —</option>';
    var upstream = flowCols.filter(function(r) { return r.upstream; });
    var other = flowCols.filter(function(r) { return !r.upstream; });
    function optionsFor(list) {
      return list.map(function(r) {
        var lab = r.name || r.collectionId;
        if (r.nodeName && r.nodeName !== r.name) lab += ' · ' + r.nodeName;
        return '<option value="' + escapeHtml(r.collectionId) + '"'
          + (colId === r.collectionId ? ' selected' : '') + '>'
          + escapeHtml(lab) + '</option>';
      }).join('');
    }
    if (upstream.length) {
      html += '<optgroup label="En amont">' + optionsFor(upstream) + '</optgroup>';
    }
    if (other.length) {
      html += '<optgroup label="Dans ce flux">' + optionsFor(other) + '</optgroup>';
    }
    var inFlow = flowCols.some(function(r) { return r.collectionId === colId; });
    if (colId && !inFlow) {
      html += '<option value="' + escapeHtml(colId) + '" selected>'
        + escapeHtml((node.config && node.config.modelName) || colId)
        + ' (hors flux)</option>';
    }
    html += '</select>';
    if (!flowCols.length) {
      html += '<p class="empty" style="margin-top:6px; color:#fbbf24;">Aucune collection dans ce flux. Ajoutez d’abord un bloc Entrées (collection) ou Sortie (collection).</p>';
    } else if (!upstream.length && other.length) {
      html += '<p class="empty" style="margin-top:6px;">Reliez un bloc collection avant cette condition pour la voir en amont.</p>';
    }
    html += '</div>';
    var fields = fieldsForFlowCollection(colId, flowCols);
    if (colId && fields.length) {
      var valueKey = pickCaseValueKey(node, fields);
      html += '<div class="form-group"><label>Champ des cas</label>';
      html += '<select data-key="caseValueKey">';
      fields.forEach(function(f) {
        html += '<option value="' + escapeHtml(f.key) + '"' + (f.key === valueKey ? ' selected' : '') + '>'
          + escapeHtml(f.label || f.key) + '</option>';
      });
      html += '</select>';
      html += '<p class="empty" style="margin-top:6px;">Chaque ligne de la collection devient une sortie. La valeur comparée est ce champ.</p>';
      html += '</div>';
    }
    if (colId) {
      var col = findDocCollection(colId);
      var ver = String((node.config && node.config.casesCollectionVersion) || (col && col.version) || '');
      var rev = node.config && node.config.casesCollectionRevision;
      if (rev == null && col) rev = collectionRevisionOf(col);
      var bits = [];
      if (ver) bits.push('v' + ver);
      if (rev != null && rev !== '') bits.push('rév. ' + rev);
      if (bits.length) {
        html += '<p class="empty" style="margin:-4px 0 10px;">Figé : ' + escapeHtml(bits.join(' · ')) + '</p>';
      }
    }
    return html;
  }

  function conditionCasesEditorHtml(node) {
    if (isCollectionCaseSource(node)) {
      var cases = normalizeConditionCases(node.config && node.config.cases);
      var stale = isConditionCollectionStale(node);
      var html = '<div class="form-group agent-condition-cases" data-cases-editor="1">';
      html += '<div class="agent-condition-collection-head">';
      html += '<label>Cas' + (cases.length ? ' (' + cases.length + ')' : '') + '</label>';
      html += '<button type="button" class="agent-condition-refresh' + (stale ? ' is-stale' : '') + '" data-refresh-cases="1"'
        + ' title="Recalculer les sorties depuis la collection">Mettre à jour les cas</button>';
      html += '</div>';
      if (stale) {
        html += '<p class="empty" style="color:#fb923c; margin:0 0 8px;">La collection a changé (version / lignes). Mettez à jour les cas pour réaligner les sorties.</p>';
      } else {
        html += '<p class="empty" style="margin:0 0 8px;">Les cas sont un instantané de la collection, pas des items du run.</p>';
      }
      if (!cases.length) {
        html += '<p class="empty">Aucun cas — choisissez une collection déjà remplie, puis mettez à jour.</p>';
      } else {
        cases.forEach(function(c, i) {
          html += '<div class="agent-condition-case is-locked">';
          html += '<span class="agent-condition-case-n">' + (i + 1) + '</span>';
          html += '<span class="agent-condition-case-text">' + escapeHtml(c.label || c.value || 'Cas') + '</span>';
          if (isExpertView() && c.value && c.value !== c.label) {
            html += '<code>' + escapeHtml(c.value) + '</code>';
          }
          html += '</div>';
        });
        html += '<div class="agent-condition-case is-locked"><span class="agent-condition-case-n">*</span>';
        html += '<span class="agent-condition-case-text">Défaut</span></div>';
      }
      html += '</div>';
      return html;
    }
    ensureConditionCases(node);
    var cases = normalizeConditionCases(node.config.cases);
    var html = '<div class="form-group agent-condition-cases" data-cases-editor="1">';
    html += '<label>Cas</label>';
    html += '<p class="empty agent-expert-only" style="margin:0 0 8px;">Premier cas qui correspond → cette sortie. Sinon → Défaut.</p>';
    cases.forEach(function(c, i) {
      html += '<div class="agent-condition-case" data-case-id="' + escapeHtml(c.id) + '">';
      html += '<span class="agent-condition-case-n">' + (i + 1) + '</span>';
      html += '<input type="text" data-case-value placeholder="Valeur" value="' + escapeHtml(c.value) + '">';
      html += '<input type="text" data-case-label class="agent-expert-only" placeholder="Libellé" value="' + escapeHtml(c.label) + '">';
      html += '<button type="button" class="agent-condition-case-remove" data-case-remove title="Retirer"'
        + (cases.length <= 2 ? ' disabled' : '') + '>×</button>';
      html += '</div>';
    });
    html += '<button type="button" class="btn-agent-ghost" data-case-add>+ Ajouter un cas</button>';
    html += '</div>';
    return html;
  }

  function conditionFieldsHtml(node) {
    syncLogicIfDefaults(node);
    if (!node.config.mode) node.config.mode = 'if';
    if (!node.config.caseOp) node.config.caseOp = 'eq';
    var ctx = collectContextFieldsForNode(node.id);
    var html = '';
    if (!getUpstreamNodes(node.id).length) {
      html += '<p class="empty" style="color:#fbbf24; margin-bottom:10px;">Reliez d\'abord ce bloc après un déclencheur (ex. Mail) pour voir les champs.</p>';
    }
    html += '<div class="form-group"><label>Type</label>';
    html += conditionOpSelectHtml('mode', node.config.mode || 'if', ['if', 'case'], {
      if: 'Vrai / Faux',
      case: 'Cas'
    });
    html += '</div>';
    html += '<div class="form-group"><label>Champ</label>';
    html += contextFieldSelectHtml(ctx, node.config.field, 'field');
    if (isExpertView()) {
      html += '<p class="empty" style="margin-top:6px;">Champs fournis par les blocs amont.</p>';
    }
    html += '</div>';
    if (isCaseCondition(node)) {
      if (!node.config.caseSource) node.config.caseSource = 'manual';
      html += '<div class="form-group"><label>Source des cas</label>';
      html += conditionOpSelectHtml('caseSource', node.config.caseSource || 'manual', ['manual', 'collection'], {
        manual: 'Saisie',
        collection: 'Collection'
      });
      html += '</div>';
      html += '<div class="form-group"><label>Comparaison</label>';
      html += conditionOpSelectHtml('caseOp', node.config.caseOp || 'eq', ['eq', 'contains', 'neq'], {
        eq: 'est égal à',
        contains: 'contient',
        neq: 'est différent de'
      });
      html += '</div>';
      if (isCollectionCaseSource(node)) html += conditionCollectionSelectHtml(node);
      html += conditionCasesEditorHtml(node);
    } else {
      html += '<div class="form-group"><label>Condition</label>';
      html += conditionOpSelectHtml('op', node.config.op || 'contains', [
        'contains', 'eq', 'neq', 'truthy', 'falsy', 'gt', 'lt'
      ], {
        contains: 'contient',
        eq: 'est égal à',
        neq: 'est différent de',
        truthy: 'est renseigné',
        falsy: 'est vide',
        gt: 'supérieur à',
        lt: 'inférieur à'
      });
      html += '</div>';
      var opNow = node.config.op || 'contains';
      if (opNow !== 'truthy' && opNow !== 'falsy') {
        html += '<div class="form-group"><label>Valeur</label>';
        html += '<input type="text" data-key="value" value="' + escapeHtml(node.config.value != null ? node.config.value : '') + '">';
        html += '</div>';
      }
    }
    return html;
  }

  function dataFieldVisible(key, node) {
    if (key === 'provider' || key === 'instanceId' || key === 'kinds' || key === 'pageId' || key === 'mailbox') return false;
    if (key === 'unseenOnly' || key === 'fromContains' || key === 'subjectContains') return false;
    if (key === 'pollByDate' || key === 'pollByCount' || key === 'lookbackHours' || key === 'pollLimit') return false;
    if (key === 'payload' || key === 'dbSource' || key === 'presetId' || key === 'schemaSlug' || key === 'fieldsFrom') return false;
    if (key === 'collectionNamespace' || key === 'collectionId' || key === 'modelName' || key === 'modelFields'
      || key === 'modelRows' || key === 'referenceFields') return false;
    return true;
  }

  function actionSchemaFieldVisible(key) {
    return false;
  }

  function iaSchemaFieldVisible(key) {
    return false;
  }

  function outputSchemaFieldVisible(key, config) {
    if (key === 'to' || key === 'subject' || key === 'body' || key === 'message' || key === 'templateId') return false;
    if (key === 'provider' || key === 'instanceId' || key === 'accountRef' || key === 'pageId' || key === 'connectorId') return false;
    if (key === 'collectionId' || key === 'collectionNamespace' || key === 'modelName' || key === 'modelFields'
      || key === 'modelRows' || key === 'writeMode' || key === 'referenceFields') return false;
    if (key === 'exportName' || key === 'exportFields' || key === 'copyFrom') return false;
    var p = String((config && config.provider) || '').toLowerCase();
    if (key === 'action') return p === 'facebook';
    if (key === 'usePreviousRoute') return p === 'mail' || p === 'facebook';
    if (key === 'attachPrevious') return p === 'mail';
    if (key === 'emitUrl' || key === 'emitMethod') return p === 'webhook' || p === 'http';
    if (key === 'path') return p === 'disk';
    return true;
  }

  function renderLinkConfig(host) {
    var link = state.selectedLink;
    var source = link ? state.nodes.find(function(n) { return n.id === link.sourceId; }) : null;
    var target = link ? state.nodes.find(function(n) { return n.id === link.targetId; }) : null;
    if (!link || !source) {
      host.innerHTML = '<p class="empty">Sélectionnez un bloc ou un lien sur le canvas.</p>';
      return;
    }
    var srcName = source.name || source.brickId;
    var tgtName = target ? (target.name || target.brickId) : '…';
    var portLabel = conditionPortLabel(source, link.portId)
      || (link.portId === 'false' ? 'Faux'
        : (link.portId === 'true' ? 'Vrai'
          : (link.portId === 'body' ? 'Répéter'
            : (link.portId === 'done' ? 'Terminé' : 'Sortie'))));
    var html = '<h3>Lien</h3>';
    html += '<p class="empty" style="margin-bottom:12px;">' + escapeHtml(srcName) + ' (' + portLabel + ') → ' + escapeHtml(tgtName) + '</p>';
    html += runIoShortcutHtml(source);
    html += '<p class="empty" style="margin-bottom:12px;">Contrat de données qui circule sur ce lien (sortie du bloc amont, éventuellement enrichie).</p>';
    html += '<button type="button" class="btn-agent-ghost" data-open-link-contract="1">Voir le contrat de données</button>';
    html += '<button type="button" class="btn-agent-ghost btn-agent-danger" id="btnDeleteLink" style="margin-top:12px;">Supprimer ce lien</button>';
    host.innerHTML = html;
    var delLink = document.getElementById('btnDeleteLink');
    if (delLink) {
      delLink.addEventListener('click', function() { deleteSelectedLink(); });
    }
  }

  function renderConfig() {
    var host = document.getElementById('agentConfig');
    if (!host) return;
    if (state.selectedLink && !state.selectedNodeId) {
      renderLinkConfig(host);
      return;
    }
    var node = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    if (!node) {
      if (state.paletteHookForm) {
        host.innerHTML = paletteHookFormHtml();
        bindPaletteHookForm(host);
        return;
      }
      host.innerHTML = '<p class="empty">Sélectionnez un bloc ou un lien sur le canvas.</p>';
      return;
    }
    state.paletteHookForm = false;
    var brick = getBrick(node.brickId) || {};
    var schema = null;
    if (node.kind === 'trigger' && brick.trigger && brick.trigger.configSchema) {
      schema = brick.trigger.configSchema;
    } else if (brick.operations) {
      var opKey = node.operation || DEFAULT_OPS[node.brickId];
      var op = opKey && brick.operations[opKey];
      if (op && op.configSchema) schema = op.configSchema;
    }

    if (node.brickId === 'trigger') {
      var rawMode = String((node.config && node.config.mode) || 'button');
      if (rawMode !== 'cron' && rawMode !== 'webhook' && rawMode !== 'block') node.config.mode = 'button';
    }

    var html = '<div class="agent-node-identity">';
    html += '<label>Nom du bloc</label>';
    html += '<input type="text" data-node-name value="' + escapeHtml(node.name || brick.name || '') + '" placeholder="'
      + escapeHtml(brick.name || 'Bloc') + '">';
    if (isExpertView()) {
      html += '<p class="empty agent-node-slug-hint">Namespace <code>{{' + escapeHtml(ensureNodeSlug(node)) + '.*}}</code></p>';
    }
    html += runIoShortcutHtml(node);
    if (isExpertView()) {
      html += '<label>Identifiant</label>';
      html += '<input type="text" data-node-slug value="' + escapeHtml(node.slug || '') + '">';
    }
    html += '</div>';
    html += nodeWarningsHtml(node);
    if (brick.description && node.brickId !== 'data' && node.brickId !== 'action' && node.brickId !== 'ia' && node.brickId !== 'condition') {
      html += '<p class="empty" style="margin-bottom:12px;">' + brick.description + '</p>';
    }
    if (node.brickId === 'trigger' && node.config.mode === 'button') {
      html += '<p class="empty" style="margin-bottom:12px; color:#94a3b8;">Le bouton ▶ Lancer démarre l’agent. Pour un événement canal, passez en mode Webhook et choisissez une instance connecteur.</p>';
    }
    if (node.brickId === 'trigger' && node.config.mode === 'block') {
      html += '<p class="empty" style="margin-bottom:12px; color:#94a3b8;">À la sélection ou à l’import d’un bloc : la liste de hooks se met à jour, puis tu choisis l’accroche dans le panneau droit. Pas d’IA.</p>';
    }
    if (node.brickId === 'trigger' && node.config.mode === 'webhook') {
      html += '<p class="empty" style="margin-bottom:12px; color:#94a3b8;">Le webhook est configuré dans Connecteurs. Ici on choisit lequel écoute cet agent. Entrées se préremplit sur le même canal.</p>';
    }
    if (node.brickId === 'trigger' || node.brickId === 'data') {
      html += connectorMismatchHtml(node.brickId === 'data' ? node : null);
    }
    if (node.brickId === 'data') {
      if (isFacebookListenNode(node)) syncFacebookAccountFromNode(node);
      html += dataChannelFieldsHtml(node);
      html += dataContractButtonHtml(node);
    }
    if (isConditionNode(node)) {
      html += conditionFieldsHtml(node);
    }
    if (node.brickId === 'action') {
      html += actionFieldsHtml(node);
    }
    if (node.brickId === 'ia') {
      html += iaFieldsHtml(node);
    }
    if (node.brickId === 'output') {
      html += outputChannelFieldsHtml(node);
      if (!isCollectionOutput(node) && !isFlowOutput(node)) html += templateBindPanelHtml(node);
      if (!isFlowOutput(node)) html += mappingPanelHtml(node);
    }

    var cfgUi = brickConfigUi(node.brickId);
    if (cfgUi && cfgUi.tabId) {
      html += '<button type="button" class="btn-agent" id="btnOpenBrickConfig" style="margin-bottom:12px;">Ouvrir config « ' +
        (cfgUi.tabLabel || cfgUi.tabId) + ' »</button>';
    }
    if (brick.interaction === 'human') {
      html += '<p class="empty" style="color:#fb923c; margin-bottom:12px;">Intervention humaine — place l\'agent en mode assisté.</p>';
    }

    if (node.brickId === 'human-doc-review' || node.brickId === 'validation') {
      html += vizBlockDataHtml(node);
    }
    if (node.brickId === 'visualization') {
      html += visualizationFieldsHtml(node);
    }

    var incoming = getIncomingNodes(node.id);
    var outgoing = nodeNextIds(node).map(function(id) {
      return state.nodes.find(function(n) { return n.id === id; });
    }).filter(Boolean);
    var outgoingFalse = nodeNextFalseIds(node).map(function(id) {
      return state.nodes.find(function(n) { return n.id === id; });
    }).filter(Boolean);
    html += '<div class="agent-conn-panel">';
    html += '<div class="agent-conn-row"><span>Entrée' + (incoming.length > 1 ? 's (' + incoming.length + ')' : '') + '</span><strong>' + escapeHtml(namesList(incoming)) + '</strong>'
      + '<button type="button" class="btn-agent-ghost agent-expert-only" data-open-port-contract="in" style="margin-left:auto;">Contrat</button></div>';
    if (isConditionNode(node) && isCaseCondition(node)) {
      namedOutputPorts(node).forEach(function(p) {
        var targets = nodeNextPortIds(node, p.id).map(function(id) {
          return state.nodes.find(function(n) { return n.id === id; });
        }).filter(Boolean);
        html += '<div class="agent-conn-row"><span>' + escapeHtml(p.label) + '</span><strong>'
          + escapeHtml(namesList(targets)) + '</strong></div>';
      });
      html += '<p class="empty agent-expert-only" style="margin-top:8px;">Tirez depuis un <strong>cas</strong> ou <strong>Défaut</strong>.</p>';
    } else if (isConditionNode(node)) {
      html += '<div class="agent-conn-row"><span>Vrai</span><strong>' + escapeHtml(namesList(outgoing)) + '</strong>'
        + '<button type="button" class="btn-agent-ghost agent-expert-only" data-open-port-contract="out" style="margin-left:auto;">Contrat</button></div>';
      html += '<div class="agent-conn-row"><span>Faux</span><strong>' + escapeHtml(namesList(outgoingFalse)) + '</strong></div>';
      html += '<p class="empty agent-expert-only" style="margin-top:8px;">Tirez depuis le port <strong>Vrai</strong> ou <strong>Faux</strong>. Plusieurs blocs peuvent être reliés à chaque sortie.</p>';
    } else if (isLoopNode(node)) {
      html += '<div class="agent-conn-row"><span>Répéter</span><strong>' + escapeHtml(namesList(outgoing)) + '</strong>'
        + '<button type="button" class="btn-agent-ghost agent-expert-only" data-open-port-contract="out" style="margin-left:auto;">Contrat</button></div>';
      html += '<div class="agent-conn-row"><span>Terminé</span><strong>' + escapeHtml(namesList(outgoingFalse)) + '</strong></div>';
      html += '<p class="empty agent-expert-only" style="margin-top:8px;">Port <strong>Répéter</strong> → premier bloc du cycle. Reliez le <strong>dernier</strong> bloc du cycle vers cette boucle. Port <strong>Terminé</strong> → la suite.</p>';
    } else {
      html += '<div class="agent-conn-row"><span>Sortie' + (outgoing.length > 1 ? 's (' + outgoing.length + ')' : '') + '</span><strong>' + escapeHtml(namesList(outgoing)) + '</strong>'
        + '<button type="button" class="btn-agent-ghost agent-expert-only" data-open-port-contract="out" style="margin-left:auto;">Contrat</button></div>';
    }
    if (allOutgoingIds(node).length) {
      html += '<button type="button" class="btn-agent-ghost" id="btnDisconnectNode" style="margin-top:8px;">Déconnecter les sorties</button>';
    } else if (node.brickId !== 'ia') {
      html += '<p class="empty agent-expert-only" style="margin-top:8px;">' + (isConditionNode(node) && isCaseCondition(node)
        ? 'Glissez depuis un cas ou Défaut vers un autre bloc.'
        : (isConditionNode(node)
        ? 'Glissez depuis Vrai ou Faux vers un autre bloc.'
        : (isLoopNode(node)
          ? 'Glissez depuis Répéter vers le premier bloc, puis le dernier bloc vers cette boucle.'
          : 'Glissez depuis un port bas/droite vers un autre bloc. Plusieurs liens sont possibles.'))) + '</p>';
    }
    html += '</div>';

    var contextFields = collectContextFieldsForNode(node.id);

    if (isLoopNode(node)) {
      syncLoopDefaults(node);
      html += '<div class="agent-logic-panel" style="margin:12px 0; padding:12px; border:1px solid #1f2937; border-radius:10px; background:#0f172a;">';
      html += '<p style="margin:0 0 10px; color:#c4b5fd; font-size:0.9rem;"><strong>Boucle</strong> — '
        + escapeHtml(loopSummary(node.config)) + '</p>';
      html += '<p class="empty" style="margin:0;">Par défaut : une passe par ligne du tableau Entrées. Le dernier bloc du cycle doit revenir vers ce bloc.</p>';
      html += '</div>';
    }

    if (schema && schema.properties) {
      Object.keys(schema.properties).forEach(function(key) {
        var prop = schema.properties[key];
        var val = node.config[key];
        if (val === undefined && prop.default !== undefined) val = prop.default;
        // Masquer « valeur » si opérateur sans valeur
        if ((node.brickId === 'logic-if' || node.brickId === 'condition') && !conditionFieldVisible(key, node)) return;
        if ((node.brickId === 'logic-if' || node.brickId === 'condition') && key === 'value') {
          var opNow = node.config.op || 'contains';
          if (opNow === 'truthy' || opNow === 'falsy') return;
        }
        if (node.brickId === 'trigger' && !triggerFieldVisible(key, node.config)) return;
        if (node.brickId === 'loop' && !loopFieldVisible(key, node.config)) return;
        if (node.brickId === 'data' && !dataFieldVisible(key, node)) return;
        if (node.brickId === 'action' && !actionSchemaFieldVisible(key)) return;
        if (node.brickId === 'ia' && !iaSchemaFieldVisible(key)) return;
        if (node.brickId === 'output' && !outputSchemaFieldVisible(key, node.config)) return;
        if (node.brickId === 'visualization') return;
        if ((node.brickId === 'validation' || node.brickId === 'human-doc-review') &&
            (key === 'reviewContext' || key === 'templateNamespace' || key === 'templateId')) return;
        html += fieldHtml(key, prop, val, {
          brickId: node.brickId,
          provider: node.config && node.config.provider,
          contextFields: contextFields
        });
      });
    } else if (!isConditionNode(node)) {
      html += '<p class="empty">Aucun paramètre pour ce bloc.</p>';
    }

    if (node.brickId === 'data') {
      html += dataKindsHtml(node);
    }

    if (isExpertView() && contextFields.length && node.brickId !== 'ia' && (node.brickId === 'logic-if' || node.brickId === 'condition'
        || node.brickId === 'action' || node.brickId === 'output' || node.brickId === 'loop')) {
      html += '<details style="margin-top:10px; color:#94a3b8; font-size:0.85rem;"><summary>Champs disponibles ('
        + contextFields.length + ')</summary><ul style="margin:8px 0 0; padding-left:1.1rem;">';
      contextFields.forEach(function(f) {
        html += '<li><strong>' + escapeHtml(f.label) + '</strong>';
        if (isExpertView()) html += ' <code>{{' + escapeHtml(f.key) + '}}</code>';
        html += ' ← ' + escapeHtml(f.source) + '</li>';
      });
      html += '</ul></details>';
    }

    html += '<button type="button" class="btn-agent-ghost btn-agent-danger" id="btnDeleteNode" style="margin-top:12px;">Supprimer ce bloc</button>';
    host.innerHTML = html;

    var nameInput = host.querySelector('[data-node-name]');
    if (nameInput) {
      nameInput.addEventListener('change', function() {
        renameNode(node, nameInput.value);
        render();
      });
    }
    var slugInput = host.querySelector('[data-node-slug]');
    if (slugInput) {
      slugInput.addEventListener('change', function() {
        retargetNodeSlug(node, slugInput.value);
        render();
      });
    }
    host.querySelectorAll('[data-mapping-llm]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        ensureMappingConfig(node);
        var slot = sel.getAttribute('data-mapping-llm');
        var val = String(sel.value || '');
        if (!val) {
          node.config.mapping[slot] = '';
          node.config.literals[slot] = '';
        } else if (val.indexOf('__llm__:') === 0) {
          node.config.mapping[slot] = '__literal__';
          node.config.literals[slot] = val.slice(8);
        } else {
          node.config.mapping[slot] = val;
          node.config.literals[slot] = '';
        }
        render();
      });
    });
    host.querySelectorAll('[data-mapping-slot]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        ensureMappingConfig(node);
        var slot = sel.getAttribute('data-mapping-slot');
        var val = String(sel.value || '');
        if (val === '__literal__') {
          node.config.mapping[slot] = '__literal__';
          if (node.config.literals[slot] == null) node.config.literals[slot] = '';
        } else {
          node.config.mapping[slot] = val;
          if (val) delete node.config.literals[slot];
        }
        if (isHookAction(node) && slot === 'surface') {
          node.config.surface = hookConfiguredSurface(node) || 'tab';
        }
        render();
      });
    });
    host.querySelectorAll('[data-mapping-literal]').forEach(function(ta) {
      ta.addEventListener('input', function() {
        ensureMappingConfig(node);
        node.config.mapping[ta.getAttribute('data-mapping-literal')] = '__literal__';
        node.config.literals[ta.getAttribute('data-mapping-literal')] = ta.value;
      });
      ta.addEventListener('change', function() {
        ensureMappingConfig(node);
        var slot = ta.getAttribute('data-mapping-literal');
        node.config.mapping[slot] = '__literal__';
        node.config.literals[slot] = ta.value;
        if (isHookAction(node) && slot === 'surface') {
          node.config.surface = String(ta.value || '').trim() || 'tab';
          updateConfigTabs();
        }
        renderCanvas();
      });
    });

    var tplSelect = host.querySelector('[data-template-id]');
    if (tplSelect) {
      tplSelect.addEventListener('change', function() {
        if (!node.config) node.config = {};
        node.config.templateId = String(tplSelect.value || '').trim();
        if (node.config.templateId) {
          loadBlockTemplateDetails(node.config.templateId).then(function() {
            stampPairedPromptFromDocSlots(node);
            renderConfig();
          });
        } else {
          renderConfig();
        }
      });
    }
    host.querySelectorAll('[data-sub-template]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        if (!node.config) node.config = {};
        if (!node.config.subTemplates || typeof node.config.subTemplates !== 'object') {
          node.config.subTemplates = {};
        }
        var hole = sel.getAttribute('data-sub-template');
        var id = String(sel.value || '').trim();
        if (id) node.config.subTemplates[hole] = id;
        else delete node.config.subTemplates[hole];
        if (id) {
          loadBlockTemplateDetails(id).then(function() {
            stampPairedPromptFromDocSlots(node);
            renderConfig();
          });
        } else {
          stampPairedPromptFromDocSlots(node);
          renderConfig();
        }
      });
    });
    host.querySelectorAll('[data-sub-template-create]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        createSubTemplate(node, btn.getAttribute('data-sub-template-create'));
      });
    });
    var prodSelect = host.querySelector('[data-production-template-id]');
    if (prodSelect) {
      prodSelect.addEventListener('change', function() {
        if (!node.config) node.config = {};
        var id = String(prodSelect.value || '').trim();
        node.config.productionTemplateId = id;
        var tpl = findProductionTemplate(id);
        if (tpl) {
          if (node.brickId === 'ia' && !state.entityLlmsLoaded) {
            loadEntityLlms().then(function() {
              applyProductionTemplateToNode(node, tpl);
              renderConfig();
            });
            return;
          }
          applyProductionTemplateToNode(node, tpl);
        }
        renderConfig();
      });
    }
    var tplCreate = host.querySelector('[data-template-create]');
    if (tplCreate) {
      tplCreate.addEventListener('click', function() {
        createBoundTemplate(node);
      });
    }

    var colPick = host.querySelector('[data-collection-pick]');
    if (colPick) {
      colPick.addEventListener('change', function() {
        applyCollectionChoice(node, colPick.value);
      });
    }
    var caseColPick = host.querySelector('[data-case-collection-pick]');
    if (caseColPick) {
      caseColPick.addEventListener('change', function() {
        applyCaseCollectionChoice(node, caseColPick.value);
      });
    }
    var refreshCasesBtn = host.querySelector('[data-refresh-cases]');
    if (refreshCasesBtn) {
      refreshCasesBtn.addEventListener('click', function() {
        refreshCasesFromCollection(node);
      });
    }

    host.querySelectorAll('[data-case-id]').forEach(function(row) {
      var cid = row.getAttribute('data-case-id');
      var valEl = row.querySelector('[data-case-value]');
      var labEl = row.querySelector('[data-case-label]');
      var rm = row.querySelector('[data-case-remove]');
      function patchCase(mut) {
        ensureConditionCases(node);
        node.config.cases = normalizeConditionCases(node.config.cases).map(function(c) {
          if (c.id !== cid) return c;
          return mut(c);
        });
      }
      if (valEl) {
        valEl.addEventListener('input', function() {
          patchCase(function(c) {
            c.value = valEl.value;
            return c;
          });
        });
        valEl.addEventListener('change', function() { renderCanvas(); });
      }
      if (labEl) {
        labEl.addEventListener('input', function() {
          patchCase(function(c) {
            c.label = labEl.value;
            return c;
          });
        });
        labEl.addEventListener('change', function() { renderCanvas(); });
      }
      if (rm) {
        rm.addEventListener('click', function() {
          var cases = normalizeConditionCases(node.config && node.config.cases);
          if (cases.length <= 2) return;
          node.config.cases = cases.filter(function(c) { return c.id !== cid; });
          var map = nodeNextPortMap(node);
          delete map['case:' + cid];
          node.nextPortIds = map;
          syncNextAliases(node);
          render();
        });
      }
    });
    var addCaseBtn = host.querySelector('[data-case-add]');
    if (addCaseBtn) {
      addCaseBtn.addEventListener('click', function() {
        ensureConditionCases(node);
        node.config.cases.push({ id: newCaseId(), value: '', label: '' });
        render();
      });
    }

    host.querySelectorAll('[data-key]').forEach(function(input) {
      if (input.tagName === 'TEXTAREA' && input.getAttribute('data-key') === 'payload') {
        input.addEventListener('input', function() {
          if (!node.config) node.config = {};
          node.config.payload = input.value;
        });
      }
      input.addEventListener('change', function() {
        var key = input.getAttribute('data-key');
        if (input.getAttribute('data-type') === 'boolean') {
          node.config[key] = input.checked;
          return;
        }
        var val = input.value;
        if (input.type === 'number') val = parseInt(val, 10);
        if (key === 'copyFrom') {
          setCopyFrom(node, val);
          render();
          return;
        }
        node.config[key] = val;
        if ((node.brickId === 'validation' || node.brickId === 'human-doc-review') && key === 'subTemplateId') {
          node.config.subFlowId = '';
          importOfficialSubAgent(node);
          render();
          return;
        }
        if (node.brickId === 'visualization' && (key === 'vizType' || key === 'valueField' || key === 'labelField' || key === 'surface')) {
          if (key === 'surface') {
            var localLab = vizPathLocal(node.config.labelField) || 'label';
            var hit = vizRowsFromUpstream(node).filter(function(row) {
              return vizRowValue(row, vizPathLocal(node.config.valueField)) === String(val || '');
            })[0];
            if (hit) node.config.label = vizRowLabel(hit, localLab);
          }
          render();
          return;
        }
        if (key === 'hookSurface') {
          if (val === 'palette') val = '';
          node.config.hookSurface = val;
          if (node.brickId === 'visualization') node.config.surface = val;
          var pickedHook = hookCatalogOptions().filter(function(r) {
            return r.surface === String(val || '');
          })[0];
          if (pickedHook) node.config.label = pickedHook.label;
          render();
          return;
        }
        if (node.brickId === 'data' && key === 'provider') {
          if (val === 'facebook') ensureFacebookListenConfig(node);
          if (val === 'mail') ensureMailQueryConfig(node);
          if (isLocalDataProvider(val)) {
            node.config.instanceId = '';
            node.config.pageId = '';
            node.config.accountRef = '';
            if (val === 'json' && node.config.presetId == null) node.config.presetId = '';
          } else {
            var stillValid = listDataAccounts(val).some(function(inst) {
              return instanceIdOf(inst) === String(node.config.instanceId || '');
            });
            if (!stillValid) {
              node.config.instanceId = '';
              node.config.pageId = '';
              node.config.accountRef = '';
            }
          }
          node.config.kinds = [];
          ensureDataKinds(node);
          updateConfigTabs();
          render();
          return;
        }
        if (node.brickId === 'data' && key === 'dbSource') {
          render();
          return;
        }
        if (node.brickId === 'data' && key === 'payload') {
          renderCanvas();
          return;
        }
        if (node.brickId === 'data' && key === 'instanceId') {
          var picked = findConnectorInstance(val);
          if (picked) {
            node.config.provider = providerFromConnectorId(picked.connectorId) || node.config.provider;
            if (picked.settings && picked.settings.accountRef) node.config.accountRef = String(picked.settings.accountRef);
          }
          if (node.config.provider === 'facebook' || (picked && providerFromConnectorId(picked.connectorId) === 'facebook')) {
            applyFacebookAccountToNode(node, { instanceId: val });
            ensureFacebookListenConfig(node);
            fillFacebookPageSelects();
          } else if (node.config.provider === 'mail' || (picked && providerFromConnectorId(picked.connectorId) === 'mail')) {
            ensureMailQueryConfig(node);
          } else if (picked && picked.settings && picked.settings.pageId) {
            node.config.pageId = String(picked.settings.pageId);
          } else if (!val) {
            node.config.pageId = '';
            node.config.pageName = '';
          }
          node.config.kinds = [];
          ensureDataKinds(node);
          updateConfigTabs();
          render();
          return;
        }
        if (key === 'pageId' && isFacebookListenNode(node)) {
          applyFacebookAccountToNode(node, { pageId: val });
          fillFacebookPageSelects();
        } else if (key === 'pageId' && node.brickId === 'facebook-out') {
          var page = findFacebookPage(val);
          node.config.pageName = page ? (page.pageName || '') : '';
        }
        if (node.brickId === 'trigger' && (key === 'mode' || key === 'preset' || key === 'webhookInstanceId')) {
          if (key === 'mode' && val === 'block') {
            if (node.config.blockOnSelect == null) node.config.blockOnSelect = true;
            if (node.config.blockOnImport == null) node.config.blockOnImport = true;
          }
          if (key === 'mode' || key === 'webhookInstanceId') {
            var prevPreset = state.lastWebhookPresetId;
            applyWebhookPresetToData({ previousId: prevPreset, trigger: node });
            state.nodes.forEach(function(n) {
              if (n.brickId === 'data') ensureDataKinds(n);
            });
          }
          render();
          return;
        }
        if ((node.brickId === 'logic-if' || node.brickId === 'condition')) {
          if (key === 'mode' && isCaseCondition(node) && !isCollectionCaseSource(node)) ensureConditionCases(node);
          if (key === 'caseSource' && val === 'collection' && (conditionCaseCollectionId(node) || node.config.casePresetId)) {
            refreshCasesFromCollection(node);
            return;
          }
          if (key === 'caseValueKey' || key === 'caseLabelKey') {
            if (isCollectionCaseSource(node) && (conditionCaseCollectionId(node) || node.config.casePresetId)) {
              refreshCasesFromCollection(node);
              return;
            }
          }
          render();
          return;
        }
        if (isLoopNode(node)) {
          syncLoopDefaults(node);
          render();
          return;
        }
        if (node.brickId === 'ia' && (key === 'source' || key === 'writeMode' || key === 'prompt')) {
          if (key === 'source') {
            render();
            return;
          }
          renderCanvas();
        }
        if (node.brickId === 'output' && key === 'connectorId') {
          applyOutputConnectorType(node, val);
          render();
          return;
        }
        if (node.brickId === 'output' && key === 'provider') {
          applyOutputConnectorType(node, outputConnectorIdForProvider(val));
          render();
          return;
        }
        if (node.brickId === 'output' && key === 'instanceId') {
          applyOutputAccountToNode(node, val);
          render();
          return;
        }
        if (node.brickId === 'output' && key === 'writeMode') {
          renderCanvas();
          return;
        }
        if (node.brickId === 'output' && key === 'exportName') {
          renderCanvas();
          return;
        }
        if (node.brickId === 'action' && key === 'visualizationId') {
          render();
          return;
        }
        if (node.brickId === 'action' && (key === 'actionId' || key === 'writeMode' || key === 'surface')) {
          node.config.operation = node.config.actionId || node.config.operation;
          if (key === 'actionId') {
            var aid = normalizeClientActionId(node.config.actionId);
            if (aid === 'ia.compose' || !aid) {
              delete node.config.kind;
              node.config.actionId = 'ia.compose';
              node.config.operation = 'ia.compose';
            } else {
              node.config.kind = 'function';
            }
            if (aid === 'surface.hook') {
              node.config.actionId = 'surface.hook';
              node.config.operation = 'surface.hook';
              delete node.config.hookCollectionId;
              delete node.config.hookCollectionPreset;
              ensureHookMappingDefaults(node);
              updateConfigTabs();
              render();
              return;
            }
          }
          updateConfigTabs();
          render();
          return;
        }
        if (node.brickId === 'action' && (key === 'prompt' || key === 'folder' || key === 'subfolder' || key === 'messageField')) {
          renderCanvas();
        }
        if (key === 'pageId' && (isFacebookListenNode(node) || node.brickId === 'facebook-out')) {
          renderCanvas();
        }
      });
    });

    host.querySelectorAll('[data-export-field]').forEach(function(input) {
      input.addEventListener('change', function() {
        setFlowExportField(node, input.getAttribute('data-export-field'), input.checked);
        renderCanvas();
      });
    });
    var exportAll = host.querySelector('[data-export-fields-all]');
    if (exportAll) {
      exportAll.addEventListener('click', function(ev) {
        ev.preventDefault();
        ensureFlowExportFields(node);
        node.config.exportFields = collectContextFieldsForNode(node.id).filter(function(f) {
          return f && f.key && !f.own && f.source !== 'Système' && f.key !== 'today' && f.key !== 'date';
        }).map(function(f) { return f.key; });
        render();
      });
    }
    var exportNone = host.querySelector('[data-export-fields-none]');
    if (exportNone) {
      exportNone.addEventListener('click', function(ev) {
        ev.preventDefault();
        ensureFlowExportFields(node);
        node.config.exportFields = [];
        render();
      });
    }

    host.querySelectorAll('[data-remove-zone]').forEach(function(btn) {
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        removeComposeZone(node, btn.getAttribute('data-remove-zone'));
        render();
      });
    });
    host.querySelectorAll('[data-set-field-type]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        setComposeFieldType(node, sel.getAttribute('data-set-field-type'), sel.value);
        render();
      });
    });
    host.querySelectorAll('[data-field-label]').forEach(function(input) {
      input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          input.blur();
        }
      });
      input.addEventListener('input', function() {
        var oldKey = input.getAttribute('data-field-label');
        var found = (node.config.variables || []).find(function(v) { return v.key === oldKey; });
        if (found) found.label = input.value;
      });
      input.addEventListener('change', function() {
        var oldKey = input.getAttribute('data-field-label');
        var next = renameComposeField(node, oldKey, input.value);
        if (!input.value.trim()) {
          var found = (node.config.variables || []).find(function(v) { return v.key === oldKey; });
          input.value = (found && found.label) || oldKey;
          return;
        }
        if (next !== oldKey) render();
      });
    });
    var addZoneCfg = host.querySelector('[data-add-zone-config]');
    if (addZoneCfg) {
      addZoneCfg.addEventListener('click', function() {
        var label = window.prompt('Nom du champ (ex. Destinataire, Prompt, RAG)', '');
        if (!label) return;
        addComposeZone(node, label, label);
        render();
      });
    }
    host.querySelectorAll('[data-apply-zone-preset]').forEach(function(applyPreset) {
      applyPreset.addEventListener('click', function() {
        applyZonePreset(node, applyPreset.getAttribute('data-apply-zone-preset'));
        render();
      });
    });

    var openCfg = document.getElementById('btnOpenBrickConfig');
    if (openCfg && cfgUi && cfgUi.tabId) {
      openCfg.addEventListener('click', function() {
        setActiveTab(cfgUi.tabId);
      });
    }
    var openFb = document.getElementById('btnOpenFacebookTab');
    if (openFb) {
      openFb.addEventListener('click', function() {
        openChannelTab(node);
      });
    }
    var openMail = document.getElementById('btnOpenMailTab');
    if (openMail) {
      openMail.addEventListener('click', function() {
        openChannelTab(node);
      });
    }
    var btnForkViz = document.getElementById('btnForkVizDesign');
    if (btnForkViz) {
      btnForkViz.addEventListener('click', function() {
        forkVizDesignForNode(node, btnForkViz);
      });
    }
    var btnJoinViz = document.getElementById('btnJoinVizDesign');
    if (btnJoinViz) {
      btnJoinViz.addEventListener('click', function() {
        joinSharedVizDesign(node);
      });
    }
    var btnGenReviewAi = document.getElementById('btnGenerateReviewPageAi');
    if (btnGenReviewAi) {
      btnGenReviewAi.addEventListener('click', function() {
        generateReviewPageFromAi(node, btnGenReviewAi);
      });
    }
    var btnOpenReviewEditor = document.getElementById('btnOpenReviewPageEditor');
    if (btnOpenReviewEditor) {
      btnOpenReviewEditor.addEventListener('click', function() {
        var ns = resolveBlockPageNamespace(node);
        storePageEditorContext(collectPageGenerationContext(node, { namespace: ns }));
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

    var alignBtn = document.getElementById('btnAlignDataWebhook');
    if (alignBtn) {
      alignBtn.addEventListener('click', function() {
        applyWebhookPresetToData({
          force: node.brickId === 'data',
          nodeId: node.brickId === 'data' ? node.id : null
        });
        render();
      });
    }
    if (node.brickId === 'data') {
      var contractModal = document.getElementById('dataContractModal');
      if (contractModal && contractModal.classList.contains('is-open')) fillDataContractModal(node);
    }

    var btnOpenCompose = document.getElementById('btnOpenActionCompose');
    if (btnOpenCompose) {
      btnOpenCompose.addEventListener('click', function() {
        openActionComposeModal(node);
      });
    }
    var btnImportSub = document.getElementById('btnImportSubAgent');
    if (btnImportSub) {
      btnImportSub.addEventListener('click', function() {
        importOfficialSubAgent(node);
      });
    }
    var previewFrame = document.getElementById('subAgentPreviewFrame');
    if (previewFrame && node && node.config && node.config.subFlowId) {
      var packedPreview = state.subAgentById[String(node.config.subFlowId)];
      var pickedPreview = pickSubAgentExport(packedPreview);
      if (pickedPreview && pickedPreview.data) {
        previewFrame.srcdoc = combineFlowPreview(pickedPreview.data);
      }
    }
    host.querySelectorAll('[data-open-zone]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        node.config.activeComposeTab = 'fields';
        openActionComposeModal(node, btn.getAttribute('data-open-zone'));
      });
    });
    host.querySelectorAll('[data-open-output-map]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        node.config.activeComposeTab = btn.getAttribute('data-open-output-map') || 'fields';
        openActionComposeModal(node);
      });
    });
    host.querySelectorAll('[data-map-an-output]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        startMapOutput(node);
        openActionComposeModal(node);
        render();
      });
    });

    host.querySelectorAll('[data-kind]').forEach(function(box) {
      box.addEventListener('change', function() {
        var next = [];
        host.querySelectorAll('[data-kind]').forEach(function(el) {
          if (el.checked) next.push(el.getAttribute('data-kind'));
        });
        if (!node.config || typeof node.config !== 'object') node.config = {};
        node.config.kinds = next;
        if (dataIngestMode(node) === 'push') {
          node.config.webhookEvents = next.slice();
          node.config.ingestModes = ['push'];
        } else {
          node.config.resources = next.slice();
          node.config.ingestModes = ['poll'];
        }
        render();
      });
    });

    host.querySelectorAll('[data-pick-field]').forEach(function(box) {
      box.addEventListener('change', function() {
        var next = [];
        host.querySelectorAll('[data-pick-field]').forEach(function(el) {
          if (el.checked) next.push(el.getAttribute('data-pick-field'));
        });
        node.config.pickFields = next;
      });
    });
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

  function flowHasActionOp(op) {
    var want = normalizeClientActionId(op);
    return state.nodes.some(function(n) {
      if (n.brickId !== 'action') return false;
      var id = normalizeClientActionId((n.config && (n.config.actionId || n.config.operation)) || '');
      return id === want || String((n.config && n.config.operation) || '') === String(op || '');
    });
  }

  function flowHasDataProvider(provider) {
    var want = String(provider || '');
    return state.nodes.some(function(n) {
      return n.brickId === 'data' && String((n.config && n.config.provider) || '') === want;
    });
  }

  function brickConfigUi(brickId) {
    var brick = getBrick(brickId);
    if (!brick) return null;
    return brick.configUi || (brick.agentConfig
      ? { type: 'panel', tabId: brick.agentConfig.tabId, tabLabel: brick.agentConfig.tabLabel }
      : null);
  }

  function nodesForEditorTab(tabId) {
    if (tabId === 'facebook') {
      return state.nodes.filter(isFacebookListenNode);
    }
    if (tabId === 'routing') {
      return state.nodes.filter(function(n) {
        if (n.brickId === 'route-intention') return true;
        if (n.brickId !== 'action') return false;
        var id = normalizeClientActionId((n.config && (n.config.actionId || n.config.operation)) || '');
        return id === 'route-intention' || String((n.config && n.config.operation) || '') === 'route-intention';
      });
    }
    if (tabId === 'doc-review') {
      return state.nodes.filter(function(n) {
        return n.brickId === 'validation' || n.brickId === 'human-doc-review';
      });
    }
    if (tabId === 'intentions') {
      return state.nodes.filter(function(n) { return n.brickId === 'analyse-intention'; });
    }
    return [];
  }

  function setTabCaption(el, baseLabel, nodes) {
    if (!el) return;
    var labels = (nodes || []).map(function(n) {
      return String((n && (n.name || n.slug)) || '').trim();
    }).filter(Boolean);
    var seen = {};
    labels = labels.filter(function(s) {
      if (seen[s]) return false;
      seen[s] = true;
      return true;
    });
    el.textContent = labels.length ? (baseLabel + ' · ' + labels.join(', ')) : baseLabel;
    if (isExpertView()) {
      var slugs = (nodes || []).map(function(n) {
        return String((n && n.slug) || '').trim();
      }).filter(Boolean);
      if (slugs.length) el.title = 'Namespace : {{' + slugs.join('}}, {{') + '}}';
      else el.removeAttribute('title');
    } else {
      el.removeAttribute('title');
    }
  }

  function updateConfigTabs() {
    var tabInt = document.getElementById('tabIntentions');
    var tabRoute = document.getElementById('tabRouting');
    var tabDoc = document.getElementById('tabDocReview');
    var tabFb = document.getElementById('tabFacebook');
    var tabDesign = document.getElementById('tabDesign');
    var vizNodes = state.nodes.filter(isVizNode);
    if (tabDesign) tabDesign.style.display = (vizNodes.length && hasSurfaceHook('tab')) ? '' : 'none';
    var routeNodes = nodesForEditorTab('routing');
    var docNodes = nodesForEditorTab('doc-review');
    var intNodes = nodesForEditorTab('intentions');
    if (tabInt) {
      tabInt.style.display = intNodes.length ? '' : 'none';
      setTabCaption(tabInt, 'Intentions', intNodes);
    }
    if (tabRoute) {
      tabRoute.style.display = routeNodes.length ? '' : 'none';
      setTabCaption(tabRoute, 'Routage', routeNodes);
    }
    if (tabDoc) {
      tabDoc.style.display = docNodes.length ? '' : 'none';
      setTabCaption(tabDoc, 'Revue', docNodes);
    }
    if (tabFb) tabFb.style.display = 'none';
    renderChannelTabs();
    syncFacebookTabToTrigger();
    updateAppPreview();

    state.nodes.forEach(function(n) {
      var ui = brickConfigUi(n.brickId);
      if (!ui || !ui.tabId || ui.tabId === 'facebook') return;
      var el = document.querySelector('.agent-tab[data-tab="' + ui.tabId + '"]');
      if (!el) return;
      el.style.display = '';
      setTabCaption(el, ui.tabLabel || ui.tabId, [n]);
    });
  }

  function renderChannelTabs() {
    var host = document.getElementById('agentChannelTabs');
    if (!host) return;
    var nodes = listChannelDataNodes();
    var active = String(state.activeTab || '');
    host.innerHTML = nodes.map(function(n) {
      var tab = channelTabId(n);
      var on = active === tab;
      var title = isExpertView() ? (' title="Namespace {{' + escapeHtml(ensureNodeSlug(n)) + '}}"') : '';
      return '<button type="button" class="' + (on ? 'btn-agent' : 'btn-agent-ghost') + ' agent-tab' + (on ? ' is-active' : '') + '"'
        + ' data-tab="' + escapeHtml(tab) + '"'
        + title + '>'
        + escapeHtml(channelTabLabel(n)) + '</button>';
    }).join('');
    if (active.indexOf('channel:') !== 0) return;
    var current = nodeFromChannelTab(active);
    if (!current || !isChannelDataNode(current)) {
      setActiveTab('canvas');
      return;
    }
    var fbPanel = document.getElementById('panelFacebook');
    var mailPanel = document.getElementById('panelMailChannel');
    var fbShown = fbPanel && fbPanel.style.display !== 'none';
    var mailShown = mailPanel && mailPanel.style.display !== 'none';
    if ((isFacebookListenNode(current) && !fbShown) || (isMailDataNode(current) && !mailShown)) {
      setActiveTab(active);
    }
  }

  function setActiveTab(tab) {
    if (tab === 'facebook') {
      var fbJump = getActiveChannelNode();
      if (!isFacebookListenNode(fbJump)) fbJump = state.nodes.find(isFacebookListenNode);
      if (fbJump) tab = channelTabId(fbJump);
    }
    persistActiveChannelPanel();
    state.activeTab = tab;
    var channelNode = nodeFromChannelTab(tab);
    state.activeChannelNodeId = channelNode ? channelNode.id : null;
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
    var mailPanel = document.getElementById('panelMailChannel');
    var appPanel = document.getElementById('panelApp');
    var designPanel = document.getElementById('panelDesign');
    var showFb = !!(channelNode && isFacebookListenNode(channelNode));
    var showMail = !!(channelNode && isMailDataNode(channelNode));
    if (canvas) canvas.style.display = tab === 'canvas' ? '' : 'none';
    if (appPanel) appPanel.style.display = tab === 'app' ? '' : 'none';
    if (designPanel) designPanel.style.display = tab === 'design' ? '' : 'none';
    if (intentions) intentions.style.display = tab === 'intentions' ? '' : 'none';
    if (routing) routing.style.display = tab === 'routing' ? '' : 'none';
    if (docReview) docReview.style.display = tab === 'doc-review' ? '' : 'none';
    if (facebook) facebook.style.display = showFb ? '' : 'none';
    if (mailPanel) mailPanel.style.display = showMail ? '' : 'none';
    if (tab === 'app') {
      loadHookCatalog().then(function() {
        syncAppFields();
      });
    }
    if (tab === 'design') {
      renderDesignTab();
    }
    if (tab === 'intentions') loadAnalyseConfigPanel();
    if (tab === 'routing') loadRouteConfigPanel();
    if (tab === 'doc-review') loadDocReviewConfigPanel();
    if (showFb) loadFacebookConfigPanel(channelNode);
    if (showMail) loadMailChannelPanel(channelNode);
  }

  function isFacebookListenNode(n) {
    if (!n) return false;
    if (n.brickId === 'facebook') return true;
    return n.brickId === 'data' && String((n.config && n.config.provider) || '') === 'facebook';
  }

  function isMailDataNode(n) {
    return !!(n && n.brickId === 'data' && String((n.config && n.config.provider) || '') === 'mail');
  }

  function isChannelDataNode(n) {
    return isFacebookListenNode(n) || isMailDataNode(n);
  }

  function listChannelDataNodes() {
    return state.nodes.filter(isChannelDataNode);
  }

  function channelTabId(node) {
    return node ? ('channel:' + node.id) : '';
  }

  function nodeFromChannelTab(tab) {
    var raw = String(tab || '');
    if (raw.indexOf('channel:') !== 0) return null;
    var id = raw.slice('channel:'.length);
    return state.nodes.find(function(n) { return n.id === id; }) || null;
  }

  function getActiveChannelNode() {
    if (state.activeChannelNodeId) {
      var n = state.nodes.find(function(x) { return x.id === state.activeChannelNodeId; });
      if (isChannelDataNode(n)) return n;
    }
    var fromTab = nodeFromChannelTab(state.activeTab);
    if (fromTab) return fromTab;
    return null;
  }

  function getFacebookNode() {
    var active = getActiveChannelNode();
    if (isFacebookListenNode(active)) return active;
    return state.nodes.find(isFacebookListenNode) || null;
  }

  function channelTabLabel(node) {
    var slug = ensureNodeSlug(node);
    if (isFacebookListenNode(node)) return 'Facebook · ' + slug;
    if (isMailDataNode(node)) return 'Mail · ' + slug;
    return slug;
  }

  function persistActiveChannelPanel() {
    var node = getActiveChannelNode();
    if (!node) return;
    var fbPanel = document.getElementById('panelFacebook');
    var mailPanel = document.getElementById('panelMailChannel');
    var fbVisible = fbPanel && fbPanel.style.display !== 'none';
    var mailVisible = mailPanel && mailPanel.style.display !== 'none';
    if (fbVisible && isFacebookListenNode(node)) readFacebookConfigFromPanel(node);
    if (mailVisible && isMailDataNode(node)) readMailChannelFromPanel(node);
  }

  function openChannelTab(node) {
    if (!isChannelDataNode(node)) return;
    setActiveTab(channelTabId(node));
  }

  function facebookListenDefaults() {
    return defaultConfigForBrick({ id: 'facebook' });
  }

  function ensureMailQueryConfig(node) {
    if (!node) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    if (node.config.unseenOnly === undefined) node.config.unseenOnly = false;
    if (node.config.fromContains === undefined) node.config.fromContains = '';
    if (node.config.subjectContains === undefined) node.config.subjectContains = '';
    if (node.config.pollByDate === undefined) node.config.pollByDate = false;
    if (node.config.pollByCount === undefined) node.config.pollByCount = true;
    if (node.config.lookbackHours === undefined) node.config.lookbackHours = 168;
    if (node.config.pollLimit === undefined) node.config.pollLimit = 20;
    node.config.provider = 'mail';
  }

  function setMailLookbackHours(hours) {
    var ui = hoursToLookbackUi(hours);
    var valueEl = document.getElementById('mailLookbackValue');
    var unitEl = document.getElementById('mailLookbackUnit');
    if (unitEl) unitEl.value = ui.unit;
    if (valueEl) valueEl.value = ui.value;
    syncMailLookbackHidden();
  }

  function syncMailLookbackHidden() {
    var valueEl = document.getElementById('mailLookbackValue');
    var unitEl = document.getElementById('mailLookbackUnit');
    var hidden = document.getElementById('mailLookback');
    var hint = document.getElementById('mailLookbackHint');
    if (!valueEl || !unitEl) return;
    var hours = lookbackUiToHours(valueEl.value, unitEl.value);
    if (hidden) hidden.value = String(hours);
    if (hint) {
      hint.textContent = 'Fenêtre active : ' + formatLookbackLabel(hours)
        + ' — seuls les mails reçus dans cette période (SEARCH SINCE, max 90 j).';
    }
    document.querySelectorAll('#mailLookbackPresets [data-mail-lookback-hours]').forEach(function(btn) {
      var preset = parseInt(btn.getAttribute('data-mail-lookback-hours'), 10);
      btn.classList.toggle('btn-agent', preset === hours);
      btn.classList.toggle('btn-agent-ghost', preset !== hours);
    });
  }

  function syncMailQueryUi() {
    var byDate = !!(document.getElementById('mailPollByDate') && document.getElementById('mailPollByDate').checked);
    var byCount = !!(document.getElementById('mailPollByCount') && document.getElementById('mailPollByCount').checked);
    if (!byDate && !byCount) {
      var dateBox = document.getElementById('mailPollByDate');
      if (dateBox) dateBox.checked = true;
      byDate = true;
    }
    var dateFields = document.getElementById('mailPollDateFields');
    if (dateFields) dateFields.style.display = byDate ? '' : 'none';
    var countFields = document.getElementById('mailPollCountFields');
    if (countFields) countFields.style.display = byCount ? '' : 'none';
    var boundHint = document.getElementById('mailPollBoundHint');
    if (boundHint) {
      if (byDate && byCount) {
        boundHint.textContent = 'Les deux : SEARCH date + au plus N messages (les plus récents de la fenêtre).';
      } else if (byDate) {
        boundHint.textContent = 'Date seule : tous les mails de la fenêtre (plafond sécurité 100).';
      } else {
        boundHint.textContent = 'Nombre seul : les N plus récents, sans filtre de date.';
      }
    }
    var presets = document.getElementById('mailLookbackPresets');
    if (presets) presets.style.pointerEvents = byDate ? '' : 'none';
  }

  function loadMailChannelPanel(node) {
    node = node || getActiveChannelNode();
    if (!isMailDataNode(node)) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    ensureMailQueryConfig(node);
    state.activeChannelNodeId = node.id;
    ensureDataKinds(node);
    var slug = ensureNodeSlug(node);
    var titleEl = document.getElementById('mailPanelTitle');
    if (titleEl) titleEl.textContent = 'Mail — ' + (node.name || slug);
    var nsEl = document.getElementById('mailPanelNamespace');
    if (nsEl) nsEl.textContent = '{{' + slug + '}}';
    var accEl = document.getElementById('mailPanelAccount');
    if (accEl) {
      var inst = findConnectorInstance(node.config.instanceId);
      accEl.textContent = inst
        ? accountLabel(inst)
        : (node.config.accountRef || node.config.instanceId || '— Choisissez le compte dans le bloc Entrées');
    }
    var kindsHost = document.getElementById('mailPanelKinds');
    if (kindsHost) kindsHost.innerHTML = dataKindsHtml(node);
    var box = document.getElementById('mailPanelMailbox');
    if (box) box.value = node.config.mailbox || '';
    var unseenEl = document.getElementById('mailUnseenOnly');
    if (unseenEl) unseenEl.checked = node.config.unseenOnly === true;
    var fromEl = document.getElementById('mailFromContains');
    if (fromEl) fromEl.value = node.config.fromContains || '';
    var subEl = document.getElementById('mailSubjectContains');
    if (subEl) subEl.value = node.config.subjectContains || '';
    var byDateEl = document.getElementById('mailPollByDate');
    var byCountEl = document.getElementById('mailPollByCount');
    if (byDateEl) byDateEl.checked = node.config.pollByDate === true;
    if (byCountEl) byCountEl.checked = node.config.pollByCount !== false;
    setMailLookbackHours(node.config.lookbackHours != null ? node.config.lookbackHours : 168);
    var limitEl = document.getElementById('mailPollLimit');
    if (limitEl) limitEl.value = node.config.pollLimit != null ? node.config.pollLimit : 20;
    syncMailQueryUi();
  }

  function readMailChannelFromPanel(node) {
    if (!isMailDataNode(node)) return;
    if (!node.config || typeof node.config !== 'object') node.config = {};
    var box = document.getElementById('mailPanelMailbox');
    if (box) node.config.mailbox = String(box.value || '').trim();
    var unseenEl = document.getElementById('mailUnseenOnly');
    if (unseenEl) node.config.unseenOnly = !!unseenEl.checked;
    var fromEl = document.getElementById('mailFromContains');
    if (fromEl) node.config.fromContains = String(fromEl.value || '').trim();
    var subEl = document.getElementById('mailSubjectContains');
    if (subEl) node.config.subjectContains = String(subEl.value || '').trim();
    var byDateEl = document.getElementById('mailPollByDate');
    var byCountEl = document.getElementById('mailPollByCount');
    if (byDateEl) node.config.pollByDate = !!byDateEl.checked;
    if (byCountEl) node.config.pollByCount = !!byCountEl.checked;
    var lookHidden = document.getElementById('mailLookback');
    var lookVal = document.getElementById('mailLookbackValue');
    var lookUnit = document.getElementById('mailLookbackUnit');
    if (lookVal && lookUnit) {
      node.config.lookbackHours = lookbackUiToHours(lookVal.value, lookUnit.value);
    } else if (lookHidden) {
      node.config.lookbackHours = clampFbInt(lookHidden.value, 168, 1, 2160);
    }
    var limitEl = document.getElementById('mailPollLimit');
    if (limitEl) node.config.pollLimit = clampFbInt(limitEl.value, 20, 1, 100);
    var host = document.getElementById('mailPanelKinds');
    if (!host) return;
    var kinds = [];
    host.querySelectorAll('input[data-kind]').forEach(function(cb) {
      if (cb.checked) kinds.push(cb.getAttribute('data-kind'));
    });
    if (kinds.length) node.config.kinds = kinds;
  }

  function ensureFacebookListenConfig(node) {
    if (!node) return;
    if (!node.config) node.config = {};
    var defaults = facebookListenDefaults();
    Object.keys(defaults).forEach(function(k) {
      if (node.config[k] === undefined) node.config[k] = defaults[k];
    });
    node.config.provider = 'facebook';
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
    var pushOn = currentTriggerMode(getFacebookNode()) === 'webhook';
    var pollOn = !pushOn;
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
    var byDate = !!(document.getElementById('fbPollByDate') && document.getElementById('fbPollByDate').checked);
    var byCount = !!(document.getElementById('fbPollByCount') && document.getElementById('fbPollByCount').checked);
    if (pollOn && !byDate && !byCount) {
      var dateBox = document.getElementById('fbPollByDate');
      if (dateBox) dateBox.checked = true;
      byDate = true;
    }
    var dateFields = document.getElementById('fbPollDateFields');
    if (dateFields) dateFields.style.display = (pollOn && byDate) ? '' : 'none';
    var boundHint = document.getElementById('fbPollBoundHint');
    if (boundHint) {
      if (!pollOn) {
        boundHint.textContent = '';
      } else if (byDate && byCount) {
        boundHint.textContent = 'Les deux : on prend au plus N éléments dans la fenêtre de temps.';
      } else if (byDate) {
        boundHint.textContent = 'Date seule : tout ce qui est dans la fenêtre, sans quota N.';
      } else {
        boundHint.textContent = 'Nombre seul : les N plus récents, sans filtre de date.';
      }
    }

    ['fbLookbackValue', 'fbLookbackUnit', 'fbResPosts', 'fbResComments', 'fbResMessages'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !pollOn;
    });
    var presets = document.getElementById('fbLookbackPresets');
    if (presets) presets.style.pointerEvents = (pollOn && byDate) ? '' : 'none';

    var postsOn = pollOn && document.getElementById('fbResPosts') && document.getElementById('fbResPosts').checked;
    var commentsOn = pollOn && document.getElementById('fbResComments') && document.getElementById('fbResComments').checked;
    var messagesOn = pollOn && document.getElementById('fbResMessages') && document.getElementById('fbResMessages').checked;
    setCardFieldsEnabled('fbPollPostsFields', postsOn);
    setCardFieldsEnabled('fbPollCommentsFields', commentsOn);
    setCardFieldsEnabled('fbPollMessagesFields', messagesOn);
    [
      ['fbPostLimit', postsOn],
      ['fbCommentCatchup', commentsOn],
      ['fbCommentsPerPost', commentsOn],
      ['fbMsgConversations', messagesOn],
      ['fbMsgPerConv', messagesOn]
    ].forEach(function(pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var wrap = el.parentNode;
      if (wrap) wrap.style.display = byCount ? '' : 'none';
      el.disabled = !pair[1] || !byCount;
    });
    var fetchAll = document.getElementById('fbCommentsFetchAll');
    var perPost = document.getElementById('fbCommentsPerPost');
    if (perPost && fetchAll) perPost.disabled = !commentsOn || !byCount || fetchAll.checked;

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

  function syncFacebookTabToTrigger() {
    var webhook = currentTriggerMode(getFacebookNode()) === 'webhook';
    var whZone = document.getElementById('fbWebhookZone');
    var pollZone = document.getElementById('fbPollZone');
    if (whZone) whZone.style.display = webhook ? '' : 'none';
    if (pollZone) pollZone.style.display = webhook ? 'none' : '';
  }

  function loadFacebookConfigPanel(node) {
    node = node || getFacebookNode();
    if (!node) return;
    ensureFacebookListenConfig(node);
    state.facebookPanelLoaded = true;
    state.activeChannelNodeId = node.id;
    syncFacebookTabToTrigger();
    var slug = ensureNodeSlug(node);
    var titleEl = document.getElementById('fbPanelTitle');
    if (titleEl) titleEl.textContent = 'Facebook — ' + (node.name || slug);
    var nsEl = document.getElementById('fbPanelNamespace');
    if (nsEl) nsEl.textContent = '{{' + slug + '}}';
    refreshFacebookAccountUi(node);
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
    var byDateEl = document.getElementById('fbPollByDate');
    var byCountEl = document.getElementById('fbPollByCount');
    if (byDateEl) byDateEl.checked = cfg.pollByDate !== false;
    if (byCountEl) byCountEl.checked = cfg.pollByCount !== false;
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
    syncFacebookKindsFromListen(node);
    loadFacebookConfigPanel(node);
    renderCanvas();
  }

  function readFacebookConfigFromPanel(node) {
    if (!node.config) node.config = {};
    var pageEl = document.getElementById('fbPageId');
    if (isFacebookListenNode(node) && (state.activeTab === 'facebook' || String(state.activeTab || '').indexOf('channel:') === 0) && pageEl) {
      applyFacebookAccountToNode(node, { pageId: pageEl.value || '' });
    } else {
      syncFacebookAccountFromNode(node);
    }
    if (!state.facebookPanelLoaded) return;
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
    var byDateEl = document.getElementById('fbPollByDate');
    var byCountEl = document.getElementById('fbPollByCount');
    node.config.pollByDate = !byDateEl || byDateEl.checked;
    node.config.pollByCount = !byCountEl || byCountEl.checked;
    if (!node.config.pollByDate && !node.config.pollByCount) {
      node.config.pollByDate = true;
    }

    syncFacebookLookbackHidden();
    var lookHours = clampFbInt((document.getElementById('fbLookback') || {}).value, 168, 1, 2160);
    var unit = (document.getElementById('fbLookbackUnit') || {}).value || 'hours';
    node.config.lookbackHours = lookHours;
    node.config.lookbackUnit = unit;
    node.config.scenario = (document.getElementById('fbScenario') || {}).value || '';
    var webhookTrigger = currentTriggerMode(node) === 'webhook';
    node.config.ingestModes = webhookTrigger ? ['push'] : ['poll'];
    if (webhookTrigger) {
      var webhookEvents = [];
      if (document.getElementById('fbWhComments') && document.getElementById('fbWhComments').checked) webhookEvents.push('comments');
      if (document.getElementById('fbWhMessages') && document.getElementById('fbWhMessages').checked) webhookEvents.push('messages');
      if (document.getElementById('fbWhPosts') && document.getElementById('fbWhPosts').checked) webhookEvents.push('posts');
      if (document.getElementById('fbWhNotifications') && document.getElementById('fbWhNotifications').checked) {
        webhookEvents.push('notifications');
      }
      node.config.webhookEvents = webhookEvents.length ? webhookEvents : ['comments', 'messages'];
    } else {
      node.config.webhookEvents = [];
    }
    var resources = [];
    if (document.getElementById('fbResPosts') && document.getElementById('fbResPosts').checked) resources.push('posts');
    if (document.getElementById('fbResComments') && document.getElementById('fbResComments').checked) resources.push('comments');
    if (document.getElementById('fbResMessages') && document.getElementById('fbResMessages').checked) resources.push('messages');
    node.config.resources = resources.length ? resources : (webhookTrigger ? [] : ['posts']);
    syncFacebookKindsFromListen(node);
  }

  function collectAnalyseConfigFromDom() {
    if (!state.analyseConfig) return null;
    var promptEl = document.getElementById('analyseBasePrompt');
    if (promptEl) state.analyseConfig.basePrompt = promptEl.value;
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
    state.analyseConfig.intentionMode = modeEl ? modeEl.value : (state.analyseConfig.intentionMode || 'fixed');
    state.analyseConfig.intentionSetBySource = {
      mail: (document.getElementById('intentionMapMail') || {}).value || 'mail',
      facebook: (document.getElementById('intentionMapFacebook') || {}).value || 'reseaux-sociaux',
      contact: (document.getElementById('intentionMapContact') || {}).value || 'contact'
    };
    return state.analyseConfig;
  }

  function collectRouteConfigFromDom() {
    if (!state.routeConfig) return null;
    syncRouteRulesFromIntentions((state.analyseConfig && state.analyseConfig.intentions) || []);
    var subjectEl = document.getElementById('routeSubjectTpl');
    var bodyEl = document.getElementById('routeBodyTpl');
    if (subjectEl) state.routeConfig.subjectTemplate = subjectEl.value;
    if (bodyEl) state.routeConfig.bodyTemplate = bodyEl.value;
    return state.routeConfig;
  }

  function putBrickConfig(brickId, config) {
    return fetch(API + '/flows/' + state.flowId + '/brick-config/' + encodeURIComponent(brickId), {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ config: config })
    }).then(parseJson).then(function(data) {
      if (!data.success) throw new Error(data.message || 'Erreur config ' + brickId);
      return data;
    });
  }

  function collectDataContractForNode(node) {
    var dataNodes = [];
    if (node && node.brickId === 'data') {
      dataNodes = [node];
    } else if (node) {
      dataNodes = getUpstreamNodes(node.id).filter(function(n) { return n.brickId === 'data'; });
    }
    if (!dataNodes.length) {
      dataNodes = state.nodes.filter(function(n) { return n.brickId === 'data'; });
    }
    var fields = [];
    var seen = {};
    var providers = [];
    var kinds = [];
    var groups = [];
    var groupByProvider = {};
    var labels = [];
    dataNodes.forEach(function(n) {
      ensureDataKinds(n);
      var provider = resolveDataProvider(n);
      var contract = getConnectorContract(provider);
      var providerLabel = (contract && contract.label) || provider || 'Entrées';
      if (provider && providers.indexOf(provider) === -1) {
        providers.push(provider);
        labels.push(providerLabel);
      }
      ((n.config && n.config.kinds) || []).forEach(function(kindId) {
        if (kinds.indexOf(kindId) === -1) kinds.push(kindId);
      });
      selectedKindsForNode(n).forEach(function(kind) {
        var gid = (provider || 'data') + '.' + kind.id;
        var kindLabel = providerLabel + ' — ' + (kind.label || kind.id);
        if (!groupByProvider[gid]) {
          groupByProvider[gid] = {
            id: gid,
            kind: kind.id,
            provider: provider,
            label: kindLabel,
            fields: fieldsForKind(n, kind),
            example: kind.example || null
          };
          groups.push(groupByProvider[gid]);
        }
        groupByProvider[gid].fields.forEach(function(f) {
          if (!f || !f.key || seen[f.key]) return;
          seen[f.key] = true;
          fields.push({ key: f.key, label: f.label || f.key, example: f.example, type: f.type });
        });
      });
    });
    var examples = groups.map(function(g) {
      return { id: g.kind, label: g.label, example: g.example };
    }).filter(function(ex) { return ex.example; });
    return {
      providers: providers,
      kinds: kinds,
      fields: fields,
      groups: groups,
      examples: examples,
      example: examples[0] ? examples[0].example : null,
      label: labels.join(' + ') || 'Entrées'
    };
  }

  function collectPageGenerationContext(node, extra) {
    readIdentityFromDom();
    var reviewContext = (node && node.config && node.config.reviewContext) || '';
    var pageCtxEl = document.getElementById('reviewPageContext');
    if (pageCtxEl && (!node || node.id === state.selectedNodeId)) {
      reviewContext = pageCtxEl.value.trim() || reviewContext;
    }
    extra = extra || {};
    return {
      namespace: extra.namespace || '',
      flowId: state.flowId || '',
      nodeId: (node && node.id) || '',
      agentName: state.name || '',
      agentContext: state.agentContext || '',
      reviewContext: reviewContext,
      dataContract: collectDataContractForNode(node)
    };
  }

  function collectAppPageContext(page) {
    var reviewBits = [];
    var firstNode = null;
    ((page && page.slots) || []).forEach(function(slot) {
      var n = state.nodes.find(function(x) { return x.id === slot.nodeId; });
      if (!n) return;
      if (!firstNode) firstNode = n;
      if (n.config && n.config.reviewContext) reviewBits.push(String(n.config.reviewContext));
    });
    var ctx = collectPageGenerationContext(firstNode, {
      namespace: (page && page.templateNamespace) || ''
    });
    if (reviewBits.length) ctx.reviewContext = reviewBits.join('\n\n');
    ctx.pageTitle = (page && page.title) || '';
    return ctx;
  }

  function storePageEditorContext(ctx) {
    if (!ctx) return;
    try {
      var payload = JSON.stringify(ctx);
      sessionStorage.setItem('gdriAgentPageContext', payload);
      if (ctx.namespace) {
        sessionStorage.setItem('gdriAgentPageContext:' + ctx.namespace, payload);
      }
    } catch (e) { /* quota / private mode */ }
  }

  function openDocEditor(namespace, ctx) {
    if (!ctx) ctx = collectPageGenerationContext(null, { namespace: namespace });
    ctx.namespace = namespace || ctx.namespace;
    storePageEditorContext(ctx);
    saveFlow({ silent: true }).catch(function() { /* on ouvre quand même */ }).then(function() {
      var url = docEditorUrl(namespace, ctx);
      var win = window.open(url, 'gdriDocEditor');
      if (!win) window.location.href = url;
    });
  }

  function ensureSharedDesign() {
    if (currentVizDesign().templateId) return Promise.resolve(currentVizDesign());
    if (state._vizDesignSeeding) return state._vizDesignSeeding;
    state._vizDesignSeeding = applyVizDesignFromUi(null, { silent: true }).finally(function() {
      state._vizDesignSeeding = null;
    });
    return state._vizDesignSeeding;
  }

  function applyVizDesignFromUi(btnEl, opts) {
    opts = opts || {};
    var design = readVizDesignFromDom();
    var statusEl = document.getElementById('vizDesignStatus');
    if (btnEl) btnEl.disabled = true;
    if (statusEl) statusEl.textContent = 'Mise à jour du design…';
    var existingId = design.templateId || '';
    return fetch(API + '/visualization/design', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: 'Design ' + (state.name || 'agent'),
        templateId: existingId,
        design: design
      })
    })
      .then(parseJson)
      .then(function(data) {
        var tpl = data && data.template;
        if (!data || !data.success || !tpl || !tpl.id) {
          throw new Error((data && data.message) || 'Design incomplet');
        }
        state.vizDesign = normalizeVizDesign(Object.assign({}, data.design || design, { prompt: design.prompt }));
        state.vizDesign.templateId = String(tpl.id);
        syncSharedDesignToNodes(tpl.id);
        state.blockTemplatesByUsage[templatesCacheKey('validation', '')] = null;
        return loadBlockTemplates('validation', true, '').then(function() {
          return loadBlockTemplateDetails(tpl.id, true);
        }).then(function() {
          if (statusEl) statusEl.textContent = 'Design partagé appliqué aux blocs visualisation.';
          renderDesignTab();
          renderConfig();
          return saveFlow({ silent: true });
        });
      })
      .catch(function(e) {
        if (statusEl) statusEl.textContent = e.message;
        if (!opts.silent) alert(e.message);
      })
      .finally(function() {
        if (btnEl) btnEl.disabled = false;
      });
  }

  function suggestVizDesignFromUi(btnEl) {
    var design = readVizDesignFromDom();
    design.prompt = String(design.prompt || '').trim() || emptyVizDesign().prompt;
    var promptEl = document.getElementById('vizDesignPrompt');
    if (promptEl) promptEl.value = design.prompt;
    state.vizDesign.prompt = design.prompt;
    var statusEl = document.getElementById('vizDesignSuggestStatus');
    if (btnEl) btnEl.disabled = true;
    if (statusEl) statusEl.textContent = 'L’IA propose des couleurs et des zones…';
    return fetch(API + '/visualization/design-suggest', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ prompt: design.prompt, brief: design.prompt })
    })
      .then(parseJson)
      .then(function(data) {
        if (!data || !data.success || !data.design) {
          throw new Error((data && data.message) || 'Proposition incomplète');
        }
        var next = normalizeVizDesign(Object.assign({}, currentVizDesign(), data.design, {
          prompt: design.prompt,
          templateId: currentVizDesign().templateId
        }));
        state.vizDesign = next;
        var note = data.source === 'ia' ? 'Proposition IA appliquée.' : 'Design par défaut appliqué.';
        return applyVizDesignFromUi(null, { silent: true }).then(function() {
          var after = document.getElementById('vizDesignSuggestStatus');
          if (after) after.textContent = note + (data.iaError ? ' (' + data.iaError + ')' : '');
        });
      })
      .catch(function(e) {
        if (statusEl) statusEl.textContent = e.message;
        alert(e.message);
      })
      .finally(function() {
        if (btnEl) btnEl.disabled = false;
      });
  }

  function forkVizDesignForNode(node, btnEl) {
    var statusEl = document.getElementById('vizForkStatus');
    var sourceId = currentVizDesign().templateId || nodeTemplateId(node);
    if (!sourceId) {
      if (statusEl) statusEl.textContent = 'Appliquez d’abord le design partagé (onglet Design).';
      return;
    }
    if (btnEl) btnEl.disabled = true;
    if (statusEl) statusEl.textContent = 'Copie du design…';
    return fetch(API + '/visualization/design-fork', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        templateId: sourceId,
        name: 'Design dédié — ' + (node.name || 'validation')
      })
    })
      .then(parseJson)
      .then(function(data) {
        var tpl = data && data.template;
        if (!data || !data.success || !tpl || !tpl.id) {
          throw new Error((data && data.message) || 'Séparation impossible');
        }
        if (!node.config) node.config = {};
        node.config.templateId = String(tpl.id);
        node.config.designShared = false;
        state.blockTemplatesByUsage[templatesCacheKey('validation', '')] = null;
        return loadBlockTemplateDetails(tpl.id, true).then(function() {
          if (statusEl) statusEl.textContent = 'Page autonome : ce bloc a sa copie du design.';
          renderConfig();
          return saveFlow({ silent: true });
        });
      })
      .catch(function(e) {
        if (statusEl) statusEl.textContent = e.message;
        alert(e.message);
      })
      .finally(function() {
        if (btnEl) btnEl.disabled = false;
      });
  }

  function joinSharedVizDesign(node) {
    attachSharedDesign(node);
    node.config.designShared = true;
    renderConfig();
    return saveFlow({ silent: true });
  }

  function bindVizDesignTabEvents() {
    var btnApply = document.getElementById('btnApplyVizDesign');
    if (btnApply) {
      btnApply.addEventListener('click', function() { applyVizDesignFromUi(btnApply); });
    }
    var btnSuggest = document.getElementById('btnSuggestVizDesign');
    if (btnSuggest) {
      btnSuggest.addEventListener('click', function() { suggestVizDesignFromUi(btnSuggest); });
    }
    var btnAddZone = document.getElementById('btnVizAddZone');
    if (btnAddZone) {
      btnAddZone.addEventListener('click', function() {
        var input = document.getElementById('vizZoneAdd');
        var name = String((input && input.value) || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
        if (!name) return;
        var d = readVizDesignFromDom();
        if (d.zones.indexOf(name) < 0) d.zones.push(name);
        state.vizDesign = normalizeVizDesign(d);
        renderDesignTab();
      });
    }
    ['primary', 'background', 'surface', 'text', 'muted'].forEach(function(key) {
      var el = document.getElementById('vizColor_' + key);
      if (!el) return;
      el.addEventListener('input', function() {
        var d = readVizDesignFromDom();
        var host = document.getElementById('vizDesignPreview');
        if (!host) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = vizDesignPreviewHtml(d);
        if (wrap.firstChild) host.replaceWith(wrap.firstChild);
      });
    });
  }

  function atelierFieldInputHtml(field, value) {
    var key = field.key;
    var type = String(field.type || 'text');
    var val = value == null ? (field.default != null ? field.default : '') : value;
    if (Array.isArray(val)) val = val.join(', ');
    var common = ' class="form-control" data-atelier-field="' + escapeHtml(key) + '" style="width:100%;margin-top:4px;background:#111827;color:#e2e8f0;border-color:#1f2937;"';
    if (type === 'textarea') {
      return '<textarea rows="3"' + common + '>' + escapeHtml(val) + '</textarea>';
    }
    if (type === 'color') {
      var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(val)) ? String(val) : '#1d4ed8';
      return '<input type="color" value="' + escapeHtml(hex) + '"' + common + ' style="display:block;width:56px;height:32px;padding:0;border:0;background:transparent;">';
    }
    if (type === 'boolean') {
      return '<span class="agent-check" style="margin-top:6px;">'
        + '<input type="checkbox" data-atelier-field="' + escapeHtml(key) + '"' + (val ? ' checked' : '') + '>'
        + '<span>Oui</span></span>';
    }
    var itype = type === 'url' ? 'url' : type === 'number' ? 'number' : 'text';
    return '<input type="' + itype + '" value="' + escapeHtml(val) + '" placeholder="'
      + escapeHtml(field.placeholder || '') + '"' + common + '>';
  }

  function readAtelierFormValues(host) {
    var values = {};
    if (!host) return values;
    host.querySelectorAll('[data-atelier-field]').forEach(function(el) {
      var key = el.getAttribute('data-atelier-field');
      if (!key) return;
      if (el.type === 'checkbox') values[key] = !!el.checked;
      else values[key] = el.value;
    });
    return values;
  }

  function renderDesignTab() {
    var host = document.getElementById('vizDesignTabHost');
    if (!host) return;
    var node = state.nodes.find(isVizNode);
    var pack = state._atelierPack || {};
    var fields = Array.isArray(pack.fields) ? pack.fields : [];
    var record = pack.record || {};
    var mode = state._atelierMode === 'guide' ? 'guide' : 'expert';
    var html = '<div class="agent-viz-design" style="margin:0 0 12px;padding:10px;border:1px solid #1f2937;border-radius:8px;background:#0f172a;">';
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;">';
    html += '<button type="button" class="btn-agent' + (mode === 'guide' ? '' : '-ghost') + '" id="btnAtelierModeGuide">Guide</button>';
    html += '<button type="button" class="btn-agent' + (mode === 'expert' ? '' : '-ghost') + '" id="btnAtelierModeExpert">Expert</button>';
    html += '</div>';
    if (!fields.length) {
      html += '<p class="empty">Chargement du schéma Collection design…</p>';
    } else if (mode === 'guide') {
      var idx = Math.max(0, Math.min(state._atelierGuideIndex || 0, fields.length - 1));
      state._atelierGuideIndex = idx;
      var field = fields[idx];
      html += '<p class="empty" style="margin:0 0 8px;">Question ' + (idx + 1) + ' / ' + fields.length + '</p>';
      html += '<label style="display:block;color:#cbd5e1;font-size:0.85rem;margin-bottom:12px;">'
        + escapeHtml(field.label || field.key)
        + (field.description ? '<small style="display:block;color:#64748b;margin:4px 0;">' + escapeHtml(field.description) + '</small>' : '')
        + atelierFieldInputHtml(field, record[field.key])
        + '</label>';
      html += '<div style="display:flex;gap:8px;">';
      if (idx > 0) html += '<button type="button" class="btn-agent-ghost" id="btnAtelierGuidePrev">Précédent</button>';
      if (idx < fields.length - 1) html += '<button type="button" class="btn-agent" id="btnAtelierGuideNext">Suivant</button>';
      else html += '<button type="button" class="btn-agent" id="btnAtelierSave">Valider</button>';
      html += '</div>';
    } else {
      fields.forEach(function(field) {
        html += '<label style="display:block;color:#cbd5e1;font-size:0.8rem;margin-bottom:10px;">'
          + escapeHtml(field.label || field.key)
          + atelierFieldInputHtml(field, record[field.key])
          + '</label>';
      });
      html += '<button type="button" class="btn-agent" id="btnAtelierSave">Valider</button>';
    }
    html += '<p id="atelierDesignStatus" class="empty" style="margin:8px 0 0;color:#64748b;"></p>';
    html += '</div>';
    host.innerHTML = html;
    bindAtelierDesignEvents(node);
    if (!fields.length && node) {
      ensureAtelierCollectionForNode(node).then(function() { renderDesignTab(); });
    }
  }

  function bindAtelierDesignEvents(node) {
    var host = document.getElementById('vizDesignTabHost');
    function persistLocal() {
      if (!state._atelierPack) state._atelierPack = {};
      state._atelierPack.record = Object.assign({}, state._atelierPack.record || {}, readAtelierFormValues(host));
    }
    var g = document.getElementById('btnAtelierModeGuide');
    if (g) g.addEventListener('click', function() {
      persistLocal();
      state._atelierMode = 'guide';
      renderDesignTab();
    });
    var e = document.getElementById('btnAtelierModeExpert');
    if (e) e.addEventListener('click', function() {
      persistLocal();
      state._atelierMode = 'expert';
      renderDesignTab();
    });
    var prev = document.getElementById('btnAtelierGuidePrev');
    if (prev) prev.addEventListener('click', function() {
      persistLocal();
      state._atelierGuideIndex = Math.max(0, (state._atelierGuideIndex || 0) - 1);
      renderDesignTab();
    });
    var next = document.getElementById('btnAtelierGuideNext');
    if (next) next.addEventListener('click', function() {
      persistLocal();
      state._atelierGuideIndex = (state._atelierGuideIndex || 0) + 1;
      renderDesignTab();
    });
    var save = document.getElementById('btnAtelierSave');
    if (save) {
      save.addEventListener('click', function() {
        persistLocal();
        var pack = state._atelierPack || {};
        var statusEl = document.getElementById('atelierDesignStatus');
        if (!pack.schemaSlug && !pack.collectionId && !pack.catalogId) {
          if (statusEl) statusEl.textContent = 'Schéma design manquant.';
          return;
        }
        save.disabled = true;
        if (statusEl) statusEl.textContent = 'Enregistrement…';
        fetch(API + '/atelier/records', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            collectionId: pack.collectionId || '',
            schemaSlug: pack.schemaSlug || 'design',
            values: pack.record || {},
            flowId: state.flowId || '',
            nodeId: node && node.id
          })
        })
          .then(parseJson)
          .then(function(data) {
            if (!data || !data.success) throw new Error((data && data.message) || 'Échec');
            if (data.collectionId) pack.collectionId = data.collectionId;
            if (statusEl) statusEl.textContent = 'Design enregistré.';
            return saveFlow({ silent: true });
          })
          .catch(function(err) {
            if (statusEl) statusEl.textContent = err.message;
          })
          .finally(function() { save.disabled = false; });
      });
    }
  }

  function generateReviewPageFromAi(node, btnEl) {
    return applyVizDesignFromUi(btnEl);
  }

  function docEditorUrl(namespace, ctx) {
    var base = (cfg.docEditorBaseUrl || '').replace(/\?.*$/, '');
    if (!base) return '#';
    var nodeForNs = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    var ns = namespace || (nodeForNs ? resolveBlockPageNamespace(nodeForNs) : '');
    if (!ns) ns = 'agent:review:draft';
    if (!ctx) ctx = collectPageGenerationContext(nodeForNs, { namespace: ns });
    ctx.namespace = ns;
    storePageEditorContext(ctx);
    var url = base + '?template=' + encodeURIComponent(ns);
    var contract = ctx.dataContract || {};
    if (contract.providers && contract.providers.length) {
      url += '&provider=' + encodeURIComponent(contract.providers.join(','));
    }
    if (contract.kinds && contract.kinds.length) {
      url += '&kinds=' + encodeURIComponent(contract.kinds.join(','));
    }
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'return=' + encodeURIComponent(window.location.href);
    return url;
  }

  function syncDocEditorLink() {
    var input = document.getElementById('docReviewTemplateNs');
    var link = document.getElementById('btnDocOpenEditor');
    var hint = document.getElementById('docReviewEditorHint');
    var nodeForNs = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    var ns = (input && input.value.trim())
      || (nodeForNs ? resolveBlockPageNamespace(nodeForNs) : '')
      || blockPageNamespace({ id: 'node' });
    if (link) {
      link.href = docEditorUrl(ns);
      link.textContent = 'Ouvrir l\'éditeur HTML (« ' + ns + ' »)';
      storePageEditorContext(collectPageGenerationContext(nodeForNs, { namespace: ns }));
    }
    if (hint) {
      hint.textContent = ns
        ? 'Éditeur : ' + ns + ' — enregistrez le template puis liez le même namespace ci-dessous.'
        : 'Choisissez ou créez un namespace, puis ouvrez l\'éditeur.';
    }
  }

  function ensureDocReviewNode() {
    var selected = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    var node = (selected && (selected.brickId === 'human-doc-review' || selected.brickId === 'validation'))
      ? selected
      : state.nodes.find(function(n) { return (n.brickId === 'human-doc-review' || n.brickId === 'validation'); });
    if (!node) {
      alert('Ajoutez le bloc « Validation » sur le canvas.');
      return null;
    }
    if (!node.config) node.config = {};
    resolveBlockPageNamespace(node);
    return node;
  }

  function bootstrapInvoiceReviewTemplate(force) {
    var node = ensureDocReviewNode();
    var ns = node ? resolveBlockPageNamespace(node) : blockPageNamespace({ id: 'node' });
    var input = document.getElementById('docReviewTemplateNs');
    if (input) input.value = ns;

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
    var selected = state.nodes.find(function(n) { return n.id === state.selectedNodeId; });
    var node = (selected && (selected.brickId === 'human-doc-review' || selected.brickId === 'validation'))
      ? selected
      : state.nodes.find(function(n) { return (n.brickId === 'human-doc-review' || n.brickId === 'validation'); });
    input.value = node ? resolveBlockPageNamespace(node) : '';
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

  function fillAnalyseConfigForm() {
    if (!state.analyseConfig) state.analyseConfig = { intentions: [], basePrompt: '', intentionMode: 'fixed' };
    var promptEl = document.getElementById('analyseBasePrompt');
    if (promptEl) promptEl.value = state.analyseConfig.basePrompt || '';
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
  }

  function loadAnalyseConfigPanel() {
    if (!state.flowId) {
      fillAnalyseConfigForm();
      return;
    }
    fetch(API + '/flows/' + state.flowId + '/brick-config/analyse-intention', { headers: headers() })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message);
        state.analyseConfig = (data.data && data.data.config) || { intentions: [], basePrompt: '' };
        fillAnalyseConfigForm();
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
      if (!state.routeConfig) {
        state.routeConfig = {
          rules: [],
          defaultTarget: { type: 'emails', to: [] },
          subjectTemplate: '[{{intention}}] {{subject}}',
          bodyTemplate: 'Intention: {{intention}}\n\nMessage:\n{{body}}'
        };
      }
      var subjectEl = document.getElementById('routeSubjectTpl');
      var bodyEl = document.getElementById('routeBodyTpl');
      if (subjectEl) subjectEl.value = state.routeConfig.subjectTemplate || '[{{intention}}] {{subject}}';
      if (bodyEl) bodyEl.value = state.routeConfig.bodyTemplate || 'Intention: {{intention}}\n\n{{body}}';
      syncRouteRulesFromIntentions((state.analyseConfig && state.analyseConfig.intentions) || []);
      renderRoutingRules();
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

  var lastSavedFingerprint = '';

  function flowFingerprint() {
    try {
      return JSON.stringify(buildPayload());
    } catch (e) {
      return '';
    }
  }

  function markFlowSaved() {
    lastSavedFingerprint = flowFingerprint();
  }

  function isFlowDirty() {
    return !!lastSavedFingerprint && flowFingerprint() !== lastSavedFingerprint;
  }

  function saveFlow(opts) {
    opts = opts || {};
    persistActiveChannelPanel();
    readIdentityFromDom();
    var analyse = collectAnalyseConfigFromDom();
    var route = collectRouteConfigFromDom();
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
        migrateValidationPageNamespaces();
        var extras = [];
        if (analyse) extras.push(putBrickConfig('analyse-intention', analyse));
        if (route) extras.push(putBrickConfig('route-intention', route));
        return Promise.all(extras).then(function(results) {
          results.forEach(function(d) {
            if (d && d.routeConfig) state.routeConfig = d.routeConfig;
          });
          markFlowSaved();
          var syncMsg = '';
          if (data.facebookSync && data.facebookSync.matched > 0) {
            syncMsg = ' Facebook synchronisé sur le connecteur ('
              + data.facebookSync.modified + '/' + data.facebookSync.matched + ').';
          }
          if (data.mailSync && data.mailSync.matched > 0) {
            syncMsg += ' Mail synchronisé sur le connecteur ('
              + data.mailSync.modified + '/' + data.mailSync.matched + ').';
          }
          if (!opts.silent) alert('Agent enregistré.' + syncMsg);
        });
      });
  }

  function ancestorCanvasSlugs(nodeId) {
    var allowed = {};
    var seen = {};
    var q = getIncomingNodes(nodeId).map(function(n) { return n.id; });
    while (q.length) {
      var id = q.shift();
      if (!id || seen[id]) continue;
      seen[id] = true;
      var n = state.nodes.find(function(x) { return x.id === id; });
      if (n && n.slug) allowed[n.slug] = true;
      getIncomingNodes(id).forEach(function(p) { q.push(p.id); });
    }
    return allowed;
  }

  function previewTablesForNode(preview, node) {
    var tables = preview && Array.isArray(preview.tables) ? preview.tables.slice() : [];
    if (!tables.length) return tables;
    if (!node || node.brickId === 'data' || node.brickId === 'trigger' || node.kind === 'trigger') {
      return tables.filter(function(t) { return t.role === 'out'; });
    }
    var allowed = ancestorCanvasSlugs(node.id);
    if (node.slug) allowed[node.slug] = true;
    return tables.filter(function(t) {
      if (t.role === 'out') return true;
      var slug = t.slug || '';
      return !!(slug && allowed[slug]);
    });
  }

  function runNodeBadgeHtml(nodeId) {
    var dbg = state.runDebug && state.runDebug.byNode ? state.runDebug.byNode[nodeId] : null;
    if (!dbg || !dbg.status) return '';
    if (dbg.status === 'running') {
      return ' <span class="agent-node-run-badge"><span class="agent-busy-spin" aria-hidden="true"></span>en cours</span>';
    }
    var node = state.nodes.find(function(n) { return n.id === nodeId; });
    var label = runPreviewLabel(dbg.preview, dbg.status, dbg.error, node);
    if (!label) return '';
    return ' <span class="agent-node-run-badge">' + escapeHtml(label) + '</span>';
  }

  function runNodeErrorHtml(nodeId) {
    var dbg = state.runDebug && state.runDebug.byNode ? state.runDebug.byNode[nodeId] : null;
    var err = (dbg && dbg.error) || (dbg && dbg.preview && dbg.preview.error) || '';
    if (!err) return '';
    return '<div class="agent-node-run-error" title="' + escapeHtml(String(err)) + '">' + escapeHtml(String(err).slice(0, 90)) + '</div>';
  }

  function runPreviewLabel(preview, status, error, node) {
    var err = error || (preview && preview.error) || '';
    if (status === 'failed' || err) {
      return String(err || 'erreur').slice(0, 32);
    }
    if (status === 'running') return 'en cours';
    if (status === 'waiting_human') return 'validation';
    if (status === 'skipped' || status === 'pending') return '';
    if (!preview) return status === 'completed' ? 'ok' : '';
    var tables = previewTablesForNode(preview, node);
    if (tables.length > 1) {
      return tables.map(function(t) {
        var n = Number(t.itemsCount);
        return (Number.isFinite(n) ? n : 0);
      }).join(' + ');
    }
    if (preview.body && (preview.empty || preview.itemsCount === 0)) return 'texte';
    if (preview.empty || preview.itemsCount === 0) return '0 ligne';
    if (preview.itemsCount != null && preview.itemsCount !== '') {
      var n = Number(preview.itemsCount);
      if (Number.isFinite(n) && n > 0) return n + (n > 1 ? ' lignes' : ' ligne');
    }
    if (preview.to) return '→ ' + String(preview.to).slice(0, 28);
    if (preview.body) return 'texte';
    return 'ok';
  }

  var IO_COL_LABELS = {
    from: 'De',
    subject: 'Sujet',
    intention: 'Intention',
    intention_principale: 'Intention',
    confiance: 'Confiance',
    confidence: 'Confiance',
    resume: 'Résumé',
    text: 'Texte',
    body: 'Corps',
    name: 'Nom',
    id: 'Id',
    label: 'Libellé',
    definition: 'Définition',
    to: 'Destinataire',
    condition: 'Résultat',
    field: 'Champ',
    op: 'Opérateur',
    value: 'Valeur',
    actual: 'Valeur trouvée',
    success: 'Succès',
    rendered: 'Rendu'
  };

  function previewItemCells(row) {
    if (row && row.cells && typeof row.cells === 'object') return row.cells;
    var cells = {};
    if (!row || typeof row !== 'object') return cells;
    Object.keys(IO_COL_LABELS).forEach(function(k) {
      if (row[k] != null && row[k] !== '') cells[k] = row[k];
    });
    return cells;
  }

  function ioTableColumns(items) {
    var order = ['from', 'subject', 'intention', 'confiance', 'resume', 'text', 'name', 'id', 'label', 'definition', 'to', 'condition', 'field', 'op', 'value', 'actual', 'success', 'rendered'];
    var skip = { intention_principale: 'intention', confidence: 'confiance', body: 'text' };
    var present = {};
    (items || []).forEach(function(row) {
      var cells = previewItemCells(row);
      Object.keys(cells).forEach(function(k) {
        if (skip[k] && (cells[skip[k]] != null && cells[skip[k]] !== '' || present[skip[k]])) return;
        present[k] = true;
      });
    });
    var cols = order.filter(function(k) { return present[k]; });
    if (!cols.length) {
      Object.keys(present).slice(0, 8).forEach(function(k) { cols.push(k); });
    }
    return cols.map(function(k) { return { key: k, label: IO_COL_LABELS[k] || k }; });
  }

  function runTableTitle(table) {
    if (!table) return 'Tableau';
    var role = table.role === 'out' ? 'Ce bloc' : (table.role === 'in' ? 'Amont' : 'Tableau');
    var slug = table.slug || '';
    var node = slug && state.nodes.find(function(n) { return n.slug === slug; });
    var name = String(table.name || '').trim()
      || (node && (node.name || node.brickId))
      || '';
    if (isExpertView() && slug) {
      return role + ' — ' + (name && name !== slug ? name + ' · ' : '') + slug;
    }
    return role + ' — ' + (name || slug || 'flux');
  }

  function runTableItemsHtml(table) {
    var html = '';
    var items = (table && Array.isArray(table.items)) ? table.items : [];
    if (!items.length) {
      if (table && table.body && table.role === 'out') {
        html += '<pre class="agent-run-preview-body">' + escapeHtml(table.body) + '</pre>';
      } else {
        html += '<p class="empty">Aucune ligne</p>';
      }
      return html;
    }
    var cols = ioTableColumns(items);
    html += '<div class="json-model-table-wrap agent-data-test-table-wrap">';
    html += '<table class="json-model-table json-model-table--preview"><thead><tr><th>#</th>';
    cols.forEach(function(c) {
      html += '<th>' + escapeHtml(c.label) + '</th>';
    });
    html += '</tr></thead><tbody>';
    items.forEach(function(row, i) {
      var cells = previewItemCells(row);
      html += '<tr><td>' + (i + 1) + '</td>';
      cols.forEach(function(c) {
        var val = cells[c.key];
        html += '<td>' + escapeHtml(val == null || val === '' ? '—' : String(val)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function mappedInputsHtml(mapped) {
    if (!mapped || typeof mapped !== 'object') return '';
    var keys = Object.keys(mapped);
    if (!keys.length) return '';
    var html = '<div class="agent-run-table"><h5>Entrées mappées</h5>';
    html += '<div class="json-model-table-wrap agent-data-test-table-wrap">';
    html += '<table class="json-model-table json-model-table--preview"><thead><tr><th>Slot</th><th>Source</th><th>Valeur</th></tr></thead><tbody>';
    keys.forEach(function(k) {
      var slot = mapped[k] || {};
      html += '<tr><td>' + escapeHtml(k) + '</td><td>' + escapeHtml(slot.from || '') + '</td><td>'
        + escapeHtml(slot.value != null && slot.value !== '' ? String(slot.value) : '—') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function runPreviewDetailHtml(preview, error, node, side) {
    var err = error || (preview && preview.error) || '';
    if (!preview && !err) return '';
    var html = '<div class="agent-run-preview' + (err ? ' is-err' : '') + '">';
    html += '<h4>' + (side === 'in' ? 'Entrée du dernier run' : (side === 'out' ? 'Sortie du dernier run' : 'Entrée / sortie du dernier run')) + '</h4>';
    if (err) html += '<p class="agent-run-preview-error">' + escapeHtml(err) + '</p>';
    if (preview && preview.note) html += '<p class="empty">' + escapeHtml(preview.note) + '</p>';
    var tables = previewTablesForNode(preview, node).filter(function(t) {
      if (side === 'in') return t.role === 'in';
      if (side === 'out') return t.role === 'out';
      return true;
    });
    if (side !== 'out') html += mappedInputsHtml(preview && preview.mapped);
    if (tables.length) {
      tables.forEach(function(table) {
        var n = table.itemsCount != null ? Number(table.itemsCount) : ((table.items && table.items.length) || 0);
        if (!Number.isFinite(n)) n = 0;
        html += '<div class="agent-run-table' + (table.role === 'out' ? ' is-out' : '') + '">';
        html += '<h5>' + escapeHtml(runTableTitle(table)) + ' — ' + n + ' ligne' + (n > 1 ? 's' : '') + '</h5>';
        html += runTableItemsHtml(table);
        html += '</div>';
      });
    } else if (preview && preview.itemsCount != null && side !== 'in') {
      html += '<p><strong>' + escapeHtml(String(preview.itemsCount)) + '</strong> ligne(s)</p>';
    }
    if (preview && preview.debug) {
      if (side !== 'out') {
        html += '<details class="agent-run-io">';
        html += '<summary>Entrée — requête envoyée</summary>';
        html += '<pre class="agent-run-preview-body">' + escapeHtml(preview.debug.requestText || JSON.stringify(preview.debug.request || {}, null, 2) || '—') + '</pre>';
        html += '</details>';
      }
      if (side !== 'in') {
        html += '<details class="agent-run-io">';
        html += '<summary>Sortie — réponse reçue</summary>';
        html += '<pre class="agent-run-preview-body">' + escapeHtml(preview.debug.responseText || JSON.stringify(preview.debug.response || {}, null, 2) || '—') + '</pre>';
        html += '</details>';
      }
    }
    if (preview && preview.to && side !== 'in') html += '<p>Destinataire : ' + escapeHtml(preview.to) + '</p>';
    if (preview && preview.subject && side !== 'in') html += '<p>Sujet : ' + escapeHtml(preview.subject) + '</p>';
    if (preview && preview.zones && !(preview.tables && preview.tables.length) && side !== 'in') {
      Object.keys(preview.zones).forEach(function(key) {
        if (!preview.zones[key]) return;
        html += '<p><code>' + escapeHtml(key) + '</code> ' + escapeHtml(preview.zones[key]) + '</p>';
      });
    }
    html += '</div>';
    return html;
  }

  function stopRunPoll() {
    if (state.runPollTimer) {
      clearInterval(state.runPollTimer);
      state.runPollTimer = null;
    }
  }

  function setRunButtonBusy(busy) {
    var btn = document.getElementById('btnRunAgent');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? '⏳ Run…' : '▶ Lancer';
  }

  function hasCanvasRunOverlay() {
    if (state.runDebug) return true;
    var bar = document.getElementById('agentRunStatus');
    return !!(bar && !bar.hidden);
  }

  function syncClearRunButton() {
    var btn = document.getElementById('btnClearRun');
    if (!btn) return;
    btn.hidden = !hasCanvasRunOverlay();
  }

  function clearCanvasRun() {
    stopRunPoll();
    state.runDebug = null;
    setRunButtonBusy(false);
    var bar = document.getElementById('agentRunStatus');
    if (bar) {
      bar.hidden = true;
      bar.textContent = '';
      bar.className = 'agent-run-status';
      bar.removeAttribute('title');
    }
    syncClearRunButton();
    renderCanvas();
    if (state.selectedLink || state.selectedNodeId) renderConfig();
  }

  function ensureRunStatusBar() {
    var el = document.getElementById('agentRunStatus');
    if (el) return el;
    var actions = document.querySelector('.agent-editor-actions');
    if (!actions) return null;
    el = document.createElement('span');
    el.id = 'agentRunStatus';
    el.className = 'agent-run-status';
    el.hidden = true;
    actions.insertBefore(el, actions.firstChild);
    return el;
  }

  function applyRunProgress(run, progress) {
    var items = (progress && progress.items) || [];
    var byNode = {};
    items.forEach(function(it) {
      if (!it || !it.id) return;
      byNode[it.id] = it;
    });
    var prevStatus = state.runDebug && state.runDebug.status;
    state.runDebug = {
      runId: run && run._id ? String(run._id) : (state.runDebug && state.runDebug.runId) || null,
      status: (run && run.status) || (state.runDebug && state.runDebug.status) || 'running',
      error: (run && run.error) || null,
      items: items,
      byNode: byNode
    };
    var bar = ensureRunStatusBar();
    if (bar) {
      var st = state.runDebug.status;
      var failed = items.find(function(it) { return it && (it.status === 'failed' || it.error); });
      var firstErr = state.runDebug.error || (failed && failed.error) || '';
      if (failed && st === 'completed') st = 'failed';
      var done = items.filter(function(it) { return it.status === 'completed'; }).length;
      var label = st === 'running' ? ('Run… ' + done + '/' + items.length)
        : st === 'completed' ? ('Terminé · ' + done + ' bloc(s)')
        : st === 'failed' ? ('Échec' + (firstErr ? ' — ' + firstErr : ''))
        : st === 'waiting_human' ? 'En attente de validation'
        : st;
      bar.hidden = false;
      bar.className = 'agent-run-status is-' + st;
      if (st === 'running') {
        bar.innerHTML = '<span class="agent-busy-spin" aria-hidden="true"></span>' + escapeHtml(label);
      } else {
        bar.textContent = label;
      }
      if (firstErr) bar.title = firstErr;
    }
    setRunButtonBusy(state.runDebug.status === 'running');
    syncClearRunButton();
    renderCanvas();
    if (state.runDebug.status !== 'running' && prevStatus === 'running') {
      refreshCurrentFlowExports();
      var errNode = items.find(function(it) { return it && (it.status === 'failed' || it.error); });
      if (errNode) {
        state.selectedNodeId = errNode.id;
        state.selectedLink = null;
      }
      if (state.selectedLink || state.selectedNodeId) renderConfig();
    }
  }

  function pollCanvasRun(runId) {
    stopRunPoll();
    function tick() {
      fetch(API + '/runs/' + encodeURIComponent(runId), { headers: headers() })
        .then(parseJson)
        .then(function(data) {
          if (!data.success) throw new Error(data.message || 'Run introuvable');
          applyRunProgress(data.run, data.progress);
          var st = data.run && data.run.status;
          if (st && st !== 'running') stopRunPoll();
        })
        .catch(function(err) {
          stopRunPoll();
          setRunButtonBusy(false);
          var bar = ensureRunStatusBar();
          if (bar) {
            bar.hidden = false;
            bar.className = 'agent-run-status is-failed';
            bar.textContent = err.message || 'Erreur de suivi';
          }
          syncClearRunButton();
        });
    }
    tick();
    state.runPollTimer = setInterval(tick, 1500);
  }

  function startCanvasRun() {
    if (!state.flowId) throw new Error('Enregistrez l\'agent avant de le lancer.');
    setRunButtonBusy(true);
    var bar = ensureRunStatusBar();
    if (bar) {
      bar.hidden = false;
      bar.className = 'agent-run-status is-running';
      bar.innerHTML = '<span class="agent-busy-spin" aria-hidden="true"></span>Démarrage…';
    }
    syncClearRunButton();
    var body = { async: true };
    var triggerNodeId = canvasRunTriggerNodeId();
    if (triggerNodeId) body.triggerNodeId = triggerNodeId;
    return fetch(API + '/flows/' + encodeURIComponent(state.flowId) + '/run', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    })
      .then(parseJson)
      .then(function(data) {
        if (!data.success) throw new Error(data.message || 'Échec du lancement');
        var run = data.run || {};
        var runId = run._id ? String(run._id) : null;
        if (!runId) throw new Error('Run créé sans identifiant');
        applyRunProgress(run, data.progress || { items: [] });
        pollCanvasRun(runId);
      })
      .catch(function(err) {
        setRunButtonBusy(false);
        var bar = ensureRunStatusBar();
        if (bar) {
          bar.hidden = false;
          bar.className = 'agent-run-status is-failed';
          bar.textContent = err.message || 'Échec du lancement';
        }
        syncClearRunButton();
        throw err;
      });
  }

  function runFlow() {
    function go() {
      return startCanvasRun();
    }
    if (!state.flowId || isFlowDirty()) {
      return saveFlow({ silent: !!state.flowId }).then(go);
    }
    return Promise.resolve().then(go);
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
      var shortcutId = e.dataTransfer.getData('text/palette-shortcut');
      if (!shortcutId) {
        var plain = e.dataTransfer.getData('text/plain') || '';
        if (plain.indexOf('shortcut:') === 0) shortcutId = plain.slice('shortcut:'.length);
      }
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left - 100;
      var y = e.clientY - rect.top - 36;
      if (shortcutId) {
        var parent = getBrick(brickId);
        var child = paletteChildrenOf(parent).filter(function(c) { return c.id === shortcutId; })[0];
        if (child) {
          placePaletteShortcut(child, x, y);
          return;
        }
      }
      var brick = getBrick(brickId);
      if (!brick) return;
      addNodeFromBrick(brick, x, y);
    });
    canvas.addEventListener('click', function() {
      state.selectedNodeId = null;
      state.selectedLink = null;
      renderConfig();
      renderCanvas();
    });
  }

  function initCanvasKeyboard() {
    document.addEventListener('keydown', function(e) {
      var isDelete = e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace'
        || e.code === 'Delete' || e.code === 'Backspace';
      if (!isDelete) return;
      if (isEditableKeyboardTarget(e.target)) return;
      if (state.selectedLink) {
        e.preventDefault();
        deleteSelectedLink();
        return;
      }
      if (state.activeTab !== 'canvas') return;
      if (!state.selectedNodeId) return;
      if (e.key === 'Backspace' || e.code === 'Backspace') return;
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
              if (!isGdriAdmin && (fd.systemLocked || isSystemFlowPayload(fd.flow))) {
                showSystemAgentLocked(fd.message || systemAgentLockedCopy());
                return null;
              }
              if (fd.flow && fd.flow.entrepriseId) {
                state.entrepriseId = String(fd.flow.entrepriseId);
              }
              loadFromFlow(fd.flow);
              return Promise.all([loadFacebookPages(), loadConnectorCatalog(), loadMailAccounts(), loadDocCollections(), loadIntentionPresets(), loadEntityLlms(), loadPaletteCatalog(), loadHookCatalog()]);
            })
            .then(function(loaded) {
              if (!loaded) return;
              syncAllFacebookAccounts();
              fillFacebookPageSelects();
              applyWebhookPresetToData();
              render();
              markFlowSaved();
            });
        }

        return Promise.all([loadFacebookPages(), loadConnectorCatalog(), loadMailAccounts(), loadDocCollections(), loadIntentionPresets(), loadEntityLlms(), loadPaletteCatalog(), loadHookCatalog()]).then(function() {
          syncAllFacebookAccounts();
          render();
          fillFacebookPageSelects();
          markFlowSaved();
        });
      })
      .catch(function(e) {
        alert('Erreur initialisation : ' + e.message);
      });

    document.getElementById('btnSaveAgent').addEventListener('click', function() {
      saveFlow().catch(function(e) { alert(e.message); });
    });
    var btnHookPalette = document.getElementById('btnHookPalette');
    if (btnHookPalette) {
      btnHookPalette.addEventListener('click', function() {
        openPaletteHookForm();
      });
    }
    document.getElementById('btnRunAgent').addEventListener('click', function() {
      runFlow().catch(function(e) { alert(e.message); });
    });
    var btnClearRun = document.getElementById('btnClearRun');
    if (btnClearRun) {
      btnClearRun.addEventListener('click', function() {
        clearCanvasRun();
      });
    }

    var imgUrl = document.getElementById('agentImageUrl');
    if (imgUrl) {
      imgUrl.addEventListener('change', function() {
        state.imageUrl = imgUrl.value.trim();
        syncIdentityFields();
      });
      imgUrl.addEventListener('input', function() {
        state.imageUrl = imgUrl.value.trim();
        var appImg = document.getElementById('appImageUrl');
        if (appImg && appImg !== document.activeElement) appImg.value = state.imageUrl;
        updateAppPreview();
      });
    }
    var toolbarName = document.getElementById('agentName');
    if (toolbarName) {
      toolbarName.addEventListener('input', function() {
        state.name = toolbarName.value.trim() || 'Nouvel agent';
        var appName = document.getElementById('appName');
        if (appName && appName !== document.activeElement) appName.value = toolbarName.value;
        updateAppPreview();
      });
    }
    [
      ['appName', function(v) {
        state.name = v.trim() || 'Nouvel agent';
        if (toolbarName) toolbarName.value = state.name;
      }],
      ['appDescription', function(v) { state.description = v.trim(); }],
      ['appImageUrl', function(v) {
        state.imageUrl = v.trim();
        if (imgUrl) imgUrl.value = state.imageUrl;
        var preview = document.getElementById('agentImagePreview');
        if (preview) {
          if (state.imageUrl) {
            preview.src = state.imageUrl;
            preview.style.display = '';
          } else {
            preview.removeAttribute('src');
            preview.style.display = 'none';
          }
        }
      }],
      ['appButtonLabel', function(v) {
        if (!state.app) state.app = { publish: 'auto', buttonLabel: 'Lancer' };
        state.app.buttonLabel = v.trim() || 'Lancer';
      }]
    ].forEach(function(pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      el.addEventListener('input', function() {
        pair[1](el.value);
        updateAppPreview();
      });
    });
    var pubEl = document.getElementById('appPublish');
    if (pubEl) {
      pubEl.addEventListener('change', function() {
        if (!state.app) state.app = { publish: 'auto', buttonLabel: 'Lancer' };
        state.app.publish = pubEl.value || 'auto';
        updateAppPreview();
      });
    }
    ['paletteIconEmoji', 'paletteFamily', 'paletteHookSurface'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      function onPaletteField() {
        readPaletteFromDom();
        updateAgentBlockPreview();
        var status = document.getElementById('palettePublishStatus');
        var pal = ensurePaletteState();
        if (status) {
          status.textContent = pal.publish
            ? 'Accroché dans la palette · ' + hookSurfaceLabel(pal.hookSurface)
            : 'Pas encore publié comme sous-agent.';
        }
        var hint = document.getElementById('paletteHookHint');
        if (hint) {
          hint.textContent = pal.hookSurface === 'palette'
            ? 'Tu ne le vois pas dans ce flux : nom + image deviennent le bouton palette, puis le bloc dans l’autre canvas.'
            : 'Tu ne le vois pas dans ce flux : le hook « ' + hookSurfaceLabel(pal.hookSurface)
              + ' » s’applique au bloc une fois l’agent posé ailleurs.';
        }
      }
      el.addEventListener('input', onPaletteField);
      el.addEventListener('change', onPaletteField);
    });
    var btnPublishPalette = document.getElementById('btnPublishPalette');
    if (btnPublishPalette) {
      btnPublishPalette.addEventListener('click', function() {
        hookCurrentFlowToPalette(null);
      });
    }
    bindAppPagesEvents();
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
            var reviewNode = ensureDocReviewNode();
            openDocEditor(ns, collectPageGenerationContext(reviewNode, { namespace: ns }));
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
            var reviewNode = ensureDocReviewNode();
            openDocEditor(ns, collectPageGenerationContext(reviewNode, { namespace: ns }));
          })
          .catch(function(e) { alert(e.message); });
      });
    }
    var btnDocGenAi = document.getElementById('btnDocGenerateAi');
    if (btnDocGenAi) {
      btnDocGenAi.addEventListener('click', function() {
        var node = ensureDocReviewNode();
        var ns = node ? resolveBlockPageNamespace(node) : '';
        var input = document.getElementById('docReviewTemplateNs');
        if (input) input.value = ns;
        var briefEl = document.getElementById('docReviewAiBrief');
        var statusEl = document.getElementById('docReviewAiStatus');
        var brief = briefEl ? briefEl.value.trim() : '';
        if (!brief) {
          brief = 'Page de revue facture mail : en-tête, expéditeur/sujet, corps, pièces jointes téléchargeables.';
        }
        if (!confirm('Générer la page « ' + ns + ' » par IA ? La mise en page existante sera remplacée.')) return;
        var ctx = collectPageGenerationContext(node, { namespace: ns });
        if (brief) ctx.reviewContext = brief;
        storePageEditorContext(ctx);
        var apiDoc = (cfg.docApiBase || ((cfg.apiBase || '').replace(/\/$/, '') + '/agent-documentaire-v2')).replace(/\/$/, '');
        btnDocGenAi.disabled = true;
        if (statusEl) statusEl.textContent = 'Génération IA en cours…';
        fetch(apiDoc + '/templates/' + encodeURIComponent(ns) + '/generate-ai', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            brief: brief,
            agentContext: ctx.agentContext,
            reviewContext: ctx.reviewContext,
            dataContract: ctx.dataContract,
            save: true,
            entrepriseId: ENTREPRISE_ID || undefined
          })
        })
          .then(parseJson)
          .then(function(data) {
            if (!data.success) throw new Error(data.error || data.message || 'Échec génération');
            var reviewNode = ensureDocReviewNode();
            if (reviewNode) reviewNode.config.templateNamespace = ns;
            syncDocEditorLink();
            if (statusEl) {
              statusEl.textContent = (data.message || 'OK')
                + (data.source === 'ia' ? ' — ouvrez l\'éditeur pour ajuster.' : ' — modèle de secours (IA indisponible).');
            }
            openDocEditor(ns, ctx);
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

    var tabsHost = document.getElementById('agentEditorTabs');
    if (tabsHost) {
      tabsHost.addEventListener('click', function(ev) {
        var btn = ev.target.closest ? ev.target.closest('.agent-tab') : null;
        if (!btn || !tabsHost.contains(btn)) return;
        var tab = btn.getAttribute('data-tab');
        if (tab) setActiveTab(tab);
      });
    }

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
    var intentionModeEl = document.getElementById('intentionMode');
    if (intentionModeEl) {
      intentionModeEl.addEventListener('change', syncIntentionModeUi);
    }
    var fbPageSel = document.getElementById('fbPageId');
    if (fbPageSel && fbPageSel.tagName === 'SELECT') {
      fbPageSel.addEventListener('change', function() {
        var node = getFacebookNode();
        if (!node) return;
        applyFacebookAccountToNode(node, { pageId: fbPageSel.value || '' });
        ensureFacebookListenConfig(node);
        if (state.selectedNodeId === node.id) renderConfig();
        else refreshFacebookAccountUi(node);
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
      'fbWhComments',
      'fbWhMessages',
      'fbWhPosts',
      'fbWhNotifications',
      'fbResPosts',
      'fbResComments',
      'fbResMessages',
      'fbCommentsFetchAll',
      'fbPollByDate',
      'fbPollByCount'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function() {
          syncFacebookZonesUi();
          var node = getFacebookNode();
          if (node && state.facebookPanelLoaded) {
            readFacebookConfigFromPanel(node);
            renderCanvas();
          }
        });
      }
    });
    document.querySelectorAll('[data-fb-scenario]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        applyFacebookScenario(btn.getAttribute('data-fb-scenario'));
      });
    });
    var mailKindsHost = document.getElementById('mailPanelKinds');
    if (mailKindsHost) {
      mailKindsHost.addEventListener('change', function() {
        var mailNode = getActiveChannelNode();
        if (!isMailDataNode(mailNode)) return;
        readMailChannelFromPanel(mailNode);
        renderCanvas();
      });
    }
    var mailBoxEl = document.getElementById('mailPanelMailbox');
    if (mailBoxEl) {
      mailBoxEl.addEventListener('change', function() {
        var mailNode = getActiveChannelNode();
        if (isMailDataNode(mailNode)) readMailChannelFromPanel(mailNode);
      });
    }
    function persistMailQueryFromUi() {
      var mailNode = getActiveChannelNode();
      if (!isMailDataNode(mailNode)) return;
      readMailChannelFromPanel(mailNode);
      renderCanvas();
    }
    var mailLookVal = document.getElementById('mailLookbackValue');
    var mailLookUnit = document.getElementById('mailLookbackUnit');
    if (mailLookVal) {
      mailLookVal.addEventListener('input', function() {
        syncMailLookbackHidden();
        persistMailQueryFromUi();
      });
    }
    if (mailLookUnit) mailLookUnit.addEventListener('change', function() {
      syncMailLookbackHidden();
      persistMailQueryFromUi();
    });
    document.querySelectorAll('#mailLookbackPresets [data-mail-lookback-hours]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setMailLookbackHours(parseInt(btn.getAttribute('data-mail-lookback-hours'), 10));
        persistMailQueryFromUi();
      });
    });
    ['mailFromContains', 'mailSubjectContains', 'mailPollLimit'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', persistMailQueryFromUi);
      el.addEventListener('change', persistMailQueryFromUi);
    });
    ['mailUnseenOnly', 'mailPollByDate', 'mailPollByCount'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function() {
        if (id === 'mailPollByDate' || id === 'mailPollByCount') syncMailQueryUi();
        persistMailQueryFromUi();
      });
    });
    initViewModeToggle();
    initCanvasDnD();
    initCanvasKeyboard();
    initDataContractModal();
    initActionComposeModal();
    initCollectionEditorBridge();
    window.addEventListener('beforeunload', function(ev) {
      if (!isFlowDirty()) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
