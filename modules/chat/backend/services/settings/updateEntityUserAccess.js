/**
 * FICHIER : modules/chat/backend/services/settings/updateEntityUserAccess.js
 */

const { COLLECTION_ENTITY_USER_ACCESS } = require('../collections');

async function updateEntityUserAccess(database, entityId, targetUserId, enabled) {
  await database.getCollection(COLLECTION_ENTITY_USER_ACCESS).updateOne(
    { entity_id: entityId, user_id: targetUserId },
    {
      $set: {
        entity_id: entityId,
        user_id: targetUserId,
        enabled,
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
}

module.exports = updateEntityUserAccess;
