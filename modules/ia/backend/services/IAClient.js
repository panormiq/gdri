/**
 * Client IA : multi-providers (Ollama via serveur, Ollama direct, OpenAI, Anthropic, DeepSeek).
 * Config depuis DB (configLoader) ou variables d'environnement.
 * Fichier : modules/ia/backend/services/IAClient.js
 */

const http = require('http');
const https = require('https');

class IAClient {
  constructor(config = {}) {
    this.configLoader = config.configLoader || null;
    this.serverUrl = config.serverUrl || process.env.IA_SERVER_URL || '';
    this.serviceToken = config.serviceToken || process.env.IA_SERVICE_TOKEN || process.env.BACKENDIA_DEV_TOKEN || '';
    this.ollamaUrl = config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'mistral:latest';
    this.timeout = config.timeout || 300000;
  }

  async _getEffectiveConfig(options = {}) {
    let provider = options.provider;
    let model = options.model;
    let serverUrl = this.serverUrl;
    let serviceToken = this.serviceToken;
    let ollamaUrl = this.ollamaUrl;
    let apiKey = '';
    let endpoints = options.endpoints && typeof options.endpoints === 'object' ? { ...options.endpoints } : {};

    if (this.configLoader && typeof this.configLoader === 'function') {
      try {
        const doc = await this.configLoader();
        if (doc && doc.config) {
          const c = doc.config;
          provider = provider || c.provider || 'ollama_server';
          model = model || c.model || this.model;
          if (c.serverUrl) serverUrl = c.serverUrl;
          if (c.serviceToken) serviceToken = c.serviceToken;
          if (c.ollamaUrl) ollamaUrl = c.ollamaUrl;
          if (c.apiKey) apiKey = c.apiKey;
          if (c.endpoints && typeof c.endpoints === 'object') endpoints = { ...c.endpoints };
        }
      } catch (e) {
        console.warn('  ⚠️  Chargement config IA:', e.message);
      }
    }
    if (!provider) {
      provider = serverUrl && serverUrl.trim() ? 'ollama_server' : 'ollama_direct';
    }
    return { provider, model: model || this.model, serverUrl, serviceToken, ollamaUrl, apiKey, endpoints };
  }

  /**
   * Envoyer un prompt et récupérer la réponse.
   * Utilise la config DB si configLoader est défini, sinon env.
   */
  async generate(prompt, options = {}) {
    const cfg = await this._getEffectiveConfig(options);
    const model = cfg.model;
    const opts = { ...options, model };

    switch (cfg.provider) {
      case 'ollama_server':
        return this._viaServer(prompt, opts, cfg);
      case 'ollama_direct':
        return this._viaOllamaDirect(prompt, opts, cfg);
      case 'openai':
        return this._viaOpenAI(prompt, opts, cfg);
      case 'anthropic':
        return this._viaAnthropic(prompt, opts, cfg);
      case 'deepseek':
        return this._viaDeepSeek(prompt, opts, cfg);
      default:
        if (cfg.serverUrl && cfg.serverUrl.trim()) {
          return this._viaServer(prompt, opts, cfg);
        }
        return this._viaOllamaDirect(prompt, opts, cfg);
    }
  }

  async sendAnalysisPrompt(prompt, options = {}, onChunk = null) {
    return this.generate(prompt, { ...options, onChunk });
  }

  idleTimeoutMs() {
    const n = Number(this.timeout);
    return Number.isFinite(n) && n > 0 ? n : 120000;
  }

  firstByteTimeoutMs() {
    return Math.max(this.idleTimeoutMs(), 10 * 60 * 1000);
  }

