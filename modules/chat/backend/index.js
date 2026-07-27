/**
 * FICHIER : modules/chat/backend/index.js
 * RÔLE : Point d'entrée module Chat IA — init indexes + routes.
 */

const routes = require('./routes');

/**
 * Initialise le module Chat IA
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 */
async function init(app, db) {
  console.log('  💬 Initialisation module Chat IA...');
  try {
    const entityCol = db.getCollection('chat_entity_settings');
    const userCol = db.getCollection('chat_user_settings');
    const accessCol = db.getCollection('chat_entity_user_access');
    const convCol = db.getCollection('chat_conversations');

    await entityCol.createIndex({ entity_id: 1 }, { unique: true });
    await userCol.createIndex({ entity_id: 1, user_id: 1 }, { unique: true });
    await accessCol.createIndex({ entity_id: 1, user_id: 1 }, { unique: true });
    await convCol.createIndex({ entity_id: 1, user_id: 1, updated_at: -1 });
  } catch (error) {
    console.warn('  ⚠️  Chat IA indexation:', error.message);
  }
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
