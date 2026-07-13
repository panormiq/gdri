/**
 * Routes du module IA : health, config, providers, CRUD LLMs, droits utilisateur.
 * Fichier : modules/ia/backend/routes.js
 *
 * - Backoffice : se connecter à l'entité (JWT), gérer les LLMs et les droits par utilisateur.
 * - Données : collection ia_llms et ia_llm_user_rights en base principale (scopées par entity_id).
 */

const path = require('path');
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require(path.join(__dirname, '../../../backend/config/database'));
const { findEntityMemberUsers, getActiveEntityRoles, isPlatformRoleKey } = require(path.join(__dirname, '../../../backend/core/entity-member-users'));
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const iaModule = require('./index');
const providersList = require('./data/providers');
const serverPresets = require('./data/server-presets');
const { getIAClientForServer } = require('./services/ServerConfigHelper');
const moduleRegistry = require(path.join(__dirname, '../../../backend/core/module-registry'));

const CONFIG_ID = 'global';
const COLLECTION_LLMS = 'ia_llms';
const COLLECTION_RIGHTS = 'ia_llm_user_rights';
const COLLECTION_ROLE_RIGHTS = 'ia_llm_role_rights';
const COLLECTION_SERVER_USER_RIGHTS = 'ia_server_user_rights';
const COLLECTION_SERVER_ROLE_RIGHTS = 'ia_server_role_rights';
const COLLECTION_ENTITY_SETTINGS = 'ia_entity_settings';
const COLLECTION_SERVER_POLICIES = 'ia_entity_server_policies';
const COLLECTION_TOKEN_USAGE = 'ia_entity_token_usage';
const COLLECTION_SERVERS = 'ia_servers';

function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 8) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 4);
}

/**
 * Retourne l'entity_id pour la requête (backoffice scopé entité).
 * ADMIN_GDRI peut passer ?entity_id= pour agir au nom d'une entité.
 */
function getEntityId(req) {
  const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
  if (isAdminGdri && req.query && req.query.entity_id) {
    return String(req.query.entity_id).trim();
  }
  const id = req.user && (req.user.currentEntrepriseId || req.user.entrepriseId);
  return id ? (typeof id === 'string' ? id : String(id)) : null;
}

/** Exige une entité et renvoie 403 sinon */
function requireEntity(req, res, next) {
  const entityId = getEntityId(req);
  if (!entityId) {
    return res.status(403).json({
      success: false,
      message: 'Entité requise. Sélectionnez une entreprise ou fournissez entity_id (ADMIN_GDRI).'
    });
  }
  req.iaEntityId = entityId;
  next();
}

/** Admin entité ou GDRI (avec entité active) */
function requireEntityAdmin(req, res, next) {
  const role = req.user && req.user.role;
  if (role !== 'ADMIN_GDRI' && role !== 'ADMIN_ENTITY') {
    return res.status(403).json({ success: false, message: 'Admin entité requis.' });
  }
  return requireEntity(req, res, next);
}

/** Modification technique (URL, token, endpoints) : console GDRI ou serveur propre à l'entité */
function canModifyServerInfra(req, serverDoc) {
  if (!serverDoc) return false;
  if (req.user && req.user.role === 'ADMIN_GDRI') return true;
  const entityId = getEntityId(req);
  const userId = (req.user && (req.user.user_id || req.user.sub || req.user._id))
    ? String(req.user.user_id || req.user.sub || req.user._id)
    : null;
  if (serverDoc.scope === 'entity' && entityId && String(serverDoc.entity_id) === String(entityId)) {
    return true;
  }
  if (entityId && serverDoc.owner_entity_id && String(serverDoc.owner_entity_id) === String(entityId)) {
    return true;
  }
  if (serverDoc.scope === 'user' && userId && serverDoc.owner_user_id && String(serverDoc.owner_user_id) === userId) {
    return true;
  }
  return false;
}

function currentUsageMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function estimateTokenCount(prompt, responseText) {
  const p = typeof prompt === 'string' ? prompt.length : 0;
  const r = typeof responseText === 'string' ? responseText.length : 0;
  return Math.max(1, Math.ceil((p + r) / 4));
}

async function getEntityServerPolicy(entityId, serverId) {
  const policiesCol = database.getCollection(COLLECTION_SERVER_POLICIES);
  return policiesCol.findOne({
    entity_id: String(entityId),
    server_id: String(serverId)
  });
}

async function getMonthlyTokenUsage(entityId, serverId) {
  const col = database.getCollection(COLLECTION_TOKEN_USAGE);
  const doc = await col.findOne({
    entity_id: String(entityId),
    server_id: String(serverId),
    month: currentUsageMonthKey()
  });
  return doc && doc.tokens_used != null ? Number(doc.tokens_used) : 0;
}

async function incrementMonthlyTokenUsage(entityId, serverId, tokens) {
  const n = Number(tokens);
  if (!n || n <= 0) return;
  const col = database.getCollection(COLLECTION_TOKEN_USAGE);
  await col.updateOne(
    {
      entity_id: String(entityId),
      server_id: String(serverId),
      month: currentUsageMonthKey()
    },
    { $inc: { tokens_used: n }, $set: { updated_at: new Date() } },
    { upsert: true }
  );
}

/** Owner entité sur serveur global privé/dédié : gérer modèles et LLM (pas l'infra). */
function canEntityOperateOwnedServer(req, serverDoc) {
  if (!serverDoc || serverDoc.scope !== 'global') return true;
  if (req.user && req.user.role === 'ADMIN_GDRI') return true;
  const entityId = getEntityId(req);
  const isOwner = !!(entityId && serverDoc.owner_entity_id
    && String(serverDoc.owner_entity_id) === String(entityId));
  if (!isOwner) return false;
  const mode = serverDoc.mode || null;
  if (mode === 'dedicated') return true;
  if (mode === 'private' && serverDoc.allow_owner_add_llm === true) return true;
  return false;
}

function denyGlobalServerModels(res, serverDoc, req) {
  if (!serverDoc || serverDoc.scope !== 'global') return false;
  if (req.user && req.user.role === 'ADMIN_GDRI') return false;
  const mode = serverDoc.mode || null;
  if (mode === 'mutualized') {
    res.status(403).json({ success: false, message: 'Gestion des modèles interdite sur serveur mutualisé.' });
    return true;
  }
  if (!canEntityOperateOwnedServer(req, serverDoc)) {
    res.status(403).json({ success: false, message: 'Gestion des modèles réservée à l’owner du serveur ou à GDRI.' });
    return true;
  }
  return false;
}

