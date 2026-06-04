/**
 * Liens de téléchargement publics — Doc-Hub
 */

const { ObjectId } = require('mongodb');
const { generateDownloadToken, hashToken } = require('../utils/tokenUtils');
const DocumentService = require('./DocumentService');

async function createLinksForDocuments(entrepriseDb, entrepriseId, diffusionId, documentIds, { expiresAt, maxDownloads = null }) {
  const col = entrepriseDb.collection('doc_hub_download_links');
  const links = [];

  for (const documentId of documentIds) {
    const doc = await DocumentService.getById(entrepriseDb, documentId);
    if (!doc) continue;

    const token = generateDownloadToken(entrepriseId);
    const tokenHash = hashToken(token);

    await col.insertOne({
      tokenHash,
      type: 'file',
      entrepriseId: String(entrepriseId),
      diffusionId: String(diffusionId),
      documentId: String(documentId),
      documentIds: null,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxDownloads: maxDownloads ?? null,
      downloadCount: 0,
      revokedAt: null,
      createdAt: new Date()
    });

    links.push({
      type: 'file',
      documentId: String(documentId),
      filename: doc.filename,
      token
    });
  }

  return links;
}

async function createBundleLink(entrepriseDb, entrepriseId, diffusionId, documentIds, { expiresAt, maxDownloads = null, label = 'Documents' }) {
  const col = entrepriseDb.collection('doc_hub_download_links');
  const ids = documentIds.map(String).filter(Boolean);
  if (!ids.length) return null;

  const token = generateDownloadToken(entrepriseId);
  const tokenHash = hashToken(token);

  await col.insertOne({
    tokenHash,
    type: 'bundle',
    entrepriseId: String(entrepriseId),
    diffusionId: String(diffusionId),
    documentId: null,
    documentIds: ids,
    bundleLabel: label,
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxDownloads: maxDownloads ?? null,
    downloadCount: 0,
    revokedAt: null,
    createdAt: new Date()
  });

  return {
    type: 'bundle',
    token,
    filename: `${label}.zip`,
    documentCount: ids.length
  };
}

async function resolveToken(entrepriseDb, token, linkRow = null) {
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

  const doc = await DocumentService.getById(entrepriseDb, link.documentId);
  if (!doc || !doc.storagePath) {
    return { ok: false, status: 404, message: 'Document introuvable' };
  }

  return { ok: true, link, doc, bundle: false };
}

async function recordDownload(entrepriseDb, linkId) {
  await entrepriseDb.collection('doc_hub_download_links').updateOne(
    { _id: linkId },
    { $inc: { downloadCount: 1 }, $set: { lastDownloadAt: new Date() } }
  );
}

async function revokeByDiffusion(entrepriseDb, diffusionId) {
  await entrepriseDb.collection('doc_hub_download_links').updateMany(
    { diffusionId: String(diffusionId), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  createLinksForDocuments,
  createBundleLink,
  resolveToken,
  recordDownload,
  revokeByDiffusion
};
