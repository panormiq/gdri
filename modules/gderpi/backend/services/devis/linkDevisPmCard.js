/**
 * FICHIER : modules/gderpi/backend/services/devis/linkDevisPmCard.js
 * RÔLE : Lie un devis GDERPI à une carte PM (compatibilité optionnelle).
 */

const getDevisById = require('./getDevisById');
const toDevisEntry = require('./toDevisEntry');

const COLLECTION = 'gderpi_devis';

async function linkDevisPmCard(db, entrepriseId, devisId, pmCardId, options = {}) {
  const existing = await getDevisById(db, entrepriseId, devisId);
  if (!existing) throw new Error('Devis introuvable');

  const cardId = pmCardId ? String(pmCardId).trim() : null;
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), devisId: String(devisId).trim() },
    { $set: { pmCardId: cardId, updatedAt: now } }
  );

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    devisId: String(devisId).trim()
  });
  const entry = toDevisEntry(doc);

  if (!options.skipPmSync && cardId) {
    try {
      const syncCardFromDevis = require('../../../../pm/backend/services/integrations/gderpi/syncCardFromDevis');
      await syncCardFromDevis(db, entrepriseId, entry, { cardId });
    } catch (_) {
      // Module PM absent — liaison GDERPI seule conservée
    }
  }

  return entry;
}

module.exports = linkDevisPmCard;
