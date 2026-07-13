/**
 * FICHIER : modules/gderpi/backend/services/nodes/normalizeCatalogTag.js
 * RÔLE : Normalise un tag du registre catalogue.
 *
 * ENTRÉES : raw objet tag
 * SORTIES : { id, label } | null
 *
 * DÉPEND DE : aucun
 * NE PAS : CRUD tags en base
 *
 * APPELÉ PAR : normalizeNodesState.js
 */

function normalizeCatalogTag(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const id = String(t.id || '').trim();
  const label = String(t.label || '').trim();
  if (!id || !label) return null;
  return { id, label };
}

module.exports = normalizeCatalogTag;
