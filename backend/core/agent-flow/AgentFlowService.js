/**
 * CRUD flows agent + historique d'exécution.
 * Fichier : backend/core/agent-flow/AgentFlowService.js
 */

const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { describeSchedule } = require('./CronEvaluator');
const {
  deriveInteractionMode,
  resolveEffectiveInteractionMode,
  enrichFlowModes
} = require('./interactionMode');
const { normalizeAppConfig, normalizePaletteConfig, enrichFlowApp } = require('./appSurface');
const { providerFromConnectorId } = require('./channelFromConnector');
const { canvasTriggerNodes } = require('./triggerMatch');

const COL_FLOWS = 'agent_flows';
const COL_RUNS = 'agent_flow_runs';

class AgentFlowService {
  constructor(database) {
    this.database = database;
  }

  async ensureIndexes() {
    const db = await this.database.connect();
    await db.collection(COL_FLOWS).createIndex({ entrepriseId: 1, enabled: 1 });
    await db.collection(COL_FLOWS).createIndex({ 'trigger.brickId': 1, enabled: 1 });
    await db.collection(COL_FLOWS).createIndex({ entrepriseId: 1, derivedInteractionMode: 1 });
    await db.collection(COL_RUNS).createIndex({ flowId: 1, startedAt: -1 });
    await db.collection(COL_RUNS).createIndex({ entrepriseId: 1, startedAt: -1 });
    await db.collection(COL_RUNS).createIndex({ entrepriseId: 1, status: 1, startedAt: -1 });
  }

  flowsCol() {
    return this.database.getCollection(COL_FLOWS);
  }

  runsCol() {
    return this.database.getCollection(COL_RUNS);
  }

  normalizeInteractionMode(value) {
    const v = String(value || 'auto').trim().toLowerCase();
    if (v === 'automatic' || v === 'assisted' || v === 'auto') return v;
    return 'auto';
  }

  applyModeFields(doc, payload = {}) {
    if (payload.imageUrl !== undefined) {
      doc.imageUrl = payload.imageUrl ? String(payload.imageUrl).trim() : null;
    } else if (doc.imageUrl === undefined) {
      doc.imageUrl = null;
    }
    if (payload.interactionMode !== undefined) {
      doc.interactionMode = this.normalizeInteractionMode(payload.interactionMode);
    } else if (!doc.interactionMode) {
      doc.interactionMode = 'auto';
    }
    doc.derivedInteractionMode = deriveInteractionMode(doc);
    doc.app = normalizeAppConfig(payload.app !== undefined ? payload.app : doc.app);
    doc.palette = normalizePaletteConfig(payload.palette !== undefined ? payload.palette : doc.palette);
    return doc;
  }

  async listFlows(entrepriseId, { interactionMode = null } = {}) {
    const flows = await this.flowsCol()
      .find({ entrepriseId: String(entrepriseId) })
      .sort({ updatedAt: -1 })
      .toArray();
    const enriched = flows.map((f) => enrichFlowModes(f));
    if (!interactionMode) return enriched;
    const want = String(interactionMode);
    return enriched.filter((f) => f.effectiveInteractionMode === want);
  }

  async getFlowById(flowId) {
    const flow = await this.flowsCol().findOne({ _id: new ObjectId(String(flowId)) });
    return flow ? enrichFlowModes(flow) : null;
  }

  isCronTrigger(trigger) {
    if (!trigger) return false;
    if (trigger.brickId === 'cron-trigger') return true;
    if (trigger.brickId === 'trigger') {
      return String((trigger.config && trigger.config.mode) || '') === 'cron';
    }
    return false;
  }

  /** Nœuds canvas + steps qui matchent un provider Données. */
  flowHasDataProvider(flow, provider) {
    const want = String(provider || '').toLowerCase();
    const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
    if (nodes.some((n) => n.brickId === 'data' && String((n.config && n.config.provider) || '').toLowerCase() === want)) {
      return true;
    }
    const steps = Array.isArray(flow && flow.steps) ? flow.steps : [];
    return steps.some(
      (s) => s.brickId === 'data' && String((s.config && s.config.provider) || '').toLowerCase() === want
    );
  }

