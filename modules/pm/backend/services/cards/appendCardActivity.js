/**
 * FICHIER : modules/pm/backend/services/cards/appendCardActivity.js
 * RÔLE : Ajoute une entrée d'activité sur une carte PM.
 */

const getCardById = require('./getCardById');

const COLLECTION = 'pm_cards';

async function appendCardActivity(db, entrepriseId, cardId, activity) {
  const now = new Date();
  const entry = {
    date: now,
    type: String(activity?.type || 'info'),
    message: String(activity?.message || '').trim()
  };
  if (!entry.message) return getCardById(db, entrepriseId, cardId);

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), cardId: String(cardId).trim() },
    {
      $set: { updatedAt: now },
      $push: { activities: entry }
    }
  );
  return getCardById(db, entrepriseId, cardId);
}

module.exports = appendCardActivity;
