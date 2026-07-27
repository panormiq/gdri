/**
 * FICHIER : modules/doc-hub/backend/services/documents/getDocumentById.js
 * RÔLE : Récupère un document par son id (null si id invalide).
 */

const { ObjectId } = require('mongodb');

async function getDocumentById(entrepriseDb, id) {
  if (!ObjectId.isValid(id)) return null;
  return entrepriseDb.collection('doc_hub_documents').findOne({ _id: new ObjectId(id) });
}

module.exports = getDocumentById;
