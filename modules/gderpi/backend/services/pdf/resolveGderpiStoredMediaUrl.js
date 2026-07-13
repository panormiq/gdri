/**
 * FICHIER : modules/gderpi/backend/services/pdf/resolveGderpiStoredMediaUrl.js
 * RÔLE : Résout une URL image stockée GDERPI en URL absolue pour HTML/PDF.
 *
 * ENTRÉES : req Express, storedUrl
 * SORTIES : URL absolue ou vide
 *
 * DÉPEND DE : buildGderpiImageAbsoluteUrl.js
 * NE PAS : lecture disque
 *
 * APPELÉ PAR : buildDevisHtmlContext.js
 */

const buildGderpiImageAbsoluteUrl = require('../uploads/buildGderpiImageAbsoluteUrl');

function resolveGderpiStoredMediaUrl(req, storedUrl) {
  const raw = String(storedUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/api/gderpi/media/')) {
    return buildGderpiImageAbsoluteUrl(req, raw);
  }
  if (raw.startsWith('/uploads/gderpi/')) {
    const suffix = raw.slice('/uploads/gderpi/'.length);
    return buildGderpiImageAbsoluteUrl(req, `/api/gderpi/media/${suffix}`);
  }
  return buildGderpiImageAbsoluteUrl(req, raw);
}

module.exports = resolveGderpiStoredMediaUrl;
