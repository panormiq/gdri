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
  console.log('🧩 Découverte des briques flow (orchestrateur)...');
  const bricks = flowBrickRegistry.discover();
  const triggers = bricks.filter((b) => b.kind === 'trigger').length;
  const actions = bricks.filter((b) => b.kind === 'action').length;
  console.log(`🧩 Briques flow : ${bricks.length} (${triggers} triggers, ${actions} actions)`);

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
