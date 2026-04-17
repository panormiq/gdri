/**
 * Module IA - Point d'accès unique à l'IA (config en base + multi-providers).
 * Fichier : modules/ia/backend/index.js
 */

const path = require('path');
const IAClient = require('./services/IAClient');
const { getIAClientForEntity: getIAClientForEntityService, getLLMConfigForEntity } = require('./services/LLMResolver');

let clientInstance = null;

const COLLECTION_SERVERS = 'ia_servers';

async function init(app, db) {
  console.log('  🤖 Module IA : config en base (ia_config) + env de repli, serveurs ia_servers');
  try {
    const database = require(path.join(__dirname, '../../../backend/config/database'));
    const llmsCol = database.getCollection('ia_llms');
    await llmsCol.createIndex({ entity_id: 1, created_at: -1 });
    const rightsCol = database.getCollection('ia_llm_user_rights');
    await rightsCol.createIndex({ entity_id: 1, user_id: 1 }, { unique: true });
    const settingsCol = database.getCollection('ia_entity_settings');
    await settingsCol.createIndex({ entity_id: 1 }, { unique: true });
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    await serversCol.createIndex({ scope: 1 });
    await serversCol.createIndex({ entity_id: 1 });
    await serversCol.createIndex({ owner_user_id: 1 });
  } catch (e) {
    console.warn('  ⚠️ Index ia_llms / ia_llm_user_rights / ia_servers:', e.message);
  }
}

function getIAClient(config = {}) {
  if (!clientInstance) {
    const database = require(path.join(__dirname, '../../../backend/config/database'));
    clientInstance = new IAClient({
      serverUrl: config.serverUrl || process.env.IA_SERVER_URL,
      serviceToken: config.serviceToken || process.env.IA_SERVICE_TOKEN || process.env.BACKENDIA_DEV_TOKEN,
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_URL,
      model: config.model || process.env.OLLAMA_MODEL,
      timeout: config.timeout,
      configLoader: async () => {
        const col = database.getCollection('ia_config');
        return await col.findOne({ _id: 'global' });
      }
    });
  }
  return clientInstance;
}

async function getIAClientForEntity(entityId, llmId = null) {
  return getIAClientForEntityService(entityId, llmId);
}

function getRoutes() {
  return require('./routes');
}

module.exports = {
  init,
  getIAClient,
  getIAClientForEntity,
  getLLMConfigForEntity,
  routes: getRoutes,
  config: {}
};
