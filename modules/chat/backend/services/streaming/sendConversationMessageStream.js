/**
 * FICHIER : modules/chat/backend/services/streaming/sendConversationMessageStream.js
 * RÔLE : Proxy SSE vers backendIA /stream, puis persiste la conversation.
 */

const http = require('http');
const https = require('https');
const resolveRuntimeConfig = require('../runtime/resolveRuntimeConfig');
const parseObjectId = require('../utils/parseObjectId');
const consumeSseBuffer = require('../utils/consumeSseBuffer');
const writeSseEvent = require('../utils/writeSseEvent');
const buildPrompt = require('../conversations/buildPrompt');
const appendConversationMessages = require('../conversations/appendConversationMessages');
const { COLLECTION_CONVERSATIONS } = require('../collections');

async function sendConversationMessageStream(database, req, res, conversationId, payload = {}) {
  const runtime = await resolveRuntimeConfig(database, req);
  if (!runtime.ok) {
    return res.status(runtime.status || 400).json({ success: false, message: runtime.message });
  }

  const oid = parseObjectId(conversationId);
  if (!oid) {
    return res.status(400).json({ success: false, message: 'conversationId invalide.' });
  }

  const userMessage = payload && payload.message ? String(payload.message).trim() : '';
  if (!userMessage) {
    return res.status(400).json({ success: false, message: 'message est requis.' });
  }

  const col = database.getCollection(COLLECTION_CONVERSATIONS);
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

  const prompt = buildPrompt({
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

  const firstByteMs = Math.max(runtime.client.timeout || 120000, 10 * 60 * 1000);
  const idleMs = runtime.client.timeout || 120000;
  const isHttps = streamUrl.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve) => {
    let buffer = '';
    let assistantAccum = '';
    let finalFull = null;
    let streamError = false;
    let gotByte = false;
    let settled = false;
    let idleTimer = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      resolve();
    };
    const armIdle = (ms, req) => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        req.destroy();
        writeSseEvent(res, {
          error: gotByte
            ? `Flux IA interrompu (aucune donnée depuis ${ms}ms)`
            : `Aucune réponse IA après ${ms}ms (chargement du modèle ?)`
        });
        res.end();
        finish();
      }, ms);
    };

    const handleSseJson = (j) => {
      if (j.token !== undefined && j.token !== null && j.token !== '') {
        assistantAccum += String(j.token);
        writeSseEvent(res, { token: String(j.token) });
      }
      if (j.error !== undefined && j.error !== null) {
        streamError = true;
        const errMsg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
        writeSseEvent(res, { error: errMsg });
      }
      if (j.done === true) {
        finalFull = j.full != null ? String(j.full) : assistantAccum;
      }
    };

    const upstreamReq = lib.request(
      {
        hostname: streamUrl.hostname,
        port: streamUrl.port || (isHttps ? 443 : 80),
        path: streamUrl.pathname + (streamUrl.search || ''),
        method: 'POST',
        headers: upstreamHeaders
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
            writeSseEvent(res, { error: msg });
            res.end();
            finish();
          });
          return;
        }

        upRes.setEncoding('utf8');
        upRes.on('data', (chunk) => {
          gotByte = true;
          armIdle(idleMs, upstreamReq);
          buffer += chunk;
          buffer = consumeSseBuffer(buffer, handleSseJson);
        });

        upRes.on('end', async () => {
          buffer = consumeSseBuffer(buffer, handleSseJson);

          if (streamError) {
            res.end();
            finish();
            return;
          }

          const assistantText =
            finalFull != null && finalFull !== '' ? finalFull : assistantAccum;

          try {
            const serialized = await appendConversationMessages(col, oid, {
              existingMessages,
              userMessage,
              assistantText,
              model: runtime.model,
              serverId: runtime.serverId
            });
            writeSseEvent(res, {
              done: true,
              conversation: serialized,
              model: runtime.model,
              server_id: runtime.serverId
            });
          } catch (e) {
            writeSseEvent(res, { error: e.message || 'Erreur persistance.' });
          }
          res.end();
          finish();
        });

        upRes.on('error', (e) => {
          writeSseEvent(res, { error: e.message || 'Flux interrompu' });
          res.end();
          finish();
        });
      }
    );

    armIdle(firstByteMs, upstreamReq);
    upstreamReq.on('error', (e) => {
      writeSseEvent(res, { error: e.message || 'Connexion serveur IA impossible' });
      res.end();
      finish();
    });
    upstreamReq.write(body);
    upstreamReq.end();
  });
}

module.exports = sendConversationMessageStream;
