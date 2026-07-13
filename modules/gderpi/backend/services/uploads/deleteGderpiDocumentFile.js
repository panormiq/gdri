/**
 * FICHIER : modules/gderpi/backend/services/uploads/deleteGderpiDocumentFile.js
 * RÔLE : Supprime un fichier document tiers du disque.
 */

const fs = require('fs');
const resolveGderpiMediaDiskPath = require('./resolveGderpiMediaDiskPath');

function deleteGderpiDocumentFile(entrepriseId, scope, filename) {
  try {
    const filePath = resolveGderpiMediaDiskPath(entrepriseId, scope, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = deleteGderpiDocumentFile;
