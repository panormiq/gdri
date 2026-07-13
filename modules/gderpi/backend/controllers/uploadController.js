/**
 * FICHIER : modules/gderpi/backend/controllers/uploadController.js
 * RÔLE : Handler upload image GDERPI (logo boutique, image article).
 *
 * ENTRÉES : req.file, req.entrepriseId, body.scope
 * SORTIES : JSON { url, path, scope }
 *
 * DÉPEND DE : saveGderpiImageFile, buildGderpiImageAbsoluteUrl
 * NE PAS : logique multer
 *
 * APPELÉ PAR : routes.js
 */

const fs = require('fs');
const saveGderpiImageFile = require('../services/uploads/saveGderpiImageFile');
const buildGderpiImageMediaPath = require('../services/uploads/buildGderpiImageMediaPath');

async function uploadImage(req, res) {
  let tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    }
    const scope = String(req.body?.scope || 'misc').trim().toLowerCase();
    const saved = saveGderpiImageFile(req.entrepriseId, scope, req.file);
    tempPath = null;
    const mediaPath = buildGderpiImageMediaPath(req.entrepriseId, saved.scope, saved.filename);
    res.status(201).json({
      success: true,
      data: {
        path: mediaPath,
        mediaPath,
        scope: saved.scope,
        filename: saved.filename
      }
    });
  } catch (error) {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) { /* ignore */ }
    }
    console.error('GDERPI uploadImage:', error);
    const message = error.code === 'ENOENT'
      ? 'Fichier image introuvable sur le serveur. Réessayez.'
      : (error.message || 'Erreur upload');
    if (!res.headersSent) {
      res.status(400).json({ success: false, message });
    }
  }
}

module.exports = { uploadImage };
