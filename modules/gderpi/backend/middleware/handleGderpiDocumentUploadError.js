/**
 * FICHIER : modules/gderpi/backend/middleware/handleGderpiDocumentUploadError.js
 * RÔLE : Intercepte les erreurs multer pour les documents tiers.
 */

const { MAX_BYTES } = require('./createGderpiDocumentUpload');

function handleGderpiDocumentUploadError(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `Document trop volumineux (max ${Math.round(MAX_BYTES / (1024 * 1024))} Mo).`
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Erreur lors de la réception du fichier'
      });
    });
  };
}

module.exports = { handleGderpiDocumentUploadError };
