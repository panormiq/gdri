/**
 * FICHIER : modules/ugap/backend/services/devis/resolveDevisCatalogCategory.js
 * RÔLE : Catégories devis depuis l'arbre catalogue (nœuds), pas les catégories Excel legacy.
 *
 * ENTRÉES : données UGAP (uiState.catalog), option, overrides parcours
 * SORTIES : { categorie, sousNoeud }
 *
 * DÉPEND DE : UgapDataService.normalizeCatalog
 * APPELÉ PAR : computeDevisPricing, renderDevisTableHtml
 */

const UgapDataService = require('../UgapDataService');

function isLegacyUnclassifiedCategory(name) {
  const n = String(name || '').trim().toLowerCase();
  return n === 'non classées'
    || n === 'non classees'
    || n === 'non classé'
    || n === 'non classe'
    || n === 'non classée';
}

function getCatalogNodes(data) {
  const uiState = data?.uiState && typeof data.uiState === 'object' ? data.uiState : {};
  const catalog = UgapDataService.normalizeCatalog(uiState.catalog || {});
  return Array.isArray(catalog.nodes) ? catalog.nodes : [];
}

function getNodeById(nodes, nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return null;
  return (Array.isArray(nodes) ? nodes : []).find((n) => String(n?.id || '').trim() === id) || null;
}

function nodePathLabels(nodes, nodeId) {
  const parts = [];
  let cur = getNodeById(nodes, nodeId);
  let guard = 0;
  while (cur && guard < 32) {
    parts.unshift(String(cur.label || cur.id || '').trim());
    const parentId = String(cur.parentId || '').trim();
    cur = parentId ? getNodeById(nodes, parentId) : null;
    guard += 1;
  }
  return parts.filter(Boolean);
}

function labelsFromCatalogNodeId(nodes, catalogObjectId) {
  const cnId = String(catalogObjectId || '').trim();
  if (!cnId) return null;
  const path = nodePathLabels(nodes, cnId);
  if (!path.length) return null;
  return {
    categorie: path[0],
    sousNoeud: path.slice(1).join(' › ') || ''
  };
}

function resolveDevisCategoryFromCatalog(data, option) {
  const opt = option && typeof option === 'object' ? option : {};
  const nodes = getCatalogNodes(data);
  if (!nodes.length) return null;

  const fromObjectId = labelsFromCatalogNodeId(nodes, opt.catalogObjectId);
  if (fromObjectId?.categorie) return fromObjectId;

  const linkedBase = String(opt.linkedBaseCatalogOptionId || '').trim();
  if (linkedBase) {
    // Minoration liée : retrouver le nœud via l'option de base si besoin.
    const categories = Array.isArray(data?.categories) ? data.categories : [];
    for (const category of categories) {
      const baseOpt = (category?.options || []).find(
        (o) => String(o?.id || '').trim() === linkedBase
      );
      if (baseOpt) {
        const fromBase = labelsFromCatalogNodeId(nodes, baseOpt.catalogObjectId);
        if (fromBase?.categorie) return fromBase;
      }
    }
  }

  return null;
}

function resolveDevisOptionCategory(data, option, overrides = {}, legacyCategory = '') {
  const optId = String(option?.id || '').trim();
  const override = optId && overrides && typeof overrides === 'object'
    ? overrides[optId]
    : null;
  if (override?.categorie && !isLegacyUnclassifiedCategory(override.categorie)) {
    return {
      categorie: String(override.categorie).trim(),
      sousNoeud: String(override.sousNoeud || '').trim()
    };
  }

  const fromCatalog = resolveDevisCategoryFromCatalog(data, option);
  if (fromCatalog?.categorie) return fromCatalog;

  const legacy = String(legacyCategory || option?.category || option?.familyLabel || '').trim();
  if (legacy && !isLegacyUnclassifiedCategory(legacy)) {
    return { categorie: legacy, sousNoeud: '' };
  }

  return { categorie: '', sousNoeud: '' };
}

function resolveDevisModelCategory(data, modelCategoryOverride = '') {
  const override = String(modelCategoryOverride || '').trim();
  if (override && !isLegacyUnclassifiedCategory(override) && override.toLowerCase() !== 'bateau') {
    return override;
  }

  const nodes = getCatalogNodes(data);
  if (nodes.length) {
    const roots = nodes
      .filter((n) => {
        const pid = String(n?.parentId || '').trim();
        if (!pid) return true;
        return !getNodeById(nodes, pid);
      })
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    const label = String(roots[0]?.label || '').trim();
    if (label) return label;
  }

  return override || 'Modèle';
}

module.exports = {
  isLegacyUnclassifiedCategory,
  getCatalogNodes,
  resolveDevisCategoryFromCatalog,
  resolveDevisOptionCategory,
  resolveDevisModelCategory
};
