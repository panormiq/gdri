/**
 * FICHIER : modules/gderpi/backend/services/articles/listArticles.js
 * RÔLE : Liste les articles avec filtres nodeId, type et recherche texte.
 *
 * ENTRÉES : db, entrepriseId, { nodeId, type, search, actifOnly }
 * SORTIES : Article[]
 *
 * DÉPEND DE : ensureArticleIndexes.js, toArticleEntry.js
 * NE PAS : création/modification
 *
 * APPELÉ PAR : articlesController
 */

const ensureArticleIndexes = require('./ensureArticleIndexes');
const toArticleEntry = require('./toArticleEntry');

const COLLECTION = 'gderpi_articles';

async function listArticles(db, entrepriseId, { nodeId = '', type = '', search = '', actifOnly = false } = {}) {
  await ensureArticleIndexes(db);
  const col = db.collection(COLLECTION);
  const query = { entrepriseId: String(entrepriseId) };
  if (nodeId) query.nodeId = String(nodeId).trim();
  if (type) {
    const t = String(type).trim().toLowerCase();
    if (t === 'service' || t === 'developpement' || t === 'produit') query.type = t;
  }
  if (actifOnly) query.actif = { $ne: false };
  const q = String(search || '').trim().toLowerCase();
  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
  let entries = docs.map((d) => toArticleEntry(d)).filter(Boolean);
  if (q) {
    entries = entries.filter((a) => {
      const hay = [a.libelle, a.reference, a.referenceFournisseur, a.description, a.commentaire, a.unite]
        .concat((a.refsClient || []).map((r) => [r.reference, r.clientId].join(' ')))
        .concat((a.fournisseursArticle || []).map((f) => [
          f.referenceFournisseur,
          f.conditions,
          f.fournisseurId,
          f.boutiqueId,
          f.sourceType
        ].join(' ')))
        .join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return entries;
}

module.exports = listArticles;
