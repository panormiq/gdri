/**
 * Construit la config IAClient à partir d'un document ia_servers.
 * Fichier : modules/ia/backend/services/ServerConfigHelper.js
 */

const IAClient = require('./IAClient');

/**
 * Transforme un document ia_servers en config plate pour IAClient.
 * @param {object} serverDoc - Document de la collection ia_servers
 * @returns {object} { provider, model, serverUrl, serviceToken, ollamaUrl, apiKey }
 */
function buildClientConfigFromServer(serverDoc) {
  if (!serverDoc) return null;
  const baseUrl = (serverDoc.baseUrl || '').replace(/\/$/, '');
  const auth = serverDoc.auth || {};
  const endpoints = serverDoc.endpoints && typeof serverDoc.endpoints === 'object'
    ? { ...serverDoc.endpoints }
    : {};
  let serverUrl = '';
  let serviceToken = '';
  let ollamaUrl = '';
  let apiKey = '';
  const provider = serverDoc.provider || 'ollama_server';

  if (provider === 'ollama_server') {
    serverUrl = baseUrl;
    serviceToken = auth.serviceToken || '';
  } else if (provider === 'ollama_direct') {
    ollamaUrl = baseUrl || 'http://127.0.0.1:11434';
  } else if (['openai', 'anthropic', 'deepseek'].includes(provider)) {
    serverUrl = baseUrl;
    apiKey = auth.apiKey || '';
  }

  return {
    provider,
    model: serverDoc.defaultModel || 'mistral:latest',
    serverUrl,
    serviceToken,
    ollamaUrl,
    apiKey,
    endpoints
  };
}

/**
 * Retourne une instance IAClient configurée pour ce serveur (test, list models, etc.).
 * @param {object} serverDoc - Document ia_servers
 * @returns {IAClient|null}
 */
function getIAClientForServer(serverDoc) {
  const flat = buildClientConfigFromServer(serverDoc);
  if (!flat) return null;
  const configLoader = async () => ({ config: flat });
  return new IAClient({
    configLoader,
    serverUrl: flat.serverUrl,
    serviceToken: flat.serviceToken,
    ollamaUrl: flat.ollamaUrl,
    model: flat.model,
    timeout: 120000
  });
}

module.exports = {
  buildClientConfigFromServer,
  getIAClientForServer
};