  getDataNodes(flow, provider = null) {
    const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
    let list = nodes.filter((n) => n.brickId === 'data');
    if (!list.length && Array.isArray(flow && flow.steps)) {
      list = flow.steps.filter((s) => s.brickId === 'data');
    }
    if (provider) {
      const want = String(provider).toLowerCase();
      list = list.filter((n) => String((n.config && n.config.provider) || '').toLowerCase() === want);
    }
    return list;
  }

  getOutputNodes(flow, provider = null) {
    const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
    let list = nodes.filter((n) => n.brickId === 'output');
    if (!list.length && Array.isArray(flow && flow.steps)) {
      list = flow.steps.filter((s) => s.brickId === 'output');
    }
    if (provider) {
      const want = String(provider).toLowerCase();
      list = list.filter((n) => {
        const p = String((n.config && n.config.provider) || '').toLowerCase();
        if (want === 'http') return p === 'http' || p === 'webhook';
        return p === want;
      });
    }
    return list;
  }

  flowHasOutputInstance(flow, instanceId) {
    const want = String(instanceId || '').trim();
    if (!want) return false;
    return this.getOutputNodes(flow).some((n) => String((n.config && n.config.instanceId) || '').trim() === want);
  }

  flowHasWebhookInstance(flow, instanceId, pageId = '') {
    const want = String(instanceId || '').trim();
    const page = String(pageId || '').trim();
    if (!want && !page) return false;
    return this.getFlowTriggers(flow).some((t) => {
      const cfg = t.config || {};
      if (String(cfg.mode || '') !== 'webhook') return false;
      const selected = String(cfg.webhookInstanceId || '').trim();
      if (want && selected === want) return true;
      if (page && (selected === page || selected === `fb-page:${page}`)) return true;
      return false;
    });
  }

  flowHasDataInstance(flow, instanceId) {
    const want = String(instanceId || '').trim();
    if (!want) return false;
    return this.getDataNodes(flow).some((n) => String((n.config && n.config.instanceId) || '').trim() === want);
  }

  /**
   * Agents liés à une instance connecteur : trigger webhook, Données.instanceId,
   * Sortie.instanceId, ou (rétrocompat) provider + page/compte.
   */
  async listFlowsBoundToInstance(entrepriseId, instance) {
    if (!instance) return [];
    const instanceId = String(instance._id || '');
    const provider = providerFromConnectorId(instance.connectorId);
    const pageId = String((instance.settings && instance.settings.pageId) || '').trim();
    const accountRef = String(
      (instance.settings && (instance.settings.accountRef || instance.settings.accountId)) || ''
    ).trim();

    const all = await this.flowsCol()
      .find({ enabled: true, entrepriseId: String(entrepriseId) })
      .toArray();

    return all.filter((f) => {
      if (this.flowHasWebhookInstance(f, instanceId, pageId)) return true;
      if (this.flowHasDataInstance(f, instanceId)) return true;
      if (this.flowHasOutputInstance(f, instanceId)) return true;

      const dataMatch = this.flowHasDataProvider(f, provider);
      const outputMatch = this.getOutputNodes(f, provider).length > 0;
      if (!dataMatch && !outputMatch) return false;

      if (provider === 'facebook' && pageId) {
        const nodes = [...this.getDataNodes(f, 'facebook'), ...this.getOutputNodes(f, 'facebook')];
        if (!nodes.length) return true;
        return nodes.some((n) => {
          const cfgPage = String((n.config && n.config.pageId) || '').trim();
          const cfgInst = String((n.config && n.config.instanceId) || '').trim();
          return (!cfgPage && !cfgInst) || cfgPage === pageId || cfgInst === instanceId;
        });
      }
      if (provider === 'mail' && accountRef) {
        const nodes = [...this.getDataNodes(f, 'mail'), ...this.getOutputNodes(f, 'mail')];
        if (!nodes.length) return true;
        return nodes.some((n) => {
          const cfgRef = String((n.config && n.config.accountRef) || '').trim();
          const cfgInst = String((n.config && n.config.instanceId) || '').trim();
          return (!cfgRef && !cfgInst) || cfgRef === accountRef || cfgInst === instanceId;
        });
      }
      if (provider === 'http') return false;
      return true;
    });
  }

