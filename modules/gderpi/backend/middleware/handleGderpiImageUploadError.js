/**
 * FICHIER : modules/gderpi/backend/middleware/handleGderpiImageUploadError.js
 * RÔLE : Intercepte les erreurs multer et renvoie du JSON lisible côté front.
 *
 * ENTRÉES : middleware multer .single('file')
 * SORTIES : middleware Express
 *
 * DÉPEND DE : MAX_BYTES
 * NE PAS : logique de sauvegarde fichier
 *
 * APPELÉ PAR : routes.js
 */

const { MAX_BYTES } = require('./createGderpiImageUpload');

function handleGderpiImageUploadError(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `Image trop volumineuse (max ${Math.round(MAX_BYTES / (1024 * 1024))} Mo).`
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Erreur lors de la réception du fichier'
      });
    });
  };
}

module.exports = { handleGderpiImageUploadError };
