/**
 * FICHIER : modules/gderpi/backend/services/uploads/buildGderpiImageMediaPath.js
 * RÔLE : Chemin API pour servir une image GDERPI (compatible balise img).
 *
 * ENTRÉES : entrepriseId, scope, filename
 * SORTIES : /api/gderpi/media/{entrepriseId}/{scope}/{filename}
 *
 * DÉPEND DE : aucune
 * NE PAS : lecture disque
 *
 * APPELÉ PAR : uploadController.js, resolveGderpiImageDiskPath.js
 */

function buildGderpiImageMediaPath(entrepriseId, scope, filename) {
  const ent = String(entrepriseId || '').trim();
  const sc = String(scope || 'misc').trim().toLowerCase();
  const name = String(filename || '').trim();
  return `/api/gderpi/media/${ent}/${sc}/${name}`;
}

module.exports = buildGderpiImageMediaPath;
