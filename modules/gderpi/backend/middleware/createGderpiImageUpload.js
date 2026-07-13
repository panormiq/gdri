/**
 * FICHIER : modules/gderpi/backend/middleware/createGderpiImageUpload.js
 * RÔLE : Configure multer pour l'upload d'images GDERPI (mémoire).
 *
 * ENTRÉES : aucune
 * SORTIES : middleware multer .single('file')
 *
 * DÉPEND DE : multer
 * NE PAS : écriture disque (faite dans saveGderpiImageFile)
 *
 * APPELÉ PAR : routes.js
 */

const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024;

function createGderpiImageUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || '').toLowerCase();
      const allowed = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
      ];
      if (allowed.includes(mime)) cb(null, true);
      else cb(new Error('Format image non supporté (JPEG, PNG, GIF, WebP, SVG).'));
    }
  });
}

module.exports = { createGderpiImageUpload, MAX_BYTES };