/** Masque les champs sensibles d'un document LLM pour la réponse */
function maskLlmDoc(doc) {
  if (!doc) return null;
  const out = {
    _id: doc._id,
    entity_id: doc.entity_id,
    name: doc.name,
    provider: doc.provider,
    model: doc.model,
    is_default: !!doc.is_default,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
  if (doc.server_id != null) out.server_id = doc.server_id.toString ? doc.server_id.toString() : String(doc.server_id);
  if (doc.serverUrl != null) out.serverUrl = doc.serverUrl;
  if (doc.serviceToken != null) out.serviceToken = maskKey(doc.serviceToken);
  if (doc.ollamaUrl != null) out.ollamaUrl = doc.ollamaUrl;
  if (doc.apiKey != null) out.apiKey = maskKey(doc.apiKey);
  return out;
}

/** Vérifie que l'utilisateur est ADMIN_GDRI (super-admin) */
function requireAdminGdri(req, res, next) {
  if (req.user && req.user.role === 'ADMIN_GDRI') return next();
  return res.status(403).json({ success: false, message: 'Rôle ADMIN_GDRI requis.' });
}

/** Masque auth d'un document ia_servers pour la réponse API */
function maskServerDoc(doc) {
  if (!doc) return null;
  const out = {
    _id: doc._id,
    name: doc.name,
    provider: doc.provider,
    presetId: doc.presetId || null,
    baseUrl: doc.baseUrl || '',
    scope: doc.scope || 'global',
    entity_id: doc.entity_id || null,
    owner_user_id: doc.owner_user_id || null,
    canAddLlm: doc.canAddLlm === true,
    // Gestion plateforme / ownership
    owner_entity_id: doc.owner_entity_id || null,
    mode: doc.mode || null, // 'mutualized' | 'private' | 'dedicated' | null
    allow_owner_add_llm: doc.allow_owner_add_llm === true,
    dedicated_module_id: doc.dedicated_module_id || null, // legacy
    dedicated_module_ids: Array.isArray(doc.dedicated_module_ids)
      ? doc.dedicated_module_ids
      : (doc.dedicated_module_id ? [doc.dedicated_module_id] : []),
    allowed_entity_ids: Array.isArray(doc.allowed_entity_ids) ? doc.allowed_entity_ids : [],
    allowEntitiesToAddLlm: doc.allowEntitiesToAddLlm === true, // legacy (sera remplacé par allowed_entity_ids)
    endpoints: doc.endpoints || {},
    defaultModel: doc.defaultModel || '',
    enabledModels: Array.isArray(doc.enabledModels) ? doc.enabledModels : [],
    lastCheckedAt: doc.lastCheckedAt || null,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
  if (doc.auth) {
    out.auth = { type: doc.auth.type || 'bearer' };
    if (doc.auth.serviceToken) out.auth.serviceToken = maskKey(doc.auth.serviceToken);
    if (doc.auth.apiKey) out.auth.apiKey = maskKey(doc.auth.apiKey);
  } else {
    out.auth = null;
  }
  return out;
}

/** Filtre MongoDB pour lister les serveurs selon le rôle (global + entity + user) */
function buildServersFilter(req) {
  const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
  if (isAdminGdri) return {}; // super-admin voit tout
  const entityId = getEntityId(req);
  const userId = (req.user && (req.user.user_id || req.user.sub || req.user._id)) ? String(req.user.user_id || req.user.sub || req.user._id) : null;
  // Serveurs globaux :
  // - publics : pas d'owner_entity_id et pas de allowed_entity_ids
  // - privés : visibles seulement par owner_entity_id ou entités autorisées
  // Global visible par tous si mutualisé + * (toutes entités) OU serveur public legacy
  const globalAllEntities = { scope: 'global', mode: 'mutualized', allowed_entity_ids: '*' };
  const globalPublic = { scope: 'global', owner_entity_id: { $in: [null, undefined, ''] }, allowed_entity_ids: { $in: [null, undefined] } };
  const globalOwned = entityId ? { scope: 'global', owner_entity_id: String(entityId) } : null;
  const globalAllowed = entityId ? { scope: 'global', allowed_entity_ids: String(entityId) } : null;
  return {
    $or: [
      globalAllEntities,
      globalPublic,
      ...(globalOwned ? [globalOwned] : []),
      ...(globalAllowed ? [globalAllowed] : []),
      ...(entityId ? [{ entity_id: entityId }] : []),
      ...(userId ? [{ owner_user_id: userId }] : [])
    ].filter(Boolean)
  };
}

/** Vérifie que l'utilisateur peut accéder à ce serveur (lecture ou écriture) */
function canAccessServer(req, serverDoc) {
  if (!serverDoc) return false;
  if (req.user && req.user.role === 'ADMIN_GDRI') return true;
  const entityId = getEntityId(req);
  if (serverDoc.scope === 'global') {
    // mutualisé "toutes entités"
    if (serverDoc.mode === 'mutualized') {
      const arr = Array.isArray(serverDoc.allowed_entity_ids) ? serverDoc.allowed_entity_ids.map(String) : [];
      if (arr.includes('*')) return true;
    }
    // global public
    const hasOwner = !!(serverDoc.owner_entity_id && String(serverDoc.owner_entity_id).trim());
    const hasAllowed = Array.isArray(serverDoc.allowed_entity_ids) && serverDoc.allowed_entity_ids.length > 0;
    if (!hasOwner && !hasAllowed) return true;
    // global privé : visible uniquement owner/allowlist
    if (hasOwner && entityId && String(serverDoc.owner_entity_id) === String(entityId)) return true;
    if (hasAllowed && entityId && serverDoc.allowed_entity_ids.map(String).includes(String(entityId))) return true;
    return false;
  }
  if (serverDoc.entity_id && entityId && String(serverDoc.entity_id) === String(entityId)) return true;
  const userId = (req.user && (req.user.user_id || req.user.sub || req.user._id)) ? String(req.user.user_id || req.user.sub || req.user._id) : null;
  if (serverDoc.owner_user_id && userId && String(serverDoc.owner_user_id) === userId) return true;
  return false;
}

/** Serveur pool mutualisé offert par GDRI (non supprimable). */
function isMutualizedPlatformServer(serverDoc) {
  if (!serverDoc || serverDoc.scope !== 'global') return false;
  const mode = serverDoc.mode ? String(serverDoc.mode).trim() : '';
  if (mode === 'mutualized') return true;
  const hasOwner = !!(serverDoc.owner_entity_id && String(serverDoc.owner_entity_id).trim());
  if (!hasOwner && mode !== 'private' && mode !== 'dedicated') return true;
  return false;
}

/** Suppression : mutualisés GDRI interdits ; reste selon propriétaire / admin plateforme */
function canDeleteServer(req, serverDoc) {
  if (!serverDoc) return false;
  if (isMutualizedPlatformServer(serverDoc)) return false;
  if (req.user && req.user.role === 'ADMIN_GDRI') return true;
  const entityId = getEntityId(req);
  const userId = (req.user && (req.user.user_id || req.user.sub || req.user._id))
    ? String(req.user.user_id || req.user.sub || req.user._id)
    : null;

  if (serverDoc.scope === 'entity' && entityId && String(serverDoc.entity_id) === String(entityId)) {
    return true;
  }
  if (entityId && serverDoc.owner_entity_id && String(serverDoc.owner_entity_id) === String(entityId)) {
    return serverDoc.scope !== 'global';
  }
  if (serverDoc.scope === 'user' && userId && serverDoc.owner_user_id && String(serverDoc.owner_user_id) === userId) {
    return true;
  }
  return false;
}

/**
 * GET /api/ia/providers - Liste des fournisseurs et modèles (public pour la page config)
 */
router.get('/providers', (req, res) => {
  res.json({ success: true, providers: providersList });
});

/**
 * GET /api/ia/admin/entities - Liste des entités (ADMIN_GDRI) pour l’onglet "Entités" en admin
 */
router.get('/admin/entities', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const col = database.getCollection('entities');
    const list = await col
      .find({})
      .project({ _id: 1, name: 1, company_name: 1, label: 1 })
      .sort({ name: 1 })
      .toArray();
    res.json({
      success: true,
      entities: list.map(e => ({
        _id: e._id.toString(),
        name: e.name || e.company_name || e.label || e._id.toString()
      }))
    });
  } catch (e) {
    console.error('GET /api/ia/admin/entities:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/admin/modules - Liste des modules backend chargés (ADMIN_GDRI)
 * Utilisé pour le mode "dédié" (dédier un serveur à un module/app).
 */
router.get('/admin/modules', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    // En cas de démarrage sans discover, on force un scan opportuniste (safe).
    try { moduleRegistry.rediscover(); } catch (_) {}
    const mods = (moduleRegistry.getModules ? moduleRegistry.getModules() : []) || [];
    const list = mods
      .filter(m => m && m.enabled !== false)
      .map(m => ({
        id: m.name,
        name: m.displayName || m.name
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    res.json({ success: true, modules: list });
  } catch (e) {
    console.error('GET /api/ia/admin/modules:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------- Serveurs IA (ia_servers) : CRUD + test + models ----------

/**
 * GET /api/ia/servers/presets - Liste des presets (backoffice)
 */
router.get('/servers/presets', authenticateJWT, (req, res) => {
  res.json({ success: true, presets: serverPresets });
});

/**
 * GET /api/ia/servers - Liste des serveurs (filtrée par scope / entity / user)
 */
router.get('/servers', authenticateJWT, async (req, res) => {
  try {
    const col = database.getCollection(COLLECTION_SERVERS);
    const filter = buildServersFilter(req);
    const list = await col.find(filter).sort({ created_at: -1 }).toArray();
    res.json({ success: true, servers: list.map(maskServerDoc) });
  } catch (e) {
    console.error('GET /api/ia/servers:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /api/ia/servers - Créer un serveur (depuis preset ou manuel)
 * Body: { presetId?, name?, provider, baseUrl, auth?, endpoints?, scope?, entity_id?, owner_user_id?, defaultModel? }
 */
router.post('/servers', authenticateJWT, async (req, res) => {
  try {
    const body = req.body || {};
    const entityId = getEntityId(req);
    const userId = (req.user && (req.user.user_id || req.user.sub || req.user._id)) ? String(req.user.user_id || req.user.sub || req.user._id) : null;
    const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
    const isEntityAdmin = req.user && req.user.role === 'ADMIN_ENTITY';
    const isUserScope = body.scope === 'user';

    if (!isAdminGdri) {
      if (isUserScope) {
        if (!userId) {
          return res.status(403).json({ success: false, message: 'Utilisateur requis pour un serveur personnel.' });
        }
      } else if (isEntityAdmin && entityId) {
        body.scope = 'entity';
      } else {
        return res.status(403).json({
          success: false,
          message: 'Création réservée : admin entité (serveur entité), utilisateur (serveur perso) ou console GDRI.'
        });
      }
    }

    let doc = {};
    const presetId = body.presetId && String(body.presetId).trim();
    if (presetId) {
      const preset = serverPresets.find(p => p.id === presetId);
      if (!preset) return res.status(400).json({ success: false, message: 'Preset inconnu' });
      doc = {
        name: body.name && String(body.name).trim() ? body.name.trim() : preset.label,
        provider: preset.provider,
        presetId: preset.id,
        baseUrl: (body.baseUrl != null && String(body.baseUrl).trim()) ? String(body.baseUrl).trim() : (preset.defaults.baseUrl || ''),
        auth: body.auth != null ? body.auth : preset.defaults.auth,
        endpoints: body.endpoints != null ? body.endpoints : (preset.defaults.endpoints || {}),
        scope: body.scope || preset.scope || 'global',
        defaultModel: (body.defaultModel != null && String(body.defaultModel).trim()) ? String(body.defaultModel).trim() : (preset.defaults.defaultModel || '')
      };
    } else {
      if (!body.provider) return res.status(400).json({ success: false, message: 'provider ou presetId requis' });
      doc = {
        name: (body.name && String(body.name).trim()) || body.provider,
        provider: String(body.provider).trim(),
        presetId: null,
        baseUrl: (body.baseUrl != null && String(body.baseUrl).trim()) ? String(body.baseUrl).trim() : '',
        auth: body.auth || null,
        endpoints: body.endpoints || {},
        scope: body.scope || 'global',
        defaultModel: (body.defaultModel != null && String(body.defaultModel).trim()) ? String(body.defaultModel).trim() : ''
      };
    }

    if (doc.scope === 'global' && !isAdminGdri) doc.scope = 'entity';
    if (doc.scope === 'entity' && entityId) doc.entity_id = entityId;
    if (doc.scope === 'user' && userId) doc.owner_user_id = userId;
    doc.canAddLlm = doc.scope === 'global' ? false : (body.canAddLlm === true);

    const now = new Date();
    doc.created_at = now;
    doc.updated_at = now;

    const col = database.getCollection(COLLECTION_SERVERS);
    const result = await col.insertOne(doc);
    const inserted = await col.findOne({ _id: result.insertedId });
    res.status(201).json({ success: true, server: maskServerDoc(inserted) });
  } catch (e) {
    console.error('POST /api/ia/servers:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/servers/:id - Détail d'un serveur (si accès autorisé)
 */
router.get('/servers/:id', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });
    res.json({ success: true, server: maskServerDoc(server) });
  } catch (e) {
    console.error('GET /api/ia/servers/:id:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/servers/:id - Modifier un serveur
 */
router.put('/servers/:id', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const body = req.body || {};
    const infraKeys = ['name', 'baseUrl', 'auth', 'endpoints', 'defaultModel'];
    const touchesInfra = infraKeys.some((key) => body[key] !== undefined);
    if (touchesInfra && !canModifyServerInfra(req, server)) {
      return res.status(403).json({
        success: false,
        message: 'Modification technique réservée à la console GDRI.'
      });
    }

    const update = { updated_at: new Date() };
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.baseUrl !== undefined) update.baseUrl = String(body.baseUrl).trim();
    if (body.auth !== undefined) update.auth = body.auth;
    if (body.endpoints !== undefined) update.endpoints = body.endpoints;
    if (body.defaultModel !== undefined) update.defaultModel = String(body.defaultModel).trim();
    if (body.canAddLlm !== undefined) {
      if (server.scope === 'global') update.canAddLlm = false;
      else update.canAddLlm = body.canAddLlm === true;
    }
    if (body.allowEntitiesToAddLlm !== undefined) {
      const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
      if (!isAdminGdri) return res.status(403).json({ success: false, message: 'Rôle ADMIN_GDRI requis.' });
      // Réglage plateforme : seulement sur les serveurs globaux (offerts par GDRI)
      if (server.scope !== 'global') {
        return res.status(400).json({ success: false, message: 'allowEntitiesToAddLlm est réservé aux serveurs globaux.' });
      }
      update.allowEntitiesToAddLlm = body.allowEntitiesToAddLlm === true;
    }
    // Nouveau modèle : owner + mode + allowlist par entité (serveurs globaux)
    if (body.owner_entity_id !== undefined || body.mode !== undefined || body.allowed_entity_ids !== undefined || body.allow_owner_add_llm !== undefined) {
      const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
      if (!isAdminGdri) return res.status(403).json({ success: false, message: 'Rôle ADMIN_GDRI requis.' });
      if (server.scope !== 'global') {
        return res.status(400).json({ success: false, message: 'owner_entity_id/mode/allowed_entity_ids sont réservés aux serveurs globaux.' });
      }
      if (body.owner_entity_id !== undefined) {
        const v = body.owner_entity_id == null ? '' : String(body.owner_entity_id).trim();
        update.owner_entity_id = v || null;
      }
      if (body.mode !== undefined) {
        const m = body.mode == null ? '' : String(body.mode).trim();
        if (m && !['mutualized', 'private', 'dedicated'].includes(m)) {
          return res.status(400).json({ success: false, message: 'mode invalide (mutualized|private|dedicated)' });
        }
        update.mode = m || null;
      }
      if (body.allowed_entity_ids !== undefined) {
        if (!Array.isArray(body.allowed_entity_ids)) {
          return res.status(400).json({ success: false, message: 'allowed_entity_ids doit être un tableau' });
        }
        const cleaned = body.allowed_entity_ids.map(x => (x == null ? '' : String(x).trim())).filter(Boolean);
        update.allowed_entity_ids = Array.from(new Set(cleaned));
      }
      if (body.allow_owner_add_llm !== undefined) {
        update.allow_owner_add_llm = body.allow_owner_add_llm === true;
      }
    }

    if (body.dedicated_module_id !== undefined) {
      const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
      if (!isAdminGdri) return res.status(403).json({ success: false, message: 'Rôle ADMIN_GDRI requis.' });
      if (server.scope !== 'global') {
        return res.status(400).json({ success: false, message: 'dedicated_module_id est réservé aux serveurs globaux.' });
      }
      const v = body.dedicated_module_id == null ? '' : String(body.dedicated_module_id).trim();
      update.dedicated_module_id = v || null;
      update.dedicated_module_ids = v ? [v] : [];
    }

    if (body.dedicated_module_ids !== undefined) {
      const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
      if (!isAdminGdri) return res.status(403).json({ success: false, message: 'Rôle ADMIN_GDRI requis.' });
      if (server.scope !== 'global') {
        return res.status(400).json({ success: false, message: 'dedicated_module_ids est réservé aux serveurs globaux.' });
      }
      if (!Array.isArray(body.dedicated_module_ids)) {
        return res.status(400).json({ success: false, message: 'dedicated_module_ids doit être un tableau' });
      }
      const cleaned = body.dedicated_module_ids.map(x => (x == null ? '' : String(x).trim())).filter(Boolean);
      const uniq = Array.from(new Set(cleaned));
      update.dedicated_module_ids = uniq;
      update.dedicated_module_id = uniq.length ? uniq[0] : null; // compat
    }

    await col.updateOne({ _id: id }, { $set: update });
    const updated = await col.findOne({ _id: id });
    res.json({ success: true, server: maskServerDoc(updated) });
  } catch (e) {
    console.error('PUT /api/ia/servers/:id:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * DELETE /api/ia/servers/:id - Supprimer un serveur
 */
router.delete('/servers/:id', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (isMutualizedPlatformServer(server)) {
      return res.status(403).json({ success: false, message: 'Les serveurs mutualisés GDRI ne peuvent pas être supprimés.' });
    }
    if (!canDeleteServer(req, server)) return res.status(403).json({ success: false, message: 'Suppression non autorisée pour ce serveur' });
    await col.deleteOne({ _id: id });
    res.json({ success: true, message: 'Serveur supprimé' });
  } catch (e) {
    console.error('DELETE /api/ia/servers/:id:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/servers/:id/entity-policy - Limites entité sur un serveur GDRI
 */
router.get('/servers/:id/entity-policy', authenticateJWT, requireEntityAdmin, async (req, res) => {
  try {
    let serverObjectId;
    try { serverObjectId = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    const server = await serversCol.findOne({ _id: serverObjectId });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) {
      return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });
    }

    const entityId = req.iaEntityId;
    const policiesCol = database.getCollection(COLLECTION_SERVER_POLICIES);
    const policy = await policiesCol.findOne({
      entity_id: entityId,
      server_id: String(serverObjectId)
    });
    const tokensUsedThisMonth = await getMonthlyTokenUsage(entityId, String(serverObjectId));

    res.json({
      success: true,
      policy: {
        server_id: String(serverObjectId),
        entity_id: entityId,
        max_tokens_per_month: policy && policy.max_tokens_per_month != null ? Number(policy.max_tokens_per_month) : null,
        max_tokens_per_request: policy && policy.max_tokens_per_request != null ? Number(policy.max_tokens_per_request) : null,
        enabled: policy ? policy.enabled !== false : true,
        tokens_used_this_month: tokensUsedThisMonth,
        usage_month: currentUsageMonthKey()
      }
    });
  } catch (e) {
    console.error('GET /api/ia/servers/:id/entity-policy:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/servers/:id/entity-policy - Limites entité (tokens, activation)
 */
router.put('/servers/:id/entity-policy', authenticateJWT, requireEntityAdmin, async (req, res) => {
  try {
    let serverObjectId;
    try { serverObjectId = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    const server = await serversCol.findOne({ _id: serverObjectId });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) {
      return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });
    }

    const entityId = req.iaEntityId;
    const body = req.body || {};
    const update = {
      entity_id: entityId,
      server_id: String(serverObjectId),
      updated_at: new Date()
    };

    if (body.max_tokens_per_month !== undefined) {
      const v = body.max_tokens_per_month;
      update.max_tokens_per_month = (v === null || v === '') ? null : Math.max(0, Number(v) || 0);
    }
    if (body.max_tokens_per_request !== undefined) {
      const v = body.max_tokens_per_request;
      update.max_tokens_per_request = (v === null || v === '') ? null : Math.max(0, Number(v) || 0);
    }
    if (body.enabled !== undefined) {
      update.enabled = body.enabled !== false;
    }

    const policiesCol = database.getCollection(COLLECTION_SERVER_POLICIES);
    await policiesCol.updateOne(
      { entity_id: entityId, server_id: String(serverObjectId) },
      { $set: update },
      { upsert: true }
    );
    const saved = await policiesCol.findOne({ entity_id: entityId, server_id: String(serverObjectId) });

    res.json({
      success: true,
      policy: {
        server_id: String(serverObjectId),
        entity_id: entityId,
        max_tokens_per_month: saved && saved.max_tokens_per_month != null ? Number(saved.max_tokens_per_month) : null,
        max_tokens_per_request: saved && saved.max_tokens_per_request != null ? Number(saved.max_tokens_per_request) : null,
        enabled: saved ? saved.enabled !== false : true
      }
    });
  } catch (e) {
    console.error('PUT /api/ia/servers/:id/entity-policy:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /api/ia/servers/:id/test - Tester la connexion au serveur
 */
router.post('/servers/:id/test', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const client = getIAClientForServer(server);
    if (!client) return res.status(400).json({ success: false, message: 'Configuration serveur invalide' });
    const result = await client.testServerOnly();

    if (result && result.success) {
      await col.updateOne({ _id: id }, { $set: { lastCheckedAt: new Date(), updated_at: new Date() } });
    }
    res.json(result || { success: false, message: 'Test indéterminé' });
  } catch (e) {
    console.error('POST /api/ia/servers/:id/test:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/servers/:id/models - Liste des modèles disponibles sur ce serveur (Ollama/backendIA)
 */
router.get('/servers/:id/models', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const client = getIAClientForServer(server);
    if (!client) return res.status(400).json({ success: false, models: [], message: 'Configuration serveur invalide' });
    const result = await client.listServerModels();
    res.json(result || { success: false, models: [], message: 'Aucun modèle' });
  } catch (e) {
    console.error('GET /api/ia/servers/:id/models:', e);
    res.status(500).json({ success: false, models: [], message: e.message });
  }
});

/**
 * PUT /api/ia/servers/:id/models/enabled - Enregistrer la liste de modèles autorisés pour ce serveur
 * Body: { models: string[] }
 */
router.put('/servers/:id/models/enabled', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const { models } = req.body || {};
    if (!Array.isArray(models)) {
      return res.status(400).json({ success: false, message: 'models doit être un tableau' });
    }
    const cleaned = models
      .map(m => (m != null ? String(m).trim() : ''))
      .filter(Boolean);

    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });
    if (denyGlobalServerModels(res, server, req)) return;

    await col.updateOne(
      { _id: id },
      { $set: { enabledModels: cleaned, updated_at: new Date() } }
    );
    const updated = await col.findOne({ _id: id });
    res.json({ success: true, server: maskServerDoc(updated) });
  } catch (e) {
    console.error('PUT /api/ia/servers/:id/models/enabled:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

function httpJson(urlObj, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : null;
    const req = lib.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method,
        headers: {
          ...(dataStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dataStr, 'utf8') } : {}),
          ...headers
        },
        timeout: timeoutMs
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, raw, json: parsed });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout après ${timeoutMs}ms`));
    });
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

/**
 * POST /api/ia/servers/:id/models - Démarrer l'installation d'un modèle (pull en arrière-plan côté serveur IA)
 * Body: { model: string }. Répond immédiatement ; suivi via GET .../models/install-status?model=...
 */
router.post('/servers/:id/models', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const model = (req.body && req.body.model != null) ? String(req.body.model).trim() : '';
    if (!model) return res.status(400).json({ success: false, message: 'model est requis' });

    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });
    if (denyGlobalServerModels(res, server, req)) return;

    const baseUrl = (server.baseUrl || '').replace(/\/$/, '');
    const ep = server.endpoints && server.endpoints.modelsAdd ? String(server.endpoints.modelsAdd).trim() : '';
    if (!baseUrl || !ep) {
      return res.status(400).json({ success: false, message: 'Endpoint modelsAdd non configuré pour ce serveur' });
    }

    const url = new URL(ep, baseUrl);
    const headers = {};
    const token = server.auth && (server.auth.serviceToken || server.auth.apiKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Timeout court : le serveur IA répond tout de suite (installation en arrière-plan)
    const out = await httpJson(url, { method: 'POST', headers, body: { name: model }, timeoutMs: 20000 });
    if (!out.ok) {
      return res.status(out.statusCode || 500).json({ success: false, message: out.json?.message || out.raw || `HTTP ${out.statusCode}` });
    }
    const data = out.json || {};
    const started = data.started === true;
    res.status(started ? 202 : 200).json({
      success: true,
      started: started,
      message: data.message || (started ? 'Installation démarrée' : 'Modèle ajouté'),
      model: model,
      data: data
    });
  } catch (e) {
    console.error('POST /api/ia/servers/:id/models:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/servers/:id/models/install-status?model=xxx - État d'installation d'un modèle (pull en cours)
 */
router.get('/servers/:id/models/install-status', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const model = (req.query.model != null) ? String(req.query.model).trim() : '';
    if (!model) return res.status(400).json({ success: false, message: 'Paramètre model requis' });

    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const baseUrl = (server.baseUrl || '').replace(/\/$/, '');
    // Convention backendIA : GET /api/models/install-status?model=xxx
    const path = '/api/models/install-status?model=' + encodeURIComponent(model);
    const url = new URL(path, baseUrl);
    const headers = {};
    const token = server.auth && (server.auth.serviceToken || server.auth.apiKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const out = await httpJson(url, { method: 'GET', headers, timeoutMs: 10000 });
    if (!out.ok) {
      return res.status(out.statusCode || 500).json({ success: false, status: 'error', message: out.json?.message || out.raw || `HTTP ${out.statusCode}` });
    }
    const data = out.json || {};
    res.json({
      success: true,
      status: data.status || 'idle',
      model: data.model || model,
      completed: data.completed != null ? data.completed : 0,
      total: data.total != null ? data.total : 0,
      message: data.message || ''
    });
  } catch (e) {
    console.error('GET /api/ia/servers/:id/models/install-status:', e);
    res.status(500).json({ success: false, status: 'error', message: e.message });
  }
});

/**
 * DELETE /api/ia/servers/:id/models - Supprimer / désinstaller des modèles du serveur (ex: Ollama delete)
 * Body: { models: string[] }
 */
router.delete('/servers/:id/models', authenticateJWT, async (req, res) => {
  try {
    let id;
    try { id = new ObjectId(req.params.id); } catch (_) {
      return res.status(400).json({ success: false, message: 'ID serveur invalide' });
    }
    const models = Array.isArray(req.body?.models) ? req.body.models : [];
    const cleaned = models.map(m => (m != null ? String(m).trim() : '')).filter(Boolean);
    if (!cleaned.length) return res.status(400).json({ success: false, message: 'models est requis' });

    const col = database.getCollection(COLLECTION_SERVERS);
    const server = await col.findOne({ _id: id });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé' });
    if (denyGlobalServerModels(res, server, req)) return;

    const baseUrl = (server.baseUrl || '').replace(/\/$/, '');
    const ep = server.endpoints && server.endpoints.modelsDelete ? String(server.endpoints.modelsDelete).trim() : '';
    if (!baseUrl || !ep) {
      return res.status(400).json({ success: false, message: 'Endpoint modelsDelete non configuré pour ce serveur' });
    }
    const url = new URL(ep, baseUrl);
    const headers = {};
    const token = server.auth && (server.auth.serviceToken || server.auth.apiKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const results = [];
    for (const model of cleaned) {
      // Convention Ollama/backendIA: { name: "<model>" }
      const out = await httpJson(url, { method: 'POST', headers, body: { name: model }, timeoutMs: 600000 });
      results.push({ model, ok: out.ok, statusCode: out.statusCode, message: out.json?.message || (out.ok ? 'OK' : (out.raw || `HTTP ${out.statusCode}`)) });
    }
    const okCount = results.filter(r => r.ok).length;
    res.json({ success: okCount === results.length, results });
  } catch (e) {
    console.error('DELETE /api/ia/servers/:id/models:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/config - Récupérer la configuration IA (clés masquées)
 */
router.get('/config', authenticateJWT, async (req, res) => {
  try {
    const col = database.getCollection('ia_config');
    const doc = await col.findOne({ _id: CONFIG_ID });
    if (!doc || !doc.config) {
      return res.json({
        success: true,
        config: null,
        message: 'Aucune configuration. Utilisation des variables d\'environnement ou valeurs par défaut.'
      });
    }
    const c = doc.config;
    const out = {
      provider: c.provider,
      model: c.model,
      serverUrl: c.serverUrl || '',
      serviceToken: c.serviceToken ? maskKey(c.serviceToken) : '',
      ollamaUrl: c.ollamaUrl || '',
      apiKey: c.apiKey ? maskKey(c.apiKey) : '',
      updated_at: doc.updated_at
    };
    res.json({ success: true, config: out });
  } catch (e) {
    console.error('GET /api/ia/config:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /api/ia/config - Enregistrer la configuration IA (provider, modèle, clés)
 * Body: { provider, model, serverUrl?, serviceToken?, ollamaUrl?, apiKey? }
 */
router.post('/config', authenticateJWT, async (req, res) => {
  try {
    const { provider, model, serverUrl, serviceToken, ollamaUrl, apiKey } = req.body || {};
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'provider est requis'
      });
    }
    const col = database.getCollection('ia_config');
    const existing = await col.findOne({ _id: CONFIG_ID });
    const prevConfig = existing && existing.config ? existing.config : {};

    const config = {
      provider: String(provider),
      // le modèle par défaut global est optionnel (deprecated) : on conserve l'ancien si absent
      model: (model != null && String(model).trim() !== '') ? String(model).trim() : (prevConfig.model || ''),
      serverUrl: provider === 'ollama_server' && serverUrl != null ? String(serverUrl).trim() : (prevConfig.serverUrl || ''),
      serviceToken: (provider === 'ollama_server' && serviceToken != null && String(serviceToken).trim() !== '')
        ? String(serviceToken).trim()
        : (prevConfig.serviceToken || ''),
      ollamaUrl: provider === 'ollama_direct' && ollamaUrl != null ? String(ollamaUrl).trim() : (prevConfig.ollamaUrl || ''),
      apiKey: (['openai', 'anthropic', 'deepseek'].includes(provider) && apiKey != null && String(apiKey).trim() !== '')
        ? String(apiKey).trim()
        : (prevConfig.apiKey || '')
    };
    if (config.apiKey && (config.apiKey === '****' || config.apiKey === maskKey(prevConfig.apiKey))) {
      config.apiKey = prevConfig.apiKey || '';
    }
    if (config.serviceToken && (config.serviceToken === '****' || config.serviceToken === maskKey(prevConfig.serviceToken))) {
      config.serviceToken = prevConfig.serviceToken || '';
    }

    await col.updateOne(
      { _id: CONFIG_ID },
      { $set: { config, updated_at: new Date(), updated_by: req.user?.user_id || req.user?.sub } },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Configuration IA enregistrée',
      config: {
        provider: config.provider,
        model: config.model,
        serverUrl: config.serverUrl,
        serviceToken: config.serviceToken ? maskKey(config.serviceToken) : '',
        ollamaUrl: config.ollamaUrl,
        apiKey: config.apiKey ? maskKey(config.apiKey) : ''
      }
    });
  } catch (e) {
    console.error('POST /api/ia/config:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------- CRUD LLMs (backoffice, scopé par entité) ----------

/**
 * GET /api/ia/llms - Liste des LLMs de l'entité (JWT + entité)
 * Query: entity_id (optionnel, ADMIN_GDRI uniquement)
 */
router.get('/llms', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const col = database.getCollection(COLLECTION_LLMS);
    const list = await col.find({ entity_id: entityId }).sort({ created_at: -1 }).toArray();
    res.json({ success: true, llms: list.map(maskLlmDoc) });
  } catch (e) {
    console.error('GET /api/ia/llms:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/llms/:id - Détail d'un LLM (vérifie entity)
 */
router.get('/llms/:id', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    let id;
    try {
      id = new ObjectId(req.params.id);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'ID LLM invalide' });
    }
    const col = database.getCollection(COLLECTION_LLMS);
    const doc = await col.findOne({ _id: id, entity_id: entityId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'LLM non trouvé' });
    }
    res.json({ success: true, llm: maskLlmDoc(doc) });
  } catch (e) {
    console.error('GET /api/ia/llms/:id:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /api/ia/llms - Créer un LLM pour l'entité
 * Body (nouveau): { server_id, model, name?, is_default? }
 * Body (legacy): { name, provider, model, serverUrl?, serviceToken?, ollamaUrl?, apiKey?, is_default? }
 */
router.post('/llms', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const { name, provider, model, serverUrl, serviceToken, ollamaUrl, apiKey, is_default, server_id } = req.body || {};
    const col = database.getCollection(COLLECTION_LLMS);
    const now = new Date();
    const userId = req.user?.user_id || req.user?.sub || '';

    let doc;

    if (server_id) {
      if (!model || !String(model).trim()) {
        return res.status(400).json({ success: false, message: 'model est requis avec server_id' });
      }
      let serverOid;
      try { serverOid = new ObjectId(server_id); } catch (_) {
        return res.status(400).json({ success: false, message: 'server_id invalide' });
      }
      const serversCol = database.getCollection(COLLECTION_SERVERS);
      const server = await serversCol.findOne({ _id: serverOid });
      if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
      if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });

      // Paramètres entité : autoriser l'ajout par rôle OU par user (cas par cas)
      // (utile surtout pour serveurs "entity/user"; sur global, la règle plateforme s'applique aussi)
      const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
      if (!isAdminGdri) {
        const settingsCol = database.getCollection(COLLECTION_ENTITY_SETTINGS);
        const settings = await settingsCol.findOne({ entity_id: entityId });
        const allow = settings ? settings.allowUsersToAddLlm === true : false;
        const roleRule = settings && settings.allowUsersToAddLlmRole ? settings.allowUsersToAddLlmRole : 'admin';
        const roleIds = settings && Array.isArray(settings.allowUsersToAddLlmRoleIds) ? settings.allowUsersToAddLlmRoleIds.map(String) : [];
        const allowUserIds = settings && Array.isArray(settings.allowUsersToAddLlmUserIds) ? settings.allowUsersToAddLlmUserIds.map(String) : [];
        const reqUserId = String(userId || '');
        const isUserAllowed = reqUserId && allowUserIds.includes(reqUserId);
        const reqRole = req.user && req.user.role ? String(req.user.role) : '';
        const isRoleAllowed = (roleIds.length > 0)
          ? (reqRole && roleIds.includes(reqRole))
          : ((roleRule === 'all') ? true : (reqRole === 'ADMIN_ENTITY' || reqRole === 'ADMIN_GDRI'));

        // si le switch est off, seuls les users explicitement listés passent
        if (!allow && !isUserAllowed) {
          return res.status(403).json({ success: false, message: 'Ajout de LLM interdit pour cet utilisateur (paramètres entité).' });
        }
        // si switch on, la règle de rôle s'applique, sauf exception user
        if (allow && !isUserAllowed && !isRoleAllowed) {
          return res.status(403).json({ success: false, message: 'Ajout de LLM interdit pour ce rôle (paramètres entité).' });
        }
      }

      // Règle plateforme / ownership :
      // - mutualized : pas d'ajout LLM par l'entité
      // - dedicated : l'owner gère les modèles (console entité)
      // - private : l'owner peut ajouter si allow_owner_add_llm = true
      const entityIdForReq = req.iaEntityId;
      if (!isAdminGdri && server.scope === 'global') {
        const mode = server.mode || null;
        const isOwner = !!(server.owner_entity_id && String(server.owner_entity_id) === String(entityIdForReq));
        if (mode === 'mutualized') {
          return res.status(403).json({ success: false, message: 'Ajout de LLM interdit sur ce serveur (mutualisé).' });
        }
        if (mode === 'dedicated') {
          if (!isOwner) {
            return res.status(403).json({ success: false, message: 'Ajout de LLM interdit : seul l’owner peut gérer ce serveur dédié.' });
          }
        } else if (mode === 'private') {
          if (!isOwner) return res.status(403).json({ success: false, message: 'Ajout de LLM interdit : seul l’owner peut ajouter des modèles.' });
          if (server.allow_owner_add_llm !== true) {
            return res.status(403).json({ success: false, message: 'Ajout de LLM interdit : owner non autorisé sur ce serveur privé.' });
          }
        } else {
          // fallback legacy
          if (server.owner_entity_id) {
            if (!isOwner) return res.status(403).json({ success: false, message: 'Ajout de LLM interdit : seul l’owner peut ajouter des modèles.' });
          } else if (server.allowEntitiesToAddLlm !== true) {
            return res.status(403).json({ success: false, message: 'Ajout de LLM interdit : la plateforme n’autorise pas les entités sur ce serveur.' });
          }
        }
      }

      doc = {
        entity_id: entityId,
        name: (name && String(name).trim()) || `${server.name || server.provider} - ${model}`,
        provider: server.provider,
        model: String(model).trim(),
        server_id: serverOid,
        is_default: !!is_default,
        created_at: now,
        updated_at: now,
        created_by: userId
      };
    } else {
      if (!provider || !model) {
        return res.status(400).json({ success: false, message: 'provider et model sont requis (ou server_id + model)' });
      }
      doc = {
        entity_id: entityId,
        name: (name && String(name).trim()) || `${provider} - ${model}`,
        provider: String(provider).trim(),
        model: String(model).trim(),
        serverUrl: provider === 'ollama_server' && serverUrl != null ? String(serverUrl).trim() : '',
        serviceToken: provider === 'ollama_server' && serviceToken != null ? String(serviceToken).trim() : '',
        ollamaUrl: provider === 'ollama_direct' && ollamaUrl != null ? String(ollamaUrl).trim() : '',
        apiKey: ['openai', 'anthropic', 'deepseek'].includes(provider) && apiKey != null ? String(apiKey).trim() : '',
        is_default: !!is_default,
        created_at: now,
        updated_at: now,
        created_by: userId
      };
    }

    if (doc.is_default) {
      await col.updateMany({ entity_id: entityId }, { $set: { is_default: false, updated_at: now } });
    }

    const result = await col.insertOne(doc);
    res.status(201).json({ success: true, llm: maskLlmDoc({ ...doc, _id: result.insertedId }) });
  } catch (e) {
    console.error('POST /api/ia/llms:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/llms/:id - Modifier un LLM (vérifie entity)
 * Body: mêmes champs que POST (partiels)
 */
router.put('/llms/:id', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    let id;
    try {
      id = new ObjectId(req.params.id);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'ID LLM invalide' });
    }
    const col = database.getCollection(COLLECTION_LLMS);
    const existing = await col.findOne({ _id: id, entity_id: entityId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'LLM non trouvé' });
    }

    const { name, provider, model, serverUrl, serviceToken, ollamaUrl, apiKey, is_default, server_id } = req.body || {};
    const update = { updated_at: new Date() };
    if (name !== undefined) update.name = String(name).trim();
    if (model !== undefined) update.model = String(model).trim();
    if (is_default !== undefined) update.is_default = !!is_default;

    if (server_id !== undefined) {
      if (server_id === null || server_id === '') {
        update.server_id = null;
        if (provider !== undefined) update.provider = String(provider).trim();
      } else {
        let serverOid;
        try { serverOid = new ObjectId(server_id); } catch (_) {
          return res.status(400).json({ success: false, message: 'server_id invalide' });
        }
        const serversCol = database.getCollection(COLLECTION_SERVERS);
        const server = await serversCol.findOne({ _id: serverOid });
        if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
        if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });
        const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
        const entityIdForReq = req.iaEntityId;
        if (!isAdminGdri && server.scope === 'global') {
          const mode = server.mode || null;
          const isOwner = !!(server.owner_entity_id && String(server.owner_entity_id) === String(entityIdForReq));
          if (mode === 'mutualized') {
            return res.status(403).json({ success: false, message: 'Modification interdite sur serveur mutualisé.' });
          }
          if (mode === 'dedicated') {
            if (!isOwner) {
              return res.status(403).json({ success: false, message: 'Modification interdite : seul l’owner gère ce serveur dédié.' });
            }
          } else if (mode === 'private') {
            if (!isOwner) return res.status(403).json({ success: false, message: 'Modification interdite : seul l’owner peut modifier les modèles.' });
            if (server.allow_owner_add_llm !== true) {
              return res.status(403).json({ success: false, message: 'Modification interdite : owner non autorisé sur ce serveur privé.' });
            }
          } else {
            // fallback legacy
            if (server.owner_entity_id) {
              if (!isOwner) return res.status(403).json({ success: false, message: 'Modification interdite : seul l’owner peut modifier les modèles.' });
            } else if (server.allowEntitiesToAddLlm !== true) {
              return res.status(403).json({ success: false, message: 'Modification interdite : la plateforme n’autorise pas les entités sur ce serveur.' });
            }
          }
        }
        update.server_id = serverOid;
        update.provider = server.provider;
      }
    } else {
      if (provider !== undefined) update.provider = String(provider).trim();
      if (provider === 'ollama_server' || existing.provider === 'ollama_server') {
        if (serverUrl !== undefined) update.serverUrl = String(serverUrl).trim();
        if (serviceToken !== undefined) update.serviceToken = String(serviceToken).trim();
      }
      if (provider === 'ollama_direct' || existing.provider === 'ollama_direct') {
        if (ollamaUrl !== undefined) update.ollamaUrl = String(ollamaUrl).trim();
      }
      if (['openai', 'anthropic', 'deepseek'].includes(provider || existing.provider) && apiKey !== undefined) {
        if (apiKey !== '' && apiKey !== maskKey(existing.apiKey)) {
          update.apiKey = String(apiKey).trim();
        }
      }
    }

    if (update.is_default) {
      await col.updateMany({ entity_id: entityId, _id: { $ne: id } }, { $set: { is_default: false, updated_at: update.updated_at } });
    }

    const updateOp = { $set: update };
    if (update.server_id != null) {
      updateOp.$unset = { serverUrl: '', serviceToken: '', ollamaUrl: '', apiKey: '' };
    }
    await col.updateOne({ _id: id, entity_id: entityId }, updateOp);
    const doc = await col.findOne({ _id: id, entity_id: entityId });
    res.json({ success: true, llm: maskLlmDoc(doc) });
  } catch (e) {
    console.error('PUT /api/ia/llms/:id:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * DELETE /api/ia/llms/:id - Supprimer un LLM (vérifie entity)
 */
router.delete('/llms/:id', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    let id;
    try {
      id = new ObjectId(req.params.id);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'ID LLM invalide' });
    }
    const col = database.getCollection(COLLECTION_LLMS);
    const result = await col.deleteOne({ _id: id, entity_id: entityId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'LLM non trouvé' });
    }
    const rightsCol = database.getCollection(COLLECTION_RIGHTS);
    await rightsCol.updateMany(
      { entity_id: entityId },
      { $pull: { llm_ids: id }, $set: { updated_at: new Date() } }
    );
    res.json({ success: true, message: 'LLM supprimé' });
  } catch (e) {
    console.error('DELETE /api/ia/llms/:id:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------- Droits utilisateur par LLM (backoffice) ----------

/**
 * GET /api/ia/entity-users - Liste des utilisateurs de l'entité (pour le backoffice droits)
 * Query: entity_id (optionnel, ADMIN_GDRI)
 */
router.get('/entity-users', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const db = await database.connect();
    const usersCol = database.getCollection('users');
    const [members, entityRoles] = await Promise.all([
      findEntityMemberUsers(usersCol, entityId),
      getActiveEntityRoles(db, entityId)
    ]);
    res.json({
      success: true,
      entity_roles: entityRoles,
      users: members.map((m) => ({
        _id: m.userId,
        email: m.email,
        name: m.name,
        membership_role: m.membershipRole,
        entity_roles: m.entity_roles,
        role: m.membershipRole
      }))
    });
  } catch (e) {
    console.error('GET /api/ia/entity-users:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/entity-settings - Paramètres IA de l'entité (allowUsersToAddLlm, allowUsersToAddLlmRole)
 */
router.get('/entity-settings', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const col = database.getCollection(COLLECTION_ENTITY_SETTINGS);
    const doc = await col.findOne({ entity_id: entityId });
    res.json({
      success: true,
      allowUsersToAddLlm: doc ? doc.allowUsersToAddLlm === true : false,
      allowUsersToAddLlmRole: doc && doc.allowUsersToAddLlmRole ? doc.allowUsersToAddLlmRole : 'admin',
      allowUsersToAddLlmRoleIds: doc && Array.isArray(doc.allowUsersToAddLlmRoleIds) ? doc.allowUsersToAddLlmRoleIds : [],
      allowUsersToAddLlmUserIds: doc && Array.isArray(doc.allowUsersToAddLlmUserIds) ? doc.allowUsersToAddLlmUserIds : []
    });
  } catch (e) {
    console.error('GET /api/ia/entity-settings:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/entity-settings - Mettre à jour les paramètres IA de l'entité
 * Body: { allowUsersToAddLlm?: boolean, allowUsersToAddLlmRole?: 'admin' | 'all' }
 */
router.put('/entity-settings', authenticateJWT, requireEntityAdmin, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const body = req.body || {};
    const col = database.getCollection(COLLECTION_ENTITY_SETTINGS);
    const update = {
      entity_id: entityId,
      updated_at: new Date()
    };
    if (body.allowUsersToAddLlm !== undefined) update.allowUsersToAddLlm = body.allowUsersToAddLlm === true;
    if (body.allowUsersToAddLlmRole !== undefined) update.allowUsersToAddLlmRole = (body.allowUsersToAddLlmRole === 'all' ? 'all' : 'admin');
    if (body.allowUsersToAddLlmRoleIds !== undefined) {
      if (!Array.isArray(body.allowUsersToAddLlmRoleIds)) {
        return res.status(400).json({ success: false, message: 'allowUsersToAddLlmRoleIds doit être un tableau' });
      }
      const cleaned = body.allowUsersToAddLlmRoleIds.map(x => (x == null ? '' : String(x).trim())).filter(Boolean);
      update.allowUsersToAddLlmRoleIds = Array.from(new Set(cleaned));
    }
    if (body.allowUsersToAddLlmUserIds !== undefined) {
      if (!Array.isArray(body.allowUsersToAddLlmUserIds)) {
        return res.status(400).json({ success: false, message: 'allowUsersToAddLlmUserIds doit être un tableau' });
      }
      const cleaned = body.allowUsersToAddLlmUserIds.map(x => (x == null ? '' : String(x).trim())).filter(Boolean);
      update.allowUsersToAddLlmUserIds = Array.from(new Set(cleaned));
    }
    await col.updateOne(
      { entity_id: entityId },
      { $set: update },
      { upsert: true }
    );
    const doc = await col.findOne({ entity_id: entityId });
    res.json({
      success: true,
      allowUsersToAddLlm: doc ? doc.allowUsersToAddLlm === true : false,
      allowUsersToAddLlmRole: doc && doc.allowUsersToAddLlmRole ? doc.allowUsersToAddLlmRole : 'admin',
      allowUsersToAddLlmRoleIds: doc && Array.isArray(doc.allowUsersToAddLlmRoleIds) ? doc.allowUsersToAddLlmRoleIds : [],
      allowUsersToAddLlmUserIds: doc && Array.isArray(doc.allowUsersToAddLlmUserIds) ? doc.allowUsersToAddLlmUserIds : []
    });
  } catch (e) {
    console.error('PUT /api/ia/entity-settings:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/rights - Liste des droits LLM pour l'entité (user_id -> llm_ids)
 * Query: entity_id (optionnel, ADMIN_GDRI)
 */
router.get('/rights', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const col = database.getCollection(COLLECTION_RIGHTS);
    const list = await col.find({ entity_id: entityId }).toArray();
    res.json({
      success: true,
      rights: list.map(r => ({
        user_id: r.user_id,
        llm_ids: (r.llm_ids || []).map(oid => oid.toString()),
        updated_at: r.updated_at
      }))
    });
  } catch (e) {
    console.error('GET /api/ia/rights:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/rights/me - Droits LLM de l'utilisateur connecté pour l'entité courante (Mon compte)
 */
router.get('/rights/me', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = (req.user && (req.user.user_id || req.user.sub || req.user._id)) ? String(req.user.user_id || req.user.sub || req.user._id) : null;
    if (!userId) return res.status(401).json({ success: false, message: 'Utilisateur non identifié' });
    const col = database.getCollection(COLLECTION_RIGHTS);
    const doc = await col.findOne({ entity_id: entityId, user_id: userId });
    res.json({
      success: true,
      user_id: userId,
      llm_ids: (doc && doc.llm_ids) ? doc.llm_ids.map(oid => oid.toString()) : [],
      updated_at: doc && doc.updated_at
    });
  } catch (e) {
    console.error('GET /api/ia/rights/me:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/rights/:userId - Alias compat (redirige logique vers /rights/user/:userId)
 */
router.get('/rights/:userId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = String(req.params.userId).trim();
    const col = database.getCollection(COLLECTION_RIGHTS);
    const doc = await col.findOne({ entity_id: entityId, user_id: userId });
    res.json({
      success: true,
      user_id: userId,
      llm_ids: (doc && doc.llm_ids) ? doc.llm_ids.map(oid => oid.toString()) : [],
      updated_at: doc && doc.updated_at
    });
  } catch (e) {
    console.error('GET /api/ia/rights/:userId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/rights/user/:userId - Droits LLM d'un utilisateur pour l'entité
 */
router.get('/rights/user/:userId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = String(req.params.userId).trim();
    const col = database.getCollection(COLLECTION_RIGHTS);
    const doc = await col.findOne({ entity_id: entityId, user_id: userId });
    res.json({
      success: true,
      user_id: userId,
      llm_ids: (doc && doc.llm_ids) ? doc.llm_ids.map(oid => oid.toString()) : [],
      updated_at: doc && doc.updated_at
    });
  } catch (e) {
    console.error('GET /api/ia/rights/user/:userId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/rights/:userId - Alias compat (redirige logique vers /rights/user/:userId)
 * Body: { llm_ids: string[] }
 */
router.put('/rights/:userId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = String(req.params.userId).trim();
    const llm_ids = Array.isArray(req.body?.llm_ids) ? req.body.llm_ids : [];
    const col = database.getCollection(COLLECTION_RIGHTS);
    const oids = llm_ids.map(s => {
      try {
        return new ObjectId(s);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);

    await col.updateOne(
      { entity_id: entityId, user_id: userId },
      {
        $set: {
          llm_ids: oids,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
    res.json({
      success: true,
      user_id: userId,
      llm_ids: oids.map(oid => oid.toString()),
      message: 'Droits LLM mis à jour'
    });
  } catch (e) {
    console.error('PUT /api/ia/rights/:userId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/rights/user/:userId - Définir les LLMs autorisés pour un utilisateur
 * Body: { llm_ids: string[] } (IDs des LLMs autorisés; vide = aucun)
 */
router.put('/rights/user/:userId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = String(req.params.userId).trim();
    const llm_ids = Array.isArray(req.body?.llm_ids) ? req.body.llm_ids : [];
    const col = database.getCollection(COLLECTION_RIGHTS);
    const oids = llm_ids.map(s => {
      try {
        return new ObjectId(s);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);

    await col.updateOne(
      { entity_id: entityId, user_id: userId },
      {
        $set: {
          llm_ids: oids,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
    res.json({
      success: true,
      user_id: userId,
      llm_ids: oids.map(oid => oid.toString()),
      message: 'Droits LLM mis à jour'
    });
  } catch (e) {
    console.error('PUT /api/ia/rights/user/:userId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/rights/role/:roleId - Droits LLM d'un rôle pour l'entité
 */
router.get('/rights/role/:roleId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const roleId = String(req.params.roleId || '').trim();
    if (!roleId) return res.status(400).json({ success: false, message: 'roleId requis' });
    const col = database.getCollection(COLLECTION_ROLE_RIGHTS);
    const doc = await col.findOne({ entity_id: entityId, role_id: roleId });
    res.json({
      success: true,
      role_id: roleId,
      llm_ids: (doc && doc.llm_ids) ? doc.llm_ids.map(oid => oid.toString()) : [],
      updated_at: doc && doc.updated_at
    });
  } catch (e) {
    console.error('GET /api/ia/rights/role/:roleId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/rights/role/:roleId - Définir les LLMs autorisés pour un rôle
 * Body: { llm_ids: string[] }
 */
router.put('/rights/role/:roleId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const roleId = String(req.params.roleId || '').trim();
    if (!roleId) return res.status(400).json({ success: false, message: 'roleId requis' });
    const llm_ids = Array.isArray(req.body?.llm_ids) ? req.body.llm_ids : [];
    const col = database.getCollection(COLLECTION_ROLE_RIGHTS);
    const oids = llm_ids.map(s => {
      try {
        return new ObjectId(s);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);

    await col.updateOne(
      { entity_id: entityId, role_id: roleId },
      { $set: { llm_ids: oids, updated_at: new Date() } },
      { upsert: true }
    );

    res.json({
      success: true,
      role_id: roleId,
      llm_ids: oids.map(oid => oid.toString()),
      message: 'Droits LLM rôle mis à jour'
    });
  } catch (e) {
    console.error('PUT /api/ia/rights/role/:roleId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------- Droits par serveur + modèle (source = /servers/:id/models) ----------

/**
 * GET /api/ia/rights/server/user/:userId/:serverId
 * Retourne les modèles autorisés pour un user sur un serveur donné
 */
router.get('/rights/server/user/:userId/:serverId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = String(req.params.userId || '').trim();
    const serverId = String(req.params.serverId || '').trim();
    if (!userId || !serverId) return res.status(400).json({ success: false, message: 'userId et serverId requis' });

    let serverOid;
    try { serverOid = new ObjectId(serverId); } catch (_) {
      return res.status(400).json({ success: false, message: 'serverId invalide' });
    }
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    const server = await serversCol.findOne({ _id: serverOid });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });

    const col = database.getCollection(COLLECTION_SERVER_USER_RIGHTS);
    const doc = await col.findOne({ entity_id: entityId, user_id: userId, server_id: serverId });
    res.json({
      success: true,
      user_id: userId,
      server_id: serverId,
      model_names: (doc && Array.isArray(doc.model_names)) ? doc.model_names : [],
      updated_at: doc && doc.updated_at
    });
  } catch (e) {
    console.error('GET /api/ia/rights/server/user/:userId/:serverId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/rights/server/user/:userId/:serverId
 * Body: { model_names: string[] }
 */
router.put('/rights/server/user/:userId/:serverId', authenticateJWT, requireEntityAdmin, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const userId = String(req.params.userId || '').trim();
    const serverId = String(req.params.serverId || '').trim();
    if (!userId || !serverId) return res.status(400).json({ success: false, message: 'userId et serverId requis' });

    let serverOid;
    try { serverOid = new ObjectId(serverId); } catch (_) {
      return res.status(400).json({ success: false, message: 'serverId invalide' });
    }
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    const server = await serversCol.findOne({ _id: serverOid });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });

    const input = Array.isArray(req.body?.model_names) ? req.body.model_names : [];
    const cleaned = Array.from(new Set(input.map(x => (x == null ? '' : String(x).trim())).filter(Boolean)));
    const col = database.getCollection(COLLECTION_SERVER_USER_RIGHTS);
    await col.updateOne(
      { entity_id: entityId, user_id: userId, server_id: serverId },
      { $set: { model_names: cleaned, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({
      success: true,
      user_id: userId,
      server_id: serverId,
      model_names: cleaned,
      message: 'Droits serveur utilisateur mis à jour'
    });
  } catch (e) {
    console.error('PUT /api/ia/rights/server/user/:userId/:serverId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /api/ia/rights/server/role/:roleId/:serverId
 * Retourne les modèles autorisés pour un rôle sur un serveur donné
 */
router.get('/rights/server/role/:roleId/:serverId', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const roleId = String(req.params.roleId || '').trim();
    const serverId = String(req.params.serverId || '').trim();
    if (!roleId || !serverId) return res.status(400).json({ success: false, message: 'roleId et serverId requis' });
    if (isPlatformRoleKey(roleId)) {
      return res.status(400).json({ success: false, message: 'Rôle plateforme non autorisé dans l\'espace entité' });
    }

    let serverOid;
    try { serverOid = new ObjectId(serverId); } catch (_) {
      return res.status(400).json({ success: false, message: 'serverId invalide' });
    }
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    const server = await serversCol.findOne({ _id: serverOid });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });

    const col = database.getCollection(COLLECTION_SERVER_ROLE_RIGHTS);
    const doc = await col.findOne({ entity_id: entityId, role_id: roleId, server_id: serverId });
    res.json({
      success: true,
      role_id: roleId,
      server_id: serverId,
      model_names: (doc && Array.isArray(doc.model_names)) ? doc.model_names : [],
      updated_at: doc && doc.updated_at
    });
  } catch (e) {
    console.error('GET /api/ia/rights/server/role/:roleId/:serverId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * PUT /api/ia/rights/server/role/:roleId/:serverId
 * Body: { model_names: string[] }
 */
router.put('/rights/server/role/:roleId/:serverId', authenticateJWT, requireEntityAdmin, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const roleId = String(req.params.roleId || '').trim();
    const serverId = String(req.params.serverId || '').trim();
    if (!roleId || !serverId) return res.status(400).json({ success: false, message: 'roleId et serverId requis' });
    if (isPlatformRoleKey(roleId)) {
      return res.status(400).json({ success: false, message: 'Rôle plateforme non autorisé dans l\'espace entité' });
    }
    const db = await database.connect();
    const activeRoles = await getActiveEntityRoles(db, entityId);
    if (!activeRoles.some((r) => String(r.key) === roleId)) {
      return res.status(400).json({ success: false, message: 'Rôle métier inconnu pour cette entité' });
    }

    let serverOid;
    try { serverOid = new ObjectId(serverId); } catch (_) {
      return res.status(400).json({ success: false, message: 'serverId invalide' });
    }
    const serversCol = database.getCollection(COLLECTION_SERVERS);
    const server = await serversCol.findOne({ _id: serverOid });
    if (!server) return res.status(404).json({ success: false, message: 'Serveur non trouvé' });
    if (!canAccessServer(req, server)) return res.status(403).json({ success: false, message: 'Accès refusé à ce serveur' });

    const input = Array.isArray(req.body?.model_names) ? req.body.model_names : [];
    const cleaned = Array.from(new Set(input.map(x => (x == null ? '' : String(x).trim())).filter(Boolean)));
    const col = database.getCollection(COLLECTION_SERVER_ROLE_RIGHTS);
    await col.updateOne(
      { entity_id: entityId, role_id: roleId, server_id: serverId },
      { $set: { model_names: cleaned, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({
      success: true,
      role_id: roleId,
      server_id: serverId,
      model_names: cleaned,
      message: 'Droits serveur rôle mis à jour'
    });
  } catch (e) {
    console.error('PUT /api/ia/rights/server/role/:roleId/:serverId:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /api/ia/generate - Génération avec LLM de l'entité (usage app / autres modules)
 * Body: { prompt, llm_id?, temperature?, max_tokens?, ... }
 * Entité depuis JWT. Si aucun LLM pour l'entité, repli sur config globale.
 */
router.post('/generate', authenticateJWT, requireEntity, async (req, res) => {
  try {
    const entityId = req.iaEntityId;
    const { prompt, llm_id, temperature, max_tokens, top_p, top_k } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'prompt (string) requis' });
    }

    const llmDoc = await iaModule.getLLMConfigForEntity(entityId, llm_id || null);
    const resolvedServerId = llmDoc && llmDoc.server_id
      ? String(llmDoc.server_id)
      : null;

    const options = {};
    if (temperature != null) options.temperature = Number(temperature);
    if (max_tokens != null) options.max_tokens = Number(max_tokens);
    if (top_p != null) options.top_p = Number(top_p);
    if (top_k != null) options.top_k = Number(top_k);

    if (resolvedServerId) {
      const policy = await getEntityServerPolicy(entityId, resolvedServerId);
      if (policy && policy.enabled === false) {
        return res.status(403).json({
          success: false,
          message: 'Ce serveur IA est désactivé pour votre entité.'
        });
      }
      if (policy && policy.max_tokens_per_request != null) {
        const cap = Number(policy.max_tokens_per_request);
        if (!options.max_tokens || options.max_tokens > cap) {
          options.max_tokens = cap;
        }
      }
      if (policy && policy.max_tokens_per_month != null) {
        const monthlyCap = Number(policy.max_tokens_per_month);
        const used = await getMonthlyTokenUsage(entityId, resolvedServerId);
        if (used >= monthlyCap) {
          return res.status(429).json({
            success: false,
            message: 'Plafond mensuel de tokens atteint pour ce serveur.'
          });
        }
        const remaining = monthlyCap - used;
        if (options.max_tokens) {
          options.max_tokens = Math.min(options.max_tokens, remaining);
        } else {
          options.max_tokens = remaining;
        }
      }
    }

    let client = await iaModule.getIAClientForEntity(entityId, llm_id || null);
    if (!client) {
      client = iaModule.getIAClient();
    }
    const result = await client.generate(prompt.trim(), options);

    if (resolvedServerId && result && result.success) {
      const responseText = result.data && result.data.response ? result.data.response : '';
      const usedTokens = estimateTokenCount(prompt, responseText);
      await incrementMonthlyTokenUsage(entityId, resolvedServerId, usedTokens);
    }

    res.json(result);
  } catch (e) {
    console.error('POST /api/ia/generate:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------- SERVEUR : uniquement adresse + token, test health (pas de modèle) ----------
/**
 * GET /api/ia/server/health - Test du serveur (adresse + token).
 * Réponse immédiate : { success, message: "Serveur connecté", server: true } ou erreur.
 * Ne dépend d'aucun "modèle" : uniquement connexion au serveur.
 */
router.get('/server/health', async (req, res) => {
  try {
    const client = iaModule.getIAClient();
    const result = await client.testServerOnly();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message, server: false });
  }
});

// ---------- MODÈLES : liste des LLM disponibles (à part du serveur) ----------
/**
 * GET /api/ia/models/available - Liste des modèles disponibles (ex. depuis Ollama/backendIA).
 * Utilise la config serveur sauvegardée pour savoir où interroger. Concept "modèles", pas "serveur".
 */
router.get('/models/available', async (req, res) => {
  try {
    const client = iaModule.getIAClient();
    const result = await client.listServerModels();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, models: [], message: e.message });
  }
});

/**
 * GET /api/ia/health - Test connexion (utilise la config enregistrée ou env)
 * Pour compatibilité ; préférer GET /api/ia/server/health pour un test serveur immédiat.
 */
router.get('/health', async (req, res) => {
  try {
    const client = iaModule.getIAClient();
    const result = await client.testConnection();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
