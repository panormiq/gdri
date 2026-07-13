/**
 * FICHIER : modules/pm/backend/services/cards/createCard.js
 * RÔLE : Crée une carte PM.
 */

const crypto = require('crypto');
const ensureCardIndexes = require('./ensureCardIndexes');
const getDefaultBoard = require('../boards/getDefaultBoard');
const toCardEntry = require('./toCardEntry');

const COLLECTION = 'pm_cards';
const TYPES = new Set(['demande', 'devis', 'commande', 'info']);

async function createCard(db, entrepriseId, data = {}) {
  await ensureCardIndexes(db);
  const board = data.boardId
    ? { boardId: String(data.boardId) }
    : await getDefaultBoard(db, entrepriseId);

  const typeRaw = String(data.type || 'demande').trim().toLowerCase();
  const type = TYPES.has(typeRaw) ? typeRaw : 'demande';
  const columnId = String(data.columnId || 'inbox').trim() || 'inbox';
  const now = new Date();

  const doc = {
    entrepriseId: String(entrepriseId),
    cardId: crypto.randomUUID(),
    boardId: board.boardId || board.id,
    columnId,
    title: String(data.title || 'Nouvelle demande').trim() || 'Nouvelle demande',
    description: String(data.description || '').trim(),
    type,
    status: 'open',
    priority: ['low', 'normal', 'high'].includes(data.priority) ? data.priority : 'normal',
    contactName: String(data.contactName || '').trim(),
    contactEmail: String(data.contactEmail || '').trim(),
    annuaire: data.annuaire && typeof data.annuaire === 'object' ? data.annuaire : null,
    sourceEmail: data.sourceEmail && typeof data.sourceEmail === 'object' ? data.sourceEmail : null,
    gderpi: null,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    activities: [{
      date: now,
      type: 'created',
      message: data.sourceEmail ? 'Carte créée depuis un e-mail entrant' : 'Carte créée manuellement'
    }],
    createdAt: now,
    updatedAt: now
  };

  await db.collection(COLLECTION).insertOne(doc);
  return toCardEntry(doc);
}

module.exports = createCard;
