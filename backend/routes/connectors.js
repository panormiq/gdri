/**
 * Routes API connecteurs — types, instances, test, poll manuel.
 * Fichier : backend/routes/connectors.js
 */

const express = require('express');
const { authenticateJWT } = require('../config/jwt');
const { connectorRegistry, getConnectorScheduler } = require('../core/connectors/connector-loader');
const { ConnectorInstanceService } = require('../core/connectors/ConnectorInstanceService');
const { ConnectorRuntime } = require('../core/connectors/ConnectorRuntime');
const { listPresets, resolveInstanceTemplate } = require('../core/connectors/instance-defaults');

function getEntrepriseId(req) {
  return req.user?.currentEntrepriseId || req.user?.entrepriseId || null;
}

function createConnectorsRouter(database) {
  const router = express.Router();
  const instanceService = new ConnectorInstanceService(database);
  const runtime = new ConnectorRuntime(database);

  router.get('/', (req, res) => {
    res.json({
      success: true,
      data: connectorRegistry.list()
    });
  });

  // Routes instances AVANT /:connectorId pour éviter les collisions
  router.get('/instances/list/all', authenticateJWT, async (req, res) => {
    try {
      const entrepriseId = getEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité courante requise' });
      }
      let instances = await instanceService.listByEntreprise(entrepriseId);
      const connectorId = req.query.connectorId ? String(req.query.connectorId).trim() : '';
      if (connectorId) {
        instances = instances.filter((i) => String(i.connectorId) === connectorId);
      }
      res.json({ success: true, data: instances });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/instances', authenticateJWT, async (req, res) => {
    try {
      const entrepriseId = getEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité courante requise' });
      }

      const connectorId = req.body?.connectorId;
      if (!connectorRegistry.get(connectorId)) {
        return res.status(400).json({ success: false, message: 'Type de connecteur invalide' });
      }

      const instance = await instanceService.create(entrepriseId, {
        ...req.body,
        connectorId
      });
      res.status(201).json({ success: true, data: instance });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.put('/instances/:id', authenticateJWT, async (req, res) => {
    try {
      const entrepriseId = getEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité courante requise' });
      }

      const instance = await instanceService.update(req.params.id, entrepriseId, req.body || {});
      if (!instance) {
        return res.status(404).json({ success: false, message: 'Instance introuvable' });
      }
      res.json({ success: true, data: instance });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.post('/instances/:id/test', authenticateJWT, async (req, res) => {
    try {
      const entrepriseId = getEntrepriseId(req);
      const instance = await instanceService.getById(req.params.id, entrepriseId);
      if (!instance) {
        return res.status(404).json({ success: false, message: 'Instance introuvable' });
      }
      const result = await runtime.testConnection(instance);
      res.json({ success: result.success, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/instances/:id/poll', authenticateJWT, async (req, res) => {
    try {
      const entrepriseId = getEntrepriseId(req);
      const instance = await instanceService.getById(req.params.id, entrepriseId);
      if (!instance) {
        return res.status(404).json({ success: false, message: 'Instance introuvable' });
      }

      const scheduler = getConnectorScheduler();
      const result = scheduler
        ? await scheduler.pollInstance(instance)
        : await runtime.ingestPoll(instance);

      if (result.cursor != null) {
        await instanceService.updateCursor(instance._id, result.cursor);
      }

      res.json({
        success: result.success !== false,
        data: {
          messages: result.messages || [],
          cursor: result.cursor || null
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/instances/:id', authenticateJWT, async (req, res) => {
    try {
      const entrepriseId = getEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité courante requise' });
      }
      const deleted = await instanceService.delete(req.params.id, entrepriseId);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Instance introuvable' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.get('/:connectorId/template', authenticateJWT, (req, res) => {
    const manifest = connectorRegistry.getManifest(req.params.connectorId);
    if (!manifest) {
      return res.status(404).json({ success: false, message: 'Connecteur introuvable' });
    }

    const presetId = req.query.presetId ? String(req.query.presetId) : null;
    res.json({
      success: true,
      data: {
        connectorId: manifest.id,
        presets: listPresets(manifest),
        template: resolveInstanceTemplate(manifest, presetId)
      }
    });
  });

  router.get('/:connectorId', (req, res) => {
    const manifest = connectorRegistry.getManifest(req.params.connectorId);
    if (!manifest) {
      return res.status(404).json({ success: false, message: 'Connecteur introuvable' });
    }
    res.json({
      success: true,
      data: {
        ...manifest,
        presets: listPresets(manifest)
      }
    });
  });

  return router;
}

module.exports = createConnectorsRouter;
