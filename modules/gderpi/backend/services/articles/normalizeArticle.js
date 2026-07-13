/**
 * FICHIER : modules/gderpi/backend/services/articles/normalizeArticle.js
 * RÔLE : Normalise un article catalogue (produit ou service).
 *
 * ENTRÉES : raw objet article
 * SORTIES : article normalisé
 *
 * DÉPEND DE : crypto (id généré si absent)
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : createArticle.js, updateArticle.js, toArticleEntry.js
 */

const crypto = require('crypto');
const normalizeArticleRefsClient = require('./normalizeArticleRefsClient');
const normalizeArticleFournisseurs = require('./normalizeArticleFournisseurs');
const getArticleFournisseurPrincipal = require('./getArticleFournisseurPrincipal');
const resolveArticleSupplierIds = require('./resolveArticleSupplierIds');

const ARTICLE_TYPES = new Set(['produit', 'service', 'developpement']);

function normalizeArticleType(value) {
  const raw = String(value || 'produit').trim().toLowerCase();
  return ARTICLE_TYPES.has(raw) ? raw : 'produit';
}

function normalizePrixSurDevis(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function normalizeGestionStock(value, type) {
  if (type !== 'produit') return false;
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function normalizeArticle(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const type = normalizeArticleType(a.type);
  const prixHt = Number(a.prixHt);
  const tauxTva = Number(a.tauxTva);
  const defaultUnite = type === 'service' || type === 'developpement' ? 'heure' : 'piece';
  const fournisseursArticle = normalizeArticleFournisseurs(a);
  const principalFrs = getArticleFournisseurPrincipal({ fournisseursArticle });
  const principalIds = resolveArticleSupplierIds(principalFrs);
  const legacyFournisseurId = a.fournisseurId != null ? String(a.fournisseurId).trim() || null : null;
  const legacyRefFournisseur = String(a.referenceFournisseur || '').trim();
  return {
    id: String(a.id || a.articleId || '').trim() || crypto.randomUUID(),
    nodeId: String(a.nodeId || '').trim(),
    type,
    reference: String(a.reference || '').trim(),
    libelle: String(a.libelle || '').trim(),
    description: String(a.description || '').trim(),
    commentaire: String(a.commentaire || '').trim(),
    unite: String(a.unite || defaultUnite).trim(),
    prixHt: Number.isFinite(prixHt) ? prixHt : 0,
    prixSurDevis: normalizePrixSurDevis(a.prixSurDevis),
    tauxTva: Number.isFinite(tauxTva) ? tauxTva : 20,
    fournisseursArticle,
    fournisseurId: principalIds.fournisseurId || legacyFournisseurId,
    boutiqueFournisseurId: principalIds.boutiqueFournisseurId,
    gestionStock: normalizeGestionStock(a.gestionStock, type),
    referenceFournisseur: principalFrs?.referenceFournisseur || legacyRefFournisseur,
    refsClient: normalizeArticleRefsClient(a.refsClient),
    imageUrl: String(a.imageUrl || '').trim(),
    actif: a.actif !== false,
    createdAt: a.createdAt || null,
    updatedAt: a.updatedAt || null
  };
}

module.exports = normalizeArticle;
