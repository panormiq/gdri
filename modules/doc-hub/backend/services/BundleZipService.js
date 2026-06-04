/**
 * Archives ZIP — fichiers originaux + dates d’origine dans les en-têtes ZIP
 * (adm-zip ignorait { date } ; il faut fs.Stats ou entry.header.time).
 */

const fs = require('fs');
const DocumentService = require('./DocumentService');
const {
  applyFilesystemDatesFromMetadata,
  getCaptureDateForDoc
} = require('../utils/metadataExtract');
const { buildNtfsExtraField } = require('../utils/zipNtfsExtra');

let AdmZip = null;
try {
  AdmZip = require('adm-zip');
} catch {
  AdmZip = null;
}

function uniqueEntryName(filename, usedCounts) {
  const base = filename || 'document';
  const n = usedCounts.get(base) || 0;
  usedCounts.set(base, n + 1);
  if (n === 0) return base;
  const dot = base.lastIndexOf('.');
  if (dot > 0) {
    return `${base.slice(0, dot)} (${n + 1})${base.slice(dot)}`;
  }
  return `${base} (${n + 1})`;
}

/**
 * @param {import('adm-zip')} zip
 * @param {string} entryName
 * @param {Date} captureDate
 */
function applyZipEntryDates(zip, entryName, captureDate) {
  const entry = zip.getEntry(entryName);
  if (!entry || !captureDate || Number.isNaN(captureDate.getTime())) return;

  entry.header.time = captureDate;

  try {
    const ntfs = buildNtfsExtraField(captureDate);
    entry.extra = ntfs;
    if ('extralocal' in entry) {
      entry.extralocal = ntfs;
    }
  } catch (err) {
    console.warn('Doc-Hub: champ NTFS ZIP ignoré:', err.message);
  }
}

function addDocToZip(zip, doc, usedCounts = new Map()) {
  if (!doc?.storagePath || !fs.existsSync(doc.storagePath)) {
    return false;
  }

  const entryName = uniqueEntryName(doc.filename || `document-${doc._id}`, usedCounts);

  applyFilesystemDatesFromMetadata(doc.storagePath, {
    captureDate: doc.captureDate,
    ...(doc.metadata || {})
  });

  const captureDate = getCaptureDateForDoc(doc);

  zip.addLocalFile(doc.storagePath, '', entryName, '');
  applyZipEntryDates(zip, entryName, captureDate || fs.statSync(doc.storagePath).mtime);

  return true;
}

async function buildZipBuffer(entrepriseDb, documentIds) {
  if (!AdmZip) {
    throw new Error('Module adm-zip requis pour le téléchargement groupé (npm install adm-zip)');
  }

  const zip = new AdmZip();
  const usedCounts = new Map();
  let added = 0;

  for (const documentId of documentIds) {
    const doc = await DocumentService.getById(entrepriseDb, documentId);
    if (addDocToZip(zip, doc, usedCounts)) added++;
  }

  if (added === 0) {
    throw new Error('Aucun fichier disponible pour cette archive');
  }

  return zip.toBuffer();
}

async function buildSingleDocumentZipBuffer(doc) {
  if (!AdmZip) {
    throw new Error('Module adm-zip requis (npm install adm-zip)');
  }
  const zip = new AdmZip();
  if (!addDocToZip(zip, doc)) {
    throw new Error('Fichier introuvable');
  }
  return zip.toBuffer();
}

module.exports = {
  buildZipBuffer,
  buildSingleDocumentZipBuffer,
  isZipAvailable: () => Boolean(AdmZip)
};
