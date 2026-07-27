/**
 * FICHIER : modules/doc-hub/backend/services/links/resolveDownloadToken.js
 * RÔLE : Valide un token de téléchargement (révocation, expiration, quota)
 *        et résout le lien vers le document ou la liste de documents (bundle).
 *
 * SORTIES : { ok, status?, message?, link?, doc?, bundle?, documentIds? }
 */

const { hashToken } = require('../../utils/tokenUtils');
const getDocumentById = require('../documents/getDocumentById');

async function resolveDownloadToken(entrepriseDb, token, linkRow = null) {
  const tokenHash = hashToken(token);
  const link = linkRow || (await entrepriseDb.collection('doc_hub_download_links').findOne({ tokenHash }));
  if (!link) return { ok: false, status: 404, message: 'Lien invalide ou expiré' };

  if (link.revokedAt) {
    return { ok: false, status: 410, message: 'Ce lien a été révoqué' };
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    return { ok: false, status: 410, message: 'Ce lien a expiré' };
  }

  if (link.maxDownloads != null && link.downloadCount >= link.maxDownloads) {
    return { ok: false, status: 410, message: 'Nombre maximum de téléchargements atteint' };
  }

  if (link.type === 'bundle') {
    return { ok: true, link, bundle: true, documentIds: link.documentIds || [] };
  }

  const doc = await getDocumentById(entrepriseDb, link.documentId);
  if (!doc || !doc.storagePath) {
    return { ok: false, status: 404, message: 'Document introuvable' };
  }

  return { ok: true, link, doc, bundle: false };
}

module.exports = resolveDownloadToken;
