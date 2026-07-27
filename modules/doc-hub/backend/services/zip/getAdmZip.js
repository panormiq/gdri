/**
 * FICHIER : modules/doc-hub/backend/services/zip/getAdmZip.js
 * RÔLE : Charge adm-zip si disponible (null sinon — dépendance optionnelle).
 */

let AdmZip = null;
try {
  AdmZip = require('adm-zip');
} catch {
  AdmZip = null;
}

function getAdmZip() {
  return AdmZip;
}

module.exports = getAdmZip;
