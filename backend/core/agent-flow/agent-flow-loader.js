/**
 * Chargeur orchestrateur agent-flow.
 * Fichier : backend/core/agent-flow/agent-flow-loader.js
 */

const flowBrickRegistry = require('./FlowBrickRegistry');
const { AgentFlowScheduler } = require('./AgentFlowScheduler');
const createAgentFlowsRouter = require('../../routes/agent-flows');

let scheduler = null;

/**
 * @param {import('express').Express} app
 * @param {Object} database
 */
async function loadAgentFlows(app, database) {
  console.log('🧩 Découverte des familles de blocs agent...');
  const bricks = flowBrickRegistry.discover();
  const families = bricks.map((b) => b.family || b.id).join(', ');
  console.log(`🧩 Blocs agent : ${bricks.length} familles (${families})`);

  try {
    const { AgentBrickConfigService } = require('./AgentBrickConfigService');
    await new AgentBrickConfigService(database).ensureIndexes();
  } catch (e) {
    console.warn('  ⚠️ Index agent_flow_brick_configs:', e.message);
  }

  app.use('/api/agent-flows', createAgentFlowsRouter(database));

  scheduler = new AgentFlowScheduler(database);
  await scheduler.init();
  scheduler.start();
}

function getAgentFlowScheduler() {
  return scheduler;
}

module.exports = {
  loadAgentFlows,
  getAgentFlowScheduler,
  flowBrickRegistry
};
