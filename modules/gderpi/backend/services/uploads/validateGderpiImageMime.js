/**
 * FICHIER : modules/gderpi/backend/services/uploads/validateGderpiImageMime.js
 * RÔLE : Valide le type MIME d'une image uploadée GDERPI.
 *
 * ENTRÉES : mimetype string
 * SORTIES : boolean
 *
 * DÉPEND DE : aucune
 * NE PAS : lecture fichier
 *
 * APPELÉ PAR : saveGderpiImageFile.js
 */

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]);

function validateGderpiImageMime(mimetype) {
  return ALLOWED.has(String(mimetype || '').toLowerCase());
}

module.exports = validateGderpiImageMime;
