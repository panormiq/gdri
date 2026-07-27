/**
 * FICHIER : modules/chat/backend/services/settings/getGlobalSettings.js
 */

const { COLLECTION_GLOBAL } = require('../collections');

async function getGlobalSettings(database) {
  return database.getCollection(COLLECTION_GLOBAL).findOne({ _id: 'default' });
}

module.exports = getGlobalSettings;
