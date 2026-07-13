/**
 * FICHIER : modules/gderpi/backend/services/uploads/buildGderpiImagePublicPath.js
 * RÔLE : Construit le chemin public HTTP d'une image GDERPI.
 *
 * ENTRÉES : entrepriseId, scope, filename
 * SORTIES : /uploads/gderpi/{entrepriseId}/{scope}/{filename}
 *
 * DÉPEND DE : aucune
 * NE PAS : écriture disque
 *
 * APPELÉ PAR : saveGderpiImageFile.js
 */

function buildGderpiImagePublicPath(entrepriseId, scope, filename) {
  const ent = String(entrepriseId || '').trim();
  const sc = String(scope || 'misc').trim().toLowerCase();
  const name = String(filename || '').trim();
  return `/uploads/gderpi/${ent}/${sc}/${name}`;
}

module.exports = buildGderpiImagePublicPath;
