/**
 * Service de chat IA : gestion conversation + résolution IA server/model.
 * Fichier : modules/chat/backend/services/ChatService.js
 */

const path = require('path');
const http = require('http');
const https = require('https');
const { ObjectId } = require('mongodb');
const IAClient = require(path.join(__dirname, '../../../ia/backend/services/IAClient'));
const { buildClientConfigFromServer } = require(path.join(__dirname, '../../../ia/backend/services/ServerConfigHelper'));

const COLLECTION_GLOBAL = 'chat_global_settings';
const COLLECTION_ENTITY = 'chat_entity_settings';
const COLLECTION_USER = 'chat_user_settings';
const COLLECTION_ENTITY_USER_ACCESS = 'chat_entity_user_access';
const COLLECTION_CONVERSATIONS = 'chat_conversations';

class ChatService {
  constructor(database) {
    this.database = database;
  }

  getEntityId(req) {
    const isAdminGdri = req.user && req.user.role === 'ADMIN_GDRI';
    if (isAdminGdri && req.query && req.query.entity_id) {
      return String(req.query.entity_id).trim();
    }
    const entityId = req.user && (req.user.currentEntrepriseId || req.user.entrepriseId);
    return entityId ? String(entityId) : null;
  }

  getUserId(req) {
    return req.user && (req.user.user_id || req.user.sub || req.user._id)
      ? String(req.user.user_id || req.user.sub || req.user._id)
      : null;
  }

  async ensureChatAccess(req) {
    const entityId = this.getEntityId(req);
    const userId = this.getUserId(req);
    if (!entityId || !userId) {
      return { ok: false, status: 403, message: 'Entité ou utilisateur non déterminé.' };
    }

    const entitiesCol = this.database.getCollection('entities');
    const servicesCol = this.database.getCollection('services');
    const userAccessCol = this.database.getCollection(COLLECTION_ENTITY_USER_ACCESS);
    const chatServiceDoc = await servicesCol.findOne({
      $or: [
        { slug: 'chat' },
        { slug: 'module-chat-ia' },
        { name: /chat/i }
      ]
    });
    const entityDoc = await entitiesCol.findOne({ _id: new ObjectId(entityId) });
    const authorized = Array.isArray(entityDoc && entityDoc.services_authorized)
      ? entityDoc.services_authorized.map((x) => String(x))
      : [];
    if (!chatServiceDoc || !authorized.includes(String(chatServiceDoc._id))) {
      return { ok: false, status: 403, message: 'Module chat non autorisé pour cette entité.' };
    }

    const explicitUserAccess = await userAccessCol.findOne({ entity_id: entityId, user_id: userId });
    if (explicitUserAccess && explicitUserAccess.enabled === false) {
      return { ok: false, status: 403, message: 'Utilisateur non autorisé à utiliser le module chat.' };
    }

    return { ok: true, entityId, userId };
  }

