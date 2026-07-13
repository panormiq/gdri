/**
 * Planificateur de poll pour instances connecteur.
 * Fichier : backend/core/connectors/ConnectorScheduler.js
 */

const { ConnectorInstanceService } = require('./ConnectorInstanceService');
const { ConnectorRuntime } = require('./ConnectorRuntime');

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
        // TODO: brancher orchestrateur agent_flows
      }

      return { success: true, messages: result.messages, cursor: result.cursor };
    } catch (error) {
      console.error(`  ❌ Poll connecteur ${instance.connectorId} (${instance.name}):`, error.message);
      return { success: false, messages: [], cursor: instance.cursor, error: error.message };
    }
  }
}

module.exports = { ConnectorScheduler };
