/**
 * FICHIER : modules/doc-hub/backend/services/tags/removeTag.js
 * RÔLE : Supprime un tag et le retire des documents qui le portent.
 */

const { ObjectId } = require('mongodb');

async function removeTag(entrepriseDb, id) {
  const tag = await entrepriseDb.collection('doc_hub_tags').findOne({ _id: new ObjectId(id) });
  if (!tag) return false;

  await entrepriseDb.collection('doc_hub_documents').updateMany(
    { tags: tag.code },
    { $pull: { tags: tag.code } }
  );
  const result = await entrepriseDb.collection('doc_hub_tags').deleteOne({ _id: tag._id });
  return result.deletedCount > 0;
}

module.exports = removeTag;
