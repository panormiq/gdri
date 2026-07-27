/**
 * FICHIER : modules/gderpi/backend/services/devis/ensureDevisPmCard.js
 * RÔLE : Garantit qu'un devis a une carte PM (création + liaison si besoin).
 */

const getDevisById = require('./getDevisById');
const toDevisEntry = require('./toDevisEntry');
const isPmAvailable = require('../../integrations/pm-bridge/isPmAvailable');

const COLLECTION = 'gderpi_devis';

async function ensureDevisPmCard(db, entrepriseId, devisId) {
  if (!isPmAvailable()) {
    throw new Error('Module PM non installé');
  }

  const existing = await getDevisById(db, entrepriseId, devisId);
  if (!existing) throw new Error('Devis introuvable');

  const notifyPmFromDevis = require('../../integrations/pm-bridge/notifyPmFromDevis');
  await notifyPmFromDevis(db, entrepriseId, existing, { createIfMissing: true });

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    devisId: String(devisId).trim()
  });
  return toDevisEntry(doc);
}

module.exports = ensureDevisPmCard;
