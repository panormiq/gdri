/**
 * Dispatch des familles de blocs génériques.
 * Fichier : backend/core/agent-flow/families/FamilyDispatch.js
 */

const { providerFromConnectorId } = require('../channelFromConnector');
const { normalizeActionConfig } = require('../actionContracts');
const { getPreset } = require('../intentionPresets');
const { normalizeIntentions } = require('../resolveIntentionInputs');
const { ensurePresetCollection } = require('../presetCollections');
const { asDataTable, emptyDataTable, looksLikeIntentionList } = require('../dataTable');
const { writeCollectionOutput } = require('../collectionWrite');

const FAMILIES = new Set(['trigger', 'data', 'condition', 'loop', 'action', 'ia', 'validation', 'output']);

function isFamilyBrick(brickId) {
  return FAMILIES.has(String(brickId || ''));
}

/**
 * @param {import('../FlowExecutor').FlowExecutor} executor
 * @param {Object} step
 * @param {Object} context
 * @param {Object} flow
 * @param {Object} extras
 */
async function dispatchFamily(executor, step, context, flow, extras = {}) {
  const family = String(step.brickId || '');
  const config = { ...(step.config || {}) };

  switch (family) {
    case 'trigger':
      return runTrigger(context, config);
    case 'data':
      return runData(executor, context, config, flow);
    case 'condition':
      return executor.runLogicIf(config, context, extras.canvasNode || null);
    case 'loop':
      return executor.runLoop(config, context, extras.canvasNode || null);
    case 'action':
      return runAction(executor, flow, config, context, extras);
    case 'ia':
      return runIa(executor, flow, config, context);
    case 'validation':
      if (config.subFlowId || config.subTemplateId) {
        return runSubAgent(executor, flow, config, context, extras);
      }
      return executor.runHumanDocReview(flow, config, context, extras);
    case 'output':
      return runOutput(executor, flow, config, context);
    default:
      throw new Error(`Famille inconnue : ${family}`);
  }
}

function runTrigger(context, config) {
  const mode = String(config.mode || 'button');
  return {
    ok: true,
    type: 'trigger-event',
    mode,
    trigger: context.trigger,
    message: context.message
  };
}

function toDataMessage(msg, provider, channel, extra = {}) {
  return asDataTable(msg, {
    provider,
    channel: channel || provider,
    ...extra
  });
}

function triggerAccountFromContext(context) {
  const payload = (context && context.trigger && context.trigger.payload) || {};
  const message = (context && context.message) || {};
  const meta = (message && message.metadata) || {};
  return {
    instanceId: String(payload.instanceId || message.instanceId || '').trim(),
    pageId: String(payload.pageId || message.pageId || meta.pageId || '').trim(),
    accountRef: String(payload.accountRef || message.accountRef || meta.accountRef || '').trim(),
    channel: String(
      (context && context.options && context.options.channel) ||
      (context && context.channel) ||
      ''
    ).toLowerCase()
  };
}

function isLiveConnectorTrigger(context) {
  const mode = String((context && context.trigger && context.trigger.mode) || '').toLowerCase();
  return mode === 'polling' || mode === 'webhook';
}

/** Lancement manuel / lot N>1 : relire le connecteur. Événement live 1 mail : passthrough. */
function dataWantsConnectorFetch(config, context) {
  if (!String((config && config.instanceId) || '').trim()) return false;
  if (!isLiveConnectorTrigger(context)) return true;
  const pollByCount = !config || config.pollByCount !== false;
  const limit = Number(config && (config.pollLimit != null ? config.pollLimit : config.limit));
  return pollByCount && Number.isFinite(limit) && limit > 1;
}

