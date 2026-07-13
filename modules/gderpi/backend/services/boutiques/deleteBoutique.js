/**
 * FICHIER : modules/gderpi/backend/services/boutiques/deleteBoutique.js
 * RÔLE : Désactive une boutique (suppression logique — backoffice).
 *
 * ENTRÉES : db, entrepriseId, boutiqueId
 * SORTIES : boolean
 *
 * DÉPEND DE : aucun service métier
 * NE PAS : hard delete (historique futur devis)
 *
 * APPELÉ PAR : boutiquesController
 */

const COLLECTION = 'gderpi_boutiques';

async function deleteBoutique(db, entrepriseId, boutiqueId) {
  const id = String(boutiqueId || '').trim();
  if (!id) return false;
  const col = db.collection(COLLECTION);
  const result = await col.updateOne(
    { entrepriseId: String(entrepriseId), boutiqueId: id },
    { $set: { actif: false, updatedAt: new Date() } }
  );
  return result.matchedCount > 0;
}

module.exports = deleteBoutique;
