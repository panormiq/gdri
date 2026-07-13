/**
 * FICHIER : modules/gderpi/backend/services/uploads/buildGderpiImageAbsoluteUrl.js
 * RÔLE : Construit l'URL absolue d'une image GDERPI à partir de la requête HTTP.
 *
 * ENTRÉES : req Express, publicPath
 * SORTIES : URL string (absolue ou chemin relatif)
 *
 * DÉPEND DE : aucune
 * NE PAS : stockage fichier
 *
 * APPELÉ PAR : uploadController.js
 */

function buildGderpiImageAbsoluteUrl(req, publicPath) {
  const pathPart = String(publicPath || '').trim();
  if (!pathPart) return '';
  if (/^https?:\/\//i.test(pathPart)) return pathPart;

  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  if (!host) return pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return `${proto}://${host}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}`;
}

module.exports = buildGderpiImageAbsoluteUrl;
