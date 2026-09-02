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
const { TEMPLATES, TEMPLATE_CATALOG, isSystemAgentFlow, isSystemTemplateId } = require('../core/agent-flow/flowTemplates');
const { buildRunProgress, flowSnapshot } = require('../core/agent-flow/runProgress');
const { runData } = require('../core/agent-flow/families/FamilyDispatch');
const {
  listPresetCollectionMeta,
  ensurePresetCollection
} = require('../core/agent-flow/presetCollections');
const {
  collectConditionCollectionIds,
  flowConditionCollectionStale,
  loadCollectionsForConditionStale
} = require('../core/agent-flow/conditionCollectionStale');

const PREVIEW_SECRET_KEY = /token|password|secret|credential|accessToken/i;
const PREVIEW_SKIP_KEYS = new Set(['content', 'raw', 'pageAccessToken', 'credentials']);
const PREVIEW_MAX_ITEMS = 50;
const PREVIEW_MAX_TEXT = 4000;

function sanitizePreviewValue(value, depth = 0) {
  if (value == null) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[buffer ${value.length} octets]`;
  }
  if (typeof value === 'string') {
    return value.length > PREVIEW_MAX_TEXT ? `${value.slice(0, PREVIEW_MAX_TEXT)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth > 4) return `[${value.length} éléments]`;
    return value.slice(0, 80).map((item) => sanitizePreviewValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (value._bsontype) return String(value);
    if (depth > 4) return '[objet]';
    const out = {};
    Object.keys(value).slice(0, 40).forEach((key) => {
      if (PREVIEW_SKIP_KEYS.has(key) || PREVIEW_SECRET_KEY.test(key)) {
        out[key] = '[masqué]';
        return;
      }
      if (key === 'attachments' && Array.isArray(value.attachments)) {
        out.attachments = value.attachments.map((att) => ({
          filename: att && att.filename,
          contentType: att && att.contentType,
          size: att && att.size,
          url: att && att.url,
          path: att && att.path
        }));
        return;
      }
      out[key] = sanitizePreviewValue(value[key], depth + 1);
    });
    return out;
  }
  return String(value);
}

