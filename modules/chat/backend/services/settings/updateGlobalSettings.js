/**
 * FICHIER : modules/chat/backend/services/settings/updateGlobalSettings.js
 */

const { COLLECTION_GLOBAL } = require('../collections');

async function updateGlobalSettings(database, { defaultServerId, defaultModel, updatedBy }) {
  const col = database.getCollection(COLLECTION_GLOBAL);
  await col.updateOne(
    { _id: 'default' },
    {
      $set: {
        default_server_id: defaultServerId,
        default_model: defaultModel,
        updated_at: new Date(),
        updated_by: updatedBy
      }
    },
    { upsert: true }
  );
}

module.exports = updateGlobalSettings;
