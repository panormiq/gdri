/**
 * FICHIER : modules/doc-hub/backend/services/documents/removeDocument.js
 * RÔLE : Supprime un document : fichier disque, liens de téléchargement, entrée Mongo.
 */

const fs = require('fs');
const { ObjectId } = require('mongodb');
const getDocumentById = require('./getDocumentById');

async function removeDocument(entrepriseDb, id, entrepriseId) {
  const doc = await getDocumentById(entrepriseDb, id);
  if (!doc) return false;

  if (doc.storagePath && fs.existsSync(doc.storagePath)) {
    try {
      fs.unlinkSync(doc.storagePath);
    } catch (err) {
      console.warn('Doc-Hub: suppression fichier:', err.message);
    }
  }

  const idStr = String(id);
  await entrepriseDb.collection('doc_hub_download_links').deleteMany({ documentId: idStr });
  await entrepriseDb.collection('doc_hub_download_links').updateMany(
    { documentIds: idStr },
    { $pull: { documentIds: idStr } }
  );

  const result = await entrepriseDb.collection('doc_hub_documents').deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

module.exports = removeDocument;
