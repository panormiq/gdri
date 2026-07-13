/**
 * FICHIER : modules/gderpi/backend/services/unites/deleteUnite.js
 * RÔLE : Désactive une unité (actif: false).
 */

const COLLECTION = 'gderpi_unites';

async function deleteUnite(db, entrepriseId, uniteId) {
  const id = String(uniteId || '').trim();
  if (!id) return false;
  const res = await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), uniteId: id },
    { $set: { actif: false, updatedAt: new Date() } }
  );
  return res.matchedCount > 0;
}

module.exports = deleteUnite;
