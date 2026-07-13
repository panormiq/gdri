/**
 * FICHIER : modules/gderpi/backend/services/nodes/defaultCatalogTagRegistry.js
 * RÔLE : Retourne le registre de tags catalogue par défaut (compatible UGAP).
 *
 * ENTRÉES : aucune
 * SORTIES : { id, label }[]
 *
 * DÉPEND DE : aucun
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : normalizeNodesState.js, getNodesState.js
 */

function defaultCatalogTagRegistry() {
  return [
    { id: 'produit', label: 'Produit' },
    { id: 'service', label: 'Service' },
    { id: 'equipement', label: 'Équipement' },
    { id: 'divers', label: 'Divers' }
  ];
}

module.exports = defaultCatalogTagRegistry;
