/**
 * FICHIER : modules/gderpi/backend/services/devis/getDevisById.js
 * RÔLE : Récupère un devis par identifiant.
 *
 * ENTRÉES : db, entrepriseId, devisId
 * SORTIES : Devis | null
 *
 * DÉPEND DE : ensureDevisIndexes.js, toDevisEntry.js
 * NE PAS : liste, modification
 *
 * APPELÉ PAR : devisController, workflow
 */

const ensureDevisIndexes = require('./ensureDevisIndexes');
const toDevisEntry = require('./toDevisEntry');

const COLLECTION = 'gderpi_devis';

async function getDevisById(db, entrepriseId, devisId) {
  await ensureDevisIndexes(db);
  const col = db.collection(COLLECTION);
  const doc = await col.findOne({
    entrepriseId: String(entrepriseId),
    devisId: String(devisId).trim()
  });
  return toDevisEntry(doc);
}

module.exports = getDevisById;
