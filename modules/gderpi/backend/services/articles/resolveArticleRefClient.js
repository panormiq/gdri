/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticleRefClient.js
 * RÔLE : Retourne la référence client d'un article pour un client donné.
 *
 * ENTRÉES : article, clientId
 * SORTIES : string référence ou ''
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : (frontend devis via copie article)
 */

function resolveArticleRefClient(article, clientId) {
  if (!article || !clientId) return '';
  const id = String(clientId).trim();
  const list = Array.isArray(article.refsClient) ? article.refsClient : [];
  const match = list.find((r) => String(r.clientId || '').trim() === id);
  return match ? String(match.reference || '').trim() : '';
}

module.exports = resolveArticleRefClient;
