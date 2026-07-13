/**
 * FICHIER : modules/gderpi/backend/services/uploads/validateGderpiDocumentMime.js
 * RÔLE : Valide le type MIME d'un document tiers GDERPI.
 */

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]);

function validateGderpiDocumentMime(mime) {
  return ALLOWED_MIMES.has(String(mime || '').toLowerCase());
}

module.exports = validateGderpiDocumentMime;
