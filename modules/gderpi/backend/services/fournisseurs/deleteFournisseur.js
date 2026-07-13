/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/deleteFournisseur.js
 * RÔLE : Supprime un fournisseur.
 *
 * ENTRÉES : db, entrepriseId, fournisseurId
 * SORTIES : { deleted: boolean }
 *
 * DÉPEND DE : aucun
 * NE PAS : cascade articles
 *
 * APPELÉ PAR : fournisseursController
 */

const COLLECTION = 'gderpi_fournisseurs';

async function deleteFournisseur(db, entrepriseId, fournisseurId) {
  const id = String(fournisseurId || '').trim();
  if (!id) return false;
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ entrepriseId: String(entrepriseId), fournisseurId: id });
  return result.deletedCount > 0;
}

module.exports = deleteFournisseur;
