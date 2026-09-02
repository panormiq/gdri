/**
 * Choix du déclencheur de départ : chaque nœud Déclencher n’exécute que sa chaîne.
 */

const { allOutgoingIds } = require('./flowGraph');

function isTriggerNode(node) {
  if (!node) return false;
  const id = String(node.brickId || '');
  if (id === 'manual-trigger' || id === 'cron-trigger') return true;
  return node.kind === 'trigger' || id === 'trigger';
}

function triggerModeOf(node) {
  if (!node) return 'button';
  const id = String(node.brickId || '');
  if (id === 'manual-trigger') return 'button';
  if (id === 'cron-trigger') return 'cron';
  const mode = String((node.config && node.config.mode) || 'button').toLowerCase();
  if (mode === 'http') return 'webhook';
  if (mode === 'block' || mode === 'select' || mode === 'import') return 'block';
  if (mode === 'webhook' || mode === 'cron') return mode;
  return 'button';
}

function canvasNodes(flow) {
  return flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
}

function canvasTriggerNodes(flow) {
  const nodes = canvasNodes(flow);
  const fromCanvas = nodes.filter(isTriggerNode);
  if (fromCanvas.length) return fromCanvas;
  const list = Array.isArray(flow && flow.triggers) && flow.triggers.length
    ? flow.triggers
    : (flow && flow.trigger ? [flow.trigger] : []);
  return list.map((t, i) => ({
    id: t.id || t.nodeId || `legacy-trigger-${i}`,
    brickId: t.brickId || 'trigger',
    kind: 'trigger',
    config: t.config || {}
  }));
}

function descendantNodeIds(startId, nodes) {
  const byId = {};
  (nodes || []).forEach((n) => {
    if (n && n.id) byId[n.id] = n;
  });
  const seen = {};
  const out = [];
  const q = [String(startId || '')];
  while (q.length) {
    const id = String(q.shift() || '').trim();
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
    const n = byId[id];
    if (n) allOutgoingIds(n).forEach((next) => q.push(String(next)));
  }
  return out;
}

function subgraphNodes(trigger, nodes) {
  const ids = descendantNodeIds(trigger && trigger.id, nodes);
  const set = {};
  ids.forEach((id) => { set[id] = true; });
  return (nodes || []).filter((n) => n && set[n.id]);
}

function webhookInstanceMatches(node, instanceId, pageId) {
  if (triggerModeOf(node) !== 'webhook') return false;
  const selected = String((node.config && node.config.webhookInstanceId) || '').trim();
  const want = String(instanceId || '').trim();
  const page = String(pageId || '').trim();
  if (!selected) return false;
  if (want && selected === want) return true;
  if (page && (selected === page || selected === `fb-page:${page}`)) return true;
  return false;
}

function dataNodeMatchesInstance(node, instanceId, pageId, accountRef) {
  if (!node || node.brickId !== 'data') return false;
  const cfg = node.config || {};
  const cfgInst = String(cfg.instanceId || '').trim();
  const cfgPage = String(cfg.pageId || '').trim();
  const cfgRef = String(cfg.accountRef || '').trim();
  const want = String(instanceId || '').trim();
  const page = String(pageId || '').trim();
  const ref = String(accountRef || '').trim();
  if (want && cfgInst && cfgInst === want) return true;
  if (page && cfgPage && cfgPage === page) return true;
  if (ref && cfgRef && cfgRef === ref) return true;
  return false;
}

function triggerSubgraphMatchesInstance(trigger, nodes, instanceId, pageId, accountRef) {
  return subgraphNodes(trigger, nodes).some((n) =>
    dataNodeMatchesInstance(n, instanceId, pageId, accountRef)
  );
}

function normalizeLaunchMode(triggerMode) {
  const m = String(triggerMode || '').toLowerCase();
  if (m === 'cron') return 'cron';
  if (m === 'webhook' || m === 'http') return 'webhook';
  if (m === 'polling' || m === 'poll') return 'polling';
  return 'button';
}

function findTriggerById(triggers, id) {
  const want = String(id || '').trim();
  if (!want) return null;
  return triggers.find((t) => String(t.id || '') === want) || null;
}

/**
 * Déclencheurs qui doivent démarrer ce run.
 * Vide = ne pas lancer les autres graphes du canvas.
 */
function findStartTriggerNodes(flow, opts = {}) {
  const nodes = canvasNodes(flow);
  const triggers = canvasTriggerNodes(flow);
  if (!triggers.length) return [];

  const preferred = findTriggerById(triggers, opts.triggerNodeId);
  if (preferred) return [preferred];

  const mode = normalizeLaunchMode(opts.triggerMode);
  const instanceId = opts.instanceId;
  const pageId = opts.pageId;
  const accountRef = opts.accountRef;

  if (mode === 'cron') {
    return triggers.filter((t) => triggerModeOf(t) === 'cron');
  }

  if (mode === 'webhook' || mode === 'polling') {
    const webhookHits = triggers.filter((t) => webhookInstanceMatches(t, instanceId, pageId));
    if (webhookHits.length) return webhookHits;

    const webhookTriggers = triggers.filter((t) => triggerModeOf(t) === 'webhook');
    if (webhookTriggers.length && mode === 'webhook') return [];

    const dataHits = triggers.filter((t) => {
      if (triggerModeOf(t) === 'cron' || triggerModeOf(t) === 'button') return false;
      return triggerSubgraphMatchesInstance(t, nodes, instanceId, pageId, accountRef);
    });
    if (dataHits.length) return dataHits;

    if (triggers.length === 1 && triggerModeOf(triggers[0]) !== 'cron') return triggers;
    return [];
  }

  const buttons = triggers.filter((t) => triggerModeOf(t) === 'button');
  if (buttons.length) return [buttons[0]];
  const runnable = triggers.filter((t) => triggerModeOf(t) !== 'block');
  if (runnable.length === 1) return runnable;
  if (runnable.length) return [runnable[0]];
  if (triggers.length === 1) return triggers;
  return triggers[0] ? [triggers[0]] : [];
}

function launchOptsFromPayload(triggerMode, payload = {}) {
  return {
    triggerNodeId: payload.triggerNodeId || payload.nodeId || null,
    triggerMode,
    instanceId: payload.instanceId,
    pageId: payload.pageId,
    accountRef: payload.accountRef
  };
}

module.exports = {
  isTriggerNode,
  triggerModeOf,
  canvasTriggerNodes,
  descendantNodeIds,
  subgraphNodes,
  webhookInstanceMatches,
  findStartTriggerNodes,
  launchOptsFromPayload
};
