/**
 * FICHIER : modules/gderpi/backend/services/nodes/getNodesState.js
 * RÔLE : Charge l'état nœuds catalogue (crée un état vide si absent).
 *
 * ENTRÉES : db, entrepriseId
 * SORTIES : { nodes, tagRegistry, updatedAt }
 *
 * DÉPEND DE : ensureNodesStateIndexes.js, normalizeNodesState.js
 * NE PAS : mutations
 *
 * APPELÉ PAR : listNodes.js, createNode.js, nodesController
 */

const ensureNodesStateIndexes = require('./ensureNodesStateIndexes');
const normalizeNodesState = require('./normalizeNodesState');

const COLLECTION = 'gderpi_nodes_state';

async function getNodesState(db, entrepriseId) {
  await ensureNodesStateIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  let doc = await col.findOne({ entrepriseId: eid });
  if (!doc) {
    const normalized = normalizeNodesState({});
    const now = new Date();
    doc = {
      entrepriseId: eid,
      nodes: normalized.nodes,
      tagRegistry: normalized.tagRegistry,
      createdAt: now,
      updatedAt: now
    };
    await col.insertOne(doc);
  }
  const normalized = normalizeNodesState(doc);
  return {
    ...normalized,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null
  };
}

module.exports = getNodesState;
