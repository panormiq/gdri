/**
 * Planificateur des flows agent (trigger cron).
 * Fichier : backend/core/agent-flow/AgentFlowScheduler.js
 */

const { AgentFlowService } = require('./AgentFlowService');
const { FlowExecutor } = require('./FlowExecutor');
const { shouldTriggerNow } = require('./CronEvaluator');

const TICK_MS = 60 * 1000;

class AgentFlowScheduler {
  constructor(database) {
    this.database = database;
    this.flowService = new AgentFlowService(database);
    this.executor = new FlowExecutor(database);
    this.timer = null;
    this._running = false;
  }

  async init() {
    await this.flowService.ensureIndexes();
  }

  start() {
    if (process.env.AGENT_FLOW_SCHEDULER_DISABLED === 'true') {
      console.log('🧩 AgentFlowScheduler : désactivé (AGENT_FLOW_SCHEDULER_DISABLED)');
      return;
    }
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('AgentFlowScheduler tick:', err.message));
    }, TICK_MS);
    console.log('🧩 AgentFlowScheduler : actif (cron flows chaque minute)');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  sameMinute(a, b) {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear()
      && da.getMonth() === db.getMonth()
      && da.getDate() === db.getDate()
      && da.getHours() === db.getHours()
      && da.getMinutes() === db.getMinutes();
  }

  async tick() {
    if (this._running) return;
    this._running = true;
    try {
      const now = new Date();
      const flows = await this.flowService.listCronFlows();
      for (const flow of flows) {
        const config = (flow.trigger && flow.trigger.config) || {};
        if (!shouldTriggerNow(config, now)) continue;
        if (this.sameMinute(flow.lastTriggeredAt, now)) continue;

        try {
          console.log(`  🧩 Cron flow [${flow.name}] entité ${flow.entrepriseId}`);
          await this.executor.execute(flow, { triggerMode: 'cron' });
        } catch (error) {
          console.error(`  ❌ Flow cron ${flow.name}:`, error.message);
        }
      }
    } finally {
      this._running = false;
    }
  }
}

module.exports = { AgentFlowScheduler };
