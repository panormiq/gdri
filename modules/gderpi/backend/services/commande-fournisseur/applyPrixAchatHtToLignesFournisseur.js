/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/applyPrixAchatHtToLignesFournisseur.js
 * RÔLE : Remplace le prix des lignes CF par le tarif d'achat article (jamais le prix de vente).
 *
 * ENTRÉES : db, entrepriseId, lignes[], supplierHint optionnel
 * SORTIES : lignes[] normalisées avec prixHt = prixAchatHt fournisseur
 *
 * DÉPEND DE : getArticleById.js, resolveArticleFournisseurEntry.js, resolveArticlePrixAchatHt.js, normalizeDevisLine.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createFromCommandeClient.js, repairCommandeFournisseurPrixAchat.js
 */

const getArticleById = require('../articles/getArticleById');
const resolveArticleFournisseurEntry = require('../articles/resolveArticleFournisseurEntry');
const resolveArticlePrixAchatHt = require('../articles/resolveArticlePrixAchatHt');
const normalizeDevisLine = require('../devis/normalizeDevisLine');

async function applyPrixAchatHtToLignesFournisseur(db, entrepriseId, lignes, supplierHint = {}) {
  const list = Array.isArray(lignes) ? lignes : [];
  const hintFrs = supplierHint.fournisseurId != null
    ? String(supplierHint.fournisseurId).trim() || null
    : null;
  const hintBtq = supplierHint.fournisseurBoutiqueId != null
    ? String(supplierHint.fournisseurBoutiqueId).trim() || null
    : (supplierHint.boutiqueFournisseurId != null
      ? String(supplierHint.boutiqueFournisseurId).trim() || null
      : null);
  const out = [];

  for (let i = 0; i < list.length; i += 1) {
    const line = list[i];
    const articleId = line?.articleId ? String(line.articleId).trim() : '';
    if (!articleId || !db) {
      out.push(normalizeDevisLine(line, i));
      continue;
    }

    const article = await getArticleById(db, entrepriseId, articleId);
    if (!article) {
      out.push(normalizeDevisLine(line, i));
      continue;
    }

    const fournisseurId = hintFrs || line.fournisseurId || null;
    const boutiqueFournisseurId = hintBtq || line.boutiqueFournisseurId || null;
    const entry = resolveArticleFournisseurEntry(article, fournisseurId, boutiqueFournisseurId);
    const prixAchatHt = resolveArticlePrixAchatHt(article, fournisseurId, boutiqueFournisseurId);
    const refFrs = entry?.referenceFournisseur
      || line.referenceFournisseur
      || line.referenceClient
      || '';

    out.push(normalizeDevisLine({
      ...line,
      fournisseurId: fournisseurId || line.fournisseurId || null,
      boutiqueFournisseurId: boutiqueFournisseurId || line.boutiqueFournisseurId || null,
      prixHt: prixAchatHt,
      referenceFournisseur: refFrs,
      referenceClient: refFrs
    }, i));
  }

  return out;
}

module.exports = applyPrixAchatHtToLignesFournisseur;
