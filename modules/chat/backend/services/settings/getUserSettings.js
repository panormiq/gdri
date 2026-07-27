/**
 * FICHIER : modules/chat/backend/services/settings/getUserSettings.js
 */

const { COLLECTION_USER } = require('../collections');

async function getUserSettings(database, entityId, userId) {
  const doc = await database.getCollection(COLLECTION_USER).findOne({
    entity_id: entityId,
    user_id: userId
  });
  return doc || { entity_id: entityId, user_id: userId };
}

module.exports = getUserSettings;
