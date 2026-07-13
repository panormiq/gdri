/**
 * FICHIER : modules/gderpi/backend/services/articles/updateArticle.js
 * RÔLE : Met à jour un article existant.
 *
 * ENTRÉES : db, entrepriseId, articleId, patch
 * SORTIES : Article mis à jour
 *
 * DÉPEND DE : normalizeArticle.js, getArticleById.js
 * NE PAS : création
 *
 * APPELÉ PAR : articlesController
 */

const normalizeArticle = require('./normalizeArticle');
const getArticleById = require('./getArticleById');

const COLLECTION = 'gderpi_articles';

async function updateArticle(db, entrepriseId, articleId, data) {
  const id = String(articleId || '').trim();
  if (!id) throw new Error('Identifiant article requis');
  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), articleId: id });
  if (!existing) throw new Error('Article introuvable');
  const normalized = normalizeArticle({ ...existing, ...data, id });
  if (!normalized.libelle) throw new Error('Libellé article requis');
  const now = new Date();
  await col.updateOne(
    { entrepriseId: String(entrepriseId), articleId: id },
    { $set: { ...normalized, updatedAt: now } }
  );
  return getArticleById(db, entrepriseId, id);
}

module.exports = updateArticle;
