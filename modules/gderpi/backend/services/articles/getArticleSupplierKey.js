/**
 * FICHIER : modules/gderpi/backend/services/articles/getArticleSupplierKey.js
 * RÔLE : Clé unique d'un fournisseur article (externe ou boutique interne).
 *
 * ENTRÉES : entrée fournisseur normalisée
 * SORTIES : string `frs:<id>` | `btq:<id>` | ''
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeArticleFournisseurs.js, splitLinesByFournisseur.js
 */

function getArticleSupplierKey(entry) {
  if (!entry || entry.actif === false) return '';
  if (entry.sourceType === 'boutique' && entry.boutiqueId) {
    return 'btq:' + String(entry.boutiqueId).trim();
  }
  if (entry.fournisseurId) {
    return 'frs:' + String(entry.fournisseurId).trim();
  }
  return '';
}

module.exports = getArticleSupplierKey;
