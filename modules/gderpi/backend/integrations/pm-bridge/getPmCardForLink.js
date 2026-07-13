/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/getPmCardForLink.js
 * RÔLE : Récupère une carte PM pour affichage dans GDERPI.
 */

const isPmAvailable = require('./isPmAvailable');

async function getPmCardForLink(db, entrepriseId, cardId) {
  if (!isPmAvailable()) return null;
  const getCardById = require('../../../../pm/backend/services/cards/getCardById');
  const card = await getCardById(db, entrepriseId, cardId);
  if (!card) return null;
  return {
    cardId: card.cardId,
    title: card.title || '',
    contactName: card.contactName || '',
    contactEmail: card.contactEmail || '',
    columnId: card.columnId || '',
    type: card.type || ''
  };
}

module.exports = getPmCardForLink;
