/**
 * Routes du module Chat IA
 * Fichier : modules/chat/backend/routes.js
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const ChatService = require('./services/ChatService');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const database = require(path.join(__dirname, '../../../backend/config/database'));
const moduleRegistry = require(path.join(__dirname, '../../../backend/core/module-registry'));

let chatService = null;
function getChatService() {
  if (!chatService) chatService = new ChatService(database);
  return chatService;
}

function requireAdminGdri(req, res, next) {
  if (req.user && req.user.role === 'ADMIN_GDRI') return next();
  return res.status(403).json({ success: false, message: 'Rôle ADMIN_GDRI requis.' });
}

function requireEntityAdmin(req, res, next) {
  if (req.user && (req.user.role === 'ADMIN_GDRI' || req.user.role === 'ADMIN_ENTITY')) return next();
  return res.status(403).json({ success: false, message: 'Rôle admin entité requis.' });
}

function ensureIaModuleLoaded(req, res, next) {
  const iaModule = moduleRegistry.getModule('ia');
  if (!iaModule || iaModule.loaded !== true) {
    return res.status(503).json({
      success: false,
      message: 'Module ServerIA non disponible. Activez le module IA avant d’utiliser Chat.',
      code: 'CHAT_DEPENDENCY_IA_MISSING'
    });
  }
  return next();
}

router.get('/health', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const runtime = await getChatService().resolveRuntimeConfig(req);
    if (!runtime.ok) return res.status(runtime.status || 400).json({ success: false, message: runtime.message });
    return res.json({ success: true, data: { entity_id: runtime.entityId, user_id: runtime.userId, model: runtime.model, server_id: runtime.serverId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/bootstrap', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const runtime = await getChatService().resolveRuntimeConfig(req);
    if (!runtime.ok) return res.status(runtime.status || 400).json({ success: false, message: runtime.message });
    return res.json({ success: true, data: { entity_id: runtime.entityId, user_id: runtime.userId, default_server_id: runtime.serverId, default_model: runtime.model, defaults: runtime.defaults } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/settings/global', authenticateJWT, ensureIaModuleLoaded, requireAdminGdri, async (req, res) => {
  try {
    const doc = await database.getCollection('chat_global_settings').findOne({ _id: 'default' });
    return res.json({ success: true, data: doc || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/settings/entity', authenticateJWT, ensureIaModuleLoaded, requireEntityAdmin, async (req, res) => {
  try {
    const service = getChatService();
    const entityId = service.getEntityId(req);
    if (!entityId) return res.status(400).json({ success: false, message: 'entity_id introuvable.' });
    const doc = await database.getCollection('chat_entity_settings').findOne({ entity_id: entityId });
    return res.json({ success: true, data: doc || { entity_id: entityId, enabled: false } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/settings/user', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const service = getChatService();
    const entityId = service.getEntityId(req);
    const userId = service.getUserId(req);
    if (!entityId || !userId) return res.status(400).json({ success: false, message: 'Contexte utilisateur invalide.' });
    const doc = await database.getCollection('chat_user_settings').findOne({ entity_id: entityId, user_id: userId });
    return res.json({ success: true, data: doc || { entity_id: entityId, user_id: userId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/conversations', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const result = await getChatService().startConversation(req, req.body || {});
    if (!result.ok) return res.status(result.status || 400).json({ success: false, message: result.message });
    return res.status(201).json({ success: true, data: result.conversation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/conversations/:id', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const result = await getChatService().getConversation(req, req.params.id);
    if (!result.ok) return res.status(result.status || 400).json({ success: false, message: result.message });
    return res.json({ success: true, data: result.conversation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/conversations/:id/messages', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const result = await getChatService().sendConversationMessage(req, req.params.id, req.body || {});
    if (!result.ok) return res.status(result.status || 400).json({ success: false, message: result.message });
    return res.json({ success: true, data: { response: result.response, conversation: result.conversation, model: result.model, server_id: result.server_id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/conversations/:id/messages/stream', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    await getChatService().sendConversationMessageStream(req, res, req.params.id, req.body || {});
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Erreur serveur' })}\n\n`);
    } catch (_) {
      /* ignore */
    }
    res.end();
  }
});

