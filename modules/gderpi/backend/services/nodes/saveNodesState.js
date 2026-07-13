/**
 * FICHIER : modules/gderpi/backend/services/nodes/saveNodesState.js
 * RÔLE : Persiste l'état nœuds catalogue normalisé pour une entreprise.
 *
 * ENTRÉES : db, entrepriseId, { nodes, tagRegistry }
 * SORTIES : état sauvegardé avec updatedAt ISO
 *
 * DÉPEND DE : ensureNodesStateIndexes.js, normalizeNodesState.js
 * NE PAS : validation métier articles
 *
 * APPELÉ PAR : createNode.js, updateNode.js, deleteNode.js, reorderNodes.js
 */

const ensureNodesStateIndexes = require('./ensureNodesStateIndexes');
const normalizeNodesState = require('./normalizeNodesState');

const COLLECTION = 'gderpi_nodes_state';

async function saveNodesState(db, entrepriseId, payload) {
  await ensureNodesStateIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const normalized = normalizeNodesState(payload);
  const now = new Date();
  await col.updateOne(
    { entrepriseId: eid },
    {
      $set: {
        nodes: normalized.nodes,
        tagRegistry: normalized.tagRegistry,
        updatedAt: now
      },
      $setOnInsert: { entrepriseId: eid, createdAt: now }
    },
    { upsert: true }
  );
  return { ...normalized, updatedAt: now.toISOString() };
}

module.exports = saveNodesState;