function dataConfigMatchesTrigger(config, triggerAccount) {
  const provider = String((config && config.provider) || '').toLowerCase();
  if (provider !== 'mail' && provider !== 'facebook' && provider !== 'http') return true;
  const t = triggerAccount || {};
  const cfgInst = String((config && config.instanceId) || '').trim();
  const cfgPage = String((config && config.pageId) || '').trim();
  const cfgRef = String((config && config.accountRef) || '').trim();
  if (t.channel && (t.channel === 'mail' || t.channel === 'facebook' || t.channel === 'http')) {
    if (provider !== t.channel) return false;
  }
  const hasTriggerAccount = !!(t.instanceId || t.pageId || t.accountRef);
  const hasNodeAccount = !!(cfgInst || cfgPage || cfgRef);
  if (!hasTriggerAccount) return true;
  if (!hasNodeAccount) return true;
  if (cfgInst && t.instanceId) return cfgInst === t.instanceId;
  if (cfgPage && t.pageId) return cfgPage === t.pageId;
  if (cfgRef && t.accountRef) return cfgRef === t.accountRef;
  return false;
}

function withIoDebug(output, request, response) {
  const next = output && typeof output === 'object' ? output : emptyDataTable();
  const fromCursor = response && response.debug ? response.debug : null;
  next.debug = {
    request: (fromCursor && fromCursor.request) || request || null,
    response: (fromCursor && fromCursor.response) || response || null
  };
  const err = (response && response.error)
    || (fromCursor && fromCursor.response && fromCursor.response.error)
    || next.error;
  if (err) next.error = String(err);
  return next;
}

function tableFromCompose(prepared) {
  const src = prepared && typeof prepared === 'object' ? prepared : {};
  const rendered = String(src.rendered == null ? '' : src.rendered);
  const zones = src.zones && typeof src.zones === 'object' ? src.zones : {};
  const emptyMode = src.mode === 'empty';
  const error = emptyMode
    ? 'Aucun champ à interpoler dans l’action.'
    : (src.error || null);
  const row = {
    text: rendered,
    body: rendered,
    rendered,
    ...zones
  };
  return asDataTable(error ? [] : [row], {
    success: !error,
    empty: !!error,
    error,
    note: error || src.note || undefined,
    mode: src.mode,
    prepared: true,
    result: src.result,
    prompt: src.prompt,
    rendered,
    response: src.response,
    zones,
    channel: src.channel,
    debug: src.debug || {
      request: { templates: src.prompt ? { prompt: src.prompt } : {} },
      response: { mode: src.mode || null, rendered }
    }
  });
}

