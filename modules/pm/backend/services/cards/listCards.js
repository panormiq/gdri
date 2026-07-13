/**
 * FICHIER : modules/pm/backend/services/cards/listCards.js
 * RÔLE : Liste les cartes PM d'un tableau.
 */

const ensureCardIndexes = require('./ensureCardIndexes');
const toCardEntry = require('./toCardEntry');

const COLLECTION = 'pm_cards';

async function listCards(db, entrepriseId, options = {}) {
  await ensureCardIndexes(db);
  const filter = { entrepriseId: String(entrepriseId) };
  if (options.boardId) filter.boardId = String(options.boardId);
  if (options.columnId) filter.columnId = String(options.columnId);
  if (options.type) filter.type = String(options.type);
  if (options.search) {
    const q = String(options.search).trim();
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { contactEmail: { $regex: q, $options: 'i' } },
        { contactName: { $regex: q, $options: 'i' } },
        { 'gderpi.devisNumero': { $regex: q, $options: 'i' } }
      ];
    }
  }

  const docs = await db.collection(COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();
  return docs.map(toCardEntry);
}

module.exports = listCards;
