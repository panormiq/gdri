/**
 * FICHIER : modules/gderpi/backend/services/articles/normalizeArticleRefsClient.js
 * RÔLE : Normalise la liste des références clients d'un article.
 *
 * ENTRÉES : raw tableau
 * SORTIES : { clientId, reference }[]
 *
 * DÉPEND DE : normalizeArticleRefClient.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeArticle.js
 */

const normalizeArticleRefClient = require('./normalizeArticleRefClient');

function normalizeArticleRefsClient(raw) {
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.refsClient) ? raw.refsClient : []);
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    const entry = normalizeArticleRefClient(item);
    if (!entry.clientId && !entry.reference) return;
    const key = entry.clientId || entry.reference;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  });
  return out;
}

module.exports = normalizeArticleRefsClient;
