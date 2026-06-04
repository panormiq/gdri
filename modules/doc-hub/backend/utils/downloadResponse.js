/**
 * En-têtes HTTP pour téléchargement — dates d’origine (Last-Modified)
 */

/**
 * Nom de l’archive ZIP pour un fichier unique (ex. photo.png → photo.zip)
 * @param {string} originalFilename
 * @returns {string}
 */
function zipDownloadFilename(originalFilename) {
  const base = originalFilename || 'document';
  const dot = base.lastIndexOf('.');
  if (dot > 0) return `${base.slice(0, dot)}.zip`;
  return `${base}.zip`;
}

/**
 * @param {import('http').ServerResponse} res
 * @param {{ mimeType?: string, filename: string, captureDate?: Date|null }} opts
 */
function setFileDownloadHeaders(res, { mimeType, filename, captureDate }) {
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  if (captureDate && !Number.isNaN(captureDate.getTime())) {
    res.setHeader('Last-Modified', captureDate.toUTCString());
    res.setHeader('X-Doc-Hub-Original-Date', captureDate.toISOString());
  }
}

/**
 * @param {import('http').ServerResponse} res
 * @param {{ filename: string, captureDate?: Date|null, contentLength?: number }} opts
 */
function setZipDownloadHeaders(res, { filename, captureDate, contentLength }) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  if (contentLength != null) {
    res.setHeader('Content-Length', contentLength);
  }
  if (captureDate && !Number.isNaN(captureDate.getTime())) {
    res.setHeader('Last-Modified', captureDate.toUTCString());
    res.setHeader('X-Doc-Hub-Original-Date', captureDate.toISOString());
  }
}

module.exports = {
  zipDownloadFilename,
  setFileDownloadHeaders,
  setZipDownloadHeaders
};
