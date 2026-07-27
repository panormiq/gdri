/**
 * Migration legacy Mail + Facebook → connector_instances + agent_flows.
 *
 * Usage:
 *   node backend/scripts/migrate-legacy-connectors-to-agents.js --dry-run
 *   node backend/scripts/migrate-legacy-connectors-to-agents.js
 *   node backend/scripts/migrate-legacy-connectors-to-agents.js --entityId=<id>
 *   node backend/scripts/migrate-legacy-connectors-to-agents.js --force-flows
 *
 * Ne supprime PAS les collections legacy (mail_configs, facebook_configs,
 * analyse_intention_configs). Dual-read jusqu'à cutover manuel.
 *
 * Fichier : backend/scripts/migrate-legacy-connectors-to-agents.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const database = require('../config/database');
const connectorRegistry = require('../core/connectors/ConnectorRegistry');
const { ConnectorInstanceService } = require('../core/connectors/ConnectorInstanceService');
const { syncMailAccountConnectors, listAccountsFromConfig } = require('../core/connectors/mail-account-connector-sync');
const { AgentFlowService } = require('../core/agent-flow/AgentFlowService');
const { AgentBrickConfigService } = require('../core/agent-flow/AgentBrickConfigService');
const { mailAgentTemplate, facebookAgentTemplate } = require('../core/agent-flow/flowTemplates');
const { FacebookAgentConfigService } = require('../modules/facebook/services/FacebookAgentConfigService'); // backend/modules/facebook

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    forceFlows: false,
    entityId: null,
    /** mail | facebook | all */
    only: 'all',
    listEntities: false
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force-flows') opts.forceFlows = true;
    else if (arg === '--list-entities') opts.listEntities = true;
    else if (arg === '--facebook-only') opts.only = 'facebook';
    else if (arg === '--mail-only') opts.only = 'mail';
    else if (arg.startsWith('--entityId=')) opts.entityId = arg.slice('--entityId='.length).trim();
    else if (arg.startsWith('--only=')) opts.only = arg.slice('--only='.length).trim();
  }
  return opts;
}

/** Extrait intentions (+ emails) du legacy ; séparés ensuite analyse vs route. */
function extractLegacyIntentions(agentCfg) {
  const custom = Array.isArray(agentCfg.customIntentions) ? agentCfg.customIntentions : [];
  const intentions = custom.map((it, i) => {
    const name = String(it.name || it.category || `intention-${i + 1}`);
    const emails = Array.isArray(it.emails)
      ? it.emails.map((e) => String(e || '').trim()).filter(Boolean)
      : (it.email ? [String(it.email).trim()] : []);
    return {
      id: name,
      name,
      definition: String(it.definition || it.description || ''),
      emails,
      priority: it.priorityUrgent || it.priority || 'medium'
    };
  });

  const defaultEmails = Array.isArray(agentCfg.defaultEmails) && agentCfg.defaultEmails.length
    ? agentCfg.defaultEmails
    : (agentCfg.defaultEmail ? [agentCfg.defaultEmail] : []);

  const list = intentions.length
    ? intentions
    : [
        { id: 'commercial', name: 'commercial', definition: '', emails: [], priority: 'medium' },
        { id: 'sav', name: 'sav', definition: '', emails: [], priority: 'urgent' },
        { id: 'generic', name: 'generic', definition: '', emails: [], priority: 'medium' }
      ];

  return {
    basePrompt: agentCfg.basePrompt || '',
    intentions: list,
    defaultEmails: defaultEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  };
}

/** Analyse = labels + définitions uniquement (pas de destinataires). */
function mapAnalyseToBrickConfig(agentCfg) {
  const legacy = extractLegacyIntentions(agentCfg);
  return {
    basePrompt: legacy.basePrompt,
    intentions: legacy.intentions.map((it) => ({
      id: it.id,
      name: it.name,
      definition: it.definition,
      priority: it.priority
    })),
    intentionMode: 'fixed'
  };
}

