/**
 * FICHIER : modules/doc-hub/backend/services/tags/updateTag.js
 * RÔLE : Met à jour libellé, couleur ou ordre d'un tag.
 */

const { ObjectId } = require('mongodb');

async function updateTag(entrepriseDb, id, payload) {
  const updates = { updatedAt: new Date() };
  if (payload.label !== undefined) updates.label = String(payload.label).trim();
  if (payload.color !== undefined) updates.color = payload.color;
  if (payload.sortOrder !== undefined) updates.sortOrder = Number(payload.sortOrder);

  const result = await entrepriseDb.collection('doc_hub_tags').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result;
}

module.exports = updateTag;
