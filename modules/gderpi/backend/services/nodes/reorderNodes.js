/**
 * FICHIER : modules/gderpi/backend/services/nodes/reorderNodes.js
 * RÔLE : Réordonne les nœuds (parentId + sortOrder) en une passe.
 *
 * ENTRÉES : db, entrepriseId, items[] { id, parentId?, sortOrder? }
 * SORTIES : état sauvegardé
 *
 * DÉPEND DE : getNodesState.js, saveNodesState.js, normalizeCatalogNode.js
 * NE PAS : création/suppression de nœuds
 *
 * APPELÉ PAR : nodesController
 */

const getNodesState = require('./getNodesState');
const saveNodesState = require('./saveNodesState');
const normalizeCatalogNode = require('./normalizeCatalogNode');

async function reorderNodes(db, entrepriseId, items) {
  const state = await getNodesState(db, entrepriseId);
  const updates = new Map(
    (Array.isArray(items) ? items : []).map((item) => [String(item.id || '').trim(), item])
  );
  const nodes = state.nodes.map((n, i) => {
    const patch = updates.get(n.id);
    if (!patch) return n;
    return normalizeCatalogNode({ ...n, ...patch, id: n.id }, i);
  });
  const saved = await saveNodesState(db, entrepriseId, {
    nodes,
    tagRegistry: state.tagRegistry
  });
  return saved;
}

module.exports = reorderNodes;
