/**
 * Graphe canvas agent : plusieurs sorties / entrées par nœud.
 * nextId / nextFalseId restent des alias du 1er lien (compat anciens flows).
 */

function asIdList(primaryArray, legacySingle) {
  const out = [];
  const seen = {};
  function push(id) {
    const s = id == null ? '' : String(id).trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  }
  if (Array.isArray(primaryArray)) primaryArray.forEach(push);
  push(legacySingle);
  return out;
}

function isConditionNode(node) {
  if (!node) return false;
  return node.brickId === 'condition' || node.brickId === 'logic-if';
}

function isLoopNode(node) {
  return !!(node && node.brickId === 'loop');
}

function isFalsePort(port) {
  return port === 'false' || port === 'done';
}

function isCasePort(port) {
  const p = String(port || '');
  return p === 'default' || p.indexOf('case:') === 0;
}

function nodeNextPortMap(node) {
  if (!node || !node.nextPortIds || typeof node.nextPortIds !== 'object' || Array.isArray(node.nextPortIds)) {
    return {};
  }
  const out = {};
  Object.keys(node.nextPortIds).forEach((port) => {
    const ids = asIdList(node.nextPortIds[port], null);
    if (ids.length) out[port] = ids;
  });
  return out;
}

function nodeNextPortIds(node, port) {
  if (!port) return [];
  return asIdList(nodeNextPortMap(node)[port], null);
}

function nodeNextIds(node) {
  if (!node) return [];
  return asIdList(node.nextIds, node.nextId);
}

function nodeNextFalseIds(node) {
  if (!node) return [];
  return asIdList(node.nextFalseIds, node.nextFalseId);
}

function allOutgoingIds(node) {
  const seen = {};
  const out = [];
  function push(id) {
    const s = id == null ? '' : String(id).trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  }
  nodeNextIds(node).forEach(push);
  nodeNextFalseIds(node).forEach(push);
  const map = nodeNextPortMap(node);
  Object.keys(map).forEach((port) => map[port].forEach(push));
  return out;
}

function syncNextAliases(node) {
  if (!node) return node;
  const ids = asIdList(node.nextIds, null);
  const falses = asIdList(node.nextFalseIds, null);
  node.nextIds = ids;
  node.nextFalseIds = falses;
  node.nextId = ids[0] || null;
  node.nextFalseId = falses[0] || null;
  node.nextPortIds = nodeNextPortMap(node);
  return node;
}

function addOutgoing(node, targetId, port) {
  if (!node || !targetId) return node;
  if (isCasePort(port)) {
    if (!node.nextPortIds || typeof node.nextPortIds !== 'object') node.nextPortIds = {};
    const list = nodeNextPortIds(node, port);
    if (list.indexOf(targetId) === -1) list.push(targetId);
    node.nextPortIds[port] = list;
    return syncNextAliases(node);
  }
  const wantFalse = isFalsePort(port);
  const list = wantFalse ? nodeNextFalseIds(node) : nodeNextIds(node);
  if (list.indexOf(targetId) === -1) list.push(targetId);
  if (wantFalse) node.nextFalseIds = list;
  else node.nextIds = list;
  return syncNextAliases(node);
}

function removeOutgoing(node, targetId, port) {
  if (!node || !targetId) return node;
  if (!port || port === 'true' || port === 'main' || port === 'body') {
    node.nextIds = nodeNextIds(node).filter((id) => id !== targetId);
  }
  if (!port || isFalsePort(port)) {
    node.nextFalseIds = nodeNextFalseIds(node).filter((id) => id !== targetId);
  }
  if (!port || isCasePort(port)) {
    const map = nodeNextPortMap(node);
    Object.keys(map).forEach((p) => {
      if (port && p !== port) return;
      map[p] = map[p].filter((id) => id !== targetId);
      if (!map[p].length) delete map[p];
    });
    node.nextPortIds = map;
  }
  return syncNextAliases(node);
}

function clearOutgoing(node) {
  if (!node) return node;
  node.nextIds = [];
  node.nextFalseIds = [];
  node.nextId = null;
  node.nextFalseId = null;
  node.nextPortIds = {};
  return node;
}

function nodeTargetsId(node, targetId) {
  return allOutgoingIds(node).indexOf(targetId) !== -1;
}

function incomingNodes(nodes, targetId) {
  const list = Array.isArray(nodes) ? nodes : [];
  return list.filter((n) => nodeTargetsId(n, targetId));
}

/** Ancêtres graphe (parents, grands-parents…) — pas les branches sœurs. */
function ancestorNodeIds(targetId, nodes) {
  const want = String(targetId || '').trim();
  if (!want) return [];
  const seen = {};
  const out = [];
  const q = incomingNodes(nodes, want).map((n) => n && n.id).filter(Boolean);
  while (q.length) {
    const id = String(q.shift() || '').trim();
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
    incomingNodes(nodes, id).forEach((p) => {
      if (p && p.id) q.push(p.id);
    });
  }
  return out;
}

function ancestorSlugs(targetId, nodes) {
  const byId = {};
  (Array.isArray(nodes) ? nodes : []).forEach((n) => {
    if (n && n.id) byId[n.id] = n;
  });
  return ancestorNodeIds(targetId, nodes)
    .map((id) => {
      const n = byId[id];
      return n ? String(n.slug || '').trim() : '';
    })
    .filter(Boolean);
}

/** Le nœud targetId peut encore s’exécuter depuis la file (et ses descendants). */
function nodeMightStillRun(targetId, pendingIds, completed, byId) {
  const want = String(targetId || '');
  if (!want) return false;
  if (completed && Object.prototype.hasOwnProperty.call(completed, want)) return false;
  const vis = {};
  const q = (pendingIds || []).map((id) => String(id || '')).filter(Boolean);
  while (q.length) {
    const cur = q.shift();
    if (!cur || vis[cur]) continue;
    if (completed && Object.prototype.hasOwnProperty.call(completed, cur)) continue;
    vis[cur] = true;
    if (cur === want) return true;
    const n = byId && byId[cur];
    if (n) allOutgoingIds(n).forEach((next) => q.push(String(next)));
  }
  return false;
}

/**
 * Tous les parents ont fini, ou ne peuvent plus tourner (branche non prise).
 * Permet un join : Mails + Liste → IA.
 */
function parentsReadyToJoin(nodeId, nodes, pendingIds, completed, byId) {
  const parents = incomingNodes(nodes, nodeId);
  for (let i = 0; i < parents.length; i += 1) {
    const pid = parents[i] && parents[i].id;
    if (!pid) continue;
    if (completed && Object.prototype.hasOwnProperty.call(completed, pid)) continue;
    if (nodeMightStillRun(pid, pendingIds, completed, byId)) return false;
  }
  return true;
}

function resolveNextIds(node, output) {
  if (output && Array.isArray(output.__nextNodeIds)) {
    return asIdList(output.__nextNodeIds, null);
  }
  if (output && output.__nextNodeId !== undefined) {
    return output.__nextNodeId ? asIdList(null, output.__nextNodeId) : [];
  }
  return nodeNextIds(node);
}

module.exports = {
  asIdList,
  isConditionNode,
  isLoopNode,
  isFalsePort,
  isCasePort,
  nodeNextIds,
  nodeNextFalseIds,
  nodeNextPortIds,
  nodeNextPortMap,
  allOutgoingIds,
  syncNextAliases,
  addOutgoing,
  removeOutgoing,
  clearOutgoing,
  nodeTargetsId,
  incomingNodes,
  ancestorNodeIds,
  ancestorSlugs,
  nodeMightStillRun,
  parentsReadyToJoin,
  resolveNextIds
};