async function fetchFromInstance(executor, context, config, provider) {
  const instanceId = String(config.instanceId || '').trim();
  const request = {
    provider,
    instanceId: instanceId || null,
    accountRef: String(config.accountRef || '').trim() || null,
    entrepriseId: context.entrepriseId || null,
    mailbox: String(config.mailbox || '').trim() || null,
    pollByCount: config.pollByCount !== false,
    pollLimit: config.pollLimit != null ? config.pollLimit : config.limit,
    pollByDate: config.pollByDate === true,
    unseenOnly: config.unseenOnly === true,
    fromContains: String(config.fromContains || '') || null,
    subjectContains: String(config.subjectContains || '') || null,
    kinds: Array.isArray(config.kinds) ? config.kinds : [],
    triggerMode: context.trigger && context.trigger.mode
  };
  if (!instanceId || !executor || !executor.database) {
    return withIoDebug(emptyDataTable({
      provider,
      channel: provider,
      fetched: true,
      empty: true,
      error: 'instanceId manquant',
      note: 'Aucun compte (instanceId) sur le bloc Entrées.'
    }), request, { error: 'instanceId manquant' });
  }
  const { ConnectorInstanceService } = require('../../connectors/ConnectorInstanceService');
  const { ConnectorRuntime } = require('../../connectors/ConnectorRuntime');
  const svc = new ConnectorInstanceService(executor.database);
  const connectorHint = provider === 'mail'
    ? 'mail-in'
    : (provider === 'facebook' ? 'facebook' : (provider === 'http' ? 'http-generic' : ''));
  let instance = await svc.resolve(instanceId, context.entrepriseId, {
    accountRef: config.accountRef,
    pageId: config.pageId,
    mailbox: config.mailbox,
    connectorId: connectorHint
  });
  if (!instance) {
    return withIoDebug(emptyDataTable({
      provider,
      channel: provider,
      instanceId,
      fetched: true,
      empty: true,
      error: 'instance introuvable',
      note: 'Instance connecteur introuvable pour cet identifiant / cette entité.'
    }), request, { error: 'instance introuvable', instanceId, accountRef: request.accountRef, entrepriseId: context.entrepriseId });
  }
  request.connectorId = instance.connectorId;
  request.instanceName = instance.name || null;
  request.accountRef = (instance.settings && instance.settings.accountRef) || request.accountRef;
  request.resolvedId = instance._id || 'synthetic';
  const mailbox = String(config.mailbox || '').trim();
  if (mailbox) {
    instance = {
      ...instance,
      settings: { ...(instance.settings || {}), mailbox }
    };
  }
  if (provider === 'mail') {
    const { overlayMailInstanceFromDataConfig } = require('../../connectors/mail-query-helper');
    instance = overlayMailInstanceFromDataConfig(instance, config);
    request.mailbox = (instance.settings && instance.settings.mailbox) || request.mailbox;
    request.pollLimit = (instance.settings && instance.settings.pollLimit) || request.pollLimit;
  }
  const runtime = new ConnectorRuntime(executor.database);
  const result = await runtime.ingestPoll(instance);
  const { messageMatchesKinds } = require('../dataContracts');
  const kinds = Array.isArray(config.kinds) ? config.kinds : [];
  const messages = (result.messages || []).filter((msg) => messageMatchesKinds(msg, kinds));
  const channel = providerFromConnectorId(instance.connectorId) || provider;
  const cursor = result.cursor || {};
  const response = {
    note: cursor.note || cursor.error || null,
    rawCount: cursor.count != null ? cursor.count : (result.messages || []).length,
    matched: messages.length,
    kinds,
    ...(cursor.debug && cursor.debug.response ? cursor.debug.response : {}),
    error: cursor.error || null
  };
  if ((response.mailboxExists === 0 || response.mailboxExists === false) && !response.error) {
    response.error = 'Boîte IMAP introuvable';
  }
  const reqOut = (cursor.debug && cursor.debug.request)
    ? { ...request, ...cursor.debug.request }
    : request;
  if (!messages.length) {
    return withIoDebug(emptyDataTable({
      provider,
      channel,
      instanceId,
      fetched: true,
      passthrough: false,
      error: response.error || undefined,
      note: cursor.note || cursor.error || 'Aucun mail trouvé.'
    }), reqOut, response);
  }
  return withIoDebug(toDataMessage({ items: messages }, provider, channel, {
    instanceId,
    fetched: true,
    passthrough: false,
    note: cursor.note || undefined
  }), reqOut, response);
}

function parseJsonPayload(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return { text: '', json: null, items: [] };
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { text, json: parsed, items: parsed };
    }
    if (parsed && typeof parsed === 'object') {
      const items = Array.isArray(parsed.items)
        ? parsed.items
        : (Array.isArray(parsed.intentions) ? parsed.intentions : [parsed]);
      return {
        text: String(parsed.text || parsed.body || parsed.message || text),
        json: parsed,
        items
      };
    }
    return { text: String(parsed), json: parsed, items: [{ text: String(parsed) }] };
  } catch {
    return { text, json: null, items: [{ text }] };
  }
}

function getDocModelService() {
  try {
    const { getModelService } = require('../../../modules/agent-documentaire/service-container');
    return getModelService();
  } catch {
    return null;
  }
}

function typeFromV3Field(f) {
  const raw = String((f && (f.typeRef || f.uiType || f.type)) || 'text');
  const aliases = {
    string: 'text',
    Texte: 'text',
    TextArea: 'textarea',
    Lien: 'url',
    Number: 'number',
    Boolean: 'boolean',
    Date: 'date',
    DateTime: 'datetime',
    Fichier: 'file',
    Image: 'image',
    Couleur: 'color',
    Enum: 'enum',
    Connection: 'connection',
    Secret: 'secret'
  };
  return aliases[raw] || String(raw || 'text').toLowerCase() || 'text';
}

function fieldEnum(f) {
  if (!f || typeof f !== 'object') return [];
  if (Array.isArray(f.enum) && f.enum.length) return f.enum.map(String);
  if (Array.isArray(f.allowedValues) && f.allowedValues.length) return f.allowedValues.map(String);
  const fromVal = f.validation && f.validation.allowedValues;
  const fromOv = f.validationOverrides && f.validationOverrides.allowedValues;
  if (Array.isArray(fromVal) && fromVal.length) return fromVal.map(String);
  if (Array.isArray(fromOv) && fromOv.length) return fromOv.map(String);
  return [];
}

