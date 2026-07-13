/**
 * FICHIER : modules/gderpi/backend/services/articles/ensureArticleIndexes.js
 * RÔLE : Crée les index Mongo sur la collection articles.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : aucun
 * NE PAS : CRUD articles
 *
 * APPELÉ PAR : listArticles.js, createArticle.js, etc.
 */

const COLLECTION = 'gderpi_articles';

async function ensureArticleIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, updatedAt: -1 });
  await col.createIndex({ entrepriseId: 1, articleId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, nodeId: 1 });
  await col.createIndex({ entrepriseId: 1, reference: 1 });
}

module.exports = ensureArticleIndexes;
