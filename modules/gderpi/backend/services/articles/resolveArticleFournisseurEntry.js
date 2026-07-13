/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticleFournisseurEntry.js
 * RÔLE : Retourne l'entrée fournisseur d'un article (spécifique ou principale).
 *
 * ENTRÉES : article, fournisseurId optionnel, boutiqueFournisseurId optionnel
 * SORTIES : entrée fournisseur ou null
 *
 * DÉPEND DE : getArticleFournisseurPrincipal.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : buildBesoinsFromLignes.js, splitLinesByFournisseur.js
 */

const getArticleFournisseurPrincipal = require('./getArticleFournisseurPrincipal');
const getArticleSupplierKey = require('./getArticleSupplierKey');

function resolveArticleFournisseurEntry(article, fournisseurId, boutiqueFournisseurId) {
  if (!article) return null;
  const list = Array.isArray(article.fournisseursArticle) ? article.fournisseursArticle : [];
  const frsId = fournisseurId != null ? String(fournisseurId).trim() : '';
  const btqId = boutiqueFournisseurId != null ? String(boutiqueFournisseurId).trim() : '';

  if (btqId) {
    const matchBtq = list.find((f) => f.sourceType === 'boutique'
      && String(f.boutiqueId || '') === btqId
      && f.actif !== false);
    if (matchBtq) return matchBtq;
  }

  if (frsId) {
    const matchFrs = list.find((f) => f.sourceType !== 'boutique'
      && String(f.fournisseurId || '') === frsId
      && f.actif !== false);
    if (matchFrs) return matchFrs;
  }

  return getArticleFournisseurPrincipal(article);
}

module.exports = resolveArticleFournisseurEntry;
