/**
 * FICHIER : modules/gderpi/backend/services/articles/normalizeArticleFournisseurs.js
 * RÔLE : Normalise la liste des fournisseurs d'un article (un seul principal).
 *
 * ENTRÉES : raw tableau ou objet article
 * SORTIES : fournisseur[] normalisé
 *
 * DÉPEND DE : normalizeArticleFournisseur.js, buildArticleFournisseursFromLegacy.js, getArticleSupplierKey.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeArticle.js
 */

const normalizeArticleFournisseur = require('./normalizeArticleFournisseur');
const buildArticleFournisseursFromLegacy = require('./buildArticleFournisseursFromLegacy');
const getArticleSupplierKey = require('./getArticleSupplierKey');

function normalizeArticleFournisseurs(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  let list = Array.isArray(a.fournisseursArticle) ? a.fournisseursArticle : [];
  if (!list.length) {
    list = buildArticleFournisseursFromLegacy(a);
  }

  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    const entry = normalizeArticleFournisseur(item);
    const key = getArticleSupplierKey(entry);
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  });

  if (!out.length) return [];

  const principalIdx = out.findIndex((f) => f.principal);
  const idx = principalIdx >= 0 ? principalIdx : 0;
  return out.map((f, i) => ({ ...f, principal: i === idx }));
}

module.exports = normalizeArticleFournisseurs;