function flattenV3Element(el, fields) {
  const values = el && el.values && typeof el.values === 'object' ? el.values : null;
  const src = values || (el && typeof el === 'object' ? el : {});
  const row = { id: String((el && (el._id || el.id)) || src.id || '') };
  const keys = fields.length
    ? fields.map((f) => f.key).filter(Boolean)
    : Object.keys(src).filter((k) => !['_id', 'id', 'values', 'createdAt', 'updatedAt', 'entrepriseId'].includes(k));
  keys.forEach((k) => {
    if (src[k] !== undefined) row[k] = src[k];
    else if (el && el[k] !== undefined) row[k] = el[k];
  });
  return row;
}

function mapCollectionModel(model, elements) {
  if (!model) return null;
  const fields = (Array.isArray(model.fields) ? model.fields : [])
    .map((f) => {
      const mapped = {
        key: String((f && (f.name || f.key)) || ''),
        label: String((f && (f.label || f.name || f.key)) || ''),
        type: typeFromV3Field(f),
        unit: String((f && (f.unit || (f.validationOverrides && f.validationOverrides.unit))) || ''),
        required: !!(f && f.required)
      };
      const choices = fieldEnum(f);
      if (choices.length) {
        mapped.enum = choices;
        if (mapped.type === 'text' || mapped.type === 'string') mapped.type = 'enum';
      }
      return mapped;
    })
    .filter((f) => f.key);
  const rawRows = Array.isArray(elements)
    ? elements
    : (Array.isArray(model.variants)
      ? model.variants
      : (Array.isArray(model.items) ? model.items : (Array.isArray(model.elements) ? model.elements : [])));
  return {
    modelName: String(model.name || model.slug || model.namespace || ''),
    modelFields: fields,
    modelRows: rawRows.map((row) => flattenV3Element(row, fields)),
    collectionId: String(model._id || model.id || ''),
    collectionNamespace: String(model.slug || model.namespace || ''),
    referenceFields: Array.isArray(model.referenceFields) ? model.referenceFields : []
  };
}

async function loadV3Collection(entrepriseId, config) {
  const id = String((config && config.collectionId) || '').trim();
  const slug = String((config && config.collectionNamespace) || '').trim();
  if (!id && !slug) return null;
  try {
    const database = require('../../../config/database');
    const { ObjectId } = require('mongodb');
    const db = await database.getEntrepriseDb(entrepriseId);
    if (!db) return null;
    let col = null;
    if (id && ObjectId.isValid(id) && String(id).length === 24) {
      col = await db.collection('collections').findOne({ _id: new ObjectId(id) });
    }
    if (!col && slug) {
      col = await db.collection('collections').findOne({ slug })
        || await db.collection('collections').findOne({ name: slug });
    }
    if (!col && slug) {
      try {
        const { migrateV1ModelsToV3 } = require('../../../modules/doc-template/services/V1ModelMigrationService');
        await migrateV1ModelsToV3(db, entrepriseId);
      } catch (migrateErr) {
        console.warn('Migration V1 → V3 (runtime):', migrateErr.message);
      }
      col = await db.collection('collections').findOne({ slug })
        || await db.collection('collections').findOne({ name: slug });
    }
    if (!col) return null;
    const colId = String(col._id);
    const elements = await db.collection(`collection_data_${colId}`).find({}).toArray();
    return mapCollectionModel(col, elements);
  } catch (err) {
    console.warn('Collection V3:', err.message);
    return null;
  }
}

async function loadV1Collection(namespace) {
  const ns = String(namespace || '').trim();
  if (!ns) return null;
  const svc = getDocModelService();
  if (!svc) return null;
  try {
    return mapCollectionModel(await svc.getModel(ns));
  } catch {
    return null;
  }
}