/** Routage = destinataires migrés depuis le legacy (emails par intention). */
function mapAnalyseToRouteConfig(agentCfg) {
  const legacy = extractLegacyIntentions(agentCfg);
  const rules = legacy.intentions.map((it) => ({
    when: { intention: it.name },
    target: { type: 'emails', to: Array.isArray(it.emails) ? it.emails : [] }
  }));
  return {
    rules,
    defaultTarget: { type: 'emails', to: legacy.defaultEmails || [] },
    subjectTemplate: '[{{intention}}] {{subject}}',
    bodyTemplate: 'Intention: {{intention}}\n\nMessage:\n{{body}}'
  };
}

async function upsertFacebookConnectorInstance(instanceService, pageDoc, dryRun) {
  const entrepriseId = String(pageDoc.entrepriseId || '');
  const pageId = String(pageDoc.pageId || '');
  if (!entrepriseId || !pageId) return { action: 'skip', reason: 'missing ids' };

  const col = instanceService.col();
  const existing = await col.findOne({
    entrepriseId,
    connectorId: 'facebook',
    'settings.pageId': pageId
  });

  const doc = {
    entrepriseId,
    connectorId: 'facebook',
    name: pageDoc.pageName || `Facebook ${pageId}`,
    enabled: true,
    settings: {
      autoSynced: true,
      legacySource: 'facebook_configs',
      pageId,
      pollIntervalMinutes: 15,
      resources: ['posts'],
      limit: 25,
      lookbackHours: 168,
      commentCatchupLimit: 20,
      graphVersion: 'v21.0',
      ingestModes: ['push', 'poll']
    },
    mapping: { text: 'message', sourceRef: 'pageId' },
    ingestModes: ['push', 'poll'],
    credentials: {
      // Tokens restent dans facebook_configs (dual-read) ; pointer seulement
      legacyConfigRef: String(pageDoc._id)
    },
    presetId: 'default',
    updated_at: new Date()
  };

  if (dryRun) {
    return { action: existing ? 'would-update' : 'would-create', pageId };
  }

  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      { $set: { ...doc, settings: { ...(existing.settings || {}), ...doc.settings } } }
    );
    return { action: 'updated', pageId, id: String(existing._id) };
  }

  const result = await col.insertOne({ ...doc, cursor: null, created_at: new Date() });
  return { action: 'created', pageId, id: String(result.insertedId) };
}

async function ensureAgentFlow(flowService, brickConfigService, {
  entrepriseId,
  templateId,
  factory,
  analyseConfig,
  routeConfig,
  accountRef,
  force,
  dryRun
}) {
  const existing = await flowService.findByTemplateId(entrepriseId, templateId);
  if (existing && !force) {
    return { action: 'exists', flowId: String(existing._id) };
  }

  if (dryRun) {
    return { action: existing ? 'would-recreate' : 'would-create', templateId };
  }

  let flow;
  if (existing && force) {
    await flowService.deleteFlow(existing._id);
  }

  const payload = factory(entrepriseId);
  if (accountRef && payload.trigger && payload.trigger.brickId === 'mail-in') {
    payload.trigger.config = { ...(payload.trigger.config || {}), accountRef: String(accountRef) };
    if (payload.canvas && Array.isArray(payload.canvas.nodes)) {
      payload.canvas.nodes = payload.canvas.nodes.map((n) => {
        if (n.brickId === 'mail-in') {
          return { ...n, config: { ...(n.config || {}), accountRef: String(accountRef) } };
        }
        if (n.brickId === 'mail-out' && accountRef) {
          return { ...n, config: { ...(n.config || {}), accountRef: String(accountRef) } };
        }
        return n;
      });
    }
    if (Array.isArray(payload.steps)) {
      payload.steps = payload.steps.map((s) => {
        if (s.brickId === 'mail-out' && accountRef) {
          return { ...s, config: { ...(s.config || {}), accountRef: String(accountRef) } };
        }
        return s;
      });
    }
  }

  flow = await flowService.createFromTemplate(entrepriseId, payload);

  await brickConfigService.upsertConfig(flow._id, 'analyse-intention', entrepriseId, {
    config: analyseConfig || brickConfigService.getDefaultAnalyseConfig()
  });
  await brickConfigService.upsertConfig(flow._id, 'route-intention', entrepriseId, {
    config: routeConfig || brickConfigService.getDefaultRouteConfig()
  });

  return { action: 'created', flowId: String(flow._id), templateId };
}

