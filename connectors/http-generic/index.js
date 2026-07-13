/**
 * Connecteur HTTP générique — webhook, poll et emit HTTP.
 * Fichier : connectors/http-generic/index.js
 */

const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');
const { resolveDeep } = require('../../backend/core/connectors/template-resolver');

class HttpGenericConnector extends BaseConnector {
  buildAuthHeaders(ctx) {
    const creds = ctx.secrets || {};
    const headers = {};
    if (creds.bearerToken) {
      headers.Authorization = `Bearer ${creds.bearerToken}`;
    }
    if (creds.apiKeyHeader && creds.apiKeyValue) {
      headers[creds.apiKeyHeader] = creds.apiKeyValue;
    }
    if (creds.basicUser && creds.basicPass) {
      const token = Buffer.from(`${creds.basicUser}:${creds.basicPass}`).toString('base64');
      headers.Authorization = `Basic ${token}`;
    }
    return headers;
  }

  verifyWebhook(ctx, req) {
    const settings = ctx.instance.settings || {};
    const verify = settings.webhookVerify || {};
    if (!verify.type || verify.type === 'none') return true;

    if (verify.type === 'header-secret') {
      const header = String(verify.header || 'X-Webhook-Secret');
      const expected = String(verify.secret || ctx.secrets.webhookSecret || '');
      const received = String(req.headers[header.toLowerCase()] || req.headers[header] || '');
      return expected && received === expected;
    }

    return true;
  }

  async testConnection(ctx) {
    const settings = ctx.instance.settings || {};
    const url = settings.pollUrl || settings.emitUrl;
    if (!url) {
      return { success: true, message: 'Connecteur HTTP prêt (webhook push sans URL de test)' };
    }

    try {
      const response = await fetch(url, {
        method: settings.pollMethod || 'GET',
        headers: this.buildAuthHeaders(ctx)
      });
      return {
        success: response.ok,
        message: response.ok ? `HTTP ${response.status}` : `HTTP ${response.status} ${response.statusText}`
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async ingestPush(ctx, req) {
    if (!this.verifyWebhook(ctx, req)) {
      throw new Error('Webhook non autorisé');
    }

    const raw = req.body;
    const payload = Array.isArray(raw) ? raw : [raw];
    return payload.map((item) => this.normalize(item, ctx.instance.mapping, {
      source: 'http-generic',
      entrepriseId: ctx.entrepriseId,
      instanceId: ctx.instance._id,
      metadata: { mode: 'push' }
    }));
  }

  async ingestPoll(ctx, cursor) {
    const settings = ctx.instance.settings || {};
    const pollUrl = settings.pollUrl;
    if (!pollUrl) {
      return { messages: [], cursor };
    }

    const templateCtx = {
      cursor,
      settings,
      secrets: ctx.secrets,
      entrepriseId: ctx.entrepriseId
    };

    const url = resolveDeep(pollUrl, templateCtx);
    const response = await fetch(url, {
      method: settings.pollMethod || 'GET',
      headers: {
        Accept: 'application/json',
        ...this.buildAuthHeaders(ctx)
      }
    });

    if (!response.ok) {
      throw new Error(`Poll HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data)
      ? data
      : (Array.isArray(data.items) ? data.items : [data]);

    const messages = items.map((item) => this.normalize(item, ctx.instance.mapping, {
      source: 'http-generic',
      entrepriseId: ctx.entrepriseId,
      instanceId: ctx.instance._id,
      metadata: { mode: 'poll' }
    }));

    const nextCursor = data.nextCursor || data.cursor || {
      lastPollAt: new Date().toISOString()
    };

    return { messages, cursor: nextCursor };
  }

  async emit(ctx, operation, payload = {}) {
    if (operation !== 'http' && operation !== 'emit.http') {
      return super.emit(ctx, operation, payload);
    }

    const settings = ctx.instance.settings || {};
    const emitUrl = settings.emitUrl;
    if (!emitUrl) {
      return { success: false, message: 'emitUrl non configuré' };
    }

    const templateCtx = {
      message: payload.message || payload,
      action: payload,
      settings,
      secrets: ctx.secrets,
      entrepriseId: ctx.entrepriseId
    };

    const url = resolveDeep(emitUrl, templateCtx);
    const bodyTemplate = settings.emitBody || {
      text: '{{message.text}}',
      sourceRef: '{{message.sourceRef}}'
    };
    const body = resolveDeep(bodyTemplate, templateCtx);

    const response = await fetch(url, {
      method: settings.emitMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildAuthHeaders(ctx)
      },
      body: JSON.stringify(body)
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    return {
      success: response.ok,
      message: response.ok ? 'Émission HTTP OK' : `HTTP ${response.status}`,
      data
    };
  }
}

module.exports = HttpGenericConnector;
