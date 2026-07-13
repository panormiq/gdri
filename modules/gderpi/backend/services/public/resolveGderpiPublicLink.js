/**
 * Résout et valide un lien public document GDERPI.
 */

const { hashToken, parsePublicToken } = require('../../utils/tokenUtils');

const COLLECTION = 'gderpi_public_links';

async function resolveGderpiPublicLink(db, entrepriseId, docType, token) {
  const parsed = parsePublicToken(token);
  if (!parsed) return { ok: false, status: 400, message: 'Lien invalide' };
  if (String(parsed.entrepriseId) !== String(entrepriseId)) {
    return { ok: false, status: 400, message: 'Lien invalide pour cette entreprise' };
  }

  const tokenHash = hashToken(token);
  const link = await db.collection(COLLECTION).findOne({ tokenHash });
  if (!link) return { ok: false, status: 404, message: 'Lien introuvable ou expiré' };
  if (String(link.entrepriseId) !== String(entrepriseId)) {
    return { ok: false, status: 404, message: 'Lien introuvable' };
  }
  if (docType && String(link.docType) !== String(docType)) {
    return { ok: false, status: 404, message: 'Lien introuvable pour ce document' };
  }
  if (link.revokedAt) return { ok: false, status: 410, message: 'Ce lien a été révoqué' };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { ok: false, status: 410, message: 'Ce lien a expiré' };
  }

  return { ok: true, link, tokenHash };
}

async function incrementGderpiPublicDownloadCount(db, tokenHash) {
  await db.collection(COLLECTION).updateOne(
    { tokenHash },
    { $inc: { downloadCount: 1 }, $set: { lastDownloadAt: new Date() } }
  );
}

module.exports = { resolveGderpiPublicLink, incrementGderpiPublicDownloadCount };
