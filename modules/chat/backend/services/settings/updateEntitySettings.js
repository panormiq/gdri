/**
 * FICHIER : modules/chat/backend/services/settings/updateEntitySettings.js
 */

const { COLLECTION_ENTITY } = require('../collections');

async function updateEntitySettings(database, entityId, payload, updatedBy) {
  const update = { entity_id: entityId, updated_at: new Date(), updated_by: updatedBy };
  if (payload.enabled !== undefined) update.enabled = payload.enabled === true;
  if (payload.default_server_id !== undefined) {
    update.default_server_id = String(payload.default_server_id || '').trim();
  }
  if (payload.default_model !== undefined) {
    update.default_model = String(payload.default_model || '').trim();
  }
  await database.getCollection(COLLECTION_ENTITY).updateOne(
    { entity_id: entityId },
    { $set: update },
    { upsert: true }
  );
}

module.exports = updateEntitySettings;
