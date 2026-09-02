/**
 * Allègement du flux au run : une donnée ne reste que tant qu’un
 * bloc encore possible la relit. Édition = catalogue graphe (inchangé).
 */

const { normalizeNsPath, namespaceBag, nsOrder } = require('./nodeNamespace');

const KEEP_ALL = true;

const PROTECTED = {
  __ns: 1,
  __nsOrder: 1,
  __durable: 1,
  __writeMode: 1,
  __dropKeys: 1,
  __keepPaths: 1,
  __waitingHuman: 1,
  __nextNodeId: 1,
  __nextNodeIds: 1,
  debug: 1,
  type: 1,
  success: 1,
  channel: 1
};

const SYSTEM_PATHS = {
  today: 1,
  date: 1,
  i: 1,
  itemIndex: 1,
  itemNumber: 1,
  entrepriseId: 1,
  flowId: 1,
  runId: 1
};

function unique(list) {
  const seen = {};
  const out = [];
  (list || []).forEach((raw) => {
    const k = String(raw || '').trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(k);
  });
  return out;
}

function extractTokens(text) {
  const src = String(text == null ? '' : text);
  const out = [];
  const re = /\{\{\s*(?:#\s*each\s+|#\s*|\/\s*)?([a-zA-Z0-9_.À-ÿ$\[\]]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = String(m[1] || '').trim().replace(/\[[^\]]*\]/g, '');
    if (!raw) continue;
    const path = normalizeNsPath(raw) || raw;
    if (SYSTEM_PATHS[path] || SYSTEM_PATHS[path.split('.')[0]]) continue;
    out.push(path);
  }
  return unique(out);
}

function nodeConsumesAll(node) {
  if (!node) return false;
  const cfg = node.config && typeof node.config === 'object' ? node.config : {};
  if (node.brickId === 'validation' && (cfg.subFlowId || cfg.subTemplateId)) return true;
  return false;
}

function consumedPathsFromNode(node) {
  if (!node) return [];
  if (nodeConsumesAll(node)) return KEEP_ALL;
  const cfg = node.config && typeof node.config === 'object' ? node.config : {};
  const out = [];

  const mapping = cfg.mapping && typeof cfg.mapping === 'object' ? cfg.mapping : {};
  Object.keys(mapping).forEach((slot) => {
    const from = String(mapping[slot] || '').trim();
    if (!from || from === '__literal__' || from.indexOf('__llm__:') === 0) return;
    const path = normalizeNsPath(from) || from;
    if (!SYSTEM_PATHS[path]) out.push(path);
  });

  try {
    extractTokens(JSON.stringify(cfg)).forEach((t) => out.push(t));
  } catch (_) { /* ignore */ }

  ['field', 'source', 'collectionNamespace'].forEach((k) => {
    const raw = String(cfg[k] || '').trim();
    if (!raw || raw.indexOf('{{') >= 0) return;
    const path = normalizeNsPath(raw) || raw;
    if (!SYSTEM_PATHS[path] && /[a-zA-Z]/.test(path)) out.push(path);
  });

  if (Array.isArray(cfg.exportFields)) {
    cfg.exportFields.forEach((raw) => {
      const path = normalizeNsPath(String(raw || '').trim()) || String(raw || '').trim();
      if (path && !SYSTEM_PATHS[path]) out.push(path);
    });
  }

  ['copyFrom', 'sourceObject'].forEach((k) => {
    const raw = String(cfg[k] || '').trim();
    if (!raw || raw.indexOf('{{') >= 0) return;
    const path = normalizeNsPath(raw) || raw;
    if (path && !SYSTEM_PATHS[path]) out.push(path);
  });

  if (node.brickId === 'validation') {
    ['items', 'item', 'subject', 'from', 'text', 'body', 'attachments', 'sourceRef'].forEach((k) => out.push(k));
  }
  if (node.brickId === 'loop') {
    ['items', 'item', 'itemsCount', 'itemIndex', 'itemNumber'].forEach((k) => out.push(k));
  }

  return unique(out);
}

function neededPathsForNodes(nodes) {
  const paths = [];
  const list = Array.isArray(nodes) ? nodes : [];
  for (let i = 0; i < list.length; i += 1) {
    const got = consumedPathsFromNode(list[i]);
    if (got === KEEP_ALL) return KEEP_ALL;
    got.forEach((p) => paths.push(p));
  }
  return unique(paths);
}

function expandNeeded(paths) {
  const set = {};
  unique(paths).forEach((p) => {
    const path = normalizeNsPath(p) || String(p || '').trim();
    if (!path || SYSTEM_PATHS[path]) return;
    set[path] = true;
    if (path.indexOf('.') < 0) set[`*:${path}`] = true;
  });
  return set;
}

function pathIsNeeded(path, neededSet) {
  const p = normalizeNsPath(path) || String(path || '').trim();
  if (!p) return false;
  if (neededSet[p]) return true;
  const keys = Object.keys(neededSet);
  for (let i = 0; i < keys.length; i += 1) {
    const n = keys[i];
    if (n === p || n.indexOf(p + '.') === 0 || p.indexOf(n + '.') === 0) return true;
  }
  return false;
}

function projectPrevious(previous, neededPaths) {
  const prev = previous && typeof previous === 'object' ? previous : {};
  if (neededPaths === KEEP_ALL) return prev;
  const neededSet = expandNeeded(Array.isArray(neededPaths) ? neededPaths : []);
  const next = {};
  Object.keys(PROTECTED).forEach((k) => {
    if (k === '__ns' || k === '__nsOrder' || k === '__durable') return;
    if (Object.prototype.hasOwnProperty.call(prev, k)) next[k] = prev[k];
  });
  Object.keys(SYSTEM_PATHS).forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(prev, k)) next[k] = prev[k];
  });

  const ns = namespaceBag(prev);
  const nextNs = {};
  const order = [];
  nsOrder(prev).concat(Object.keys(ns)).forEach((slug) => {
    if (!slug || nextNs[slug]) return;
    const bag = ns[slug];
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) {
      if (pathIsNeeded(slug, neededSet)) {
        nextNs[slug] = bag;
        order.push(slug);
      }
      return;
    }
    const nested = Object.keys(neededSet).filter((k) => k.indexOf(`${slug}.`) === 0);
    if (neededSet[slug] && !nested.length) {
      nextNs[slug] = bag;
      order.push(slug);
      return;
    }
    const copy = {};
    Object.keys(bag).forEach((k) => {
      if (PROTECTED[k]) return;
      if (neededSet[`${slug}.${k}`] || neededSet[`*:${k}`]) copy[k] = bag[k];
    });
    if (Object.keys(copy).length) {
      nextNs[slug] = copy;
      order.push(slug);
    }
  });

  Object.keys(prev).forEach((k) => {
    if (PROTECTED[k] || SYSTEM_PATHS[k] || k === '__ns' || k === '__nsOrder' || k === '__durable') return;
    if (pathIsNeeded(k, neededSet)) next[k] = prev[k];
  });

  next.__ns = nextNs;
  next.__nsOrder = order;
  return next;
}

function restoreWritten(previous, data, slug) {
  const next = { ...previous, ...data };
  if (!slug) return next;
  const ns = next.__ns && typeof next.__ns === 'object' ? { ...next.__ns } : {};
  ns[slug] = { ...(ns[slug] || {}), ...data };
  next.__ns = ns;
  const order = Array.isArray(next.__nsOrder) ? next.__nsOrder.filter((s) => s !== slug) : [];
  order.push(slug);
  next.__nsOrder = order;
  return next;
}

/**
 * Après fusion des écritures : ne garder que ce que les blocs encore
 * possibles vont relire. remainingNodes vide = fin de chemin.
 */
function applyFlowConsume(previous, output, node, written, remainingNodes) {
  const slug = node ? String(node.slug || '').trim() : '';
  const data = written && typeof written === 'object' ? written : {};
  let next = previous && typeof previous === 'object' ? previous : {};
  next = restoreWritten(next, data, slug);
  if (remainingNodes === undefined) return next;
  return projectPrevious(next, neededPathsForNodes(remainingNodes));
}

module.exports = {
  KEEP_ALL,
  extractTokens,
  consumedPathsFromNode,
  neededPathsForNodes,
  projectPrevious,
  restoreWritten,
  applyFlowConsume
};
