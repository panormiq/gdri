/**
 * FICHIER : modules/doc-hub/backend/services/documents/projectUploadDir.js
 * RÔLE : Résout le dossier de stockage des fichiers d'un projet
 *        (modules/doc-hub/backend/uploads/<entrepriseId>/<projectId>).
 */

const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

function projectUploadDir(entrepriseId, projectId) {
  return path.join(UPLOAD_ROOT, String(entrepriseId), String(projectId));
}

module.exports = projectUploadDir;
module.exports.UPLOAD_ROOT = UPLOAD_ROOT;
