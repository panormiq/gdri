/**
 * FICHIER : modules/gderpi/backend/services/nodes/ensureNodesStateIndexes.js
 * RÔLE : Crée l'index unique sur l'état nœuds catalogue par entreprise.
 *
 * ENTRÉES : db Mongo entreprise
 * SORTIES : void
 *
 * DÉPEND DE : aucun
 * NE PAS : logique normalisation
 *
 * APPELÉ PAR : getNodesState.js, saveNodesState.js
 */

const COLLECTION = 'gderpi_nodes_state';

async function ensureNodesStateIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1 }, { unique: true });
}

module.exports = ensureNodesStateIndexes;
