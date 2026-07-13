/**
 * Résout et valide un lien public devis.
 */

const { hashToken, parsePublicToken } = require('../../utils/tokenUtils');

const COLLECTION = 'gderpi_devis_public_links';

async function resolveDevisPublicLink(db, entrepriseId, token) {
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
  if (link.revokedAt) return { ok: false, status: 410, message: 'Ce lien a été révoqué' };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { ok: false, status: 410, message: 'Ce lien a expiré' };
  }

  return { ok: true, link, tokenHash };
}

async function incrementDevisDownloadCount(db, tokenHash) {
  await db.collection(COLLECTION).updateOne(
    { tokenHash },
    { $inc: { downloadCount: 1 }, $set: { lastDownloadAt: new Date() } }
  );
}

module.exports = { resolveDevisPublicLink, incrementDevisDownloadCount };
