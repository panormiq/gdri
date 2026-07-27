/**
 * FICHIER : modules/doc-hub/backend/services/zip/addDocToZip.js
 * RÔLE : Ajoute un document à une archive ZIP en préservant la date d'origine
 *        (en-tête ZIP + champ NTFS ; adm-zip ignorait { date }).
 */

const fs = require('fs');
const {
  applyFilesystemDatesFromMetadata,
  getCaptureDateForDoc
} = require('../../utils/metadataExtract');
const { buildNtfsExtraField } = require('../../utils/zipNtfsExtra');

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

module.exports = addDocToZip;
