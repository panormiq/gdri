/**
 * FICHIER : modules/chat/backend/services/runtime/resolveRuntimeConfig.js
 * RÔLE : Accès + merge defaults user→entité→global, charge ia_servers, construit IAClient.
 */

const path = require('path');
const IAClient = require(path.join(__dirname, '../../../../ia/backend/services/IAClient'));
const { buildClientConfigFromServer } = require(path.join(__dirname, '../../../../ia/backend/services/ServerConfigHelper'));
const ensureChatAccess = require('../access/ensureChatAccess');
const parseObjectId = require('../utils/parseObjectId');
const {
  COLLECTION_GLOBAL,
  COLLECTION_ENTITY,
  COLLECTION_USER
} = require('../collections');

async function resolveRuntimeConfig(database, req) {
  const access = await ensureChatAccess(database, req);
  if (!access.ok) return access;

  const { entityId, userId } = access;
  const globalCol = database.getCollection(COLLECTION_GLOBAL);
  const entityCol = database.getCollection(COLLECTION_ENTITY);
  const userCol = database.getCollection(COLLECTION_USER);

  const [globalCfg, entityCfg, userCfg] = await Promise.all([
    globalCol.findOne({ _id: 'default' }),
    entityCol.findOne({ entity_id: entityId }),
    userCol.findOne({ entity_id: entityId, user_id: userId })
  ]);

  const resolvedServerId = (userCfg && userCfg.default_server_id)
    || (entityCfg && entityCfg.default_server_id)
    || (globalCfg && globalCfg.default_server_id)
    || null;

  const resolvedModel = (userCfg && userCfg.default_model)
    || (entityCfg && entityCfg.default_model)
    || (globalCfg && globalCfg.default_model)
    || null;

  const overrideServerId = req && req.body && req.body.server_id ? String(req.body.server_id).trim() : '';
  const overrideModel = req && req.body && req.body.model ? String(req.body.model).trim() : '';

  const effectiveServerId = overrideServerId || resolvedServerId;
  const effectiveModel = overrideModel || resolvedModel;

  if (!effectiveServerId) {
    return {
      ok: false,
      status: 400,
      message: 'Aucun serveur IA par défaut configuré (user > entité > admin GDRI).'
    };
  }

  const serverOid = parseObjectId(effectiveServerId);
  if (!serverOid) {
    return { ok: false, status: 400, message: 'Identifiant serveur IA invalide.' };
  }

  const serversCol = database.getCollection('ia_servers');
  const serverDoc = await serversCol.findOne({ _id: serverOid });
  if (!serverDoc) {
    return { ok: false, status: 404, message: 'Serveur IA introuvable pour la configuration chat.' };
  }

  const flat = buildClientConfigFromServer(serverDoc);
  if (!flat) {
    return { ok: false, status: 400, message: 'Configuration serveur IA incompatible.' };
  }

  const finalModel = effectiveModel || flat.model || serverDoc.defaultModel || 'mistral:latest';
  const enabledModels = Array.isArray(serverDoc.enabledModels) ? serverDoc.enabledModels.map((x) => String(x)) : [];
  if (enabledModels.length > 0 && !enabledModels.includes(String(finalModel))) {
    return { ok: false, status: 400, message: 'Modèle non autorisé pour ce serveur IA.' };
  }
  const configLoader = async () => ({ config: { ...flat, model: finalModel } });
  const client = new IAClient({
    configLoader,
    serverUrl: flat.serverUrl,
    serviceToken: flat.serviceToken,
    ollamaUrl: flat.ollamaUrl,
    model: finalModel,
    timeout: 120000
  });

  return {
    ok: true,
    entityId,
    userId,
    client,
    serverId: effectiveServerId,
    model: finalModel,
    defaults: {
      global: globalCfg || null,
      entity: entityCfg || null,
      user: userCfg || null
    }
  };
}

module.exports = resolveRuntimeConfig;
