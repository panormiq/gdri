/**
 * FICHIER : modules/chat/backend/services/settings/updateUserSettings.js
 */

const { COLLECTION_USER } = require('../collections');

async function updateUserSettings(database, entityId, userId, payload) {
  const update = { entity_id: entityId, user_id: userId, updated_at: new Date() };
  if (payload.default_server_id !== undefined) {
    update.default_server_id = String(payload.default_server_id || '').trim();
  }
  if (payload.default_model !== undefined) {
    update.default_model = String(payload.default_model || '').trim();
  }
  await database.getCollection(COLLECTION_USER).updateOne(
    { entity_id: entityId, user_id: userId },
    { $set: update },
    { upsert: true }
  );
}

module.exports = updateUserSettings;
