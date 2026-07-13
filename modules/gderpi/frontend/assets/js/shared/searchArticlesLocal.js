/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/searchArticlesLocal.js
 * RÔLE : Filtre local des articles catalogue (réf., libellé, description).
 *
 * ENTRÉES : articles[], query, limit
 * SORTIES : Article[] triés par pertinence
 *
 * DÉPEND DE : —
 * NE PAS : appels API
 *
 * APPELÉ PAR : bindArticleSearchField.js, bindDevisTab.js
 */
(function initGderpiSearchArticlesLocal(global) {
  'use strict';

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function scoreArticle(article, q) {
    const ref = normalize(article.reference);
    const lib = normalize(article.libelle);
    const desc = normalize(article.description);
    if (ref === q) return 0;
    if (lib === q) return 1;
    if (ref.startsWith(q)) return 2;
    if (lib.startsWith(q)) return 3;
    if (ref.includes(q)) return 4;
    if (lib.includes(q)) return 5;
    if (desc.includes(q)) return 6;
    return 99;
  }

  function searchArticlesLocal(articles, query, limit) {
    const q = normalize(query);
    const list = Array.isArray(articles) ? articles.filter((a) => a.actif !== false) : [];
    if (!q) return list.slice(0, limit || 12);
    return list
      .filter((a) => {
        const hay = [a.reference, a.referenceFournisseur, a.libelle, a.description, a.commentaire, a.unite]
          .concat((a.refsClient || []).map((r) => [r.reference, r.clientId].join(' ')))
          .concat((a.fournisseursArticle || []).map((f) => [f.referenceFournisseur, f.conditions, f.fournisseurId].join(' ')))
          .join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => scoreArticle(a, q) - scoreArticle(b, q))
      .slice(0, limit || 12);
  }

  global.GderpiArticleSearch = { searchArticlesLocal };
})(window);
