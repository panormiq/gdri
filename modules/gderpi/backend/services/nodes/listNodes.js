/**
 * FICHIER : modules/gderpi/backend/services/nodes/listNodes.js
 * RÔLE : Retourne l'état catalogue nœuds (plat + arbre).
 *
 * ENTRÉES : db, entrepriseId
 * SORTIES : { nodes, tree, tagRegistry, updatedAt }
 *
 * DÉPEND DE : getNodesState.js, buildNodesTree.js
 * NE PAS : CRUD individuel
 *
 * APPELÉ PAR : nodesController
 */

const getNodesState = require('./getNodesState');
const buildNodesTree = require('./buildNodesTree');

async function listNodes(db, entrepriseId) {
  const state = await getNodesState(db, entrepriseId);
  return {
    nodes: state.nodes,
    tree: buildNodesTree(state.nodes),
    tagRegistry: state.tagRegistry,
    updatedAt: state.updatedAt
  };
}

module.exports = listNodes;
