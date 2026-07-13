/**
 * FICHIER : modules/gderpi/backend/services/nodes/buildNodesTree.js
 * RÔLE : Convertit nodes[] plat en arbre hiérarchique pour l'UI.
 *
 * ENTRÉES : nodes[] normalisés
 * SORTIES : nœuds racine avec children[]
 *
 * DÉPEND DE : aucun
 * NE PAS : accès Mongo
 *
 * APPELÉ PAR : listNodes.js, nodesController
 */

function buildNodesTree(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byId = new Map();
  list.forEach((n) => {
    byId.set(n.id, { ...n, children: [] });
  });
  const roots = [];
  byId.forEach((node) => {
    const parentId = String(node.parentId || '').trim();
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr) => {
    arr.sort((a, b) => (a.sortOrder - b.sortOrder) || a.label.localeCompare(b.label, 'fr'));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

module.exports = buildNodesTree;