  async resolveRuntimeConfig(req) {
    const access = await this.ensureChatAccess(req);
    if (!access.ok) return access;

    const { entityId, userId } = access;
    const globalCol = this.database.getCollection(COLLECTION_GLOBAL);
    const entityCol = this.database.getCollection(COLLECTION_ENTITY);
    const userCol = this.database.getCollection(COLLECTION_USER);

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

    let serverOid;
    try {
      serverOid = new ObjectId(effectiveServerId);
    } catch (_) {
      return { ok: false, status: 400, message: 'Identifiant serveur IA invalide.' };
    }

    const serversCol = this.database.getCollection('ia_servers');
    const serverDoc = await serversCol.findOne({ _id: serverOid });
    if (!serverDoc) {
      return { ok: false, status: 404, message: 'Serveur IA introuvable pour la configuration chat.' };
    }

    const flat = buildClientConfigFromServer(serverDoc);
    if (!flat) {
      return { ok: false, status: 400, message: 'Configuration serveur IA incompatible.' };
    }

    let finalModel = effectiveModel || flat.model || serverDoc.defaultModel || 'mistral:latest';
    const enabledModels = Array.isArray(serverDoc.enabledModels) ? serverDoc.enabledModels.map((x) => String(x)) : [];
    if (enabledModels.length > 0 && !enabledModels.includes(String(finalModel))) {
      // Si un modèle est forcé mais non autorisé, on refuse plutôt que de surprendre.
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

  async startConversation(req, payload = {}) {
    // Autorise {server_id, model} dans le payload pour initialiser la conversation.
    if (payload && payload.server_id) req.body = { ...(req.body || {}), server_id: payload.server_id };
    if (payload && payload.model) req.body = { ...(req.body || {}), model: payload.model };
    const runtime = await this.resolveRuntimeConfig(req);
    if (!runtime.ok) return runtime;

    const now = new Date();
    const doc = {
      entity_id: runtime.entityId,
      user_id: runtime.userId,
      title: (payload.title && String(payload.title).trim()) || 'Nouvelle conversation',
      context: (payload.context && String(payload.context).trim()) || '',
      server_id: runtime.serverId,
      model: runtime.model,
      messages: [],
      created_at: now,
      updated_at: now
    };

    const col = this.database.getCollection(COLLECTION_CONVERSATIONS);
    const result = await col.insertOne(doc);
    return {
      ok: true,
      conversation: { ...doc, _id: result.insertedId.toString() }
    };
  }

  async getConversation(req, conversationId) {
    const access = await this.ensureChatAccess(req);
    if (!access.ok) return access;

    let oid;
    try {
      oid = new ObjectId(conversationId);
    } catch (_) {
      return { ok: false, status: 400, message: 'conversationId invalide.' };
    }

    const col = this.database.getCollection(COLLECTION_CONVERSATIONS);
    const doc = await col.findOne({
      _id: oid,
      entity_id: access.entityId,
      user_id: access.userId
    });
    if (!doc) {
      return { ok: false, status: 404, message: 'Conversation introuvable.' };
    }
    return { ok: true, conversation: this.serializeConversation(doc) };
  }

  serializeConversation(doc) {
    return {
      _id: doc._id.toString(),
      entity_id: doc.entity_id,
      user_id: doc.user_id,
      title: doc.title || 'Conversation',
      context: doc.context || '',
      server_id: doc.server_id || null,
      model: doc.model || null,
      messages: Array.isArray(doc.messages) ? doc.messages : [],
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  }

  buildPrompt({ context, memory, userMessage }) {
    const safeContext = (context || '').trim();
    const memoryBlock = (memory || [])
      .map((item) => `[${item.role}] ${item.content}`)
      .join('\n');
    return [
      safeContext ? `Contexte:\n${safeContext}\n` : '',
      memoryBlock ? `Historique récent:\n${memoryBlock}\n` : '',
      `Question utilisateur:\n${userMessage}`
    ].filter(Boolean).join('\n');
  }

  async sendConversationMessage(req, conversationId, payload = {}) {
    // Autorise l'override server/model par message.
    if (payload && payload.server_id) req.body = { ...(req.body || {}), server_id: payload.server_id };
    if (payload && payload.model) req.body = { ...(req.body || {}), model: payload.model };
    const runtime = await this.resolveRuntimeConfig(req);
    if (!runtime.ok) return runtime;

    let oid;
    try {
      oid = new ObjectId(conversationId);
    } catch (_) {
      return { ok: false, status: 400, message: 'conversationId invalide.' };
    }

    const userMessage = payload && payload.message ? String(payload.message).trim() : '';
    if (!userMessage) {
      return { ok: false, status: 400, message: 'message est requis.' };
    }

    const col = this.database.getCollection(COLLECTION_CONVERSATIONS);
    const conversation = await col.findOne({
      _id: oid,
      entity_id: runtime.entityId,
      user_id: runtime.userId
    });
    if (!conversation) {
      return { ok: false, status: 404, message: 'Conversation introuvable.' };
    }

    const memorySize = Number(payload.memory_size) > 0 ? Number(payload.memory_size) : 20;
    const existingMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const memory = existingMessages.slice(-memorySize);

    const prompt = this.buildPrompt({
      context: conversation.context,
      memory,
      userMessage
    });

    const generation = await runtime.client.generate(prompt, {
      model: runtime.model,
      temperature: payload.temperature != null ? Number(payload.temperature) : undefined,
      max_tokens: payload.max_tokens != null ? Number(payload.max_tokens) : undefined
    });

    if (!generation || generation.success !== true) {
      return {
        ok: false,
        status: 502,
        message: generation && generation.error && generation.error.message
          ? generation.error.message
          : 'Erreur IA pendant la génération.'
      };
    }

    const assistantText = generation.data && generation.data.response
      ? String(generation.data.response)
      : '';
    const now = new Date();
    const nextMessages = [
      ...existingMessages,
      { role: 'user', content: userMessage, created_at: now.toISOString() },
      { role: 'assistant', content: assistantText, created_at: now.toISOString() }
    ];

    await col.updateOne(
      { _id: oid },
      {
        $set: {
          messages: nextMessages,
          model: runtime.model,
          server_id: runtime.serverId,
          updated_at: now
        }
      }
    );

    const updated = await col.findOne({ _id: oid });
    return {
      ok: true,
      response: assistantText,
      conversation: this.serializeConversation(updated),
      model: runtime.model,
      server_id: runtime.serverId
    };
  }

  /**
   * Consomme un buffer SSE (événements séparés par \n\n), appelle onJson pour chaque objet data.
   * @returns {string} reste non consommé
   */
  _consumeSseBuffer(buffer, onJson) {
    let rest = buffer;
    let idx;
    while ((idx = rest.indexOf('\n\n')) >= 0) {
      const block = rest.slice(0, idx);
      rest = rest.slice(idx + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          onJson(JSON.parse(raw));
        } catch (_) {
          /* ignore */
        }
      }
    }
    return rest;
  }

  /**
   * Envoie le prompt au serveur IA en flux (SSE backendIA → SSE client), puis enregistre la conversation.
   * Réservé au provider ollama_server (backendIA).
   */
  async sendConversationMessageStream(req, res, conversationId, payload = {}) {
    const runtime = await this.resolveRuntimeConfig(req);
    if (!runtime.ok) {
      return res.status(runtime.status || 400).json({ success: false, message: runtime.message });
    }

    let oid;
    try {
      oid = new ObjectId(conversationId);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'conversationId invalide.' });
    }

    const userMessage = payload && payload.message ? String(payload.message).trim() : '';
    if (!userMessage) {
      return res.status(400).json({ success: false, message: 'message est requis.' });
    }

    const col = this.database.getCollection(COLLECTION_CONVERSATIONS);
    const conversation = await col.findOne({
      _id: oid,
      entity_id: runtime.entityId,
      user_id: runtime.userId
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    }

    const cfg = await runtime.client._getEffectiveConfig({
      model: runtime.model,
      temperature: payload.temperature != null ? Number(payload.temperature) : undefined,
      max_tokens: payload.max_tokens != null ? Number(payload.max_tokens) : undefined,
      top_p: payload.top_p != null ? Number(payload.top_p) : undefined,
      top_k: payload.top_k != null ? Number(payload.top_k) : undefined
    });

    if (cfg.provider !== 'ollama_server' || !(cfg.serverUrl && String(cfg.serverUrl).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Le mode flux nécessite un serveur IA (type backendIA / ollama_server).'
      });
    }

    const memorySize = Number(payload.memory_size) > 0 ? Number(payload.memory_size) : 20;
    const existingMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const memory = existingMessages.slice(-memorySize);

    const prompt = this.buildPrompt({
      context: conversation.context,
      memory,
      userMessage
    });

    const serverUrl = String(cfg.serverUrl).replace(/\/$/, '');
    const promptEndpoint =
      cfg.endpoints && typeof cfg.endpoints.prompt === 'string' && cfg.endpoints.prompt.trim()
        ? cfg.endpoints.prompt.trim()
        : '/api/generate';
    const streamPath =
      cfg.endpoints && typeof cfg.endpoints.promptStream === 'string' && cfg.endpoints.promptStream.trim()
        ? cfg.endpoints.promptStream.trim()
        : `${promptEndpoint.replace(/\/$/, '')}/stream`;
    const streamUrl = new URL(streamPath, serverUrl);

    const bodyObj = { prompt, model: runtime.model };
    if (payload.temperature != null) bodyObj.temperature = Number(payload.temperature);
    if (payload.max_tokens != null) bodyObj.max_tokens = Number(payload.max_tokens);
    if (payload.top_p != null) bodyObj.top_p = Number(payload.top_p);
    if (payload.top_k != null) bodyObj.top_k = Number(payload.top_k);

    const body = JSON.stringify(bodyObj);
    const serviceToken = cfg.serviceToken || '';
    const upstreamHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      Accept: 'text/event-stream'
    };
    if (serviceToken) upstreamHeaders.Authorization = `Bearer ${serviceToken}`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const timeoutMs = runtime.client.timeout || 120000;
    const isHttps = streamUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve) => {
      let buffer = '';
      let assistantAccum = '';
      let finalFull = null;
      let streamError = false;

      const upstreamReq = lib.request(
        {
          hostname: streamUrl.hostname,
          port: streamUrl.port || (isHttps ? 443 : 80),
          path: streamUrl.pathname + (streamUrl.search || ''),
          method: 'POST',
          headers: upstreamHeaders,
          timeout: timeoutMs
        },
        (upRes) => {
          if (upRes.statusCode < 200 || upRes.statusCode >= 300) {
            let errBody = '';
            upRes.setEncoding('utf8');
            upRes.on('data', (c) => {
              errBody += c;
            });
            upRes.on('end', () => {
              let msg = errBody || `Serveur IA HTTP ${upRes.statusCode}`;
              try {
                const j = JSON.parse(errBody);
                if (j.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
              } catch (_) {
                /* keep msg */
              }
              res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
              res.end();
              resolve();
            });
            return;
          }

          upRes.setEncoding('utf8');
          upRes.on('data', (chunk) => {
            buffer += chunk;
            buffer = this._consumeSseBuffer(buffer, (j) => {
              if (j.token !== undefined && j.token !== null && j.token !== '') {
                assistantAccum += String(j.token);
                res.write(`data: ${JSON.stringify({ token: String(j.token) })}\n\n`);
              }
              if (j.error !== undefined && j.error !== null) {
                streamError = true;
                const errMsg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
                res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
              }
              if (j.done === true) {
                finalFull = j.full != null ? String(j.full) : assistantAccum;
              }
            });
          });

          upRes.on('end', async () => {
            buffer = this._consumeSseBuffer(buffer, (j) => {
              if (j.token !== undefined && j.token !== null && j.token !== '') {
                assistantAccum += String(j.token);
                res.write(`data: ${JSON.stringify({ token: String(j.token) })}\n\n`);
              }
              if (j.error !== undefined && j.error !== null) {
                streamError = true;
                const errMsg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
                res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
              }
              if (j.done === true) {
                finalFull = j.full != null ? String(j.full) : assistantAccum;
              }
            });

            if (streamError) {
              res.end();
              resolve();
              return;
            }

            const assistantText =
              finalFull != null && finalFull !== '' ? finalFull : assistantAccum;
            const now = new Date();
            const nextMessages = [
              ...existingMessages,
              { role: 'user', content: userMessage, created_at: now.toISOString() },
              { role: 'assistant', content: assistantText, created_at: now.toISOString() }
            ];

            try {
              await col.updateOne(
                { _id: oid },
                {
                  $set: {
                    messages: nextMessages,
                    model: runtime.model,
                    server_id: runtime.serverId,
                    updated_at: now
                  }
                }
              );
              const updated = await col.findOne({ _id: oid });
              const serialized = this.serializeConversation(updated);
              res.write(
                `data: ${JSON.stringify({
                  done: true,
                  conversation: serialized,
                  model: runtime.model,
                  server_id: runtime.serverId
                })}\n\n`
              );
            } catch (e) {
              res.write(`data: ${JSON.stringify({ error: e.message || 'Erreur persistance.' })}\n\n`);
            }
            res.end();
            resolve();
          });

          upRes.on('error', (e) => {
            res.write(`data: ${JSON.stringify({ error: e.message || 'Flux interrompu' })}\n\n`);
            res.end();
            resolve();
          });
        }
      );

      upstreamReq.on('error', (e) => {
        res.write(`data: ${JSON.stringify({ error: e.message || 'Connexion serveur IA impossible' })}\n\n`);
        res.end();
        resolve();
      });
      upstreamReq.on('timeout', () => {
        upstreamReq.destroy();
        res.write(`data: ${JSON.stringify({ error: `Timeout après ${timeoutMs}ms` })}\n\n`);
        res.end();
        resolve();
      });
      upstreamReq.write(body);
      upstreamReq.end();
    });
  }
}

module.exports = ChatService;