function emitJsonModel(config) {
  const fields = Array.isArray(config.modelFields) ? config.modelFields : [];
  const rows = Array.isArray(config.modelRows) ? config.modelRows : [];
  const items = rows.map((row) => (row && typeof row === 'object' ? { ...row } : {}));
  const firstKey = fields[0] && fields[0].key;
  const firstRow = items[0] || null;
  const asIntentions = looksLikeIntentionList(items);
  const firstText = asIntentions
    ? ''
    : (firstRow
      ? String((firstRow.text != null && firstRow.text !== '')
        ? firstRow.text
        : (firstKey && firstRow[firstKey] != null ? firstRow[firstKey] : ''))
      : '');
  return asDataTable(items, {
    provider: 'json',
    channel: 'json',
    resourceType: asIntentions ? 'intentions' : undefined,
    name: asIntentions ? String(config.modelName || 'Liste d’intentions') : undefined,
    text: firstText,
    subject: asIntentions
      ? String(config.modelName || 'Liste d’intentions')
      : ((firstRow && firstRow.subject) || String(config.modelName || 'Liste')),
    json: items,
    intentions: asIntentions ? items : undefined,
    modelFields: fields,
    modelName: String(config.modelName || ''),
    collectionId: String(config.collectionId || ''),
    collectionNamespace: String(config.collectionNamespace || ''),
    payload: JSON.stringify(items, null, 2)
  });
}

async function loadPresetAsCollection(entrepriseId, presetId) {
  const bundle = await ensurePresetCollection(entrepriseId, presetId || 'mail');
  if (!bundle || !bundle.collection) return null;
  return mapCollectionModel(bundle.collection, bundle.elements);
}

async function runJsonData(config, flow) {
  const entrepriseId = flow && flow.entrepriseId;
  const presetId = String((config && config.presetId) || '').trim();
  let mapped = (entrepriseId && (await loadV3Collection(entrepriseId, config)))
    || (await loadV1Collection(config.collectionNamespace));
  if (!mapped && entrepriseId && presetId) {
    mapped = await loadPresetAsCollection(entrepriseId, presetId);
  }
  if (mapped) return emitJsonModel({ ...config, ...mapped });
  const fields = Array.isArray(config.modelFields) ? config.modelFields : [];
  const rows = Array.isArray(config.modelRows) ? config.modelRows : [];
  if (fields.length || rows.length) return emitJsonModel(config);
  const parsed = parseJsonPayload(config.payload || config.rawText || '');
  return asDataTable(parsed.items.length ? parsed.items : (parsed.text ? [{ text: parsed.text }] : []), {
    provider: 'json',
    channel: 'json',
    text: parsed.text,
    json: parsed.json,
    payload: String(config.payload || config.rawText || '')
  });
}

async function runDatabaseData(executor, config, flow) {
  const source = String(config.dbSource || config.source || 'intentions').toLowerCase();
  const entrepriseId = flow && flow.entrepriseId;
  const presetId = String(config.presetId || (source === 'intention-preset' || source === 'preset' ? 'mail' : '') || '').trim();

  if (entrepriseId && (source === 'intention-preset' || source === 'preset')) {
    const mapped = await loadPresetAsCollection(entrepriseId, presetId || 'mail');
    if (mapped) {
      return emitJsonModel({
        ...config,
        ...mapped,
        provider: 'json'
      });
    }
  }

  let intentions = [];
  let resolvedSource = source;
  let resolvedPreset = presetId || null;

  if (source === 'intention-preset' || source === 'preset') {
    const preset = getPreset(presetId || 'mail');
    intentions = preset ? preset.intentions : [];
    resolvedSource = 'intention-preset';
    resolvedPreset = preset ? preset.id : String(presetId || 'mail');
  } else if (source === 'intentions' || source === 'agent-intentions') {
    const flowId = flow && (flow._id || flow.id);
    if (executor && executor.brickConfig && flowId) {
      const doc = await executor.brickConfig.getConfig(String(flowId), 'analyse-intention');
      const cfg = (doc && doc.config) || {};
      intentions = Array.isArray(cfg.intentions) ? cfg.intentions : [];
    }
    resolvedSource = 'intentions';
    if (!intentions.length) {
      const fallback = getPreset('mail');
      intentions = fallback ? fallback.intentions : [];
      resolvedSource = 'intentions-default';
    }
  } else {
    return emptyDataTable({
      provider: 'database',
      channel: 'database',
      note: `Source base inconnue : ${source}`
    });
  }

  const list = normalizeIntentions(intentions);
  return asDataTable(list, {
    provider: 'database',
    channel: 'database',
    resourceType: 'intentions',
    name: 'Liste d’intentions',
    text: '',
    subject: resolvedSource === 'intention-preset' ? `Preset ${resolvedPreset || ''}` : 'Intentions de l’agent',
    json: list,
    intentions: list,
    source: resolvedSource,
    presetId: resolvedPreset
  });
}

