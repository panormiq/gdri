/**
 * FICHIER : modules/pm/backend/services/cards/getCardById.js
 * RÔLE : Récupère une carte PM par identifiant.
 */

const ensureCardIndexes = require('./ensureCardIndexes');
const enrichCardAnnuaire = require('./enrichCardAnnuaire');

const COLLECTION = 'pm_cards';

async function getCardById(db, entrepriseId, cardId) {
  await ensureCardIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    cardId: String(cardId).trim()
  });
  return enrichCardAnnuaire(db, entrepriseId, doc);
}

module.exports = getCardById;
