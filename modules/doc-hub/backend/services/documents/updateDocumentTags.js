/**
 * FICHIER : modules/doc-hub/backend/services/documents/updateDocumentTags.js
 * RÔLE : Remplace la liste de tags d'un document (dédoublonnée, nettoyée).
 */

const { ObjectId } = require('mongodb');

async function updateDocumentTags(entrepriseDb, id, tags) {
  if (!Array.isArray(tags)) throw new Error('tags doit être un tableau');
  const clean = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))];

  const result = await entrepriseDb.collection('doc_hub_documents').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { tags: clean } },
    { returnDocument: 'after' }
  );

  return result;
}

module.exports = updateDocumentTags;
