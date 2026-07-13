/**
 * CRUD flows agent + historique d'exécution.
 * Fichier : backend/core/agent-flow/AgentFlowService.js
 */

const { ObjectId } = require('mongodb');
const { describeSchedule } = require('./CronEvaluator');

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
    await db.collection(COL_RUNS).createIndex({ flowId: 1, startedAt: -1 });
    await db.collection(COL_RUNS).createIndex({ entrepriseId: 1, startedAt: -1 });
  }

  flowsCol() {
    return this.database.getCollection(COL_FLOWS);
  }

  runsCol() {
    return this.database.getCollection(COL_RUNS);
  }

  async listFlows(entrepriseId) {
    return this.flowsCol()
      .find({ entrepriseId: String(entrepriseId) })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async getFlowById(flowId) {
    return this.flowsCol().findOne({ _id: new ObjectId(String(flowId)) });
  }

  async createFlow(entrepriseId, payload = {}) {
    const now = new Date();
    const trigger = payload.trigger || {
      brickId: 'manual-trigger',
      config: {}
    };
    const doc = {
      entrepriseId: String(entrepriseId),
      name: String(payload.name || 'Nouveau flow').trim(),
      description: payload.description || '',
      enabled: payload.enabled !== false,
      trigger,
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      canvas: payload.canvas && typeof payload.canvas === 'object' ? payload.canvas : null,
      scheduleLabel: trigger.brickId === 'cron-trigger'
        ? describeSchedule(trigger.config || {})
        : null,
      lastTriggeredAt: null,
      createdAt: now,
      updatedAt: now
    };
    const result = await this.flowsCol().insertOne(doc);
    return this.getFlowById(result.insertedId);
  }

  async updateFlow(flowId, patch = {}) {
    const allowed = ['name', 'description', 'enabled', 'trigger', 'steps', 'canvas'];
    const update = { updatedAt: new Date() };
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        update[key] = patch[key];
      }
    });
    if (update.trigger && update.trigger.brickId === 'cron-trigger') {
      update.scheduleLabel = describeSchedule(update.trigger.config || {});
    }
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
      meta
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
          completedAt: new Date()
        }
      }
    );
    return this.runsCol().findOne({ _id: new ObjectId(String(runId)) });
  }

  async listRuns({ entrepriseId = null, flowId = null, limit = 50 } = {}) {
    const filter = {};
    if (entrepriseId) filter.entrepriseId = String(entrepriseId);
    if (flowId) filter.flowId = new ObjectId(String(flowId));
    return this.runsCol()
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
      .toArray();
  }
}

module.exports = { AgentFlowService };
