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

const { ObjectId } = require('mongodb');
const ensureDevisIndexes = require('./ensureDevisIndexes');
const toDevisEntry = require('./toDevisEntry');

const COLLECTION = 'gderpi_devis';

async function getDevisById(db, entrepriseId, devisId) {
  const id = String(devisId || '').trim();
  if (!id) return null;

  await ensureDevisIndexes(db);
  const col = db.collection(COLLECTION);
  const ent = String(entrepriseId);
  const or = [{ devisId: id }, { id }];
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    or.push({ _id: new ObjectId(id) });
  }

  const doc = await col.findOne({
    entrepriseId: ent,
    $or: or
  });
  return toDevisEntry(doc);
}

module.exports = getDevisById;