async function migrateEntity(ctx, entity) {
  const entityId = String(entity._id);
  const report = {
    entityId,
    name: entity.name || entity.raison_sociale || '',
    mailSync: null,
    facebookInstances: [],
    flows: []
  };

  const {
    dryRun,
    forceFlows,
    mailCol,
    fbCol,
    instanceService,
    flowService,
    brickConfigService,
    fbAgentService
  } = ctx;

  const doMail = ctx.only === 'all' || ctx.only === 'mail';
  const doFacebook = ctx.only === 'all' || ctx.only === 'facebook';

  // --- Mail connectors ---
  if (doMail) {
    const mailDoc = await mailCol.findOne({ module_name: 'mail', entity_id: entityId });
    if (mailDoc && mailDoc.config) {
      const accounts = listAccountsFromConfig(mailDoc.config);
      if (dryRun) {
        report.mailSync = {
          action: 'would-sync',
          accounts: accounts.length,
          imap: accounts.filter((a) => a.hasImap).length,
          smtp: accounts.filter((a) => a.hasSmtp).length
        };
      } else {
        report.mailSync = await syncMailAccountConnectors(database, entityId, mailDoc.config);
      }

      const firstImap = accounts.find((a) => a.hasImap);
      const firstSmtp = accounts.find((a) => a.hasSmtp);
      const accountRef = (firstSmtp || firstImap || {}).id || '';

      if (accounts.length) {
        const agentCfg = await fbAgentService.loadConfig(entityId);
        const analyseConfig = agentCfg
          ? mapAnalyseToBrickConfig(agentCfg)
          : brickConfigService.getDefaultAnalyseConfig();
        const routeConfig = agentCfg
          ? mapAnalyseToRouteConfig(agentCfg)
          : brickConfigService.getDefaultRouteConfig();

        const flowResult = await ensureAgentFlow(flowService, brickConfigService, {
          entrepriseId: entityId,
          templateId: 'agent-mail',
          factory: mailAgentTemplate,
          analyseConfig,
          routeConfig,
          accountRef,
          force: forceFlows,
          dryRun
        });
        report.flows.push(flowResult);
      }
    } else {
      report.mailSync = { action: 'skip', reason: 'no mail_configs' };
    }
  }

  // --- Facebook connector instances + agent (sans envoi) ---
  if (doFacebook) {
    const pages = await fbCol.find({ entrepriseId: entityId }).toArray();
    for (const page of pages) {
      if (!page.pageAccessToken && !page.pageId) continue;
      const r = await upsertFacebookConnectorInstance(instanceService, page, dryRun);
      report.facebookInstances.push(r);
    }

    if (pages.length) {
      const agentCfg = await fbAgentService.loadConfig(entityId, pages[0].pageId);
      const analyseConfig = agentCfg
        ? mapAnalyseToBrickConfig(agentCfg)
        : brickConfigService.getDefaultAnalyseConfig();
      const routeConfig = agentCfg
        ? mapAnalyseToRouteConfig(agentCfg)
        : brickConfigService.getDefaultRouteConfig();

      const flowResult = await ensureAgentFlow(flowService, brickConfigService, {
        entrepriseId: entityId,
        templateId: 'agent-facebook',
        factory: facebookAgentTemplate,
        analyseConfig,
        routeConfig,
        accountRef: null,
        force: forceFlows,
        dryRun
      });
      report.flows.push(flowResult);
    }
  }

  return report;
}

