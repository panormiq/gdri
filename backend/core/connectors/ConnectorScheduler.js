/**
 * Planificateur de poll pour instances connecteur.
 * Fichier : backend/core/connectors/ConnectorScheduler.js
 */

const { ConnectorInstanceService } = require('./ConnectorInstanceService');
const { ConnectorRuntime } = require('./ConnectorRuntime');
const { findStartTriggerNodes } = require('../agent-flow/triggerMatch');

const TICK_MS = 60 * 1000;

class ConnectorScheduler {
  constructor(database) {
    this.database = database;
    this.instanceService = new ConnectorInstanceService(database);
    this.runtime = new ConnectorRuntime(database);
    this.timer = null;
    this._running = false;
    this._lastPollByInstance = new Map();
  }

  async init() {
    await this.instanceService.ensureIndexes();
  }

  start() {
    if (process.env.CONNECTOR_SCHEDULER_DISABLED === 'true') {
      console.log('🔌 ConnectorScheduler : désactivé (CONNECTOR_SCHEDULER_DISABLED)');
      return;
    }
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('ConnectorScheduler tick:', err.message));
    }, TICK_MS);
    console.log('🔌 ConnectorScheduler : actif (vérif. poll chaque minute)');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getPollIntervalMinutes(instance) {
    const settings = instance.settings || {};
    const raw = Number(settings.pollIntervalMinutes);
    if (Number.isFinite(raw) && raw >= 1) return raw;
    return 5;
  }

  shouldPollNow(instance) {
    const id = String(instance._id);
    const intervalMs = this.getPollIntervalMinutes(instance) * 60 * 1000;
    const last = this._lastPollByInstance.get(id) || 0;
    return Date.now() - last >= intervalMs;
  }

  async tick() {
    if (this._running) return;
    this._running = true;
    try {
      const instances = await this.instanceService.listPollable();
      for (const instance of instances) {
        if (!this.shouldPollNow(instance)) continue;
        await this.pollInstance(instance);
      }
    } finally {
      this._running = false;
    }
  }

  /**
   * @param {Object} instance
   * @returns {Promise<{success:boolean, messages:Object[], cursor:Object|null}>}
   */
  async pollInstance(instance) {
    const id = String(instance._id);
    this._lastPollByInstance.set(id, Date.now());

    try {
      const result = await this.runtime.ingestPoll(instance);
      if (result.cursor != null) {
        await this.instanceService.updateCursor(instance._id, result.cursor);
      }

      if (result.messages.length > 0) {
        console.log(`  🔌 Poll ${instance.connectorId} [${instance.name}] : ${result.messages.length} message(s)`);
        if (instance.connectorId === 'mail-in') {
          await this.dispatchMailInToFlows(instance, result.messages);
        } else if (instance.connectorId === 'facebook') {
          await this.dispatchFacebookToFlows(instance, result.messages);
        } else {
          await this.dispatchGenericToFlows(instance, result.messages, { triggerMode: 'polling' });
        }
      }

      return { success: true, messages: result.messages, cursor: result.cursor };
    } catch (error) {
      console.error(`  ❌ Poll connecteur ${instance.connectorId} (${instance.name}):`, error.message);
      return { success: false, messages: [], cursor: instance.cursor, error: error.message };
    }
  }

  /**
   * Webhook / push : démarre les agents liés à cette instance.
   */
  async dispatchPushToFlows(instance, messages) {
    if (!instance || !messages || !messages.length) return;
    if (instance.connectorId === 'facebook') {
      return this.dispatchFacebookToFlows(instance, messages, { triggerMode: 'webhook' });
    }
    if (instance.connectorId === 'mail-in') {
      return this.dispatchMailInToFlows(instance, messages, { triggerMode: 'webhook' });
    }
    return this.dispatchGenericToFlows(instance, messages, { triggerMode: 'webhook' });
  }

  async executeFlowForConnector(executor, flow, { triggerMode, triggeredBy, triggerPayload }) {
    const payload = triggerPayload || {};
    const starts = findStartTriggerNodes(flow, {
      triggerNodeId: payload.triggerNodeId,
      triggerMode,
      instanceId: payload.instanceId,
      pageId: payload.pageId,
      accountRef: payload.accountRef
    });
    if (!starts.length) return;
    for (const start of starts) {
      await executor.execute(flow, {
        triggerMode,
        triggeredBy,
        triggerPayload: {
          ...payload,
          triggerBrickId: payload.triggerBrickId || 'trigger',
          triggerNodeId: start.id
        }
      });
    }
  }

  async dispatchGenericToFlows(instance, messages, { triggerMode = 'webhook' } = {}) {
    try {
      const { AgentFlowService } = require('../agent-flow/AgentFlowService');
      const { FlowExecutor } = require('../agent-flow/FlowExecutor');
      const { providerFromConnectorId } = require('../agent-flow/channelFromConnector');
      const flowService = new AgentFlowService(this.database);
      const executor = new FlowExecutor(this.database);
      const channel = providerFromConnectorId(instance.connectorId);

      const flows = await flowService.listFlowsBoundToInstance(instance.entrepriseId, instance);
      if (!flows.length) {
        console.log(`  ℹ️ Aucun agent lié au webhook ${instance.connectorId} [${instance.name}]`);
        return;
      }

      for (const raw of messages) {
        const message = this.normalizeGenericMessage(raw, channel);
        for (const flow of flows) {
          try {
            await this.executeFlowForConnector(executor, flow, {
              triggerMode,
              triggeredBy: `connector:${instance._id}`,
              triggerPayload: {
                message,
                instanceId: String(instance._id),
                triggerBrickId: 'trigger',
                options: { channel }
              }
            });
          } catch (err) {
            console.error(`  ❌ Flow ${flow.name} (${flow._id}):`, err.message);
          }
        }
      }
    } catch (error) {
      console.error('  ❌ dispatchGenericToFlows:', error.message);
    }
  }

  normalizeGenericMessage(raw, channel) {
    if (!raw || typeof raw !== 'object') {
      return { text: String(raw || ''), subject: '', from: '', channel };
    }
    const author = raw.author && typeof raw.author === 'object' ? raw.author : {};
    return {
      text: String(raw.text || raw.body || ''),
      subject: String(raw.subject || (raw.metadata && raw.metadata.subject) || ''),
      from: String(author.email || author.name || raw.from || ''),
      messageId: raw.sourceRef || raw.id || null,
      channel,
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
      author,
      raw
    };
  }

  /**
   * Démarre les agent_flows trigger=mail-in pour chaque message.
   */
  async dispatchMailInToFlows(instance, messages, { triggerMode = 'polling' } = {}) {
    try {
      const { AgentFlowService } = require('../agent-flow/AgentFlowService');
      const { FlowExecutor } = require('../agent-flow/FlowExecutor');
      const flowService = new AgentFlowService(this.database);
      const executor = new FlowExecutor(this.database);

      const accountRef =
        (instance.settings && (instance.settings.accountRef || instance.settings.accountId)) ||
        instance.name ||
        null;

      const flows = await flowService.listFlowsBoundToInstance(instance.entrepriseId, instance);
      if (!flows.length) {
        console.log(`  ℹ️ Aucun agent mail-in actif pour entité ${instance.entrepriseId}`);
        return;
      }

      for (const raw of messages) {
        const message = this.normalizeMailMessage(raw);
        for (const flow of flows) {
          if (!this.mailFlowAcceptsMessage(flow, message, instance)) continue;
          try {
            await this.executeFlowForConnector(executor, flow, {
              triggerMode,
              triggeredBy: `connector:${instance._id}`,
              triggerPayload: {
                message,
                instanceId: String(instance._id),
                accountRef,
                triggerBrickId: 'trigger',
                options: { channel: 'mail' }
              }
            });
          } catch (err) {
            console.error(`  ❌ Flow ${flow.name} (${flow._id}):`, err.message);
          }
        }
      }
    } catch (error) {
      console.error('  ❌ dispatchMailInToFlows:', error.message);
    }
  }

  normalizeMailMessage(raw) {
    if (!raw || typeof raw !== 'object') {
      return { text: String(raw || ''), subject: '', from: '', attachments: [] };
    }
    // Canonical connector message or imap raw
    const text =
      raw.text ||
      raw.body ||
      raw.bodyText ||
      (raw.payload && (raw.payload.text || raw.payload.body)) ||
      '';
    const subject =
      raw.subject ||
      (raw.metadata && raw.metadata.subject) ||
      (raw.payload && raw.payload.subject) ||
      '';
    const fromRaw =
      raw.from ||
      (raw.author && (raw.author.email || raw.author.name)) ||
      (raw.metadata && (raw.metadata.fromEmail || raw.metadata.fromName)) ||
      (raw.payload && raw.payload.from) ||
      (Array.isArray(raw.from) ? raw.from[0] : '') ||
      '';
    const from =
      typeof fromRaw === 'object'
        ? String(fromRaw.address || fromRaw.email || fromRaw.name || '')
        : String(fromRaw);
    const attachments = Array.isArray(raw.attachments)
      ? raw.attachments
      : (raw.raw && Array.isArray(raw.raw.attachments) ? raw.raw.attachments : []);
    return {
      text: String(text),
      subject: String(subject),
      from,
      messageId: raw.messageId || raw.id || null,
      sourceRef: raw.sourceRef != null ? String(raw.sourceRef) : null,
      attachments,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
      author: raw.author && typeof raw.author === 'object' ? raw.author : undefined,
      raw
    };
  }

  /**
   * Démarre les agent_flows Facebook pour chaque message pollé.
   */
  async dispatchFacebookToFlows(instance, messages, { triggerMode = 'polling' } = {}) {
    try {
      const { AgentFlowService } = require('../agent-flow/AgentFlowService');
      const { FlowExecutor } = require('../agent-flow/FlowExecutor');
      const flowService = new AgentFlowService(this.database);
      const executor = new FlowExecutor(this.database);

      const pageId =
        (instance.settings && instance.settings.pageId) ||
        null;

      const flows = await flowService.listFlowsBoundToInstance(instance.entrepriseId, instance);
      if (!flows.length) {
        console.log(`  ℹ️ Aucun agent Facebook actif pour entité ${instance.entrepriseId}`);
        return;
      }

      for (const raw of messages) {
        const message = this.normalizeFacebookMessage(raw, pageId);
        for (const flow of flows) {
          if (!this.facebookFlowAcceptsMessage(flow, message, instance)) continue;
          try {
            await this.executeFlowForConnector(executor, flow, {
              triggerMode,
              triggeredBy: `connector:${instance._id}`,
              triggerPayload: {
                message,
                instanceId: String(instance._id),
                pageId,
                triggerBrickId: 'trigger',
                options: { channel: 'facebook', intentionSet: 'reseaux-sociaux' },
                source: `facebook.${message.resourceType || 'item'}`
              }
            });
          } catch (err) {
            console.error(`  ❌ Flow ${flow.name} (${flow._id}):`, err.message);
          }
        }
      }
    } catch (error) {
      console.error('  ❌ dispatchFacebookToFlows:', error.message);
    }
  }

  /**
   * Filtre par config du bloc Facebook correspondant à CE compte (pas le premier nœud).
   */
  facebookFlowAcceptsMessage(flow, message, instance) {
    const { resolveWebhookEvents } = require('./facebook-graph-helper');
    const {
      extractFacebookConfigsFromFlow,
      facebookConfigMatchesAccount
    } = require('./syncFacebookAgentSettings');
    const { messageMatchesKinds } = require('../agent-flow/dataContracts');
    const all = extractFacebookConfigsFromFlow(flow);
    const match = {
      instanceId: String((instance && instance._id) || ''),
      pageId: String(
        (message && message.pageId) ||
        (instance && instance.settings && instance.settings.pageId) ||
        ''
      )
    };
    let cfgs = all.filter((cfg) => facebookConfigMatchesAccount(cfg, match));
    if (!cfgs.length) {
      cfgs = all.filter((cfg) =>
        !String(cfg.instanceId || '').trim() && !String(cfg.pageId || '').trim()
      );
    }
    if (all.length && !cfgs.length) return false;
    if (!cfgs.length) cfgs = [{}];
    return cfgs.some((cfg) => this.facebookConfigAcceptsMessage(cfg || {}, message, {
      resolveWebhookEvents,
      messageMatchesKinds
    }));
  }

  facebookConfigAcceptsMessage(cfg, message, helpers) {
    const resolveWebhookEvents = helpers.resolveWebhookEvents;
    const messageMatchesKinds = helpers.messageMatchesKinds;
    const modes = Array.isArray(cfg.ingestModes) ? cfg.ingestModes : ['push', 'poll'];
    const resourceType = String((message && message.resourceType) || '');
    const webhookEvent =
      (message && message.webhookEvent) ||
      (message && message.raw && message.raw.metadata && message.raw.metadata.webhookEvent) ||
      null;

    if (Array.isArray(cfg.kinds) && cfg.kinds.length) {
      return messageMatchesKinds(message, cfg.kinds);
    }
    if (webhookEvent) {
      if (!modes.includes('push')) return false;
      return resolveWebhookEvents(cfg).includes(String(webhookEvent));
    }
    if (!modes.includes('poll')) return false;
    const resources = Array.isArray(cfg.resources) ? cfg.resources : [];
    if (!resources.length) return true;
    if (resourceType === 'comment') return resources.includes('comments');
    if (resourceType === 'post') return resources.includes('posts');
    if (resourceType === 'messaging') return resources.includes('messages');
    return true;
  }

  mailFlowAcceptsMessage(flow, message, instance) {
    const { messageMatchesKinds } = require('../agent-flow/dataContracts');
    const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
    const mailNodes = nodes.filter((n) =>
      n && n.brickId === 'data' && String((n.config && n.config.provider) || '') === 'mail'
    );
    if (!mailNodes.length) return true;
    const instanceId = String((instance && instance._id) || '');
    const accountRef = String(
      (instance && instance.settings && (instance.settings.accountRef || instance.settings.accountId)) ||
      ''
    ).trim();
    let matched = mailNodes.filter((n) => {
      const cfg = n.config || {};
      const cfgInst = String(cfg.instanceId || '').trim();
      const cfgRef = String(cfg.accountRef || '').trim();
      if (cfgInst && instanceId && cfgInst === instanceId) return true;
      if (cfgRef && accountRef && cfgRef === accountRef) return true;
      return false;
    });
    if (!matched.length) {
      matched = mailNodes.filter((n) => {
        const cfg = n.config || {};
        return !String(cfg.instanceId || '').trim() && !String(cfg.accountRef || '').trim();
      });
    }
    if (!matched.length) return false;
    return matched.some((n) => {
      const kinds = Array.isArray(n.config && n.config.kinds) ? n.config.kinds : [];
      if (!messageMatchesKinds(message, kinds)) return false;
      const { resolveMailPollQuery, messageMatchesMailQuery } = require('./mail-query-helper');
      return messageMatchesMailQuery(message, resolveMailPollQuery(n.config || {}));
    });
  }

  facebookContentType(resourceType) {
    const t = String(resourceType || 'post').toLowerCase();
    if (t === 'comment' || t === 'comments' || t === 'commentaire') return 'commentaire';
    if (t === 'messaging' || t === 'message' || t === 'messages' || t === 'mp') return 'mp';
    if (t === 'notification' || t === 'notifications') return 'notification';
    return 'post';
  }

  normalizeFacebookMessage(raw, pageIdHint = null) {
    if (!raw || typeof raw !== 'object') {
      return { text: String(raw || ''), subject: '', from: '', channel: 'facebook', type: 'post' };
    }
    const meta = raw.metadata || {};
    const author = raw.author || {};
    const resourceType = meta.type || 'post';
    const type = this.facebookContentType(resourceType);
    const webhookEvent = meta.webhookEvent || null;
    const text = String(raw.text || '').trim();
    const from =
      author.name ||
      author.id ||
      meta.pageId ||
      pageIdHint ||
      '';
    let subject = `Post FB ${raw.sourceRef || ''}`.trim();
    if (resourceType === 'comment') subject = `Commentaire FB ${raw.sourceRef || ''}`.trim();
    else if (resourceType === 'messaging') subject = `Message privé FB ${raw.sourceRef || ''}`.trim();
    else if (resourceType === 'notification') subject = `Notification FB ${raw.sourceRef || ''}`.trim();

    return {
      text,
      subject,
      from: String(from),
      messageId: raw.sourceRef || raw.id || null,
      channel: 'facebook',
      type,
      pageId: meta.pageId || pageIdHint || null,
      postId: meta.postId || null,
      conversationId: meta.conversationId || null,
      resourceType,
      webhookEvent,
      permalink_url: meta.permalink_url || null,
      created_time: meta.created_time || raw.timestamp || null,
      raw
    };
  }
}

module.exports = { ConnectorScheduler };
