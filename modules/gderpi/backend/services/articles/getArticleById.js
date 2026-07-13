/**
 * FICHIER : modules/gderpi/backend/services/articles/getArticleById.js
 * RÔLE : Retourne un article par articleId.
 *
 * ENTRÉES : db, entrepriseId, articleId
 * SORTIES : Article | null
 *
 * DÉPEND DE : toArticleEntry.js
 * NE PAS : liste, mutation
 *
 * APPELÉ PAR : articlesController
 */

const toArticleEntry = require('./toArticleEntry');

const COLLECTION = 'gderpi_articles';

async function getArticleById(db, entrepriseId, articleId) {
  const id = String(articleId || '').trim();
  if (!id) return null;
  const col = db.collection(COLLECTION);
  const doc = await col.findOne({ entrepriseId: String(entrepriseId), articleId: id });
  return toArticleEntry(doc);
}

module.exports = getArticleById;
