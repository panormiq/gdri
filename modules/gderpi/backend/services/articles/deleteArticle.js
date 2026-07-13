/**
 * FICHIER : modules/gderpi/backend/services/articles/deleteArticle.js
 * RÔLE : Supprime un article catalogue.
 *
 * ENTRÉES : db, entrepriseId, articleId
 * SORTIES : { deleted: boolean }
 *
 * DÉPEND DE : aucun service métier
 * NE PAS : suppression nœuds
 *
 * APPELÉ PAR : articlesController
 */

const COLLECTION = 'gderpi_articles';

async function deleteArticle(db, entrepriseId, articleId) {
  const id = String(articleId || '').trim();
  if (!id) return false;
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ entrepriseId: String(entrepriseId), articleId: id });
  return result.deletedCount > 0;
}

module.exports = deleteArticle;
