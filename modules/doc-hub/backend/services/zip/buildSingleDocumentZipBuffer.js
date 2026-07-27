/**
 * FICHIER : modules/doc-hub/backend/services/zip/buildSingleDocumentZipBuffer.js
 * RÔLE : Construit le buffer ZIP d'un document unique (téléchargement daté).
 */

const getAdmZip = require('./getAdmZip');
const addDocToZip = require('./addDocToZip');

async function buildSingleDocumentZipBuffer(doc) {
  const AdmZip = getAdmZip();
  if (!AdmZip) {
    throw new Error('Module adm-zip requis (npm install adm-zip)');
  }
  const zip = new AdmZip();
  if (!addDocToZip(zip, doc)) {
    throw new Error('Fichier introuvable');
  }
  return zip.toBuffer();
}

module.exports = buildSingleDocumentZipBuffer;
