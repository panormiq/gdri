/**
 * FICHIER : modules/doc-hub/backend/services/zip/isZipAvailable.js
 * RÔLE : Indique si la génération d'archives ZIP est possible (adm-zip installé).
 */

const getAdmZip = require('./getAdmZip');

function isZipAvailable() {
  return Boolean(getAdmZip());
}

module.exports = isZipAvailable;
