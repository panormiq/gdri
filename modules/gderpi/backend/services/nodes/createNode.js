/**
 * FICHIER : modules/gderpi/backend/services/nodes/createNode.js
 * RÔLE : Ajoute un nœud catalogue à l'état entreprise.
 *
 * ENTRÉES : db, entrepriseId, payload nœud
 * SORTIES : nœud créé + état complet
 *
 * DÉPEND DE : getNodesState.js, saveNodesState.js, normalizeCatalogNode.js
 * NE PAS : suppression, réordonnancement
 *
 * APPELÉ PAR : nodesController
 */

const crypto = require('crypto');
const getNodesState = require('./getNodesState');
const saveNodesState = require('./saveNodesState');
const normalizeCatalogNode = require('./normalizeCatalogNode');

async function createNode(db, entrepriseId, data) {
  const state = await getNodesState(db, entrepriseId);
  const node = normalizeCatalogNode({
    ...data,
    id: String(data?.id || '').trim() || crypto.randomUUID()
  }, state.nodes.length);
  if (state.nodes.some((n) => n.id === node.id)) {
    throw new Error('Un nœud avec cet identifiant existe déjà');
  }
  if (node.parentId && !state.nodes.some((n) => n.id === node.parentId)) {
    throw new Error('Nœud parent introuvable');
  }
  const nodes = [...state.nodes, node].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'fr')
  );
  const saved = await saveNodesState(db, entrepriseId, {
    nodes,
    tagRegistry: state.tagRegistry
  });
  return { node, state: saved };
}

module.exports = createNode;
