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
const { AgentBrickConfigService } = require('../core/agent-flow/AgentBrickConfigService');
const { describeSchedule } = require('../core/agent-flow/CronEvaluator');
const { TEMPLATES } = require('../core/agent-flow/flowTemplates');

function createAgentFlowsRouter(database) {
  const router = express.Router();
  const flowService = new AgentFlowService(database);
  const executor = new FlowExecutor(database);
  const brickConfigService = new AgentBrickConfigService(database);

  function requireAdminEntity(req, res, next) {
    const role = req.user && req.user.role;
    if (role === 'ADMIN_GDRI' || role === 'ADMIN_ENTITY') return next();
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }

  /** Lecture / reprise HITL / CRUD agents : tout membre de l'entité */
  function requireEntityMember(req, res, next) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
    const role = req.user.role;
    if (
      role === 'ADMIN_GDRI' ||
      role === 'ADMIN_ENTITY' ||
      role === 'USER_ENTITY' ||
      role === 'USER'
    ) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }

  function resolveUserId(req) {
    if (!req.user) return null;
    return String(
      req.user.user_id || req.user.id || req.user._id || req.user.userId || ''
    ).trim() || null;
  }

  function isEntityAdmin(req) {
    const role = req.user && req.user.role;
    return role === 'ADMIN_GDRI' || role === 'ADMIN_ENTITY';
  }

  /** Admin : tout flow de l'entité. User : ses flows (+ legacy sans createdBy). */
  function canManageFlow(req, flow) {
    if (!flow) return false;
    if (isEntityAdmin(req)) return true;
    const uid = resolveUserId(req);
    if (!uid) return false;
    if (flow.createdBy == null || flow.createdBy === '') return true;
    return String(flow.createdBy) === uid;
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
  /**
   * Pages Facebook de l'entité — dual-read :
   * connector_instances (UI Connecteurs) + facebook_configs (tokens OAuth).
   * GET /api/agent-flows/facebook-pages?entrepriseId=
   */
  router.get('/facebook-pages', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const eid = String(entrepriseId);

      const [configs, instances] = await Promise.all([
        database
          .getCollection('facebook_configs')
          .find({ entrepriseId: eid })
          .project({
            pageId: 1,
            pageName: 1,
            pageAccessToken: 1,
            tokenStatus: 1,
            webhooks_subscribed: 1
          })
          .toArray(),
        database
          .getCollection('connector_instances')
          .find({ entrepriseId: eid, connectorId: 'facebook' })
          .project({
            name: 1,
            enabled: 1,
            settings: 1,
            ingestModes: 1
          })
          .toArray()
      ]);

      const byPageId = new Map();

      (configs || []).forEach((c) => {
        if (!c || !c.pageId) return;
        const pageId = String(c.pageId);
        byPageId.set(pageId, {
          pageId,
          pageName: String(c.pageName || `Page ${pageId}`),
          hasToken: Boolean(c.pageAccessToken),
          tokenStatus: c.tokenStatus || (c.pageAccessToken ? 'active' : 'missing'),
          webhooksSubscribed: Array.isArray(c.webhooks_subscribed) ? c.webhooks_subscribed : [],
          source: 'facebook_configs',
          instanceId: null,
          enabled: true
        });
      });

      (instances || []).forEach((inst) => {
        const pageId = inst && inst.settings && inst.settings.pageId
          ? String(inst.settings.pageId)
          : '';
        if (!pageId) return;
        const existing = byPageId.get(pageId);
        const pageName = String(
          (inst.settings && inst.settings.pageName) ||
            inst.name ||
            (existing && existing.pageName) ||
            `Page ${pageId}`
        );
        byPageId.set(pageId, {
          pageId,
          pageName,
          hasToken: existing ? existing.hasToken : true,
          tokenStatus: existing
            ? existing.tokenStatus
            : (inst.enabled === false ? 'inactive' : 'active'),
          webhooksSubscribed: existing ? existing.webhooksSubscribed : [],
          source: existing ? 'both' : 'connector_instances',
          instanceId: inst._id ? String(inst._id) : null,
          enabled: inst.enabled !== false
        });
      });

      const pages = Array.from(byPageId.values()).sort((a, b) =>
        String(a.pageName).localeCompare(String(b.pageName), 'fr')
      );

      return res.json({
        success: true,
        pages,
        count: pages.length,
        entrepriseId: eid,
        sources: {
          facebookConfigs: (configs || []).length,
          connectorInstances: (instances || []).length
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/bricks', authenticateJWT, requireEntityMember, (req, res) => {
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

  router.get('/bricks/:id', authenticateJWT, requireEntityMember, (req, res) => {
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

  router.get('/flows', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const mode = req.query.interactionMode || req.query.mode || null;
      const flows = await flowService.listFlows(entrepriseId, {
        interactionMode: mode === 'automatic' || mode === 'assisted' ? mode : null
      });
      const enriched = flows.map((f) => ({
        ...f,
        canManage: canManageFlow(req, f)
      }));
      res.json({ success: true, flows: enriched });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/flows/:id', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      res.json({ success: true, flow, canManage: canManageFlow(req, flow) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  async function syncFacebookFromFlow(flow) {
    const {
      syncFacebookAgentSettings,
      extractFacebookConfigFromFlow
    } = require('../core/connectors/syncFacebookAgentSettings');
    const fbCfg = extractFacebookConfigFromFlow(flow);
    if (!fbCfg || !flow || !flow.entrepriseId) return null;
    return syncFacebookAgentSettings(database, flow.entrepriseId, fbCfg);
  }

  router.post('/flows', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const body = { ...(req.body || {}), createdBy: resolveUserId(req) };
      const flow = await flowService.createFlow(entrepriseId, body);
      let facebookSync = null;
      try {
        facebookSync = await syncFacebookFromFlow(flow);
      } catch (syncErr) {
        console.warn('syncFacebookFromFlow (create):', syncErr.message);
      }
      res.json({ success: true, flow, facebookSync });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/flows/:id', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      if (!canManageFlow(req, flow)) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez modifier que vos propres agents' });
      }
      const updated = await flowService.updateFlow(req.params.id, req.body || {});
      let facebookSync = null;
      try {
        facebookSync = await syncFacebookFromFlow(updated);
      } catch (syncErr) {
        console.warn('syncFacebookFromFlow (update):', syncErr.message);
      }
      res.json({ success: true, flow: updated, facebookSync });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.delete('/flows/:id', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      if (!canManageFlow(req, flow)) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez supprimer que vos propres agents' });
      }
      await flowService.deleteFlow(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/flows/:id/run', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) {
        return res.status(404).json({ success: false, message: 'Flow introuvable' });
      }
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }

      let triggerPayload = (req.body && req.body.triggerPayload) || null;
      const wantsLatestPost =
        req.body && (req.body.fetchLatestPost === true || req.body.fetchLatestPost === '1');
      const triggerBrick = flow.trigger && flow.trigger.brickId;
      const isFacebookPilot =
        flow.templateId === 'agent-facebook' ||
        triggerBrick === 'facebook' ||
        (Array.isArray(flow.steps) &&
          flow.steps.some((s) => s.brickId === 'analyse-intention') &&
          (triggerBrick === 'manual-trigger' || triggerBrick === 'facebook') &&
          String(flow.name || '').toLowerCase().includes('facebook'));

      // Agent Facebook : lancer manuel = récupérer le dernier post de la page
      if ((wantsLatestPost || isFacebookPilot) && !triggerPayload) {
        const { fetchLatestFacebookPost } = require('../core/connectors/fetchLatestFacebookPost');
        const pageId =
          (req.body && req.body.pageId) ||
          (flow.trigger && flow.trigger.config && flow.trigger.config.pageId) ||
          null;
        const message = await fetchLatestFacebookPost(database, flow.entrepriseId, pageId);
        triggerPayload = { message, source: 'facebook.published_posts.latest' };
      }

      const run = await executor.execute(flow, {
        triggerMode: triggerPayload && triggerPayload.source ? 'facebook-latest-post' : 'manual',
        triggeredBy: req.user.user_id || req.user.email || null,
        triggerPayload
      });
      res.json({
        success: true,
        run,
        triggerMessage: triggerPayload && triggerPayload.message ? triggerPayload.message : null
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/runs', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      const runs = await flowService.listRuns({
        entrepriseId: entrepriseId || null,
        flowId: req.query.flowId || null,
        status: req.query.status || null,
        limit: req.query.limit
      });
      res.json({ success: true, runs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/runs/:id', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const run = await flowService.getRunById(req.params.id);
      if (!run) return res.status(404).json({ success: false, message: 'Run introuvable' });
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(run.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      res.json({ success: true, run });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Reprise après validation humaine (approve | reject) */
  router.post('/runs/:id/resume', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const run = await flowService.getRunById(req.params.id);
      if (!run) return res.status(404).json({ success: false, message: 'Run introuvable' });
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(run.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      const body = req.body || {};
      const updated = await executor.resume(req.params.id, {
        decision: body.decision,
        editedHtml: body.editedHtml,
        editedText: body.editedText,
        resumeToken: body.resumeToken || run.resumeToken,
        resumedBy: req.user.user_id || req.user.email || null
      });
      res.json({ success: true, run: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.get('/schedule/preview', authenticateJWT, requireEntityMember, (req, res) => {
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

  /** Config métier d'une brique pour un agent (intentions / routage) */
  router.get('/flows/:id/brick-config/:brickId', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) return res.status(404).json({ success: false, message: 'Flow introuvable' });
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      if (!canManageFlow(req, flow)) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez configurer que vos propres agents' });
      }
      const brickId = String(req.params.brickId);
      let doc = await brickConfigService.getConfig(flow._id, brickId);
      if (!doc) {
        const defaults =
          brickId === 'route-intention'
            ? brickConfigService.getDefaultRouteConfig()
            : brickConfigService.getDefaultAnalyseConfig();
        doc = { flowId: String(flow._id), brickId, config: defaults };
      }
      res.json({ success: true, data: doc });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.put('/flows/:id/brick-config/:brickId', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const flow = await flowService.getFlowById(req.params.id);
      if (!flow) return res.status(404).json({ success: false, message: 'Flow introuvable' });
      const entrepriseId = resolveEntrepriseId(req);
      if (req.user.role !== 'ADMIN_GDRI' && String(flow.entrepriseId) !== String(entrepriseId)) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
      }
      if (!canManageFlow(req, flow)) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez configurer que vos propres agents' });
      }
      const brickId = String(req.params.brickId);
      const config = req.body && req.body.config != null ? req.body.config : req.body;
      const saved = await brickConfigService.upsertConfig(
        flow._id,
        brickId,
        flow.entrepriseId,
        { config }
      );

      // Liste d'intentions = source de vérité des points de routage
      let routeSynced = null;
      if (brickId === 'analyse-intention') {
        const intentions = (saved && saved.config && saved.config.intentions) || [];
        routeSynced = await brickConfigService.syncRouteWithIntentions(
          flow._id,
          flow.entrepriseId,
          intentions
        );
      }

      res.json({
        success: true,
        data: saved,
        routeConfig: routeSynced ? routeSynced.config : undefined
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Listes d'intentions préconstruites (mail, réseaux sociaux, contact…) */
  router.get('/intention-presets', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      res.json({ success: true, presets: brickConfigService.listIntentionPresets() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Types de cible du routage (emails, annuaire, flow-branch…) */
  router.get('/route-target-types', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      res.json({ success: true, types: brickConfigService.listRouteTargetTypes() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/intention-presets/:presetId', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const preset = brickConfigService.getIntentionPreset(req.params.presetId);
      if (!preset) {
        return res.status(404).json({ success: false, message: 'Preset introuvable' });
      }
      res.json({
        success: true,
        preset,
        analyseConfig: brickConfigService.getDefaultAnalyseConfig(preset.id),
        routeConfig: brickConfigService.getDefaultRouteConfig(preset.id)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Liste des templates disponibles */
  router.get('/templates', authenticateJWT, requireEntityMember, (req, res) => {
    res.json({
      success: true,
      templates: [
        { id: 'agent-mail', name: 'Agent Mail', description: 'mail-in → analyse → routage → mail-out' },
        { id: 'agent-facebook', name: 'Agent Facebook', description: 'facebook / manuel → analyse → routage' },
        { id: 'agent-assisted-doc', name: 'Agent assisté (document)', description: 'analyse → revue WYSIWYG → routage' },
        {
          id: 'agent-mail-invoices',
          name: 'Agent factures mail',
          description: 'mail-in → filtre → télécharger PJ → revue → suppression IMAP si validé'
        }
      ]
    });
  });

  /** Créer un agent depuis un template (si pas déjà présent pour ce user / entité) */
  router.post('/templates/:templateId/create', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const templateId = String(req.params.templateId);
      const factory = TEMPLATES[templateId];
      if (!factory) {
        return res.status(404).json({ success: false, message: 'Template introuvable' });
      }
      const userId = resolveUserId(req);
      const force = req.body && req.body.force === true;
      // User : un exemplaire par template et par user. Admin : un par entité (sauf force).
      const ownerKey = isEntityAdmin(req) ? null : userId;
      if (!force) {
        const existing = await flowService.findByTemplateId(entrepriseId, templateId, ownerKey);
        if (existing) {
          return res.json({ success: true, flow: existing, created: false });
        }
      }
      const payload = factory(entrepriseId);
      const flow = await flowService.createFromTemplate(entrepriseId, payload, {
        createdBy: userId
      });

      // Seed configs briques (preset selon le type d'agent)
      const presetByTemplate = {
        'agent-mail': 'mail',
        'agent-facebook': 'reseaux-sociaux',
        'agent-assisted-doc': 'mail',
        'agent-mail-invoices': 'mail'
      };
      const presetId = presetByTemplate[templateId] || 'mail';
      await brickConfigService.upsertConfig(flow._id, 'analyse-intention', entrepriseId, {
        config: brickConfigService.getDefaultAnalyseConfig(presetId)
      });
      await brickConfigService.upsertConfig(flow._id, 'route-intention', entrepriseId, {
        config: brickConfigService.getDefaultRouteConfig(presetId)
      });

      res.status(201).json({ success: true, flow, created: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
}

module.exports = createAgentFlowsRouter;