async function runData(executor, context, config, flow) {
  const provider = String(config.provider || 'mail').toLowerCase();

  if (provider === 'json') {
    return runJsonData(config, flow);
  }
  if (provider === 'database') {
    return runDatabaseData(executor, config, flow);
  }

  const triggerAccount = triggerAccountFromContext(context);
  const matchesTrigger = dataConfigMatchesTrigger(config, triggerAccount);
  const wantsFetch = dataWantsConnectorFetch(config, context);

  // Événement live (1 mail) : garder le message injecté. Lancer manuel / lot N : relire IMAP.
  if (
    context.message && typeof context.message === 'object' &&
    matchesTrigger && !wantsFetch
  ) {
    return withIoDebug(toDataMessage(context.message, provider, context.channel || provider, {
      passthrough: true
    }), {
      provider,
      triggerMode: context.trigger && context.trigger.mode,
      passthrough: true
    }, {
      reason: 'passthrough — événement live, pas de relecture IMAP',
      itemsCount: Array.isArray(context.message.items) ? context.message.items.length : 1
    });
  }

  const hasTriggerAccount = !!(triggerAccount.instanceId || triggerAccount.pageId || triggerAccount.accountRef);
  if (hasTriggerAccount && !matchesTrigger && (provider === 'mail' || provider === 'facebook' || provider === 'http')) {
    return emptyDataTable({
      provider,
      channel: provider,
      note: 'Autre compte — ce bloc Entrées n’est pas celui du déclencheur.'
    });
  }

  if (provider === 'mail' || provider === 'facebook' || provider === 'http') {
    try {
      const fetched = await fetchFromInstance(executor, context, config, provider);
      if (fetched) return fetched;
    } catch (err) {
      return withIoDebug(emptyDataTable({
        provider,
        channel: provider,
        error: err.message,
        note: `Lecture connecteur impossible : ${err.message}`
      }), {
        provider,
        instanceId: String(config.instanceId || '') || null,
        pollLimit: config.pollLimit,
        triggerMode: context.trigger && context.trigger.mode
      }, { error: err.message, stack: String(err.stack || '').split('\n').slice(0, 6) });
    }
    return withIoDebug(emptyDataTable({
      provider,
      channel: provider,
      note: 'Aucun message en contexte — déclenchez via webhook connecteur, ou lancez avec une instance qui a des données.'
    }), {
      provider,
      instanceId: String(config.instanceId || '') || null,
      wantsFetch,
      triggerMode: context.trigger && context.trigger.mode
    }, { error: 'fetchFromInstance a renvoyé null' });
  }

  throw new Error(`Provider données inconnu : ${provider}`);
}

async function runIa(executor, flow, config, context) {
  const writeMode = String((config && config.writeMode) || 'merge').toLowerCase() === 'replace'
    ? 'replace'
    : 'merge';
  const result = await executor.runIaExecute(flow, config || {}, context);
    if (result && typeof result === 'object') result.__writeMode = writeMode;
    return result;
  }


