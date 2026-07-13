/**
 * FICHIER : modules/pm/backend/services/boards/seedDefaultBoard.js
 * RÔLE : Crée le tableau PM par défaut s'il n'existe pas.
 */

const crypto = require('crypto');
const ensureBoardIndexes = require('./ensureBoardIndexes');
const defaultBoardColumns = require('./defaultBoardColumns');
const toBoardEntry = require('./toBoardEntry');

const COLLECTION = 'pm_boards';

async function seedDefaultBoard(db, entrepriseId) {
  await ensureBoardIndexes(db);
  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), isDefault: true });
  if (existing) return toBoardEntry(existing);

  const now = new Date();
  const doc = {
    entrepriseId: String(entrepriseId),
    boardId: crypto.randomUUID(),
    title: 'Demandes & suivi',
    columns: defaultBoardColumns(),
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
  await col.insertOne(doc);
  return toBoardEntry(doc);
}

module.exports = seedDefaultBoard;