  async createFlow(entrepriseId, payload = {}) {
    const now = new Date();
    const trigger = payload.trigger || {
      brickId: 'trigger',
      config: { mode: 'button' }
    };
    const triggers = Array.isArray(payload.triggers) && payload.triggers.length
      ? payload.triggers
      : [trigger];
    const primary = triggers[0] || trigger;
    const cronTrigger = triggers.find((t) => this.isCronTrigger(t)) || (this.isCronTrigger(primary) ? primary : null);
    const doc = {
      entrepriseId: String(entrepriseId),
      name: String(payload.name || 'Nouveau flow').trim(),
      description: payload.description || '',
      enabled: payload.enabled !== false,
      trigger: primary,
      triggers,
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      canvas: payload.canvas && typeof payload.canvas === 'object' ? payload.canvas : null,
      scheduleLabel: cronTrigger
        ? describeSchedule(cronTrigger.config || {})
        : null,
      lastTriggeredAt: null,
      agentContext: payload.agentContext != null ? String(payload.agentContext) : '',
      vizDesign: payload.vizDesign && typeof payload.vizDesign === 'object' ? payload.vizDesign : null,
      createdBy: payload.createdBy != null ? String(payload.createdBy) : null,
      createdAt: now,
      updatedAt: now
    };
    this.applyModeFields(doc, payload);
    const result = await this.flowsCol().insertOne(doc);
    return this.getFlowById(result.insertedId);
  }

