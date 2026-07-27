/**
 * FICHIER : modules/chat/backend/services/settings/getEntitySettings.js
 */

const { COLLECTION_ENTITY } = require('../collections');

async function getEntitySettings(database, entityId) {
  const doc = await database.getCollection(COLLECTION_ENTITY).findOne({ entity_id: entityId });
  return doc || { entity_id: entityId, enabled: false };
}

module.exports = getEntitySettings;
