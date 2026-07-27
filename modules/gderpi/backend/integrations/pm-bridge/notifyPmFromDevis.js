/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/notifyPmFromDevis.js
 * RÔLE : Notifie le module PM après changement devis (crée une carte si absente).
 */

const COLLECTION = 'gderpi_devis';

async function persistPmCardId(db, entrepriseId, devisId, cardId) {
  if (!devisId || !cardId) return;
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), devisId: String(devisId).trim() },
    { $set: { pmCardId: String(cardId).trim(), updatedAt: new Date() } }
  );
}

/**
 * @param {object} options
 * @param {boolean} [options.createIfMissing=false] — crée une carte PM si le devis n'en a pas
 */
async function notifyPmFromDevis(db, entrepriseId, devis, options = {}) {
  if (!devis) return null;

  let cardId = devis.pmCardId ? String(devis.pmCardId).trim() : null;
  const createIfMissing = Boolean(options.createIfMissing);

  try {
    if (!cardId && createIfMissing) {
      const createCardFromDevis = require('../../../../pm/backend/services/integrations/gderpi/createCardFromDevis');
      const card = await createCardFromDevis(db, entrepriseId, devis);
      cardId = card?.cardId || card?.id || null;
      if (cardId) {
        await persistPmCardId(db, entrepriseId, devis.devisId || devis.id, cardId);
        devis.pmCardId = cardId;
      }
      return card;
    }

    if (!cardId) return null;

    const syncCardFromDevis = require('../../../../pm/backend/services/integrations/gderpi/syncCardFromDevis');
    return await syncCardFromDevis(db, entrepriseId, devis, { cardId });
  } catch (error) {
    console.warn('GDERPI notifyPmFromDevis:', error.message || error);
    return null;
  }
}

module.exports = notifyPmFromDevis;
