/**
 * Résout la config LLM par entité (ia_llms) pour génération.
 * Si le LLM a server_id, la config est lue depuis ia_servers ; sinon ancien format (champs plats sur le LLM).
 * Fichier : modules/ia/backend/services/LLMResolver.js
 */

const path = require('path');
const { ObjectId } = require('mongodb');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const IAClient = require('./IAClient');
const { buildClientConfigFromServer } = require('./ServerConfigHelper');

const COLLECTION_LLMS = 'ia_llms';
const COLLECTION_SERVERS = 'ia_servers';

/**
 * Charge le document LLM pour une entité (par id ou défaut).
 * @param {string} entityId - ID de l'entité
 * @param {string} [llmId] - ID du LLM (optionnel) ; sinon utilise is_default ou le premier
 * @returns {Promise<object|null>} Document ia_llms ou null
 */
async function getLLMConfigForEntity(entityId, llmId = null) {
  const col = database.getCollection(COLLECTION_LLMS);
  let doc = null;
  if (llmId) {
    try {
      doc = await col.findOne({ _id: new ObjectId(llmId), entity_id: String(entityId) });
    } catch (_) {
      return null;
    }
  }
  if (!doc) {
    doc = await col.findOne({ entity_id: String(entityId), is_default: true });
  }
  if (!doc) {
    doc = await col.findOne({ entity_id: String(entityId) }, { sort: { created_at: -1 } });
  }
  return doc;
}

/**
 * Retourne un IAClient configuré pour l'entité (et optionnellement un LLM précis).
 * Si le LLM a server_id, charge le serveur depuis ia_servers et construit le client à partir de celui-ci.
 * Sinon utilise les champs plats du document LLM (comportement legacy).
 * @param {string} entityId - ID de l'entité
 * @param {string} [llmId] - ID du LLM (optionnel)
 * @returns {Promise<IAClient|null>} Client configuré ou null si aucun LLM pour l'entité
 */
async function getIAClientForEntity(entityId, llmId = null) {
  const doc = await getLLMConfigForEntity(entityId, llmId);
  if (!doc) return null;

  if (doc.server_id) {
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    let serverDoc;
    try {
      serverDoc = await serversCol.findOne({ _id: new ObjectId(doc.server_id) });
    } catch (_) {
      return null;
    }
    if (!serverDoc) return null;
    const flat = buildClientConfigFromServer(serverDoc);
    if (!flat) return null;
    const model = (doc.model && String(doc.model).trim()) || flat.model;
    const configLoader = async () => ({ config: { ...flat, model } });
    return new IAClient({
      configLoader,
      serverUrl: flat.serverUrl,
      serviceToken: flat.serviceToken,
      ollamaUrl: flat.ollamaUrl,
      model,
      timeout: doc.timeout || 60000
    });
  }

  const configLoader = async () => ({ config: doc });
  return new IAClient({
    configLoader,
    serverUrl: doc.serverUrl || process.env.IA_SERVER_URL || '',
    serviceToken: doc.serviceToken || process.env.IA_SERVICE_TOKEN || process.env.BACKENDIA_DEV_TOKEN || '',
    ollamaUrl: doc.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
    model: doc.model || process.env.OLLAMA_MODEL || 'mistral:latest',
    timeout: doc.timeout
  });
}

module.exports = {
  getLLMConfigForEntity,
  getIAClientForEntity
};
