/**
 * FICHIER : modules/gderpi/backend/middleware/createGderpiDocumentUpload.js
 * RÔLE : Configure multer pour l'upload de documents tiers GDERPI.
 */

const multer = require('multer');

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIMES = [
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
];

function createGderpiDocumentUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || '').toLowerCase();
      if (ALLOWED_MIMES.includes(mime)) cb(null, true);
      else cb(new Error('Format non supporté (PDF, Word, Excel, texte, CSV ou image).'));
    }
  });
}

module.exports = { createGderpiDocumentUpload, MAX_BYTES };
