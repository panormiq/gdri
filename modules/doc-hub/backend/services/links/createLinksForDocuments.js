/**
 * FICHIER : modules/doc-hub/backend/services/links/createLinksForDocuments.js
 * RÔLE : Crée un lien de téléchargement public par document (token hashé en base).
 */

const { generateDownloadToken, hashToken } = require('../../utils/tokenUtils');
const getDocumentById = require('../documents/getDocumentById');

async function createLinksForDocuments(entrepriseDb, entrepriseId, diffusionId, documentIds, { expiresAt, maxDownloads = null }) {
  const col = entrepriseDb.collection('doc_hub_download_links');
  const links = [];

  for (const documentId of documentIds) {
    const doc = await getDocumentById(entrepriseDb, documentId);
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

module.exports = createLinksForDocuments;