// Compat legacy: message direct sans conversation explicite
router.post('/message', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const service = getChatService();
    const conv = await service.startConversation(req, { context: req.body && req.body.context ? req.body.context : '' });
    if (!conv.ok) return res.status(conv.status || 400).json({ success: false, message: conv.message });
    const result = await service.sendConversationMessage(req, conv.conversation._id, req.body || {});
    if (!result.ok) return res.status(result.status || 400).json({ success: false, message: result.message });
    return res.json({ success: true, data: { response: result.response, conversation_id: conv.conversation._id, model: result.model, server_id: result.server_id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings/global', authenticateJWT, ensureIaModuleLoaded, requireAdminGdri, async (req, res) => {
  try {
    const defaultServerId = req.body && req.body.default_server_id ? String(req.body.default_server_id).trim() : '';
    const defaultModel = req.body && req.body.default_model ? String(req.body.default_model).trim() : '';
    if (!defaultServerId) return res.status(400).json({ success: false, message: 'default_server_id requis.' });
    const col = database.getCollection('chat_global_settings');
    await col.updateOne({ _id: 'default' }, { $set: { default_server_id: defaultServerId, default_model: defaultModel, updated_at: new Date(), updated_by: req.user.user_id } }, { upsert: true });
    return res.json({ success: true, message: 'Configuration globale chat mise à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings/entity', authenticateJWT, ensureIaModuleLoaded, requireEntityAdmin, async (req, res) => {
  try {
    const service = getChatService();
    const entityId = service.getEntityId(req);
    if (!entityId) return res.status(400).json({ success: false, message: 'entity_id introuvable.' });
    const payload = req.body || {};
    const update = { entity_id: entityId, updated_at: new Date(), updated_by: req.user.user_id };
    if (payload.enabled !== undefined) update.enabled = payload.enabled === true;
    if (payload.default_server_id !== undefined) update.default_server_id = String(payload.default_server_id || '').trim();
    if (payload.default_model !== undefined) update.default_model = String(payload.default_model || '').trim();
    await database.getCollection('chat_entity_settings').updateOne({ entity_id: entityId }, { $set: update }, { upsert: true });
    return res.json({ success: true, message: 'Configuration entité chat mise à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings/user', authenticateJWT, ensureIaModuleLoaded, async (req, res) => {
  try {
    const service = getChatService();
    const entityId = service.getEntityId(req);
    const userId = service.getUserId(req);
    if (!entityId || !userId) return res.status(400).json({ success: false, message: 'Contexte utilisateur invalide.' });
    const payload = req.body || {};
    const update = { entity_id: entityId, user_id: userId, updated_at: new Date() };
    if (payload.default_server_id !== undefined) update.default_server_id = String(payload.default_server_id || '').trim();
    if (payload.default_model !== undefined) update.default_model = String(payload.default_model || '').trim();
    await database.getCollection('chat_user_settings').updateOne({ entity_id: entityId, user_id: userId }, { $set: update }, { upsert: true });
    return res.json({ success: true, message: 'Configuration utilisateur chat mise à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings/entity-user-access/:userId', authenticateJWT, ensureIaModuleLoaded, requireEntityAdmin, async (req, res) => {
  try {
    const service = getChatService();
    const entityId = service.getEntityId(req);
    const targetUserId = String(req.params.userId || '').trim();
    if (!entityId || !targetUserId) return res.status(400).json({ success: false, message: 'Paramètres invalides.' });
    const enabled = req.body && req.body.enabled === false ? false : true;
    await database.getCollection('chat_entity_user_access').updateOne(
      { entity_id: entityId, user_id: targetUserId },
      { $set: { entity_id: entityId, user_id: targetUserId, enabled, updated_at: new Date() } },
      { upsert: true }
    );
    return res.json({ success: true, message: 'Accès utilisateur mis à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/settings/entity-user-access', authenticateJWT, ensureIaModuleLoaded, requireEntityAdmin, async (req, res) => {
  try {
    const service = getChatService();
    const entityId = service.getEntityId(req);
    if (!entityId) return res.status(400).json({ success: false, message: 'entity_id introuvable.' });

    let entityOid;
    try {
      entityOid = new (require('mongodb').ObjectId)(entityId);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'entity_id invalide.' });
    }

    const usersCol = database.getCollection('users');
    const accessCol = database.getCollection('chat_entity_user_access');
    const [users, accessList] = await Promise.all([
      usersCol.find({
        $or: [
          { currentEntrepriseId: entityOid },
          { 'entreprises.entrepriseId': entityOid }
        ]
      }).project({ _id: 1, email: 1, role: 1 }).toArray(),
      accessCol.find({ entity_id: entityId }).toArray()
    ]);

    const accessMap = new Map(accessList.map((a) => [String(a.user_id), a.enabled !== false]));
    const out = users.map((u) => {
      const uid = String(u._id);
      return {
        user_id: uid,
        email: u.email || '',
        role: u.role || '',
        enabled: accessMap.has(uid) ? accessMap.get(uid) : true
      };
    });

    return res.json({ success: true, data: out });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
