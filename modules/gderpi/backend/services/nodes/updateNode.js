/**
 * FICHIER : modules/gderpi/backend/services/nodes/updateNode.js
 * RÔLE : Met à jour un nœud catalogue existant.
 *
 * ENTRÉES : db, entrepriseId, nodeId, patch
 * SORTIES : nœud mis à jour + état complet
 *
 * DÉPEND DE : getNodesState.js, saveNodesState.js, normalizeCatalogNode.js
 * NE PAS : création, suppression
 *
 * APPELÉ PAR : nodesController
 */

const getNodesState = require('./getNodesState');
const saveNodesState = require('./saveNodesState');
const normalizeCatalogNode = require('./normalizeCatalogNode');

async function updateNode(db, entrepriseId, nodeId, patch) {
  const id = String(nodeId || '').trim();
  if (!id) throw new Error('Identifiant nœud requis');
  const state = await getNodesState(db, entrepriseId);
  const index = state.nodes.findIndex((n) => n.id === id);
  if (index < 0) throw new Error('Nœud introuvable');
  const merged = normalizeCatalogNode({ ...state.nodes[index], ...patch, id }, index);
  if (merged.parentId === id) throw new Error('Un nœud ne peut pas être son propre parent');
  if (merged.parentId && !state.nodes.some((n) => n.id === merged.parentId)) {
    throw new Error('Nœud parent introuvable');
  }
  const nodes = [...state.nodes];
  nodes[index] = merged;
  const saved = await saveNodesState(db, entrepriseId, {
    nodes,
    tagRegistry: state.tagRegistry
  });
  return { node: merged, state: saved };
}

module.exports = updateNode;
