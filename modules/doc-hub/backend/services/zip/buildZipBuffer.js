/**
 * FICHIER : modules/doc-hub/backend/services/zip/buildZipBuffer.js
 * RÔLE : Construit le buffer ZIP d'une liste de documents (téléchargement groupé).
 */

const getAdmZip = require('./getAdmZip');
const addDocToZip = require('./addDocToZip');
const getDocumentById = require('../documents/getDocumentById');

async function buildZipBuffer(entrepriseDb, documentIds) {
  const AdmZip = getAdmZip();
  if (!AdmZip) {
    throw new Error('Module adm-zip requis pour le téléchargement groupé (npm install adm-zip)');
  }

  const zip = new AdmZip();
  const usedCounts = new Map();
  let added = 0;

  for (const documentId of documentIds) {
    const doc = await getDocumentById(entrepriseDb, documentId);
    if (addDocToZip(zip, doc, usedCounts)) added++;
  }

  if (added === 0) {
    throw new Error('Aucun fichier disponible pour cette archive');
  }

  return zip.toBuffer();
}

module.exports = buildZipBuffer;
