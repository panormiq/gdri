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

  async createFlow(entrepriseId, payload = {}) {
    const now = new Date();
    const trigger = payload.trigger || {
      brickId: 'manual-trigger',
      config: {}
    };
    const triggers = Array.isArray(payload.triggers) && payload.triggers.length
      ? payload.triggers
      : [trigger];
    const doc = {
      entrepriseId: String(entrepriseId),
      name: String(payload.name || 'Nouveau flow').trim(),
      description: payload.description || '',
      enabled: payload.enabled !== false,
      trigger: triggers[0] || trigger,
      triggers,
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      canvas: payload.canvas && typeof payload.canvas === 'object' ? payload.canvas : null,
      scheduleLabel: (triggers[0] || trigger).brickId === 'cron-trigger'
        ? describeSchedule((triggers[0] || trigger).config || {})
        : null,
      lastTriggeredAt: null,
      agentContext: payload.agentContext != null ? String(payload.agentContext) : '',
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
      'agentContext'
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
    if (Array.isArray(update.triggers) && update.triggers.length && !update.trigger) {
      update.trigger = update.triggers[0];
    }
    if (update.trigger && update.trigger.brickId === 'cron-trigger') {
      update.scheduleLabel = describeSchedule(update.trigger.config || {});
    }

    const merged = { ...existing, ...update };
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
    return this.flowsCol()
      .find({ enabled: true, 'trigger.brickId': 'cron-trigger' })
      .toArray();
  }

  /** Triggers d'un flow (rétrocompat : trigger singulier). */
  getFlowTriggers(flow) {
    if (!flow) return [];
    if (Array.isArray(flow.triggers) && flow.triggers.length) return flow.triggers;
    if (flow.trigger) return [flow.trigger];
    const nodes = flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
    return nodes
      .filter((n) => n.kind === 'trigger')
      .map((n) => ({ brickId: n.brickId, config: n.config || {}, id: n.id }));
  }

  flowHasTriggerBrick(flow, brickId) {
    return this.getFlowTriggers(flow).some((t) => t.brickId === brickId);
  }

  async listMailInFlows(entrepriseId, accountRef = null) {
    const all = await this.flowsCol()
      .find({ enabled: true, entrepriseId: String(entrepriseId) })
      .toArray();
    const flows = all.filter((f) => this.flowHasTriggerBrick(f, 'mail-in'));
    if (!accountRef) return flows;
    const ref = String(accountRef).trim();
    return flows.filter((f) => {
      const mailTriggers = this.getFlowTriggers(f).filter((t) => t.brickId === 'mail-in');
      return mailTriggers.some((t) => {
        const cfgRef = String((t.config && t.config.accountRef) || '').trim();
        return !cfgRef || cfgRef === ref;
      });
    });
  }

  async listFacebookFlows(entrepriseId, pageId = null) {
    const all = await this.flowsCol()
      .find({ enabled: true, entrepriseId: String(entrepriseId) })
      .toArray();
    const flows = all.filter(
      (f) => this.flowHasTriggerBrick(f, 'facebook') || f.templateId === 'agent-facebook'
    );
    if (!pageId) return flows;
    const pid = String(pageId).trim();
    return flows.filter((f) => {
      const fbTriggers = this.getFlowTriggers(f).filter((t) => t.brickId === 'facebook');
      if (!fbTriggers.length) return true;
      return fbTriggers.some((t) => {
        const cfgPage = String((t.config && t.config.pageId) || '').trim();
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
      trigger: templatePayload.trigger || { brickId: 'manual-trigger', config: {} },
      steps: Array.isArray(templatePayload.steps) ? templatePayload.steps : [],
      canvas: templatePayload.canvas || null,
      scheduleLabel: null,
      lastTriggeredAt: null,
      agentContext:
        templatePayload.agentContext != null ? String(templatePayload.agentContext) : '',
      createdBy,
      createdAt: now,
      updatedAt: now
    };
    this.applyModeFields(doc, templatePayload);
    const result = await this.flowsCol().insertOne(doc);
    return this.getFlowById(result.insertedId);
  }

  async markTriggered(flowId, at = new Date()) {
    await this.flowsCol().updateOne(
      { _id: new ObjectId(String(flowId)) },
      { $set: { lastTriggeredAt: at, updatedAt: at } }
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
      resumeToken: null,
      pausedContext: null,
      reviewUrl: null
    };
    const result = await this.runsCol().insertOne(doc);
    return this.runsCol().findOne({ _id: result.insertedId });
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
    pausedContext,
    reviewUrl = null,
    output = null
  }) {
    const resumeToken = crypto.randomBytes(24).toString('hex');
    await this.runsCol().updateOne(
      { _id: new ObjectId(String(runId)) },
      {
        $set: {
          status: 'waiting_human',
          steps: steps || [],
          pendingStepIndex,
          pendingStepId,
          pendingNodeId: pendingNodeId || null,
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
