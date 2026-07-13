/**
 * FICHIER : modules/gderpi/backend/services/nodes/deleteNode.js
 * RÔLE : Supprime un nœud et rattache ses enfants au parent du nœud supprimé.
 *
 * ENTRÉES : db, entrepriseId, nodeId
 * SORTIES : { deleted: true, state }
 *
 * DÉPEND DE : getNodesState.js, saveNodesState.js
 * NE PAS : suppression articles liés (nodeId conservé sur articles orphelins)
 *
 * APPELÉ PAR : nodesController
 */

const getNodesState = require('./getNodesState');
const saveNodesState = require('./saveNodesState');

async function deleteNode(db, entrepriseId, nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) throw new Error('Identifiant nœud requis');
  const state = await getNodesState(db, entrepriseId);
  const target = state.nodes.find((n) => n.id === id);
  if (!target) throw new Error('Nœud introuvable');
  const parentId = String(target.parentId || '').trim();
  const nodes = state.nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.parentId === id ? { ...n, parentId } : n));
  const saved = await saveNodesState(db, entrepriseId, {
    nodes,
    tagRegistry: state.tagRegistry
  });
  return { deleted: true, state: saved };
}

module.exports = deleteNode;
