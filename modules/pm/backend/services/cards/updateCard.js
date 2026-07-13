/**
 * FICHIER : modules/pm/backend/services/cards/updateCard.js
 * RÔLE : Met à jour les champs éditables d'une carte PM.
 */

const getCardById = require('./getCardById');
const toCardEntry = require('./toCardEntry');

const COLLECTION = 'pm_cards';

async function updateCard(db, entrepriseId, cardId, patch = {}) {
  const existing = await getCardById(db, entrepriseId, cardId);
  if (!existing) throw new Error('Carte introuvable');

  const update = { updatedAt: new Date() };
  const p = patch && typeof patch === 'object' ? patch : {};

  if (p.title !== undefined) update.title = String(p.title || '').trim();
  if (p.description !== undefined) update.description = String(p.description || '').trim();
  if (p.type !== undefined) update.type = String(p.type || 'demande');
  if (p.status !== undefined) update.status = String(p.status || 'open');
  if (p.priority !== undefined) update.priority = String(p.priority || 'normal');
  if (p.contactName !== undefined) update.contactName = String(p.contactName || '').trim();
  if (p.contactEmail !== undefined) update.contactEmail = String(p.contactEmail || '').trim();
  if (Array.isArray(p.tasks)) update.tasks = p.tasks;

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), cardId: String(cardId).trim() },
    { $set: update }
  );

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    cardId: String(cardId).trim()
  });
  return toCardEntry(doc);
}

module.exports = updateCard;
