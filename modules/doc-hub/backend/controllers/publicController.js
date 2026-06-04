const path = require('path');
const fs = require('fs');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const DownloadLinkService = require('../services/DownloadLinkService');
const BundleZipService = require('../services/BundleZipService');
const { parseDownloadToken, hashToken } = require('../utils/tokenUtils');
const {
  applyFilesystemDatesFromMetadata,
  getCaptureDateForDoc
} = require('../utils/metadataExtract');
const {
  zipDownloadFilename,
  setFileDownloadHeaders,
  setZipDownloadHeaders
} = require('../utils/downloadResponse');

function extractTokenFromRequest(req) {
  if (req.query && req.query.t) {
    return String(req.query.t);
  }
  if (req.params && req.params.token) {
    return String(req.params.token);
  }
  return '';
}

function shouldServeDatedZip(req, captureDate) {
  if (!captureDate || !BundleZipService.isZipAvailable()) return false;
  if (req.query && String(req.query.raw) === '1') return false;
  return true;
}

async function download(req, res) {
  try {
    const rawToken = extractTokenFromRequest(req);
    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'Lien invalide (token manquant)' });
    }

    const parsed = parseDownloadToken(rawToken);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Lien invalide' });
    }

    const entrepriseDb = await database.getEntrepriseDb(parsed.entrepriseId);
    if (!entrepriseDb) {
      return res.status(404).json({ success: false, message: 'Lien invalide ou expiré' });
    }

    const tokenForLookup = (() => {
      try {
        return decodeURIComponent(rawToken);
      } catch {
        return rawToken;
      }
    })();

    const tokenHash = hashToken(tokenForLookup);
    const linkRow = await entrepriseDb.collection('doc_hub_download_links').findOne({ tokenHash });

    const result = await DownloadLinkService.resolveToken(entrepriseDb, tokenForLookup, linkRow);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const { link } = result;

    if (result.bundle) {
      const buffer = await BundleZipService.buildZipBuffer(entrepriseDb, result.documentIds);
      const zipName = (link.bundleLabel || 'documents').replace(/[^a-zA-Z0-9._-]/g, '_') + '.zip';

      await DownloadLinkService.recordDownload(entrepriseDb, link._id);

      setZipDownloadHeaders(res, { filename: zipName, contentLength: buffer.length });
      return res.send(buffer);
    }

    const { doc } = result;

    if (!fs.existsSync(doc.storagePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable' });
    }

    applyFilesystemDatesFromMetadata(doc.storagePath, {
      captureDate: doc.captureDate,
      ...doc.metadata
    });

    const captureDate = getCaptureDateForDoc(doc);

    await DownloadLinkService.recordDownload(entrepriseDb, link._id);

    if (shouldServeDatedZip(req, captureDate)) {
      const buffer = await BundleZipService.buildSingleDocumentZipBuffer(doc);
      const zipName = zipDownloadFilename(doc.filename);
      setZipDownloadHeaders(res, {
        filename: zipName,
        captureDate,
        contentLength: buffer.length
      });
      return res.send(buffer);
    }

    setFileDownloadHeaders(res, {
      mimeType: doc.mimeType,
      filename: doc.filename,
      captureDate
    });
    fs.createReadStream(doc.storagePath).pipe(res);
  } catch (error) {
    console.error('Doc-Hub public download:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur téléchargement' });
  }
}

module.exports = { download };
