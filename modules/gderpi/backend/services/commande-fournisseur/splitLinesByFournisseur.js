/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/splitLinesByFournisseur.js
 * RÔLE : Regroupe les lignes commande par fournisseur (externe ou boutique interne).
 *
 * ENTRÉES : lignes[], db optionnel pour résolution article
 * SORTIES : Map groupKey → lignes[]
 *
 * DÉPEND DE : getArticleById.js, resolveArticleFournisseurEntryFromLine.js, resolveArticleSupplierIds.js, getArticleSupplierKey.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createFromCommandeClient.js
 */

const getArticleById = require('../articles/getArticleById');
const resolveArticleFournisseurEntryFromLine = require('../articles/resolveArticleFournisseurEntryFromLine');
const resolveArticleSupplierIds = require('../articles/resolveArticleSupplierIds');
const getArticleSupplierKey = require('../articles/getArticleSupplierKey');

function lineSupplierGroupKey(line, article) {
  let fournisseurId = line.fournisseurId || null;
  let boutiqueFournisseurId = line.boutiqueFournisseurId || null;

  if (!fournisseurId && !boutiqueFournisseurId && article) {
    const entry = resolveArticleFournisseurEntryFromLine(article, line);
    const ids = resolveArticleSupplierIds(entry);
    fournisseurId = ids.fournisseurId;
    boutiqueFournisseurId = ids.boutiqueFournisseurId;
  }

  if (boutiqueFournisseurId) return 'btq:' + boutiqueFournisseurId;
  if (fournisseurId) return 'frs:' + fournisseurId;
  if (article) {
    const key = getArticleSupplierKey(resolveArticleFournisseurEntryFromLine(article, line));
    if (key) return key;
  }
  return '__sans_fournisseur__';
}

async function splitLinesByFournisseur(db, entrepriseId, lignes) {
  const list = Array.isArray(lignes) ? lignes : [];
  const groups = new Map();

  for (const line of list) {
    let article = null;
    if (line.articleId && db) {
      article = await getArticleById(db, entrepriseId, line.articleId);
    }
    const key = lineSupplierGroupKey(line, article);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  return groups;
}

module.exports = splitLinesByFournisseur;
