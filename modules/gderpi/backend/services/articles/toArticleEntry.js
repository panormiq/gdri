/**
 * FICHIER : modules/gderpi/backend/services/articles/toArticleEntry.js
 * RÔLE : Formate un document Mongo article pour l'API.
 *
 * ENTRÉES : doc Mongo
 * SORTIES : article API ou null
 *
 * DÉPEND DE : normalizeArticle.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listArticles.js, getArticleById.js, createArticle.js, updateArticle.js
 */

const normalizeArticle = require('./normalizeArticle');

function toArticleEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeArticle(doc);
  return {
    ...normalized,
    articleId: normalized.id,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
  };
}

module.exports = toArticleEntry;
