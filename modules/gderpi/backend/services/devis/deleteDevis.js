/**
 * FICHIER : modules/gderpi/backend/services/devis/deleteDevis.js
 * RÔLE : Supprime un devis en brouillon.
 *
 * ENTRÉES : db, entrepriseId, devisId
 * SORTIES : boolean deleted
 *
 * DÉPEND DE : getDevisById.js
 * NE PAS : suppression devis envoyés
 *
 * APPELÉ PAR : devisController
 */

const getDevisById = require('./getDevisById');

const COLLECTION = 'gderpi_devis';

async function deleteDevis(db, entrepriseId, devisId) {
  const existing = await getDevisById(db, entrepriseId, devisId);
  if (!existing) return false;
  if (existing.statut !== 'brouillon') {
    throw new Error('Seuls les devis en brouillon peuvent être supprimés');
  }
  const result = await db.collection(COLLECTION).deleteOne({
    entrepriseId: String(entrepriseId),
    devisId: String(devisId).trim()
  });
  return result.deletedCount > 0;
}

module.exports = deleteDevis;
