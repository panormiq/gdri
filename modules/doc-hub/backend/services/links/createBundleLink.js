/**
 * FICHIER : modules/doc-hub/backend/services/links/createBundleLink.js
 * RÔLE : Crée un lien de téléchargement groupé (archive ZIP) pour plusieurs documents.
 */

const { generateDownloadToken, hashToken } = require('../../utils/tokenUtils');

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

module.exports = createBundleLink;
