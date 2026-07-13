/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticleFournisseurEntryFromLine.js
 * RÔLE : Résout l'entrée fournisseur d'un article à partir d'une ligne commande/devis.
 *
 * ENTRÉES : article, ligne
 * SORTIES : entrée fournisseur ou null
 *
 * DÉPEND DE : resolveArticleFournisseurEntry.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : buildBesoinsFromLignes.js, splitLinesByFournisseur.js
 */

const resolveArticleFournisseurEntry = require('./resolveArticleFournisseurEntry');

function resolveArticleFournisseurEntryFromLine(article, line) {
  if (!line) return resolveArticleFournisseurEntry(article);
  return resolveArticleFournisseurEntry(
    article,
    line.fournisseurId,
    line.boutiqueFournisseurId
  );
}

module.exports = resolveArticleFournisseurEntryFromLine;