function sanitizeDataPreview(table, meta = {}) {
  const src = table && typeof table === 'object' ? table : {};
  const items = Array.isArray(src.items) ? src.items : [];
  const clipped = items.slice(0, PREVIEW_MAX_ITEMS).map((row) => sanitizePreviewValue(row));
  const debug = src.debug && typeof src.debug === 'object'
    ? {
      request: sanitizePreviewValue(src.debug.request),
      response: sanitizePreviewValue(src.debug.response)
    }
    : null;
  return {
    nodeId: meta.nodeId || null,
    name: meta.name || 'Entrées',
    fetchedAt: new Date().toISOString(),
    provider: src.provider || src.channel || '',
    channel: src.channel || src.provider || '',
    itemsCount: src.itemsCount != null ? Number(src.itemsCount) : items.length,
    itemsShown: clipped.length,
    truncated: items.length > PREVIEW_MAX_ITEMS,
    empty: !!src.empty || !items.length,
    error: src.error ? String(src.error) : null,
    note: src.note ? String(src.note) : null,
    modelName: src.modelName ? String(src.modelName) : '',
    modelFields: Array.isArray(src.modelFields) ? src.modelFields : [],
    items: clipped,
    debug
  };
}

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

  function isGdriAdmin(req) {
    return !!(req.user && req.user.role === 'ADMIN_GDRI');
  }

  function redactSystemFlow(flow) {
    if (!flow) return null;
    return {
      _id: flow._id,
      name: flow.name,
      description: flow.description,
      templateId: flow.templateId || null,
      official: true,
      importable: flow.importable === true,
      enabled: flow.enabled !== false,
      entrepriseId: flow.entrepriseId,
      exports: flow.exports && typeof flow.exports === 'object' ? flow.exports : {},
      imageUrl: flow.imageUrl || ''
    };
  }

  function systemAgentDenied(res) {
    return res.status(403).json({
      success: false,
      systemLocked: true,
      message: 'Agent système GDRI : seuls les administrateurs GDRI peuvent l’ouvrir ou le modifier.'
    });
  }

  function flowPayloadForClient(req, flow) {
    if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) {
      return redactSystemFlow(flow);
    }
    return flow;
  }

  /** Admin : tout flow de l'entité. User : ses flows (+ legacy sans createdBy). */
  function canManageFlow(req, flow) {
    if (!flow) return false;
    if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) return false;
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

  router.get('/block-contracts', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { listBlockInputContracts } = require('../core/agent-flow/blockContracts');
      res.json({ success: true, contracts: listBlockInputContracts(flowBrickRegistry) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/llms', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { listAvailableLlms } = require('../../modules/ia/backend/services/AvailableModels');
      const llms = await listAvailableLlms(entrepriseId, {
        userId: resolveUserId(req) || (req.user && req.user.sub ? String(req.user.sub) : null)
      });
      res.json({ success: true, llms });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/block-contracts/:brickId', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { getBlockInputContract } = require('../core/agent-flow/blockContracts');
      const contract = getBlockInputContract(flowBrickRegistry, req.params.brickId);
      if (!contract) {
        return res.status(404).json({ success: false, message: 'Contrat introuvable' });
      }
      res.json({ success: true, contract });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/data-contracts', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { loadDataContracts } = require('../core/agent-flow/dataContracts');
      res.json({ success: true, contracts: loadDataContracts() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/app-crud', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { catalogPayload } = require('../core/agent-flow/app-crud/appCrudRegistry');
      res.json({ success: true, catalog: catalogPayload() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/action-contracts', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { loadActionContracts } = require('../core/agent-flow/actionContracts');
      const { loadZoneContracts } = require('../core/agent-flow/zoneContracts');
      res.json({
        success: true,
        contracts: loadActionContracts(),
        zones: loadZoneContracts()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/block-templates', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { listTemplates, kindsForUsage } = require('../core/agent-flow/blockTemplate');
      const usage = String(req.query.usage || '').trim().toLowerCase();
      const provider = String(req.query.provider || '').trim().toLowerCase();
      if (!kindsForUsage(usage, provider)) {
        return res.json({ success: true, templates: [] });
      }
      const templates = await listTemplates(database, entrepriseId, usage, provider);
      res.json({ success: true, templates });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/production-templates', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { listProductionTemplates } = require('../core/agent-flow/productionTemplates');
      res.json({ success: true, templates: listProductionTemplates(req.query.usage) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/production-templates/match', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { matchProductionTemplate, summarize } = require('../core/agent-flow/productionTemplates');
      const fields = String(req.query.fields || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const matched = matchProductionTemplate({
        usage: String(req.query.usage || 'validation'),
        brief: String(req.query.brief || ''),
        reviewContext: String(req.query.reviewContext || ''),
        agentContext: String(req.query.agentContext || ''),
        channel: String(req.query.channel || ''),
        fields
      });
      res.json({
        success: true,
        template: matched ? summarize(matched) : null,
        html: matched && matched.kind === 'html' ? matched.html : '',
        values: matched && matched.values ? matched.values : null,
        outputHint: matched && matched.outputHint ? matched.outputHint : '',
        outputFormat: matched && matched.outputFormat ? matched.outputFormat : ''
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/production-templates/:id', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { getProductionTemplate, summarize } = require('../core/agent-flow/productionTemplates');
      const doc = getProductionTemplate(req.params.id);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Modèle de production introuvable' });
      }
      res.json({
        success: true,
        template: summarize(doc),
        html: doc.kind === 'html' ? doc.html : '',
        values: doc.values || null,
        outputHint: doc.outputHint || '',
        outputFormat: doc.outputFormat || ''
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/block-templates/:id', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { getTemplateWithSlots } = require('../core/agent-flow/blockTemplate');
      const packed = await getTemplateWithSlots(database, entrepriseId, req.params.id);
      if (!packed) {
        return res.status(404).json({ success: false, message: 'Template introuvable' });
      }
      res.json({ success: true, template: packed.template, slots: packed.slots });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
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
      const scope = String(req.query.scope || 'entity').toLowerCase();
      if ((scope === 'gdri' || scope === 'system') && !isGdriAdmin(req)) {
        return res.status(403).json({
          success: false,
          systemLocked: true,
          message: 'La liste des agents système est réservée aux administrateurs GDRI.'
        });
      }
      const flows = await flowService.listFlows(entrepriseId, {
        interactionMode: mode === 'automatic' || mode === 'assisted' ? mode : null
      });
      const collectionsById = req.entrepriseDb
        ? await loadCollectionsForConditionStale(req.entrepriseDb, collectConditionCollectionIds(flows))
        : {};
      const enriched = flows.map((f) => ({
        ...f,
        canManage: canManageFlow(req, f),
        staleCollections: flowConditionCollectionStale(f, collectionsById),
        system: isSystemAgentFlow(f)
      }));
      let listed = enriched;
      if (scope === 'gdri' || scope === 'system') {
        listed = enriched.filter((f) => isSystemAgentFlow(f));
      } else if (scope === 'all' && isGdriAdmin(req)) {
        listed = enriched;
      } else {
        listed = enriched.filter((f) => !isSystemAgentFlow(f));
      }
      res.json({ success: true, flows: listed });
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
      if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) {
        return res.json({
          success: true,
          systemLocked: true,
          canManage: false,
          flow: redactSystemFlow(flow)
        });
      }
      res.json({ success: true, flow, canManage: canManageFlow(req, flow) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  async function syncFacebookFromFlow(flow) {
    const {
      syncFacebookAgentSettings,
      extractFacebookConfigsFromFlow
    } = require('../core/connectors/syncFacebookAgentSettings');
    const configs = extractFacebookConfigsFromFlow(flow);
    if (!configs.length || !flow || !flow.entrepriseId) return null;
    let matched = 0;
    let modified = 0;
    for (const fbCfg of configs) {
      const r = await syncFacebookAgentSettings(database, flow.entrepriseId, fbCfg);
      matched += (r && r.matched) || 0;
      modified += (r && r.modified) || 0;
    }
    return { matched, modified };
  }

  async function syncMailFromFlow(flow) {
    const {
      syncMailAgentSettings,
      extractMailConfigsFromFlow
    } = require('../core/connectors/syncMailAgentSettings');
    const configs = extractMailConfigsFromFlow(flow);
    if (!configs.length || !flow || !flow.entrepriseId) return null;
    let matched = 0;
    let modified = 0;
    for (const mailCfg of configs) {
      const r = await syncMailAgentSettings(database, flow.entrepriseId, mailCfg);
      matched += (r && r.matched) || 0;
      modified += (r && r.modified) || 0;
    }
    return { matched, modified };
  }

  router.post('/flows', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const body = { ...(req.body || {}), createdBy: resolveUserId(req) };
      if (!isGdriAdmin(req)) {
        delete body.official;
        if (isSystemTemplateId(body.templateId)) delete body.templateId;
      }
      const flow = await flowService.createFlow(entrepriseId, body);
      let facebookSync = null;
      let mailSync = null;
      try {
        facebookSync = await syncFacebookFromFlow(flow);
      } catch (syncErr) {
        console.warn('syncFacebookFromFlow (create):', syncErr.message);
      }
      try {
        mailSync = await syncMailFromFlow(flow);
      } catch (syncErr) {
        console.warn('syncMailFromFlow (create):', syncErr.message);
      }
      res.json({ success: true, flow, facebookSync, mailSync });
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
      if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) {
        return systemAgentDenied(res);
      }
      if (!canManageFlow(req, flow)) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez modifier que vos propres agents' });
      }
      const patch = { ...(req.body || {}) };
      if (!isGdriAdmin(req)) {
        delete patch.official;
        if (isSystemTemplateId(patch.templateId)) delete patch.templateId;
      }
      const updated = await flowService.updateFlow(req.params.id, patch);
      let facebookSync = null;
      let mailSync = null;
      try {
        facebookSync = await syncFacebookFromFlow(updated);
      } catch (syncErr) {
        console.warn('syncFacebookFromFlow (update):', syncErr.message);
      }
      try {
        mailSync = await syncMailFromFlow(updated);
      } catch (syncErr) {
        console.warn('syncMailFromFlow (update):', syncErr.message);
      }
      res.json({ success: true, flow: updated, facebookSync, mailSync });
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
      if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) {
        return systemAgentDenied(res);
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
      const triggerNodeId = String(
        (req.body && req.body.triggerNodeId) ||
        (triggerPayload && triggerPayload.triggerNodeId) ||
        ''
      ).trim();
      const wantsLatestPost =
        req.body && (req.body.fetchLatestPost === true || req.body.fetchLatestPost === '1');
      const hasFacebookData =
        flowService.flowHasDataProvider(flow, 'facebook') ||
        flow.templateId === 'agent-facebook' ||
        String(flow.name || '').toLowerCase().includes('facebook');

      // Agent Facebook : lancer manuel = récupérer le dernier post de la page
      if ((wantsLatestPost || hasFacebookData) && !(triggerPayload && triggerPayload.message)) {
        const { fetchLatestFacebookPost } = require('../core/connectors/fetchLatestFacebookPost');
        const { extractFacebookConfigFromFlow } = require('../core/connectors/syncFacebookAgentSettings');
        const fbCfg = extractFacebookConfigFromFlow(flow) || {};
        const pageId = (req.body && req.body.pageId) || fbCfg.pageId || null;
        const message = await fetchLatestFacebookPost(database, flow.entrepriseId, pageId);
        triggerPayload = {
          ...(triggerPayload && typeof triggerPayload === 'object' ? triggerPayload : {}),
          message,
          source: 'facebook.published_posts.latest',
          triggerBrickId: 'trigger',
          options: { channel: 'facebook' }
        };
      } else if (triggerNodeId && !triggerPayload) {
        triggerPayload = { triggerBrickId: 'trigger' };
      }
      if (triggerPayload && triggerNodeId) triggerPayload.triggerNodeId = triggerNodeId;

      const execOpts = {
        triggerMode: triggerPayload && triggerPayload.source ? 'facebook-latest-post' : 'manual',
        triggeredBy: req.user.user_id || req.user.email || null,
        triggerPayload
      };
      const asyncMode = req.body && (req.body.async === true || req.body.async === '1');
      const run = asyncMode
        ? await executor.start(flow, execOpts)
        : await executor.execute(flow, execOpts);
      res.json({
        success: true,
        run,
        progress: buildRunProgress(flow, run),
        triggerMessage: triggerPayload && triggerPayload.message ? triggerPayload.message : null
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Aperçu lecture d’un bloc Entrées — sans lancer le flow. */
  router.post('/flows/:id/preview-data', authenticateJWT, requireEntityMember, async (req, res) => {
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
        return res.status(403).json({ success: false, message: 'Vous ne pouvez tester que vos propres agents' });
      }

      const body = req.body || {};
      const nodeId = String(body.nodeId || '').trim();
      const canvasNodes = (flow.canvas && Array.isArray(flow.canvas.nodes)) ? flow.canvas.nodes : [];
      const savedNode = nodeId
        ? canvasNodes.find((n) => String(n.id) === nodeId)
        : null;
      const brickId = String((body.brickId || (savedNode && savedNode.brickId) || 'data'));
      if (brickId !== 'data') {
        return res.status(400).json({ success: false, message: 'Seul un bloc Entrées peut être testé.' });
      }
      const config = (body.config && typeof body.config === 'object')
        ? body.config
        : ((savedNode && savedNode.config) || {});
      if (!savedNode && !body.config) {
        return res.status(400).json({
          success: false,
          message: nodeId ? 'Bloc introuvable — enregistrez l’agent, puis réessayez.' : 'nodeId requis'
        });
      }

      const provider = String(config.provider || '').toLowerCase();
      if (!provider) {
        return res.json({
          success: true,
          preview: sanitizeDataPreview({
            items: [],
            itemsCount: 0,
            empty: true,
            error: 'Choisissez un type',
            note: 'Aucun type (Mail, Facebook, collection…) sur ce bloc Entrées.'
          }, {
            nodeId: nodeId || (savedNode && savedNode.id) || null,
            name: String((savedNode && savedNode.name) || body.name || 'Entrées')
          })
        });
      }
      const context = {
        entrepriseId: flow.entrepriseId,
        trigger: { mode: 'manual', payload: {} },
        message: null,
        channel: provider,
        options: { channel: provider }
      };
      const table = await runData(executor, context, config, flow);
      res.json({
        success: true,
        preview: sanitizeDataPreview(table, {
          nodeId: nodeId || (savedNode && savedNode.id) || null,
          name: String((savedNode && savedNode.name) || body.name || 'Entrées')
        })
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
      const flow = await flowService.getFlowById(run.flowId);
      res.json({
        success: true,
        run,
        flow: flowSnapshot(flow),
        progress: buildRunProgress(flow, run)
      });
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
        selectedItems: body.selectedItems,
        values: body.values,
        resumeToken: body.resumeToken || run.resumeToken,
        resumedBy: req.user.user_id || req.user.email || null
      });
      const flow = await flowService.getFlowById(updated.flowId || run.flowId);
      res.json({
        success: true,
        run: updated,
        flow: flowSnapshot(flow),
        progress: buildRunProgress(flow, updated)
      });
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
      if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) {
        return systemAgentDenied(res);
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
      if (isSystemAgentFlow(flow) && !isGdriAdmin(req)) {
        return systemAgentDenied(res);
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

  /** Listes préconstruites = collections V3 (mail, réseaux sociaux, contact…) */
  router.get('/intention-presets', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      res.json({ success: true, presets: listPresetCollectionMeta() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/intention-presets/:presetId/collection', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const bundle = await ensurePresetCollection(entrepriseId, req.params.presetId);
      if (!bundle || !bundle.collection) {
        return res.status(404).json({ success: false, message: 'Preset introuvable' });
      }
      const col = bundle.collection;
      res.json({
        success: true,
        data: {
          ...col,
          _id: col._id,
          elements: bundle.elements || []
        }
      });
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

  router.get('/atelier/presets', authenticateJWT, requireEntityMember, (req, res) => {
    try {
      const { listAtelierPresets } = require('../core/agent-flow/atelierPresets');
      res.json({ success: true, presets: listAtelierPresets() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/atelier/schemas', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { ensureSchemaCatalog, SCHEMA_CATALOG_SLUG } = require('../core/agent-flow/atelierPresets');
      const catalog = await ensureSchemaCatalog(entrepriseId);
      if (!catalog) {
        return res.status(400).json({ success: false, message: 'Catalogue de schémas indisponible' });
      }
      res.json({
        success: true,
        slug: SCHEMA_CATALOG_SLUG,
        ...catalog
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/atelier/collections/ensure', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { ensureAtelierCollection, latestAtelierRecord, listAtelierRows } = require('../core/agent-flow/atelierPresets');
      const presetId = (req.body && (req.body.presetId || req.body.schemaSlug)) || 'design';
      const pack = await ensureAtelierCollection(entrepriseId, presetId);
      if (!pack) return res.status(400).json({ success: false, message: 'Schéma atelier inconnu' });
      const flowId = (req.body && req.body.flowId) || '';
      const record = pack.record
        || await latestAtelierRecord(entrepriseId, pack.collectionId, flowId, pack.schemaSlug);
      let rows = Array.isArray(pack.rows) ? pack.rows : [];
      const listSlug = String(pack.slug || '');
      const isListPack = listSlug.indexOf('atelier-hook') === 0 || listSlug.indexOf('atelier-palette') === 0;
      if (pack.collectionId && (isListPack || !pack.schemaSlug || !rows.length)) {
        rows = await listAtelierRows(entrepriseId, pack.collectionId);
      }
      res.json({ success: true, ...pack, record: record || null, rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/atelier/palette', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const {
        ensureAtelierCollection,
        writeAtelierListRow,
        listAtelierRows
      } = require('../core/agent-flow/atelierPresets');
      const pack = await ensureAtelierCollection(entrepriseId, 'palette');
      if (!pack) return res.status(400).json({ success: false, message: 'Catalogue palette introuvable' });
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'Nom du bouton palette obligatoire' });
      const values = {
        name,
        iconEmoji: String(body.iconEmoji || '').trim() || '🪝',
        logoUrl: String(body.logoUrl || '').trim(),
        parentFamily: String(body.parentFamily || 'action').trim() || 'action',
        flowId: String(body.flowId || '').trim(),
        templateId: String(body.templateId || '').trim(),
        description: String(body.description || '').trim(),
        color: String(body.color || '').trim() || '#7c3aed',
        hookSurface: String(body.hookSurface || 'palette').trim() || 'palette'
      };
      const written = await writeAtelierListRow(entrepriseId, pack.collectionId, values, {
        rowId: body.rowId || '',
        flowId: values.flowId
      });
      const rows = await listAtelierRows(entrepriseId, pack.collectionId);
      res.json({ success: true, ...pack, ...written, rows });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.post('/atelier/records', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { writeAtelierRecord } = require('../core/agent-flow/atelierPresets');
      const body = req.body || {};
      const written = await writeAtelierRecord(
        entrepriseId,
        body.collectionId,
        body.values || {},
        {
          flowId: body.flowId,
          nodeId: body.nodeId,
          schemaSlug: body.schemaSlug || body.presetId || ''
        }
      );
      res.json({ success: true, ...written });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.post('/visualization/design-suggest', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      const { suggestVizDesign } = require('../core/agent-flow/vizConception');
      const result = await suggestVizDesign({
        entrepriseId,
        brief: (req.body && (req.body.brief || req.body.prompt)) || ''
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post('/visualization/design-fork', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { forkDesignTemplate } = require('../core/agent-flow/vizConception');
      const result = await forkDesignTemplate(
        entrepriseId,
        (req.body && req.body.templateId) || '',
        (req.body && req.body.name) || ''
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Étape 1 visualisation : couleurs, logo, zones (page web). */
  router.post('/visualization/design', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { applyVizDesign } = require('../core/agent-flow/vizConception');
      const result = await applyVizDesign({
        entrepriseId,
        name: (req.body && req.body.name) || 'Design agent',
        templateId: (req.body && (req.body.templateId || req.body.baseTemplateId)) || '',
        design: (req.body && req.body.design) || req.body || {}
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** @deprecated alias — étape 1 design web. */
  router.post('/visualization/generate', authenticateJWT, requireEntityMember, async (req, res) => {
    try {
      const entrepriseId = resolveEntrepriseId(req);
      if (!entrepriseId) {
        return res.status(400).json({ success: false, message: 'Entité non définie' });
      }
      const { applyVizDesign } = require('../core/agent-flow/vizConception');
      const result = await applyVizDesign({
        entrepriseId,
        name: (req.body && req.body.name) || 'Design agent',
        templateId: (req.body && (req.body.templateId || req.body.baseTemplateId)) || '',
        design: (req.body && req.body.design) || req.body || {}
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** Liste des templates disponibles */
  router.get('/templates', authenticateJWT, requireEntityMember, (req, res) => {
    const importableOnly = String(req.query.importable || '') === '1';
    const templates = importableOnly
      ? TEMPLATE_CATALOG.filter((t) => t.importable)
      : TEMPLATE_CATALOG;
    res.json({ success: true, templates });
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
          return res.json({ success: true, flow: flowPayloadForClient(req, existing), created: false });
        }
      }
      const payload = factory(entrepriseId);
      const flow = await flowService.createFromTemplate(entrepriseId, payload, {
        createdBy: userId
      });

      if (templateId === 'agent-design-page-web') {
        const { ensureSchemaCatalog, loadSchemaFieldsAsCollection } = require('../core/agent-flow/atelierPresets');
        const catalog = await ensureSchemaCatalog(entrepriseId);
        const mapped = await loadSchemaFieldsAsCollection(entrepriseId, 'design');
        if (catalog && flow.canvas && Array.isArray(flow.canvas.nodes)) {
          flow.canvas.nodes.forEach((n) => {
            if (!n || !n.config) return;
            const wantsDesign = n.slug === 'collection_design'
              || n.config.schemaSlug === 'design'
              || n.config.collectionNamespace === 'atelier-design-page-web'
              || n.config.collectionNamespace === 'atelier-schemas';
            if (!wantsDesign) return;
            n.config.schemaSlug = 'design';
            n.config.collectionId = catalog.collectionId;
            n.config.collectionNamespace = catalog.slug;
            n.config.modelName = (mapped && mapped.modelName) || 'Collection design';
            if (mapped) {
              n.config.modelFields = mapped.modelFields;
              n.config.modelRows = mapped.modelRows;
            }
          });
          await flowService.updateFlow(flow._id, { canvas: flow.canvas });
        }
        const fresh = await flowService.getFlowById(flow._id);
        return res.status(201).json({ success: true, flow: flowPayloadForClient(req, fresh || flow), created: true });
      }

      if (templateId === 'agent-hook') {
        const { ensureAtelierCollection } = require('../core/agent-flow/atelierPresets');
        const hookPack = await ensureAtelierCollection(entrepriseId, 'hook');
        if (hookPack && flow.canvas && Array.isArray(flow.canvas.nodes)) {
          flow.canvas.nodes.forEach((n) => {
            if (!n || !n.config) return;
            const wantsHook = n.config.presetId === 'hook'
              || n.config.collectionNamespace === 'atelier-hook'
              || n.slug === 'liste_hooks';
            if (!wantsHook) return;
            n.config.collectionId = hookPack.collectionId;
            n.config.collectionNamespace = hookPack.slug;
          });
          await flowService.updateFlow(flow._id, { canvas: flow.canvas });
        }
        const freshHook = await flowService.getFlowById(flow._id);
        return res.status(201).json({ success: true, flow: flowPayloadForClient(req, freshHook || flow), created: true });
      }

      // Seed configs briques (preset selon le type d'agent)
      const presetByTemplate = {
        'agent-mail': 'mail',
        'agent-facebook': 'reseaux-sociaux',
        'agent-assisted-doc': 'mail',
        'agent-mail-invoices': 'mail'
      };
      const presetId = presetByTemplate[templateId] || 'mail';
      const bundle = await ensurePresetCollection(entrepriseId, presetId);
      const intentions = (bundle && bundle.elements)
        ? bundle.elements.map((el) => ({
          id: el.name || el.id,
          name: el.name || el.id,
          definition: el.definition || '',
          priority: el.priority || 'medium'
        }))
        : [];
      await brickConfigService.upsertConfig(flow._id, 'route-intention', entrepriseId, {
        config: brickConfigService.getDefaultRouteConfig(intentions.length ? intentions : presetId)
      });
      if (bundle && flow.canvas && Array.isArray(flow.canvas.nodes)) {
        let patched = false;
        flow.canvas.nodes.forEach((n) => {
          if (!n || n.brickId !== 'data' || !n.config) return;
          const isListe = n.config.presetId === presetId
            || (n.config.provider === 'json' && n.slug === 'liste_intentions');
          if (!isListe) return;
          n.config.collectionId = String(bundle.collectionId || bundle.collection._id || '');
          n.config.collectionNamespace = bundle.slug;
          n.config.provider = 'json';
          patched = true;
        });
        if (patched) await flowService.updateFlow(flow._id, { canvas: flow.canvas });
      }

      res.status(201).json({ success: true, flow, created: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
}

module.exports = createAgentFlowsRouter;
