/**
 * FICHIER : modules/pm/backend/services/boards/listBoards.js
 * RÔLE : Liste les tableaux PM de l'entreprise.
 */

const ensureBoardIndexes = require('./ensureBoardIndexes');
const seedDefaultBoard = require('./seedDefaultBoard');
const toBoardEntry = require('./toBoardEntry');

const COLLECTION = 'pm_boards';

async function listBoards(db, entrepriseId) {
  await ensureBoardIndexes(db);
  await seedDefaultBoard(db, entrepriseId);
  const docs = await db.collection(COLLECTION)
    .find({ entrepriseId: String(entrepriseId) })
    .sort({ isDefault: -1, title: 1 })
    .toArray();
  return docs.map(toBoardEntry);
}

module.exports = listBoards;