async function runSubAgent(executor, flow, config, context, extras = {}) {
  const { AgentFlowService } = require('../AgentFlowService');
  const flowService = new AgentFlowService(executor.database);
  const subFlowId = String((config && config.subFlowId) || '').trim();
  const subTemplateId = String((config && config.subTemplateId) || '').trim();
  let sub = null;
  if (subFlowId) sub = await flowService.getFlowById(subFlowId);
  if (!sub && subTemplateId && flow.entrepriseId) {
    sub = await flowService.findByTemplateId(flow.entrepriseId, subTemplateId);
  }
  if (!sub) throw new Error('Sous-agent introuvable. Créez-le depuis Agents IA (console).');
  if (String(sub._id) === String(flow._id)) {
    throw new Error('Un agent ne peut pas s’importer lui-même.');
  }
  const child = await executor.execute(sub, {
    triggerMode: 'subagent',
    triggeredBy: extras.triggeredBy || null,
    triggerPayload: {
      parentFlowId: String(flow._id || ''),
      parentRunId: extras.runId || '',
      message: context.message,
      previous: context.previous
    }
  });
  const fresh = await flowService.getFlowById(sub._id);
  const exportsMap = (fresh && fresh.exports) || (sub.exports) || {};
  const preferred = String((config && (config.exportName || config.name)) || 'chrome').trim();
  const names = Object.keys(exportsMap);
  const firstName = (preferred && exportsMap[preferred])
    ? preferred
    : (exportsMap.chrome ? 'chrome' : (names[0] || ''));
  const first = firstName ? exportsMap[firstName] : null;
  if (child && child.status === 'waiting_human') {
    const paused = (Array.isArray(child.steps) ? child.steps : [])
      .find((s) => s && s.status === 'waiting_human');
    const output = (paused && paused.output) || {};
    return {
      __waitingHuman: true,
      type: 'subagent-pause',
      title: sub.name || 'Sous-agent',
      instructions: output.instructions || ('Validez le sous-agent « ' + (sub.name || '') + ' ».'),
      subFlowId: String(sub._id),
      subRunId: child._id ? String(child._id) : '',
      exportName: firstName || null,
      html: first && first.html,
      css: first && first.css,
      exports: exportsMap,
      ...output
    };
  }
  return {
    type: 'subagent-result',
    success: !!(child && child.status === 'completed'),
    subFlowId: String(sub._id),
    subRunId: child && child._id ? String(child._id) : '',
    status: child && child.status,
    exportName: firstName || null,
    html: first && first.html,
    css: first && first.css,
    exports: exportsMap
  };
}

async function runAction(executor, flow, config, context, extras) {
  const cfg = normalizeActionConfig(config);
  const op = String(cfg.actionId || '').toLowerCase();
  const entrepriseId = flow.entrepriseId;
  const writeMode = cfg.writeMode || 'merge';

  let result;
  if (op === 'ia.compose' || op === 'ia.generate' || op === 'ia.intention' || op === 'analyse-intention' || op === 'analyse.run') {
    result = tableFromCompose(executor.prepareCompose(cfg, context));
  } else if (op === 'route-intention' || op === 'route.resolve') {
    result = await executor.runRouteIntention(flow, cfg, context);
  } else if (op === 'http' || op === 'emit.http') {
    result = await executor.runHttpEmit(entrepriseId, cfg, context);
  } else if (op === 'backup' || op === 'backup.run') {
    result = await executor.runDataBackup(entrepriseId, cfg, context);
  } else if (op === 'mail.save-attachments' || op === 'mail-save-attachments') {
    result = await executor.runMailSaveAttachments(entrepriseId, cfg, context);
  } else if (op === 'mail.delete' || op === 'mail-delete') {
    result = await executor.runMailDelete(entrepriseId, cfg, context);
  } else if (op === 'mail.mark-seen' || op === 'mail.mark-unseen' || op === 'mail.move') {
    result = await executor.runMailImapAction(entrepriseId, cfg, context, op);
  } else if (op === 'mail.pick' || op === 'facebook.pick') {
    result = await executor.runPickFields(cfg, context, op);
  } else if (op === 'facebook.hide-comment' || op === 'facebook.like' || op === 'facebook.delete') {
    result = await executor.runFacebookAction(entrepriseId, cfg, context, op);
  } else if (op === 'surface.hook') {
    const { ensureAtelierCollection, listAtelierRows } = require('../atelierPresets');
    let pack = null;
    let rows = [];
    try {
      pack = await ensureAtelierCollection(entrepriseId, 'hook');
      if (pack) rows = await listAtelierRows(entrepriseId, pack.collectionId);
    } catch {
      rows = [];
    }
    const allowed = rows.map((r) => r && r.surface).filter(Boolean);
    let surface = String(cfg.surface || '').trim();
    if (!surface || (allowed.length && allowed.indexOf(surface) < 0)) {
      surface = allowed[0] || 'tab';
    }
    const hit = rows.find((r) => r && r.surface === surface) || null;
    result = {
      type: 'surface-hook',
      surface,
      label: hit && hit.label ? hit.label : surface,
      hookMounted: true,
      success: true,
      collectionId: pack && pack.collectionId ? pack.collectionId : (cfg.hookCollectionId || null)
    };
  } else {
    throw new Error(`Opération action inconnue : ${op}`);
  }

  if (result && typeof result === 'object') {
    result.__writeMode = writeMode;
  }
  return result;
}

