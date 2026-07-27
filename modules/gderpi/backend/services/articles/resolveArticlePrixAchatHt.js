/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticlePrixAchatHt.js
 * RÔLE : Retourne le prix d'achat HT d'un article (entrée fournisseur).
 *
 * ENTRÉES : article, fournisseurId optionnel, boutiqueFournisseurId optionnel
 * SORTIES : number (0 si aucun tarif d'achat)
 *
 * DÉPEND DE : resolveArticleFournisseurEntry.js
 * NE PAS : persistance, fallback sur prix de vente catalogue
 *
 * APPELÉ PAR : buildBesoinsFromLignes.js, applyPrixAchatHtToLignesFournisseur.js
 */

const resolveArticleFournisseurEntry = require('./resolveArticleFournisseurEntry');

function resolveArticlePrixAchatHt(article, fournisseurId, boutiqueFournisseurId) {
  const entry = resolveArticleFournisseurEntry(article, fournisseurId, boutiqueFournisseurId);
  const fromEntry = entry?.prixAchatHt;
  if (fromEntry != null && Number.isFinite(Number(fromEntry))) {
    return Math.round(Number(fromEntry) * 100) / 100;
  }
  return 0;
}

module.exports = resolveArticlePrixAchatHt;
