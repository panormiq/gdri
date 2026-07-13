/**
 * FICHIER : modules/pm/backend/services/boards/ensureBoardIndexes.js
 * RÔLE : Crée les index Mongo pour les tableaux PM.
 */

const COLLECTION = 'pm_boards';

async function ensureBoardIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, boardId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, isDefault: 1 });
}

module.exports = ensureBoardIndexes;
