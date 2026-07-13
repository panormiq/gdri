/**
 * Module Studio Média — images / vidéo via ComfyUI + chat IA
 */

const routes = require('./routes');

async function init(app, db) {
  console.log('  🎨 Initialisation module Studio Média...');
  try {
    const col = db.getCollection('media_studio_generations');
    await col.createIndex({ entity_id: 1, user_id: 1, created_at: -1 });
  } catch (error) {
    console.warn('  ⚠️  Studio Média indexation:', error.message);
  }
}

function getRoutes() {
  return routes;
}

module.exports = { init, routes: getRoutes };