(async () => {
  const opts = parseArgs(process.argv);
  console.log('=== migrate-legacy-connectors-to-agents ===');
  console.log(opts.dryRun ? 'MODE: dry-run (aucune écriture)' : 'MODE: apply');
  console.log('Scope:', opts.only);
  console.log('Legacy: CONSERVÉ (dual-run). Agent Facebook: sans envoi.');
  if (opts.entityId) console.log('Filtre entityId:', opts.entityId);
  if (opts.forceFlows) console.log('force-flows: oui (recrée les templates)');

  await database.connect();
  await connectorRegistry.discover();

  const instanceService = new ConnectorInstanceService(database);
  await instanceService.ensureIndexes();
  const flowService = new AgentFlowService(database);
  await flowService.ensureIndexes();
  const brickConfigService = new AgentBrickConfigService(database);
  await brickConfigService.ensureIndexes();

  const mailCol = database.getCollection('mail_configs');
  const fbCol = database.getCollection('facebook_configs');
  const entitiesCol = database.getCollection('entities');
  const fbAgentService = new FacebookAgentConfigService(database);

  const { ObjectId } = require('mongodb');
  const entityQuery = opts.entityId
    ? { _id: ObjectId.isValid(opts.entityId) ? new ObjectId(opts.entityId) : opts.entityId }
    : {};

  let entities;
  try {
    entities = await entitiesCol.find(entityQuery).project({ _id: 1, name: 1, raison_sociale: 1 }).toArray();
  } catch (_) {
    entities = await entitiesCol.find({}).project({ _id: 1, name: 1, raison_sociale: 1 }).toArray();
    if (opts.entityId) {
      entities = entities.filter((e) => String(e._id) === String(opts.entityId));
    }
  }

  if (opts.listEntities) {
    console.log('--- Entités ---');
    for (const e of entities) {
      const pages = await fbCol.countDocuments({ entrepriseId: String(e._id) });
      const mail = await mailCol.countDocuments({ module_name: 'mail', entity_id: String(e._id) });
      console.log(`${e._id}\t${e.name || e.raison_sociale || '?'}\tmail=${mail}\tfb_pages=${pages}`);
    }
    process.exit(0);
  }

  if (!opts.entityId && !opts.dryRun) {
    console.error('Sécurité : sans --entityId, utilisez --dry-run d\'abord, puis appliquez avec --entityId=<ton compte>.');
    process.exit(1);
  }

  console.log(`Entités à traiter: ${entities.length}`);

  const ctx = {
    dryRun: opts.dryRun,
    forceFlows: opts.forceFlows,
    only: opts.only,
    mailCol,
    fbCol,
    instanceService,
    flowService,
    brickConfigService,
    fbAgentService
  };

  const reports = [];
  for (const entity of entities) {
    const r = await migrateEntity(ctx, entity);
    reports.push(r);
    console.log(
      `- ${r.name || r.entityId}: mail=${JSON.stringify(r.mailSync)} fb=${r.facebookInstances.length} flows=${r.flows.map((f) => f.action).join(',')}`
    );
  }

  const summary = {
    entities: reports.length,
    mailSynced: reports.filter((r) => r.mailSync && (r.mailSync.synced > 0 || r.mailSync.action === 'would-sync')).length,
    fbInstances: reports.reduce((n, r) => n + r.facebookInstances.length, 0),
    flowsCreated: reports.reduce(
      (n, r) => n + r.flows.filter((f) => f.action === 'created' || f.action === 'would-create').length,
      0
    )
  };
  console.log('--- Résumé ---');
  console.log(JSON.stringify(summary, null, 2));
  console.log('Legacy NON supprimé (mail_configs, facebook_configs, analyse_intention_configs).');
  console.log('Cutover : brancher webhooks/polls sur connecteurs + désactiver legacy quand les agents sont validés.');

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
