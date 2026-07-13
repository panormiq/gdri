/**
 * FICHIER : modules/gderpi/backend/services/nodes/normalizeNodesState.js
 * RÔLE : Normalise l'état catalogue complet (nodes[] + tagRegistry[]).
 *
 * ENTRÉES : document brut Mongo ou payload
 * SORTIES : { nodes, tagRegistry }
 *
 * DÉPEND DE : normalizeCatalogNode.js, normalizeCatalogTag.js, defaultCatalogTagRegistry.js
 * NE PAS : lecture/écriture Mongo
 *
 * APPELÉ PAR : getNodesState.js, saveNodesState.js
 */

const normalizeCatalogNode = require('./normalizeCatalogNode');
const normalizeCatalogTag = require('./normalizeCatalogTag');
const defaultCatalogTagRegistry = require('./defaultCatalogTagRegistry');

function normalizeNodesState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const nodes = (Array.isArray(source.nodes) ? source.nodes : [])
    .map((n, i) => normalizeCatalogNode(n, i))
    .filter((n) => n && n.id);
  const tagRegistryRaw = Array.isArray(source.tagRegistry) ? source.tagRegistry : [];
  const tagRegistry = tagRegistryRaw.length
    ? tagRegistryRaw.map((t) => normalizeCatalogTag(t)).filter(Boolean)
    : defaultCatalogTagRegistry();
  return { nodes, tagRegistry };
}

module.exports = normalizeNodesState;
