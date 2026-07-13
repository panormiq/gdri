/**
 * FICHIER : modules/gderpi/backend/services/nodes/normalizeCatalogNode.js
 * RÔLE : Normalise un nœud catalogue (structure plate compatible UGAP nodes[]).
 *
 * ENTRÉES : raw nœud, index optionnel
 * SORTIES : { id, parentId, label, decisionMode, keywords, tags, sortOrder }
 *
 * DÉPEND DE : aucun
 * NE PAS : persistance, construction arbre
 *
 * APPELÉ PAR : normalizeNodesState.js, createNode.js, updateNode.js
 */

function normalizeCatalogNode(raw, index) {
  const n = raw && typeof raw === 'object' ? raw : {};
  const id = String(n.id || `node_${(Number(index) || 0) + 1}`).trim();
  const decisionMode = String(n.decisionMode || '').trim().toLowerCase() === 'multi_choice'
    ? 'multi_choice'
    : 'single_choice';
  const tags = Array.isArray(n.tags)
    ? n.tags.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  return {
    id,
    parentId: String(n.parentId || '').trim(),
    label: String(n.label || n.name || 'Catégorie').trim(),
    decisionMode,
    keywords: String(n.keywords || '').trim(),
    tags,
    sortOrder: Number.isFinite(Number(n.sortOrder)) ? Number(n.sortOrder) : (Number(index) || 0) * 10
  };
}

module.exports = normalizeCatalogNode;
