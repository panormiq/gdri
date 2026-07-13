/**
 * FICHIER : modules/gderpi/backend/services/articles/getArticleFournisseurPrincipal.js
 * RÔLE : Retourne l'entrée fournisseur principale d'un article.
 *
 * ENTRÉES : article normalisé
 * SORTIES : entrée fournisseur ou null
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeArticle.js, resolveArticleFournisseurEntry.js
 */

function getArticleFournisseurPrincipal(article) {
  if (!article) return null;
  const list = Array.isArray(article.fournisseursArticle) ? article.fournisseursArticle : [];
  return list.find((f) => f.principal) || list[0] || null;
}

module.exports = getArticleFournisseurPrincipal;
