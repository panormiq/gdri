/**
 * FICHIER : modules/gderpi/backend/services/devis/purgeEmptyDevisBrouillons.js
 * RÔLE : Supprime les brouillons devis vides (orphelins) de la base.
 *
 * ENTRÉES : db, entrepriseId, devisEntries[]
 * SORTIES : nombre supprimé
 *
 * DÉPEND DE : isDevisContentEmpty.js
 * NE PAS : suppression devis avec contenu
 *
 * APPELÉ PAR : listDevis.js
 */

const isDevisContentEmpty = require('./isDevisContentEmpty');

const COLLECTION = 'gderpi_devis';

async function purgeEmptyDevisBrouillons(db, entrepriseId, entries) {
  const list = Array.isArray(entries) ? entries : [];
  const ids = list
    .filter(isDevisContentEmpty)
    .map((d) => String(d.devisId || d.id || '').trim())
    .filter(Boolean);
  if (!ids.length) return 0;
  const result = await db.collection(COLLECTION).deleteMany({
    entrepriseId: String(entrepriseId),
    statut: 'brouillon',
    devisId: { $in: ids }
  });
  return result.deletedCount || 0;
}

module.exports = purgeEmptyDevisBrouillons;
