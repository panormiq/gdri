/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/linkCardToDevis.js
 * RÔLE : Lie une carte PM à un devis GDERPI existant (bidirectionnel si GDERPI dispo).
 */

const path = require('path');
const getCardById = require('../../cards/getCardById');
const syncCardFromDevis = require('./syncCardFromDevis');
const isGderpiAvailable = require('../isGderpiAvailable');
const appendCardActivity = require('../../cards/appendCardActivity');

async function setDevisPmCardId(db, entrepriseId, devisId, pmCardId) {
  if (!isGderpiAvailable()) return;
  try {
    const linkDevisPmCard = require(path.join(
      __dirname,
      '../../../../../gderpi/backend/services/devis/linkDevisPmCard.js'
    ));
    await linkDevisPmCard(db, entrepriseId, devisId, pmCardId, { skipPmSync: true });
  } catch (error) {
    console.warn('PM linkCardToDevis: impossible de lier côté GDERPI:', error.message);
  }
}

async function getDevisByIdSafe(db, entrepriseId, devisId) {
  if (!isGderpiAvailable()) throw new Error('Module GDERPI non installé');
  const getDevisById = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/devis/getDevisById.js'
  ));
  const devis = await getDevisById(db, entrepriseId, devisId);
  if (!devis) throw new Error('Devis GDERPI introuvable');
  return devis;
}

async function linkCardToDevis(db, entrepriseId, cardId, devisId) {
  const card = await getCardById(db, entrepriseId, cardId);
  if (!card) throw new Error('Carte introuvable');

  const devis = await getDevisByIdSafe(db, entrepriseId, devisId);
  await setDevisPmCardId(db, entrepriseId, devis.devisId || devis.id, cardId);
  const updated = await syncCardFromDevis(db, entrepriseId, { ...devis, pmCardId: cardId }, { cardId });
  await appendCardActivity(db, entrepriseId, cardId, {
    type: 'gderpi_link',
    message: `Liée au devis GDERPI ${devis.numero || devis.devisId}`
  });
  return updated;
}

module.exports = linkCardToDevis;
