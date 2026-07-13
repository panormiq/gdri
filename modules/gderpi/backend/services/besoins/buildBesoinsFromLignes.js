/**
 * FICHIER : modules/gderpi/backend/services/besoins/buildBesoinsFromLignes.js
 * RÔLE : Construit les besoins d'achat pour les articles produits gérés en stock.
 *
 * ENTRÉES : db, entrepriseId, lignes commande
 * SORTIES : besoin[] (agrégés par articleId)
 *
 * DÉPEND DE : getArticleById.js, normalizeBesoin.js
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : createFromDevis.js
 */

const getArticleById = require('../articles/getArticleById');
const resolveArticleFournisseurEntryFromLine = require('../articles/resolveArticleFournisseurEntryFromLine');
const resolveArticleSupplierIds = require('../articles/resolveArticleSupplierIds');
const resolveArticlePrixAchatHt = require('../articles/resolveArticlePrixAchatHt');
const normalizeBesoin = require('./normalizeBesoin');

async function buildBesoinsFromLignes(db, entrepriseId, lignes) {
  const list = Array.isArray(lignes) ? lignes : [];
  const byArticle = new Map();
  const now = new Date();

  for (const line of list) {
    const articleId = line?.articleId ? String(line.articleId).trim() : '';
    if (!articleId) continue;

    const article = await getArticleById(db, entrepriseId, articleId);
    if (!article || article.type !== 'produit' || article.gestionStock !== true) continue;

    const qty = Number(line.quantite) || 0;
    if (qty <= 0) continue;

    const frsEntry = resolveArticleFournisseurEntryFromLine(article, line);
    const supplierIds = resolveArticleSupplierIds(frsEntry);
    const fournisseurId = supplierIds.fournisseurId || article.fournisseurId || null;
    const boutiqueFournisseurId = supplierIds.boutiqueFournisseurId || article.boutiqueFournisseurId || null;
    const existing = byArticle.get(articleId);

    if (existing) {
      existing.quantite = Math.round((existing.quantite + qty) * 1000) / 1000;
      if (!existing.fournisseurId && fournisseurId) existing.fournisseurId = fournisseurId;
      if (!existing.boutiqueFournisseurId && boutiqueFournisseurId) {
        existing.boutiqueFournisseurId = boutiqueFournisseurId;
      }
      continue;
    }

    byArticle.set(articleId, normalizeBesoin({
      articleId,
      reference: line.reference || article.reference,
      referenceFournisseur: frsEntry?.referenceFournisseur || article.referenceFournisseur,
      libelle: line.libelle || article.libelle,
      quantite: qty,
      unite: line.unite || article.unite,
      fournisseurId,
      boutiqueFournisseurId,
      prixAchatHt: resolveArticlePrixAchatHt(
        article,
        supplierIds.fournisseurId,
        supplierIds.boutiqueFournisseurId
      ),
      statut: 'ouvert',
      createdAt: now
    }));
  }

  return Array.from(byArticle.values()).filter((b) => b.quantite > 0);
}

module.exports = buildBesoinsFromLignes;