  async _viaServer(prompt, options = {}, cfg = {}) {
    const serverUrl = (cfg.serverUrl || this.serverUrl).replace(/\/$/, '');
    const serviceToken = cfg.serviceToken || this.serviceToken;
    const model = options.model || this.model;
    const promptEndpoint = cfg.endpoints && typeof cfg.endpoints.prompt === 'string' && cfg.endpoints.prompt.trim()
      ? cfg.endpoints.prompt.trim()
      : '/api/generate';
    const streamPath = cfg.endpoints && typeof cfg.endpoints.promptStream === 'string' && cfg.endpoints.promptStream.trim()
      ? cfg.endpoints.promptStream.trim()
      : `${String(promptEndpoint).replace(/\/$/, '')}/stream`;
    const url = new URL(streamPath, serverUrl);
    const bodyObj = {
      prompt,
      model,
      stream: true,
      think: false
    };
    if (options.temperature !== undefined) bodyObj.temperature = options.temperature;
    if (options.max_tokens !== undefined) bodyObj.max_tokens = options.max_tokens;
    if (options.top_p !== undefined) bodyObj.top_p = options.top_p;
    if (options.top_k !== undefined) bodyObj.top_k = options.top_k;
    const body = JSON.stringify(bodyObj);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      Accept: 'text/event-stream'
    };
    if (serviceToken) headers.Authorization = `Bearer ${serviceToken}`;

