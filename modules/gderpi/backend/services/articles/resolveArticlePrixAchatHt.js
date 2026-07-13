/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticlePrixAchatHt.js
 * RÔLE : Retourne le prix d'achat HT d'un article (fournisseur ou legacy).
 *
 * ENTRÉES : article, fournisseurId optionnel
 * SORTIES : number
 *
 * DÉPEND DE : resolveArticleFournisseurEntry.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : buildBesoinsFromLignes.js
 */

const resolveArticleFournisseurEntry = require('./resolveArticleFournisseurEntry');

function resolveArticlePrixAchatHt(article, fournisseurId, boutiqueFournisseurId) {
  const entry = resolveArticleFournisseurEntry(article, fournisseurId, boutiqueFournisseurId);
  const fromEntry = entry?.prixAchatHt;
  if (fromEntry != null && Number.isFinite(Number(fromEntry))) {
    return Math.round(Number(fromEntry) * 100) / 100;
  }
  const legacy = Number(article?.prixHt);
  return Number.isFinite(legacy) ? Math.round(legacy * 100) / 100 : 0;
}

module.exports = resolveArticlePrixAchatHt;
