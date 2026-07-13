/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticleSupplierIds.js
 * RÔLE : Extrait fournisseurId / boutiqueFournisseurId depuis une entrée fournisseur article.
 *
 * ENTRÉES : entrée fournisseur normalisée
 * SORTIES : { fournisseurId, boutiqueFournisseurId, sourceType }
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : buildBesoinsFromLignes.js, splitLinesByFournisseur.js
 */

function resolveArticleSupplierIds(entry) {
  if (!entry) {
    return { sourceType: 'fournisseur', fournisseurId: null, boutiqueFournisseurId: null };
  }
  if (entry.sourceType === 'boutique' && entry.boutiqueId) {
    return {
      sourceType: 'boutique',
      fournisseurId: null,
      boutiqueFournisseurId: String(entry.boutiqueId).trim()
    };
  }
  return {
    sourceType: 'fournisseur',
    fournisseurId: entry.fournisseurId ? String(entry.fournisseurId).trim() : null,
    boutiqueFournisseurId: null
  };
}

module.exports = resolveArticleSupplierIds;
