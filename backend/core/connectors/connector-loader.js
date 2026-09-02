/**
 * Chargeur connecteurs — découverte + routes webhook.
 * Fichier : backend/core/connectors/connector-loader.js
 */

const connectorRegistry = require('./ConnectorRegistry');
const { ConnectorInstanceService } = require('./ConnectorInstanceService');
const { ConnectorRuntime } = require('./ConnectorRuntime');
const { ConnectorScheduler } = require('./ConnectorScheduler');

let scheduler = null;

/**
 * @param {import('express').Express} app
 * @param {Object} database
 */
async function loadConnectors(app, database) {
  console.log('🔌 Découverte des connecteurs...');
  await connectorRegistry.discover();

  const instanceService = new ConnectorInstanceService(database);
  await instanceService.ensureIndexes();

  const runtime = new ConnectorRuntime(database);

  // Webhook public par instance
  app.post('/api/connectors/webhook/:instanceId', async (req, res) => {
    try {
      const instance = await instanceService.getById(req.params.instanceId);
      if (!instance || !instance.enabled) {
        return res.status(404).json({ success: false, message: 'Instance connecteur introuvable' });
      }

      const modes = instance.ingestModes || [];
      if (!modes.includes('push')) {
        return res.status(400).json({ success: false, message: 'Mode push non activé pour cette instance' });
      }

      const messages = await runtime.ingestPush(instance, req);

      if (messages.length) {
        const runner = scheduler || new ConnectorScheduler(database);
        await runner.dispatchPushToFlows(instance, messages);
      }

      return res.json({
        success: true,
        count: messages.length,
        messages,
        dispatched: messages.length > 0
      });
    } catch (error) {
      console.error('Webhook connecteur:', error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  scheduler = new ConnectorScheduler(database);
  await scheduler.init();
  scheduler.start();

  console.log(`🔌 Connecteurs chargés : ${connectorRegistry.list().length}`);
}

function getConnectorScheduler() {
  return scheduler;
}

module.exports = {
  loadConnectors,
  getConnectorScheduler,
  connectorRegistry
};