  async updateFlow(flowId, patch = {}) {
    const existing = await this.flowsCol().findOne({ _id: new ObjectId(String(flowId)) });
    if (!existing) return null;

    const allowed = [
      'name',
      'description',
      'enabled',
      'trigger',
      'triggers',
      'steps',
      'canvas',
      'imageUrl',
      'interactionMode',
      'agentContext',
      'vizDesign',
      'app',
      'palette',
      'exports'
    ];
    const update = { updatedAt: new Date() };
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        update[key] = patch[key];
      }
    });
    if (update.interactionMode !== undefined) {
      update.interactionMode = this.normalizeInteractionMode(update.interactionMode);
    }
    if (update.imageUrl !== undefined) {
      update.imageUrl = update.imageUrl ? String(update.imageUrl).trim() : null;
    }
    if (update.agentContext !== undefined) {
      update.agentContext = update.agentContext != null ? String(update.agentContext) : '';
    }
    if (update.vizDesign !== undefined) {
      const { normalizeDesign } = require('./vizDesign');
      update.vizDesign = update.vizDesign ? normalizeDesign(update.vizDesign) : null;
    }
    if (update.app !== undefined) {
      update.app = normalizeAppConfig(update.app);
    }
    if (update.palette !== undefined) {
      update.palette = normalizePaletteConfig(update.palette);
    }
    if (Array.isArray(update.triggers) && update.triggers.length && !update.trigger) {
      update.trigger = update.triggers[0];
    }

    const merged = { ...existing, ...update };
    const cronTrigger = this.getFlowTriggers(merged).find((t) => this.isCronTrigger(t));
    update.scheduleLabel = cronTrigger
      ? describeSchedule(cronTrigger.config || {})
      : null;
    update.derivedInteractionMode = deriveInteractionMode(merged);

    await this.flowsCol().updateOne(
      { _id: new ObjectId(String(flowId)) },
      { $set: update }
    );
    return this.getFlowById(flowId);
  }

  async deleteFlow(flowId) {
    const result = await this.flowsCol().deleteOne({ _id: new ObjectId(String(flowId)) });
    return result.deletedCount > 0;
  }

  async listCronFlows() {
    const all = await this.flowsCol().find({ enabled: true }).toArray();
    return all.filter((f) => {
      const triggers = this.getFlowTriggers(f);
      return triggers.some((t) => this.isCronTrigger(t));
    });
  }

  /** Triggers d'un flow (canvas = source de vérité). */
  getFlowTriggers(flow) {
    if (!flow) return [];
    const fromCanvas = canvasTriggerNodes(flow);
    if (fromCanvas.length) {
      return fromCanvas.map((n) => ({
        id: n.id,
        brickId: n.brickId || 'trigger',
        config: n.config || {}
      }));
    }
    if (Array.isArray(flow.triggers) && flow.triggers.length) return flow.triggers;
    if (flow.trigger) return [flow.trigger];
    return [];
  }

  flowHasTriggerBrick(flow, brickId) {
    return this.getFlowTriggers(flow).some((t) => t.brickId === brickId);
  }

  async listMailInFlows(entrepriseId, accountRef = null) {
    const all = await this.flowsCol()
      .find({ enabled: true, entrepriseId: String(entrepriseId) })
      .toArray();
    const flows = all.filter((f) => this.flowHasDataProvider(f, 'mail'));
    if (!accountRef) return flows;
    const ref = String(accountRef).trim();
    return flows.filter((f) => {
      const dataNodes = this.getDataNodes(f, 'mail');
      if (!dataNodes.length) return true;
      return dataNodes.some((n) => {
        const cfgRef = String((n.config && n.config.accountRef) || '').trim();
        return !cfgRef || cfgRef === ref;
      });
    });
  }

  async listFacebookFlows(entrepriseId, pageId = null) {
    const all = await this.flowsCol()
      .find({ enabled: true, entrepriseId: String(entrepriseId) })
      .toArray();
    const flows = all.filter((f) => this.flowHasDataProvider(f, 'facebook'));
    if (!pageId) return flows;
    const pid = String(pageId).trim();
    return flows.filter((f) => {
      const dataNodes = this.getDataNodes(f, 'facebook');
      if (!dataNodes.length) return true;
      return dataNodes.some((n) => {
        const cfgPage = String((n.config && n.config.pageId) || '').trim();
        return !cfgPage || cfgPage === pid;
      });
    });
  }

  async findByTemplateId(entrepriseId, templateId, createdBy = null) {
    const query = {
      entrepriseId: String(entrepriseId),
      templateId: String(templateId)
    };
    if (createdBy != null && createdBy !== '') {
      query.createdBy = String(createdBy);
    }
    return this.flowsCol().findOne(query);
  }

  async createFromTemplate(entrepriseId, templatePayload, options = {}) {
    const now = new Date();
    const createdBy =
      options.createdBy != null
        ? String(options.createdBy)
        : templatePayload.createdBy != null
          ? String(templatePayload.createdBy)
          : null;
    const doc = {
      entrepriseId: String(entrepriseId),
      name: String(templatePayload.name || 'Agent').trim(),
      description: templatePayload.description || '',
      enabled: templatePayload.enabled !== false,
      templateId: templatePayload.templateId || null,
      trigger: templatePayload.trigger || { brickId: 'trigger', config: { mode: 'button' } },
      steps: Array.isArray(templatePayload.steps) ? templatePayload.steps : [],
      canvas: templatePayload.canvas || null,
      scheduleLabel: null,
      lastTriggeredAt: null,
      agentContext:
        templatePayload.agentContext != null ? String(templatePayload.agentContext) : '',
      official: templatePayload.official === true,
      importable: templatePayload.importable === true,
      exports: templatePayload.exports && typeof templatePayload.exports === 'object'
        ? templatePayload.exports
        : {},
      createdBy,
      createdAt: now,
      updatedAt: now
    };
    this.applyModeFields(doc, templatePayload);
    const result = await this.flowsCol().insertOne(doc);
    return this.getFlowById(result.insertedId);
  }

  async markTriggered(flowId, at = new Date(), triggerNodeId = null) {
    const $set = { lastTriggeredAt: at, updatedAt: at };
    const nodeId = String(triggerNodeId || '').trim();
    if (nodeId) $set[`lastTriggeredAtByNode.${nodeId}`] = at;
    await this.flowsCol().updateOne(
      { _id: new ObjectId(String(flowId)) },
      { $set }
    );
  }

  async createRun(flow, triggerMode, meta = {}) {
    const doc = {
      flowId: flow._id,
      entrepriseId: flow.entrepriseId,
      flowName: flow.name,
      triggerMode,
      status: 'running',
      startedAt: new Date(),
      completedAt: null,
      steps: [],
      error: null,
      meta,
      pendingStepIndex: null,
      pendingStepId: null,
      currentNodeId: null,
      resumeToken: null,
      pausedContext: null,
      reviewUrl: null
    };
    const result = await this.runsCol().insertOne(doc);
    return this.runsCol().findOne({ _id: result.insertedId });
  }

  async touchRunProgress(runId, { currentNodeId = undefined, steps = undefined } = {}) {
    const $set = {};
    if (currentNodeId !== undefined) $set.currentNodeId = currentNodeId || null;
    if (steps !== undefined) $set.steps = steps || [];
    if (!Object.keys($set).length) return this.getRunById(runId);
    await this.runsCol().updateOne({ _id: new ObjectId(String(runId)) }, { $set });
    return this.getRunById(runId);
  }

  async finishRun(runId, { status, steps, error = null }) {
    await this.runsCol().updateOne(
      { _id: new ObjectId(String(runId)) },
      {
        $set: {
          status,
          steps: steps || [],
          error,
          completedAt: new Date(),
          pendingStepIndex: null,
          pendingStepId: null,
          currentNodeId: null,
          resumeToken: null,
          pausedContext: null
        }
      }
    );
    return this.runsCol().findOne({ _id: new ObjectId(String(runId)) });
  }

  /**
   * Met le run en attente d'intervention humaine.
   */
  async pauseRun(runId, {
    steps,
    pendingStepIndex,
    pendingStepId,
    pendingNodeId = null,
    pendingNodeIds = null,
    pausedContext,
    reviewUrl = null,
    output = null
  }) {
    const resumeToken = crypto.randomBytes(24).toString('hex');
    const nextIds = Array.isArray(pendingNodeIds)
      ? pendingNodeIds.filter(Boolean).map((id) => String(id))
      : (pendingNodeId ? [String(pendingNodeId)] : []);
    await this.runsCol().updateOne(
      { _id: new ObjectId(String(runId)) },
      {
        $set: {
          status: 'waiting_human',
          steps: steps || [],
          pendingStepIndex,
          pendingStepId,
          pendingNodeId: nextIds[0] || pendingNodeId || null,
          pendingNodeIds: nextIds,
          currentNodeId: pendingStepId || null,
          resumeToken,
          pausedContext,
          reviewUrl,
          humanOutput: output || null,
          completedAt: null,
          error: null
        }
      }
    );
    return this.runsCol().findOne({ _id: new ObjectId(String(runId)) });
  }

  async getRunById(runId) {
    return this.runsCol().findOne({ _id: new ObjectId(String(runId)) });
  }

  async listRuns({
    entrepriseId = null,
    flowId = null,
    status = null,
    limit = 50
  } = {}) {
    const filter = {};
    if (entrepriseId) filter.entrepriseId = String(entrepriseId);
    if (flowId) filter.flowId = new ObjectId(String(flowId));
    if (status) filter.status = String(status);
    return this.runsCol()
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
      .toArray();
  }

  effectiveMode(flow) {
    return resolveEffectiveInteractionMode(flow);
  }
}

module.exports = { AgentFlowService };
