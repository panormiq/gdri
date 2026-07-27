/**
 * FICHIER : modules/doc-hub/backend/services/diffusions/listDiffusionsByProject.js
 * RÔLE : Liste les diffusions d'un projet enrichies de leur traçabilité
 *        (liens, compteurs de téléchargement, aperçu documents).
 */

const { ObjectId } = require('mongodb');
const smtpProfileLabel = require('../mail/smtpProfileLabel');

async function listDiffusionsByProject(entrepriseDb, projectId) {
  const diffusions = await entrepriseDb
    .collection('doc_hub_diffusions')
    .find({ projectId: String(projectId) })
    .sort({ createdAt: -1 })
    .toArray();

  const linksCol = entrepriseDb.collection('doc_hub_download_links');
  const docsCol = entrepriseDb.collection('doc_hub_documents');

  const enriched = [];
  for (const d of diffusions) {
    const diffusionId = d._id.toString();
    const links = await linksCol.find({ diffusionId }).toArray();
    const documentIds = Array.isArray(d.documentIds) ? d.documentIds : [];

    const documentPreview = [];
    for (const id of documentIds.slice(0, 8)) {
      try {
        const doc = await docsCol.findOne({ _id: new ObjectId(id) });
        if (doc) documentPreview.push({ id, filename: doc.filename, slotCode: doc.slotCode });
      } catch {
        /* skip invalid id */
      }
    }

    enriched.push({
      ...d,
      _id: diffusionId,
      smtpProfileLabel: smtpProfileLabel(d.smtpProfile),
      documentsCount: documentIds.length,
      documentPreview,
      trace: {
        linksCount: links.length,
        totalDownloads: links.reduce((sum, l) => sum + (l.downloadCount || 0), 0),
        links: links.map((l) => ({
          type: l.type || 'file',
          downloadCount: l.downloadCount || 0,
          maxDownloads: l.maxDownloads ?? null,
          expiresAt: l.expiresAt,
          revokedAt: l.revokedAt,
          lastDownloadAt: l.lastDownloadAt || null,
          documentIds: l.documentIds || (l.documentId ? [l.documentId] : [])
        }))
      }
    });
  }

  return enriched;
}

module.exports = listDiffusionsByProject;
