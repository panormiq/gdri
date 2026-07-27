/**
 * FICHIER : modules/chat/backend/controllers/healthController.js
 * RÔLE : Health et bootstrap runtime Chat IA.
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const resolveRuntimeConfig = require('../services/runtime/resolveRuntimeConfig');

async function health(req, res) {
  try {
    const runtime = await resolveRuntimeConfig(database, req);
    if (!runtime.ok) {
      return res.status(runtime.status || 400).json({ success: false, message: runtime.message });
    }
    return res.json({
      success: true,
      data: {
        entity_id: runtime.entityId,
        user_id: runtime.userId,
        model: runtime.model,
        server_id: runtime.serverId
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function bootstrap(req, res) {
  try {
    const runtime = await resolveRuntimeConfig(database, req);
    if (!runtime.ok) {
      return res.status(runtime.status || 400).json({ success: false, message: runtime.message });
    }
    return res.json({
      success: true,
      data: {
        entity_id: runtime.entityId,
        user_id: runtime.userId,
        default_server_id: runtime.serverId,
        default_model: runtime.model,
        defaults: runtime.defaults
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { health, bootstrap };
