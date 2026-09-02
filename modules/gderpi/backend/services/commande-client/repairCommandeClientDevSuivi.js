/**
 * FICHIER : modules/gderpi/backend/services/commande-client/repairCommandeClientDevSuivi.js
 * RÔLE : Aligne les lignes d'une commande existante sur le catalogue (type, gererCommande, recette auto).
 *
 * ENTRÉES : db, entrepriseId, commandeClientId
 * SORTIES : boolean — true si le document a été modifié
 *
 * DÉPEND DE : getArticleById.js, normalizeDevisLine.js, lineRequiresRecette.js
 * NE PAS : changement de statut pipeline
 *
 * APPELÉ PAR : getCommandeClientById.js, listCommandesClient.js
 */

const getArticleById = require('../articles/getArticleById');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const lineRequiresRecette = require('../workflow/lineRequiresRecette');

const COLLECTION = 'gderpi_commandes_client';

async function repairCommandeClientDevSuivi(db, entrepriseId, commandeClientId) {
  const id = String(commandeClientId || '').trim();
  if (!id) return false;

  const col = db.collection(COLLECTION);
  const doc = await col.findOne({
    entrepriseId: String(entrepriseId),
    commandeClientId: id
  });
  if (!doc) return false;
  if (['facturee', 'annulee'].includes(String(doc.statut))) return false;

  const now = new Date();
  const articleCache = new Map();

  async function loadArticle(articleId) {
    const key = String(articleId || '').trim();
    if (!key) return null;
    if (articleCache.has(key)) return articleCache.get(key);
    const article = await getArticleById(db, entrepriseId, key);
    articleCache.set(key, article || null);
    return article || null;
  }

  let linesChanged = false;
  const rawLines = Array.isArray(doc.lignes) ? doc.lignes : [];
  const lignes = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    let line = normalizeDevisLine(rawLines[i], i);
    const article = line.articleId ? await loadArticle(line.articleId) : null;
    if (article) {
      const nextType = String(article.type || '').trim();
      const nextGerer = article.gererCommande === true;
      if (nextType && line.articleType !== nextType) {
        line = { ...line, articleType: nextType };
        linesChanged = true;
      }
      if (line.gererCommande !== nextGerer) {
        line = { ...line, gererCommande: nextGerer };
        linesChanged = true;
      }
    }
    if (!lineRequiresRecette(line) && !line.recetteValideeAt) {
      line = { ...line, recetteValideeAt: now };
      linesChanged = true;
    }
    lignes.push(line);
  }

  const rawBesoins = Array.isArray(doc.besoins) ? doc.besoins : [];
  const besoins = [];
  for (const besoin of rawBesoins) {
    const articleId = String(besoin?.articleId || '').trim();
    if (!articleId) continue;
    const article = await loadArticle(articleId);
    if (!article || article.type !== 'produit' || article.gestionStock !== true) continue;
    besoins.push(besoin);
  }
  const besoinsChanged = besoins.length !== rawBesoins.length;

  if (!linesChanged && !besoinsChanged) return false;

  const $set = { updatedAt: now };
  if (linesChanged) $set.lignes = lignes;
  if (besoinsChanged) $set.besoins = besoins;

  await col.updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: id },
    { $set }
  );
  return true;
}

module.exports = repairCommandeClientDevSuivi;