    const streamed = await this._httpStream(url, { method: 'POST', headers, body }, {
      kind: 'sse',
      onChunk: options.onChunk
    });
    if (streamed.success) {
      return {
        success: true,
        data: {
          response: streamed.text,
          model: streamed.model || model,
          processing_time: streamed.processing_time,
          created_at: streamed.created_at || new Date().toISOString()
        }
      };
    }
    if (streamed.statusCode === 404 || streamed.statusCode === 405) {
      return this._viaServerBuffered(prompt, options, cfg);
    }
    return { success: false, error: { message: streamed.error || 'Flux serveur IA interrompu', details: streamed.details } };
  }

  async _viaServerBuffered(prompt, options = {}, cfg = {}) {
    const serverUrl = (cfg.serverUrl || this.serverUrl).replace(/\/$/, '');
    const serviceToken = cfg.serviceToken || this.serviceToken;
    const model = options.model || this.model;
    const promptEndpoint = cfg.endpoints && typeof cfg.endpoints.prompt === 'string' && cfg.endpoints.prompt.trim()
      ? cfg.endpoints.prompt.trim()
      : '/api/generate';
    const url = new URL(promptEndpoint, serverUrl);
    const body = JSON.stringify({
      prompt,
      model,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      top_k: options.top_k,
      stream: false,
      think: false
    });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body, 'utf8')
    };
    if (serviceToken) headers.Authorization = `Bearer ${serviceToken}`;
    return this._httpRequest(url, { method: 'POST', headers, body, timeout: this.firstByteTimeoutMs() }, (data) => {
      try {
        const parsed = JSON.parse(data);
        return {
          success: true,
          data: {
            response: parsed.response,
            model: parsed.model || model,
            processing_time: parsed.processing_time,
            created_at: parsed.created_at
          }
        };
      } catch (e) {
        return { success: false, error: { message: 'Réponse serveur IA invalide', details: data } };
      }
    });
  }

  async _viaOllamaDirect(prompt, options = {}, cfg = {}) {
    const ollamaUrl = (cfg.ollamaUrl || this.ollamaUrl).replace(/\/$/, '');
    const model = options.model || this.model;
    const payload = {
      model,
      prompt,
      stream: true,
      think: false,
      options: {}
    };
    if (options.temperature !== undefined) payload.options.temperature = options.temperature;
    if (options.max_tokens !== undefined) payload.options.num_predict = options.max_tokens;
    if (options.top_p !== undefined) payload.options.top_p = options.top_p;
    if (options.top_k !== undefined) payload.options.top_k = options.top_k;

    const url = new URL('/api/generate', ollamaUrl);
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body, 'utf8')
    };

    const streamed = await this._httpStream(url, { method: 'POST', headers, body }, {
      kind: 'ndjson',
      onChunk: options.onChunk
    });
    if (!streamed.success) {
      return { success: false, error: { message: streamed.error || 'Flux Ollama interrompu', details: streamed.details } };
    }
    return {
      success: true,
      data: {
        response: streamed.text,
        model: streamed.model || model,
        processing_time: streamed.processing_time,
        created_at: new Date().toISOString()
      }
    };
  }

  async _viaOpenAI(prompt, options = {}, cfg = {}) {
    const apiKey = cfg.apiKey;
    if (!apiKey) {
      return { success: false, error: { message: 'Clé API OpenAI non configurée' } };
    }
    const model = options.model || cfg.model || 'gpt-4o-mini';
    const url = new URL('https://api.openai.com/v1/chat/completions');
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      stream: true
    });
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      Accept: 'text/event-stream'
    };

    const streamed = await this._httpStream(url, { method: 'POST', headers, body }, {
      kind: 'openai',
      onChunk: options.onChunk
    });
    if (!streamed.success) {
      return { success: false, error: { message: streamed.error || 'Flux OpenAI interrompu', details: streamed.details } };
    }
    return {
      success: true,
      data: {
        response: streamed.text,
        model: streamed.model || model,
        processing_time: null,
        created_at: new Date().toISOString()
      }
    };
  }

  async _viaAnthropic(prompt, options = {}, cfg = {}) {
    const apiKey = cfg.apiKey;
    if (!apiKey) {
      return { success: false, error: { message: 'Clé API Anthropic non configurée' } };
    }
    const model = options.model || cfg.model || 'claude-3-5-haiku-20241022';
    const url = new URL('https://api.anthropic.com/v1/messages');
    const body = JSON.stringify({
      model,
      max_tokens: options.max_tokens ?? 2048,
      messages: [{ role: 'user', content: prompt }],
      stream: true
    });
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      Accept: 'text/event-stream'
    };

    const streamed = await this._httpStream(url, { method: 'POST', headers, body }, {
      kind: 'anthropic',
      onChunk: options.onChunk
    });
    if (!streamed.success) {
      return { success: false, error: { message: streamed.error || 'Flux Anthropic interrompu', details: streamed.details } };
    }
    return {
      success: true,
      data: {
        response: streamed.text,
        model: streamed.model || model,
        processing_time: null,
        created_at: new Date().toISOString()
      }
    };
  }

  async _viaDeepSeek(prompt, options = {}, cfg = {}) {
    const apiKey = cfg.apiKey;
    if (!apiKey) {
      return { success: false, error: { message: 'Clé API DeepSeek non configurée' } };
    }
    const model = options.model || cfg.model || 'deepseek-chat';
    const url = new URL('https://api.deepseek.com/v1/chat/completions');
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      stream: true
    });
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      Accept: 'text/event-stream'
    };

    const streamed = await this._httpStream(url, { method: 'POST', headers, body }, {
      kind: 'openai',
      onChunk: options.onChunk
    });
    if (!streamed.success) {
      return { success: false, error: { message: streamed.error || 'Flux DeepSeek interrompu', details: streamed.details } };
    }
    return {
      success: true,
      data: {
        response: streamed.text,
        model: streamed.model || model,
        processing_time: null,
        created_at: new Date().toISOString()
      }
    };
  }

  consumeSseBlocks(buffer, onJson) {
    let rest = buffer;
    let idx;
    while ((idx = rest.indexOf('\n\n')) >= 0) {
      const block = rest.slice(0, idx);
      rest = rest.slice(idx + 2);
      for (const line of block.split('\n')) {
        const trimmed = line.replace(/\r$/, '');
        if (!trimmed.startsWith('data:')) continue;
        const raw = trimmed.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          onJson(JSON.parse(raw));
        } catch (_) { /* ignore */ }
      }
    }
    return rest;
  }

  consumeNdjsonLines(buffer, onJson) {
    let rest = buffer;
    let idx;
    while ((idx = rest.indexOf('\n')) >= 0) {
      const line = rest.slice(0, idx).replace(/\r$/, '').trim();
      rest = rest.slice(idx + 1);
      if (!line) continue;
      try {
        onJson(JSON.parse(line));
      } catch (_) { /* ignore */ }
    }
    return rest;
  }

  applyStreamEvent(kind, event, acc) {
    if (!event || typeof event !== 'object') return;
    if (event.error) {
      acc.error = typeof event.error === 'string' ? event.error : JSON.stringify(event.error);
      return;
    }
    if (kind === 'sse') {
      if (event.token) {
        acc.text += String(event.token);
        if (typeof acc.onChunk === 'function') acc.onChunk(String(event.token));
      }
      if (event.done === true && event.full != null) acc.text = String(event.full);
      if (event.model) acc.model = event.model;
      if (event.processing_time != null) acc.processing_time = event.processing_time;
      return;
    }
    if (kind === 'ndjson') {
      const piece = event.response != null && String(event.response)
        ? String(event.response)
        : (event.message && event.message.content != null
          ? String(event.message.content)
          : (event.thinking != null ? String(event.thinking) : ''));
      if (piece) {
        acc.text += piece;
        if (typeof acc.onChunk === 'function') acc.onChunk(piece);
      }
      if (event.model) acc.model = event.model;
      return;
    }
    if (kind === 'openai') {
      const delta = event.choices && event.choices[0] && event.choices[0].delta
        ? event.choices[0].delta.content
        : '';
      if (delta) {
        acc.text += String(delta);
        if (typeof acc.onChunk === 'function') acc.onChunk(String(delta));
      }
      if (event.model) acc.model = event.model;
      return;
    }
    if (kind === 'anthropic') {
      const piece = event.type === 'content_block_delta' && event.delta && event.delta.text
        ? String(event.delta.text)
        : '';
      if (piece) {
        acc.text += piece;
        if (typeof acc.onChunk === 'function') acc.onChunk(piece);
      }
      if (event.message && event.message.model) acc.model = event.message.model;
    }
  }

  _httpStream(url, options, streamOpts = {}) {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const kind = streamOpts.kind || 'sse';
    const firstByteMs = this.firstByteTimeoutMs();
    const idleMs = this.idleTimeoutMs();
    return new Promise((resolve) => {
      const acc = {
        text: '',
        model: '',
        processing_time: null,
        error: null,
        onChunk: streamOpts.onChunk
      };
      let buffer = '';
      let gotByte = false;
      let settled = false;
      let idleTimer = null;
      let req = null;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        if (idleTimer) clearTimeout(idleTimer);
        resolve(payload);
      };
      const armIdle = (ms) => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (req) req.destroy();
          finish({
            success: false,
            error: gotByte
              ? `Flux IA interrompu (aucune donnée depuis ${ms}ms)`
              : `Aucune réponse IA après ${ms}ms (chargement du modèle ?)`
          });
        }, ms);
      };
      req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + (url.search || ''),
          method: options.method || 'POST',
          headers: options.headers || {}
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let errBody = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { errBody += c; });
            res.on('end', () => {
              let msg = errBody || `HTTP ${res.statusCode}`;
              try {
                const j = JSON.parse(errBody);
                if (j.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
                else if (j.message) msg = j.message;
                else if (j.error) msg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
              } catch (_) { /* keep msg */ }
              finish({
                success: false,
                statusCode: res.statusCode,
                error: msg,
                details: errBody
              });
            });
            return;
          }
          res.setEncoding('utf8');
          const onEvent = (event) => this.applyStreamEvent(kind, event, acc);
          res.on('data', (chunk) => {
            gotByte = true;
            armIdle(idleMs);
            buffer += chunk;
            if (kind === 'ndjson') buffer = this.consumeNdjsonLines(buffer, onEvent);
            else buffer = this.consumeSseBlocks(buffer, onEvent);
          });
          res.on('end', () => {
            if (kind === 'ndjson') this.consumeNdjsonLines(buffer + '\n', onEvent);
            else this.consumeSseBlocks(buffer + '\n\n', onEvent);
            if (acc.error) {
              finish({ success: false, error: acc.error, text: acc.text });
              return;
            }
            finish({
              success: true,
              text: acc.text,
              model: acc.model,
              processing_time: acc.processing_time,
              created_at: new Date().toISOString()
            });
          });
          res.on('error', (e) => {
            finish({ success: false, error: e.message || 'Flux interrompu', text: acc.text });
          });
        }
      );
      armIdle(firstByteMs);
      req.on('error', (e) => {
        finish({ success: false, error: e.message || 'Connexion serveur IA impossible' });
      });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  _httpRequest(url, options, parseResponse) {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const timeoutMs = options.timeout != null ? options.timeout : this.timeout;
    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + (url.search || ''),
          method: options.method || 'GET',
          headers: options.headers || {},
          timeout: timeoutMs
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const result = parseResponse(data);
              resolve(result);
            } else {
              resolve({
                success: false,
                error: {
                  message: `HTTP ${res.statusCode}`,
                  statusCode: res.statusCode,
                  details: data
                }
              });
            }
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout après ${timeoutMs}ms`));
      });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  /**
   * Test de connexion rapide : selon le provider, utilise un health check léger
   * au lieu d'une vraie génération (évite la lenteur du chargement/modèle).
   */
  async testConnection() {
    const cfg = await this._getEffectiveConfig({});
    const timeoutMs = Math.min(this.timeout, 8000); // max 8 s pour le test

    // backendIA : GET /health (instantané)
    if (cfg.provider === 'ollama_server' && cfg.serverUrl) {
      try {
        const url = new URL('/health', cfg.serverUrl.replace(/\/$/, ''));
        const res = await this._healthGet(url, timeoutMs);
        if (res.ok) {
          return {
            success: true,
            message: 'Connexion au serveur IA réussie',
            data: { model: cfg.model, source: 'backendIA' }
          };
        }
        return {
          success: false,
          message: res.statusCode ? `Serveur IA : HTTP ${res.statusCode}` : 'Serveur IA indisponible',
          error: { details: res.data || '' }
        };
      } catch (e) {
        return {
          success: false,
          message: e.message || 'Serveur IA injoignable',
          error: { message: e.message, details: e.toString() }
        };
      }
    }

    // Ollama direct : GET /api/tags (rapide, pas de génération)
    if (cfg.provider === 'ollama_direct' || (!cfg.provider && (cfg.ollamaUrl || this.ollamaUrl))) {
      try {
        const base = (cfg.ollamaUrl || this.ollamaUrl).replace(/\/$/, '');
        const url = new URL('/api/tags', base);
        const res = await this._healthGet(url, timeoutMs);
        if (res.ok) {
          return {
            success: true,
            message: 'Connexion à Ollama réussie',
            data: { model: cfg.model, source: 'ollama' }
          };
        }
        return {
          success: false,
          message: res.statusCode ? `Ollama : HTTP ${res.statusCode}` : 'Ollama indisponible',
          error: { details: res.data || '' }
        };
      } catch (e) {
        return {
          success: false,
          message: e.message || 'Ollama injoignable',
          error: { message: e.message, details: e.toString() }
        };
      }
    }

    // OpenAI / Anthropic / DeepSeek : pas d'endpoint health simple → garde un mini generate (court)
    const out = await this.generate('OK', { max_tokens: 5 });
    if (out.success) {
      return {
        success: true,
        message: 'Connexion IA réussie',
        data: { model: out.data?.model }
      };
    }
    return {
      success: false,
      message: out.error?.message || 'Connexion échouée',
      error: out.error
    };
  }

  _healthGet(url, timeoutMs = 8000, headers = {}) {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    return new Promise((resolve, reject) => {
      const opts = { timeout: timeoutMs };
      if (Object.keys(headers).length) opts.headers = headers;
      const req = lib.get(url.toString(), opts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          data
        }));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout après ${timeoutMs}ms`));
      });
    });
  }

  /**
   * Test uniquement le serveur (adresse + token) : health immédiat, pas de génération.
   * À utiliser pour afficher "Serveur connecté" avant de lister les modèles.
   */
  async testServerOnly() {
    const cfg = await this._getEffectiveConfig({});
    const timeoutMs = Math.min(this.timeout, 8000);

    if (cfg.provider === 'ollama_server' && cfg.serverUrl) {
      try {
        const url = new URL('/health', cfg.serverUrl.replace(/\/$/, ''));
        const headers = {};
        if (cfg.serviceToken) headers['Authorization'] = `Bearer ${cfg.serviceToken}`;
        const res = await this._healthGet(url, timeoutMs, headers);
        if (res.ok) {
          return { success: true, message: 'Serveur connecté', server: true };
        }
        return {
          success: false,
          message: res.statusCode ? `HTTP ${res.statusCode}` : 'Serveur indisponible',
          server: false
        };
      } catch (e) {
        return { success: false, message: e.message || 'Serveur injoignable', server: false };
      }
    }

    if (cfg.provider === 'ollama_direct' || (!cfg.provider && (cfg.ollamaUrl || this.ollamaUrl))) {
      try {
        const base = (cfg.ollamaUrl || this.ollamaUrl).replace(/\/$/, '');
        const url = new URL('/api/tags', base);
        const res = await this._healthGet(url, timeoutMs);
        if (res.ok) {
          return { success: true, message: 'Serveur connecté', server: true };
        }
        return {
          success: false,
          message: res.statusCode ? `HTTP ${res.statusCode}` : 'Ollama indisponible',
          server: false
        };
      } catch (e) {
        return { success: false, message: e.message || 'Ollama injoignable', server: false };
      }
    }

    return { success: false, message: 'Aucun serveur configuré (configurer adresse + token ou Ollama)', server: false };
  }

  /**
   * Liste les modèles disponibles sur le serveur (Ollama ou backendIA).
   * À appeler après testServerOnly() pour proposer "ajouter un LLM local".
   */
  async listServerModels() {
    const cfg = await this._getEffectiveConfig({});
    const timeoutMs = Math.min(this.timeout, 10000);

    if (cfg.provider === 'ollama_server' && cfg.serverUrl) {
      try {
        const url = new URL('/api/models', cfg.serverUrl.replace(/\/$/, ''));
        const headers = {};
        if (cfg.serviceToken) headers['Authorization'] = `Bearer ${cfg.serviceToken}`;
        const res = await this._healthGet(url, timeoutMs, headers);
        if (!res.ok) {
          if (res.statusCode === 401) {
            return { success: false, models: [], message: '401 : token invalide ou manquant pour BackendIA (IA_SERVICE_TOKEN / DEV_TOKEN).' };
          }
          return { success: false, models: [], message: res.statusCode ? `HTTP ${res.statusCode}` : 'Erreur' };
        }
        let data;
        try {
          data = JSON.parse(res.data);
        } catch (_) {
          return { success: false, models: [], message: 'Réponse invalide' };
        }
        const models = (data.models || []).map(m => ({ name: m.name || m, size: m.size }));
        return { success: true, models };
      } catch (e) {
        return { success: false, models: [], message: e.message || 'Serveur injoignable' };
      }
    }

    if (cfg.provider === 'ollama_direct' || (!cfg.provider && (cfg.ollamaUrl || this.ollamaUrl))) {
      try {
        const base = (cfg.ollamaUrl || this.ollamaUrl).replace(/\/$/, '');
        const url = new URL('/api/tags', base);
        const res = await this._healthGet(url, timeoutMs);
        if (!res.ok) {
          return { success: false, models: [], message: res.statusCode ? `HTTP ${res.statusCode}` : 'Erreur' };
        }
        let data;
        try {
          data = JSON.parse(res.data);
        } catch (_) {
          return { success: false, models: [], message: 'Réponse invalide' };
        }
        const models = (data.models || []).map(m => ({ name: m.name || m, size: m.size }));
        return { success: true, models };
      } catch (e) {
        return { success: false, models: [], message: e.message || 'Ollama injoignable' };
      }
    }

    return { success: false, models: [], message: 'Aucun serveur local configuré' };
  }
}

module.exports = IAClient;
