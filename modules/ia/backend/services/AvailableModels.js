/**
 * Catalogue des modèles utilisables par une entité : ia_llms (legacy)
 * + modèles des serveurs ia_servers (enabledModels, défaut, droits user/rôle).
 * Fichier : modules/ia/backend/services/AvailableModels.js
 */

const path = require('path');
const { ObjectId } = require('mongodb');
const database = require(path.join(__dirname, '../../../../backend/config/database'));

const COLLECTION_LLMS = 'ia_llms';
const COLLECTION_SERVERS = 'ia_servers';
const COLLECTION_SERVER_USER_RIGHTS = 'ia_server_user_rights';
const COLLECTION_SERVER_ROLE_RIGHTS = 'ia_server_role_rights';
const COLLECTION_SERVER_POLICIES = 'ia_entity_server_policies';

const SERVER_MODEL_PREFIX = 'srv:';

function entityIdVariants(entityId) {
  const raw = String(entityId || '').trim();
  const values = [raw];
  if (/^[a-fA-F0-9]{24}$/.test(raw)) {
    try { values.push(new ObjectId(raw)); } catch (_) { /* ignore */ }
  }
  return values;
}

function looksLikeObjectId(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

function encodeServerModelRef(serverId, model) {
  return SERVER_MODEL_PREFIX + String(serverId) + ':' + String(model || '').trim();
}

function parseServerModelRef(llmId) {
  const raw = String(llmId || '').trim();
  const match = raw.match(/^srv:([a-fA-F0-9]{24}):(.+)$/);
  if (!match) return null;
  const model = String(match[2] || '').trim();
  if (!model) return null;
  return { serverId: match[1], model };
}

function uniqueNames(list) {
  const out = [];
  const seen = new Set();
  (list || []).forEach((item) => {
    const name = String(item == null ? '' : item).trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  });
  return out;
}

function buildEntityServersFilter(entityId, userId) {
  const id = entityId ? String(entityId) : null;
  const globalAllEntities = { scope: 'global', mode: 'mutualized', allowed_entity_ids: '*' };
  const globalPublic = {
    scope: 'global',
    owner_entity_id: { $in: [null, undefined, ''] },
    allowed_entity_ids: { $in: [null, undefined] }
  };
  const globalOwned = id ? { scope: 'global', owner_entity_id: id } : null;
  const globalAllowed = id ? { scope: 'global', allowed_entity_ids: id } : null;
  const entityIds = id ? entityIdVariants(id) : [];
  return {
    $or: [
      globalAllEntities,
      globalPublic,
      ...(globalOwned ? [globalOwned] : []),
      ...(globalAllowed ? [globalAllowed] : []),
      ...(entityIds.length ? [{ entity_id: { $in: entityIds } }] : []),
      ...(userId ? [{ owner_user_id: String(userId) }] : [])
    ].filter(Boolean)
  };
}

function serverAccessibleToEntity(server, entityId) {
  if (!server) return false;
  const id = entityId ? String(entityId) : '';
  if (server.scope === 'global') {
    if (server.mode === 'mutualized') {
      const arr = Array.isArray(server.allowed_entity_ids) ? server.allowed_entity_ids.map(String) : [];
      if (arr.includes('*')) return true;
    }
    const hasOwner = !!(server.owner_entity_id && String(server.owner_entity_id).trim());
    const hasAllowed = Array.isArray(server.allowed_entity_ids) && server.allowed_entity_ids.length > 0;
    if (!hasOwner && !hasAllowed) return true;
    if (hasOwner && id && String(server.owner_entity_id) === id) return true;
    if (hasAllowed && id && server.allowed_entity_ids.map(String).includes(id)) return true;
    return false;
  }
  if (id && server.entity_id && entityIdVariants(id).some((v) => String(v) === String(server.entity_id))) {
    return true;
  }
  return false;
}

async function assignedModelNamesByServer(entityId) {
  const eid = String(entityId);
  const [userDocs, roleDocs] = await Promise.all([
    database.getCollection(COLLECTION_SERVER_USER_RIGHTS).find({ entity_id: eid }).toArray(),
    database.getCollection(COLLECTION_SERVER_ROLE_RIGHTS).find({ entity_id: eid }).toArray()
  ]);
  const byServer = {};
  function add(doc) {
    const sid = String(doc.server_id || '');
    if (!sid) return;
    if (!byServer[sid]) byServer[sid] = [];
    if (Array.isArray(doc.model_names)) byServer[sid].push(...doc.model_names);
  }
  userDocs.forEach(add);
  roleDocs.forEach(add);
  Object.keys(byServer).forEach((sid) => {
    byServer[sid] = uniqueNames(byServer[sid]);
  });
  return byServer;
}

function modelsForServer(server, assigned) {
  const def = String(server.defaultModel || '').trim();
  const enabled = uniqueNames(Array.isArray(server.enabledModels) ? server.enabledModels : []);
  if (enabled.length) return uniqueNames(enabled.concat(def ? [def] : []));
  return uniqueNames((assigned || []).concat(def ? [def] : []));
}

function toListItem(doc) {
  if (!doc) return null;
  const id = String(doc.id || doc._id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(doc.name || doc.model || 'LLM'),
    model: String(doc.model || ''),
    provider: String(doc.provider || ''),
    serverId: doc.server_id ? String(doc.server_id) : (doc.serverId ? String(doc.serverId) : ''),
    serverName: String(doc.serverName || doc.server_name || ''),
    isDefault: !!(doc.isDefault || doc.is_default),
    source: doc.source || (doc.server_id || doc.serverId ? 'server' : 'llm')
  };
}

async function listLegacyLlms(entityId) {
  const ids = entityIdVariants(entityId);
  const col = database.getCollection(COLLECTION_LLMS);
  const list = await col.find({
    $or: [
      { entity_id: { $in: ids } },
      { entrepriseId: { $in: ids } }
    ]
  }).sort({ is_default: -1, created_at: -1 }).toArray();
  return list.map((doc) => ({
    id: String(doc._id),
    name: String(doc.name || doc.model || 'LLM'),
    model: String(doc.model || ''),
    provider: String(doc.provider || ''),
    serverId: doc.server_id ? String(doc.server_id) : '',
    serverName: '',
    isDefault: !!doc.is_default,
    source: 'llm'
  }));
}

async function listAvailableLlms(entityId, options = {}) {
  const eid = String(entityId || '').trim();
  if (!eid) return [];
  const userId = options.userId ? String(options.userId) : null;

  const [legacy, servers, policies, assignedByServer] = await Promise.all([
    listLegacyLlms(eid),
    database.getCollection(COLLECTION_SERVERS)
      .find(buildEntityServersFilter(eid, userId))
      .sort({ created_at: -1 })
      .toArray(),
    database.getCollection(COLLECTION_SERVER_POLICIES)
      .find({ entity_id: eid })
      .toArray(),
    assignedModelNamesByServer(eid)
  ]);

  const disabledServers = new Set(
    (policies || [])
      .filter((p) => p && p.enabled === false)
      .map((p) => String(p.server_id))
  );

  const legacyKeys = new Set(
    legacy
      .filter((item) => item.serverId && item.model)
      .map((item) => item.serverId + '::' + item.model)
  );
  const serversById = {};
  servers.forEach((srv) => {
    serversById[String(srv._id)] = srv;
  });
  legacy.forEach((item) => {
    if (item.serverId && serversById[item.serverId]) {
      item.serverName = String(serversById[item.serverId].name || serversById[item.serverId].provider || '');
      item.provider = item.provider || String(serversById[item.serverId].provider || '');
    }
  });

  const virtual = [];
  for (const server of servers) {
    const serverId = String(server._id);
    if (disabledServers.has(serverId)) continue;
    if (!serverAccessibleToEntity(server, eid)
      && !(userId && String(server.owner_user_id || '') === userId)) {
      continue;
    }
    const assigned = assignedByServer[serverId] || [];
    const models = modelsForServer(server, assigned);
    const serverName = String(server.name || server.provider || 'Serveur IA');
    const defaultModel = String(server.defaultModel || '').trim();
    models.forEach((model) => {
      const key = serverId + '::' + model;
      if (legacyKeys.has(key)) return;
      virtual.push({
        id: encodeServerModelRef(serverId, model),
        name: model,
        model,
        provider: String(server.provider || ''),
        serverId,
        serverName,
        isDefault: !!defaultModel && defaultModel === model,
        source: 'server'
      });
    });
  }

  const merged = legacy.concat(virtual);
  if (!merged.some((item) => item.isDefault) && merged.length) {
    merged[0].isDefault = true;
  }
  return merged.map(toListItem).filter(Boolean);
}

async function loadServer(serverId) {
  if (!looksLikeObjectId(serverId)) return null;
  try {
    return await database.getCollection(COLLECTION_SERVERS).findOne({ _id: new ObjectId(serverId) });
  } catch (_) {
    return null;
  }
}

function syntheticDocFromServer(server, model, entityId) {
  if (!server) return null;
  const serverId = String(server._id);
  const chosen = String(model || server.defaultModel || '').trim();
  if (!chosen) return null;
  return {
    _id: encodeServerModelRef(serverId, chosen),
    entity_id: String(entityId),
    name: chosen,
    model: chosen,
    provider: server.provider || '',
    server_id: serverId,
    serverName: String(server.name || server.provider || ''),
    is_default: String(server.defaultModel || '').trim() === chosen,
    source: 'server'
  };
}

async function resolveLlmDoc(entityId, llmId = null) {
  const eid = String(entityId || '').trim();
  if (!eid) return null;
  const ids = entityIdVariants(eid);
  const col = database.getCollection(COLLECTION_LLMS);
  const entityFilter = { $or: [{ entity_id: { $in: ids } }, { entrepriseId: { $in: ids } }] };

  if (llmId) {
    const parsed = parseServerModelRef(llmId);
    if (parsed) {
      const server = await loadServer(parsed.serverId);
      const doc = syntheticDocFromServer(server, parsed.model, eid);
      if (doc) return doc;
    } else if (looksLikeObjectId(llmId)) {
      try {
        const doc = await col.findOne({ _id: new ObjectId(llmId), ...entityFilter });
        if (doc) return doc;
      } catch (_) { /* ignore */ }
      try {
        const doc = await col.findOne({ _id: new ObjectId(llmId), entity_id: eid });
        if (doc) return doc;
      } catch (_) { /* ignore */ }
    }
  }

  let doc = await col.findOne({ ...entityFilter, is_default: true });
  if (!doc) doc = await col.findOne(entityFilter, { sort: { created_at: -1 } });
  if (doc) return doc;

  const available = await listAvailableLlms(eid);
  const preferred = available.filter((item) => item.isDefault)[0] || available[0] || null;
  if (!preferred) return null;
  if (preferred.source === 'llm' && looksLikeObjectId(preferred.id)) {
    try {
      return await col.findOne({ _id: new ObjectId(preferred.id) });
    } catch (_) {
      return null;
    }
  }
  const server = await loadServer(preferred.serverId);
  return syntheticDocFromServer(server, preferred.model, eid);
}

module.exports = {
  encodeServerModelRef,
  parseServerModelRef,
  looksLikeObjectId,
  listAvailableLlms,
  resolveLlmDoc
};