async function hydrateOutputConfig(executor, context, config) {
  const next = { ...(config || {}) };
  const instanceId = String(next.instanceId || '').trim();
  if (!instanceId || !executor || !executor.database) return next;
  try {
    const { ConnectorInstanceService } = require('../../connectors/ConnectorInstanceService');
    const svc = new ConnectorInstanceService(executor.database);
    const instance = await svc.resolve(instanceId, context.entrepriseId, {
      accountRef: next.accountRef,
      pageId: next.pageId,
      connectorId: next.connectorId
        || (String(next.provider || '').toLowerCase() === 'mail' ? 'mail-out' : '')
    });
    if (!instance) return next;
    const settings = instance.settings || {};
    if (!String(next.accountRef || '').trim() && settings.accountRef) {
      next.accountRef = String(settings.accountRef);
    }
    if (!String(next.pageId || '').trim() && settings.pageId) {
      next.pageId = String(settings.pageId);
    }
    if (!String(next.emitUrl || '').trim() && settings.emitUrl) {
      next.emitUrl = String(settings.emitUrl);
    }
    if (!String(next.provider || '').trim()) {
      const p = providerFromConnectorId(instance.connectorId);
      next.provider = p === 'http' ? 'webhook' : (p || next.provider);
    }
  } catch {
    // instance synthétique (mail-out-account:…, fb-page:…) : accountRef / pageId déjà sur le nœud
  }
  return next;
}

async function runOutput(executor, flow, config, context) {
  const cfg = await hydrateOutputConfig(executor, context, config);
  const connectorId = String(cfg.connectorId || '').toLowerCase();
  const provider = String(cfg.provider || (connectorId === 'collection' ? 'collection' : 'mail')).toLowerCase();
  const entrepriseId = flow.entrepriseId;

  if (provider === 'collection' || connectorId === 'collection') {
    return writeCollectionOutput(executor, flow, cfg, context);
  }
  if (provider === 'flow' || provider === 'flux' || connectorId === 'flow' || connectorId === 'flux') {
    const { writeFlowExport } = require('../flowExport');
    return writeFlowExport(executor, flow, cfg, context);
  }
  if (provider === 'mail') {
    return executor.runMailOut(entrepriseId, cfg, context);
  }
  if (provider === 'facebook') {
    const action = String(cfg.action || 'reply').toLowerCase();
    const operation = action === 'publish' ? 'emit.publish' : 'emit.reply';
    return executor.runFacebookOut(entrepriseId, cfg, context, operation);
  }
  if (provider === 'webhook' || provider === 'http') {
    return executor.runHttpEmit(entrepriseId, cfg, context);
  }
  if (provider === 'disk') {
    const fs = require('fs');
    const path = require('path');
    const filePath = String(cfg.path || '').trim();
    if (!filePath) throw new Error('Sortie disque : chemin requis');
    let content =
      executor.readContextField(context, 'editedHtml') ||
      executor.readContextField(context, 'draftHtml') ||
      executor.readContextField(context, 'body') ||
      executor.readContextField(context, 'text') ||
      (context.message && context.message.text) ||
      '';
    if (cfg.templateId) {
      const bound = await executor.boundTemplate({ entrepriseId }, cfg, context);
      if (bound) content = bound.html || bound.text || content;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, String(content), 'utf8');
    return {
      type: 'output-disk-result',
      success: true,
      provider: 'disk',
      path: filePath,
      bytes: Buffer.byteLength(String(content), 'utf8')
    };
  }

  throw new Error(`Provider sortie inconnu : ${provider}`);
}

module.exports = {
  FAMILIES,
  isFamilyBrick,
  dispatchFamily,
  runData
};
