/**
 * FICHIER : modules/gderpi/backend/services/uploads/resolveGderpiImageDiskPath.js
 * RÔLE : Résout le chemin disque d'une image GDERPI (anti path traversal).
 */

const resolveGderpiMediaDiskPath = require('./resolveGderpiMediaDiskPath');

function resolveGderpiImageDiskPath(entrepriseId, scope, filename) {
  return resolveGderpiMediaDiskPath(entrepriseId, scope, filename);
}

module.exports = resolveGderpiImageDiskPath;
