/**
 * FICHIER : modules/pm/backend/services/cards/moveCard.js
 * RÔLE : Déplace une carte vers une autre colonne du tableau.
 */

const getCardById = require('./getCardById');
const appendCardActivity = require('./appendCardActivity');

const COLLECTION = 'pm_cards';

async function moveCard(db, entrepriseId, cardId, columnId) {
  const existing = await getCardById(db, entrepriseId, cardId);
  if (!existing) throw new Error('Carte introuvable');
  const target = String(columnId || '').trim();
  if (!target) throw new Error('Colonne cible requise');

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), cardId: String(cardId).trim() },
    { $set: { columnId: target, updatedAt: now } }
  );

  if (existing.columnId !== target) {
    await appendCardActivity(db, entrepriseId, cardId, {
      type: 'move',
      message: `Déplacée vers la colonne « ${target} »`
    });
  }
  return getCardById(db, entrepriseId, cardId);
}

module.exports = moveCard;
