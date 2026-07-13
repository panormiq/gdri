/**
 * Routes API orchestrateur agent-flow.
 * Fichier : backend/routes/agent-flows.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateJWT } = require('../config/jwt');
const flowBrickRegistry = require('../core/agent-flow/FlowBrickRegistry');
const { AgentFlowService } = require('../core/agent-flow/AgentFlowService');
const { FlowExecutor } = require('../core/agent-flow/FlowExecutor');
const { describeSchedule } = require('../core/agent-flow/CronEvaluator');

function createAgentFlowsRouter(database) {
  const router = express.Router();
  const flowService = new AgentFlowService(database);
  const executor = new FlowExecutor(database);

  function requireAdminEntity(req, res, next) {
    const role = req.user && req.user.role;
    if (role === 'ADMIN_GDRI' || role === 'ADMIN_ENTITY') return next();
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }

  function resolveEntrepriseId(req) {
    const fromQuery = req.query.entrepriseId || req.query.entityId;
    const fromBody = req.body && (req.body.entrepriseId || req.body.entityId);
    const userEntreprise = req.user.currentEntrepriseId || req.user.entrepriseId;
    if (req.user.role === 'ADMIN_GDRI') {
      return String(fromBody || fromQuery || userEntreprise || '').trim() || null;
    }
    return String(userEntreprise || '').trim() || null;
  }

  router.get('/health', (req, res) => {
    res.json({ success: true, service: 'agent-flows', version: '1.0.0' });
  });

  /** Catalogue briques — orchestrateur uniquement */
  router.get('/bricks', authenticateJWT, requireAdminEntity, (req, res) => {
    const kind = req.query.kind || null;
    const category = req.query.category || null;
    const bricks = flowBrickRegistry.list({
      kind: kind || undefined,
      category: category || undefined,
      orchestratorOnly: true
    });
    res.json({
      success: true,
      bricks,
      groups: {
        triggers: bricks.filter((b) => b.kind === 'trigger'),
        actions: bricks.filter((b) => b.kind === 'action')
      }
    });
  });

  router.get('/bricks/:id', authenticateJWT, requireAdminEntity, (req, res) => {
    const brick = flowBrickRegistry.get(req.params.id);
    if (!brick) {
      return res.status(404).json({ success: false, message: 'Brique introuvable' });
    }
    res.json({ success: true, brick: flowBrickRegistry.serialize(brick) });
  });

  router.get('/bricks/:id/icon', (req, res) => {
    const iconPath = flowBrickRegistry.resolveIconPath(req.params.id);
    if (!iconPath) {
      return res.status(404).end();
    }
    res.type(path.extname(iconPath) || '.svg');
    return res.sendFile(path.resolve(iconPath));
  });

  router.get('/flows', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const flows = await flowService.listFlows(entrepriseId);
      res.json({ success: true, flows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/flows/:id', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      res.json({ success: true, flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/flows', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const flow = await flowService.createFlow(entrepriseId, req.body || {});
      res.json({ success: true, flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/flows/:id', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      const updated = await flowService.updateFlow(req.params.id, req.body || {});
      res.json({ success: true, flow: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/flows/:id', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      await flowService.deleteFlow(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/flows/:id/run', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      const run = await executor.execute(flow, {
        triggerMode: 'manual',
        triggeredBy: req.user.user_id || req.user.email || null
      });
      res.json({ success: true, run });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/runs', authenticateJWT, requireAdminEntity, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      const runs = await flowService.listRuns({
        entrepriseId: entrepriseId || null,
        flowId: req.query.flowId || null,
        limit: req.query.limit
      });
      res.json({ success: true, runs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/schedule/preview', authenticateJWT, requireAdminEntity, (req, res) => {
    const config = {
      preset: req.query.preset,
      minute: Number(req.query.minute),
      hour: Number(req.query.hour),
      dayOfWeek: Number(req.query.dayOfWeek),
      dayOfMonth: Number(req.query.dayOfMonth),
      cron: req.query.cron
    };
    res.json({
      success: true,
      label: describeSchedule(config),
      cron: require('../core/agent-flow/CronEvaluator').resolveCronExpression(config)
    });
  });

  return router;
}

module.exports = createAgentFlowsRouter;
