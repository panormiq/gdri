/**
 * FICHIER : modules/gderpi/backend/controllers/mediaController.js
 * RÔLE : Sert un média uploadé GDERPI (image ou document).
 */

const path = require('path');
const resolveGderpiMediaDiskPath = require('../services/uploads/resolveGderpiMediaDiskPath');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv'
};

const INLINE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf']);

function serveMedia(req, res) {
  try {
    const filePath = resolveGderpiMediaDiskPath(
      req.params.entrepriseId,
      req.params.scope,
      req.params.filename
    );
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const download = req.query.download === '1' || req.query.download === 'true';
    const disposition = (!download && INLINE_EXT.has(ext)) ? 'inline' : 'attachment';

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `${disposition}; filename="${path.basename(filePath)}"`);
    res.type(mime);
    res.sendFile(filePath);
  } catch (error) {
    res.status(error.message === 'Fichier introuvable' ? 404 : 400).json({
      success: false,
      message: error.message || 'Fichier inaccessible'
    });
  }
}

module.exports = { serveMedia };
