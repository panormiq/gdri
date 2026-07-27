/**
 * FICHIER : modules/doc-hub/backend/services/links/recordLinkDownload.js
 * RÔLE : Incrémente le compteur de téléchargements d'un lien.
 */

async function recordLinkDownload(entrepriseDb, linkId) {
  await entrepriseDb.collection('doc_hub_download_links').updateOne(
    { _id: linkId },
    { $inc: { downloadCount: 1 }, $set: { lastDownloadAt: new Date() } }
  );
}

module.exports = recordLinkDownload;
