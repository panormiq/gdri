/**
 * Extraction métadonnées fichier (EXIF images) + dates de prise de vue
 */

const fs = require('fs');

let exifr = null;
try {
  exifr = require('exifr');
} catch {
  exifr = null;
}

/**
 * Parse une valeur date EXIF (souvent "2023:05:12 14:30:45" — invalide pour new Date() seul).
 * @param {*} raw
 * @returns {Date|null}
 */
function parseExifDateValue(raw) {
  if (raw == null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const exifMatch = trimmed.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (exifMatch) {
      return new Date(
        Number(exifMatch[1]),
        Number(exifMatch[2]) - 1,
        Number(exifMatch[3]),
        Number(exifMatch[4]),
        Number(exifMatch[5]),
        Number(exifMatch[6])
      );
    }
    const iso = trimmed.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * @param {Object} exif
 * @returns {Date|null}
 */
function parseExifDate(exif) {
  if (!exif || typeof exif !== 'object') return null;

  const keys = ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTimeDigitized'];
  for (const key of keys) {
    const d = parseExifDateValue(exif[key]);
    if (d) return d;
  }
  return null;
}

function pickFilesystemDate(stat) {
  const candidates = [stat.birthtime, stat.mtime];
  for (const d of candidates) {
    if (d instanceof Date && !Number.isNaN(d.getTime()) && d.getFullYear() > 1980) {
      return d;
    }
  }
  return null;
}

/**
 * @param {Object} metadata
 * @returns {Date|null}
 */
function getCaptureDateFromMetadata(metadata) {
  if (!metadata) return null;
  if (metadata.captureDate) {
    const d = new Date(metadata.captureDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return parseExifDate(metadata.exif);
}

/**
 * Date d’origine d’un document Doc-Hub (EXIF, fichier client, etc.)
 * @param {{ captureDate?: string, metadata?: Object }} doc
 * @returns {Date|null}
 */
function getCaptureDateForDoc(doc) {
  if (!doc) return null;
  const fromMeta = getCaptureDateFromMetadata(doc.metadata);
  if (fromMeta) return fromMeta;
  if (doc.captureDate) {
    const d = new Date(doc.captureDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function applyFilesystemDatesFromMetadata(filePath, metadata) {
  const captureDate = getCaptureDateFromMetadata(metadata);
  if (!captureDate || !fs.existsSync(filePath)) return null;

  const epochSec = Math.floor(captureDate.getTime() / 1000);
  try {
    fs.utimesSync(filePath, epochSec, epochSec);
  } catch (err) {
    console.warn('Doc-Hub: utimes date ignoré:', err.message);
  }
  return captureDate;
}

/**
 * Priorité : EXIF (prise de vue) > date navigateur (lastModified) > date disque serveur
 * @param {Object} fileMetadata - résultat extractFileMetadata
 * @param {{ lastModified?: number, originalName?: string }} [clientHint]
 */
function resolveCaptureDate(fileMetadata, clientHint) {
  const exifDate = parseExifDate(fileMetadata?.exif);
  if (exifDate) {
    return {
      captureDate: exifDate.toISOString(),
      dateSource: 'exif'
    };
  }

  if (fileMetadata?.captureDate && fileMetadata.dateSource === 'exif') {
    return {
      captureDate: fileMetadata.captureDate,
      dateSource: 'exif'
    };
  }

  if (clientHint?.exifCaptureDate) {
    const d = new Date(clientHint.exifCaptureDate);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1980) {
      return {
        captureDate: d.toISOString(),
        dateSource: 'exif-client'
      };
    }
  }

  if (clientHint && clientHint.lastModified != null) {
    const d = new Date(Number(clientHint.lastModified));
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1980) {
      return {
        captureDate: d.toISOString(),
        dateSource: 'client-file'
      };
    }
  }

  if (fileMetadata?.captureDate) {
    return {
      captureDate: fileMetadata.captureDate,
      dateSource: fileMetadata.dateSource || 'filesystem'
    };
  }

  return { captureDate: null, dateSource: null };
}

/**
 * @param {string} filePath
 * @param {string} mimeType
 * @returns {Promise<Object>}
 */
async function extractFileMetadata(filePath, mimeType) {
  const stat = fs.statSync(filePath);
  const fileDate = pickFilesystemDate(stat);

  const base = {
    size: stat.size,
    mimeType: mimeType || null,
    extractedAt: new Date().toISOString(),
    captureDate: null,
    dateSource: null,
    fileCreatedAt: fileDate ? fileDate.toISOString() : null,
    exifPresent: false
  };

  const isImage = mimeType && mimeType.startsWith('image/');

  if (!isImage) {
    return base;
  }

  if (!exifr) {
    if (fileDate) {
      base.captureDate = fileDate.toISOString();
      base.dateSource = 'filesystem';
    }
    return base;
  }

  try {
    const dateFields = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTimeDigitized'],
      reviveDates: true
    });

    let captureDate = parseExifDate(dateFields);
    let exifPayload = dateFields || null;

    if (!captureDate) {
      const fullExif = await exifr.parse(filePath, { tiff: true, ifd0: true, exif: true, gps: true });
      if (fullExif && typeof fullExif === 'object') {
        exifPayload = fullExif;
        captureDate = parseExifDate(fullExif);
        base.exifPresent = Object.keys(fullExif).length > 0;
      }
    } else {
      base.exifPresent = true;
    }

    if (captureDate) {
      base.captureDate = captureDate.toISOString();
      base.dateSource = 'exif';
      base.exif = exifPayload;
    } else if (fileDate) {
      base.captureDate = fileDate.toISOString();
      base.dateSource = 'filesystem';
      base.exif = exifPayload;
      if (exifPayload) base.exifPresent = true;
    } else if (exifPayload) {
      base.exif = exifPayload;
      base.exifPresent = true;
    }
  } catch (err) {
    base.exifError = err.message;
    if (fileDate) {
      base.captureDate = fileDate.toISOString();
      base.dateSource = 'filesystem';
    }
  }

  return base;
}

module.exports = {
  extractFileMetadata,
  getCaptureDateFromMetadata,
  getCaptureDateForDoc,
  applyFilesystemDatesFromMetadata,
  resolveCaptureDate,
  parseExifDate,
  parseExifDateValue
};
