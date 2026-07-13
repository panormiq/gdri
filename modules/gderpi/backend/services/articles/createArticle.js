/**
 * FICHIER : modules/gderpi/backend/services/articles/createArticle.js
 * RÔLE : Crée un article catalogue.
 *
 * ENTRÉES : db, entrepriseId, payload
 * SORTIES : Article créé
 *
 * DÉPEND DE : ensureArticleIndexes.js, normalizeArticle.js, toArticleEntry.js
 * NE PAS : mise à jour, suppression
 *
 * APPELÉ PAR : articlesController
 */

const ensureArticleIndexes = require('./ensureArticleIndexes');
const normalizeArticle = require('./normalizeArticle');
const toArticleEntry = require('./toArticleEntry');

const COLLECTION = 'gderpi_articles';

async function createArticle(db, entrepriseId, data) {
  await ensureArticleIndexes(db);
  const col = db.collection(COLLECTION);
  const normalized = normalizeArticle(data);
  if (!normalized.libelle) throw new Error('Libellé article requis');
  const now = new Date();
  const doc = {
    entrepriseId: String(entrepriseId),
    articleId: normalized.id,
    ...normalized,
    createdAt: now,
    updatedAt: now
  };
  await col.insertOne(doc);
  return toArticleEntry(doc);
}

module.exports = createArticle;
