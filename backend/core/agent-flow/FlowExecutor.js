/**
 * Exécution séquentielle des steps d'un flow agent.
 * Fichier : backend/core/agent-flow/FlowExecutor.js
 */

const fs = require('fs');
const path = require('path');
const flowBrickRegistry = require('./FlowBrickRegistry');
const { AgentBrickConfigService } = require('./AgentBrickConfigService');
const { isFamilyBrick, dispatchFamily } = require('./families/FamilyDispatch');
const {
  detectChannel,
  resolveIntentionList,
  resolvePrompt,
  resolveMessages
} = require('./resolveIntentionInputs');
const {
  nodeNextIds,
  nodeNextFalseIds,
  nodeNextPortIds,
  allOutgoingIds,
  resolveNextIds,
  parentsReadyToJoin,
  ancestorSlugs
} = require('./flowGraph');
const { findStartTriggerNodes, launchOptsFromPayload } = require('./triggerMatch');
const { ensureAllSlugs, namespaceBag, nsOrder, scopePreviousToSlugs, readFromNamespaces, readFromBag, normalizeNsPath } = require('./nodeNamespace');
const { getMapping, resolveSlot, resolveSlotString, resolveSlotNonEmpty } = require('./inputMapping');
const { renderBound } = require('./blockTemplate');
const {
  getProductionTemplate,
  matchProductionTemplate,
  buildProductionLocals,
  modelSpecOf,
  pickModelForTemplate
} = require('./productionTemplates');
const {
  collectItems,
  projectCurrent,
  asDataTable,
  interpolateTable,
  readPath,
  isDataTableAlias,
  pickDataTable,
  readIndexedField,
  expandIndexTokens,
  loopItemIndex,
  loopKeysMatch,
  looksLikeIntentionList,
  looksLikeIntentionCatalogPath,
  looksLikeMessageList,
  formatIntentionCatalog,
  formatScalar,
  intentionEntry,
  applyCatalogToIaRow,
  applyIaConfiance
} = require('./dataTable');
const { extractOutputError, snapshotIncomingTables, buildBlockIoDebug } = require('./runProgress');

function attachmentsFromBag(bag) {
  if (!bag || typeof bag !== 'object') return null;
  if (Array.isArray(bag.attachments) && bag.attachments.length) return bag.attachments;
  const item = bag.item && typeof bag.item === 'object' ? bag.item : null;
  if (item && Array.isArray(item.attachments) && item.attachments.length) return item.attachments;
  if (Array.isArray(bag.items)) {
    const all = [];
    bag.items.forEach((row) => {
      if (row && Array.isArray(row.attachments) && row.attachments.length) {
        row.attachments.forEach((att) => all.push(att));
      }
    });
    if (all.length) return all;
  }
  return null;
}

class FlowExecutor {
  constructor(database) {
    this.database = database;
    this.brickConfig = new AgentBrickConfigService(database);
  }

  /**
   * @param {Object} flow
   * @param {{ triggerMode?: string, triggeredBy?: string, triggerPayload?: Object }} options
   */
  async execute(flow, options = {}) {
    const triggerMode = options.triggerMode || 'manual';
    const triggerPayload = { ...(options.triggerPayload || {}) };
    const fanned = await this.executeEachStartTrigger(flow, options, triggerMode, triggerPayload);
    if (fanned !== undefined) return fanned;

    const { AgentFlowService } = require('./AgentFlowService');
    const flowService = new AgentFlowService(this.database);

    const run = await flowService.createRun(flow, triggerMode, {
      triggeredBy: options.triggeredBy || null
    });

    const context = this.buildContext(flow, triggerMode, options.triggeredBy, triggerPayload);

    return this.runSteps(flow, run, context, flowService, 0, []);
  }

  /**
   * Crée le run et lance l'exécution en arrière-plan (page sablier).
   */
  async start(flow, options = {}) {
    const triggerMode = options.triggerMode || 'manual';
    const triggerPayload = { ...(options.triggerPayload || {}) };
    const fanned = await this.executeEachStartTrigger(flow, options, triggerMode, triggerPayload, true);
    if (fanned !== undefined) return fanned;

    const { AgentFlowService } = require('./AgentFlowService');
    const flowService = new AgentFlowService(this.database);

    const run = await flowService.createRun(flow, triggerMode, {
      triggeredBy: options.triggeredBy || null
    });
    const context = this.buildContext(flow, triggerMode, options.triggeredBy, triggerPayload);

    setImmediate(() => {
      this.runSteps(flow, run, context, flowService, 0, []).catch(async (error) => {
        try {
          const latest = await flowService.getRunById(run._id);
          if (latest && (latest.status === 'completed' || latest.status === 'waiting_human' || latest.status === 'rejected')) {
            return;
          }
          await flowService.finishRun(run._id, {
            status: 'failed',
            steps: (latest && latest.steps) || [],
            error: error.message
          });
        } catch (e) {
          console.error('agent-run async fail:', e.message);
        }
      });
    });
    return run;
  }

  /**
   * Reprend un run en waiting_human après validation / rejet.
   */
  async resume(runId, { decision, editedHtml, editedText, selectedItems, values, resumeToken, resumedBy = null } = {}) {
    const { AgentFlowService } = require('./AgentFlowService');
    const flowService = new AgentFlowService(this.database);
    const run = await flowService.getRunById(runId);
    if (!run) throw new Error('Run introuvable');
    if (run.status !== 'waiting_human') {
      throw new Error('Ce run n\'est pas en attente de validation');
    }
    if (!resumeToken || resumeToken !== run.resumeToken) {
      throw new Error('Jeton de reprise invalide');
    }

    const flow = await flowService.getFlowById(run.flowId);
    if (!flow) throw new Error('Flow introuvable');

    const dec = String(decision || '').toLowerCase();
    if (dec !== 'approve' && dec !== 'reject') {
      throw new Error('decision doit être approve ou reject');
    }

    const context = run.pausedContext || this.buildContext(flow, run.triggerMode, resumedBy, {});
    const msgAttachments = this.readContextField(context, 'attachments');
    const selected = Array.isArray(selectedItems) ? selectedItems : [];
    const formValues = values && typeof values === 'object' ? values : {};
    const pendingOut = (Array.isArray(run.steps) ? run.steps : [])
      .find((s) => s && (s.status === 'waiting_human')) || {};
    const atelierOut = (pendingOut && pendingOut.output) || run.output || {};
    if (atelierOut.atelier && Object.keys(formValues).length && flow.entrepriseId && atelierOut.collectionId) {
      try {
        const { writeAtelierRecord } = require('./atelierPresets');
        await writeAtelierRecord(flow.entrepriseId, atelierOut.collectionId, formValues, {
          flowId: flow._id || flow.id,
          runId,
          nodeId: run.pendingStepId
        });
      } catch (err) {
        console.warn('atelier write:', err.message);
      }
    }
    const humanResult = {
      type: atelierOut.atelier ? 'atelier-result' : 'human-review-result',
      decision: dec,
      selectedItems: selected,
      values: formValues,
      editedHtml: editedHtml != null ? String(editedHtml) : null,
      editedText: editedText != null ? String(editedText) : null,
      resumedAt: new Date().toISOString(),
      resumedBy,
      attachments: Array.isArray(msgAttachments) ? msgAttachments : [],
      sourceRef: this.readContextField(context, 'sourceRef') || null,
      message: context.message || null,
      ...formValues
    };
    const canvasNodes = this.getCanvasNodes(flow);
    ensureAllSlugs(canvasNodes);
    const pendingNode = canvasNodes.find((n) => n && (n.id === run.pendingStepId || n.id === run.pendingNodeId)) || null;
    context.previous = this.mergeStepOutput(context.previous, humanResult, pendingNode);

    const stepResults = Array.isArray(run.steps) ? [...run.steps] : [];
    const pendingIdx = Number(run.pendingStepIndex);
    if (Number.isFinite(pendingIdx) && stepResults[pendingIdx]) {
      stepResults[pendingIdx] = {
        ...stepResults[pendingIdx],
        status: dec === 'approve' ? 'completed' : 'rejected',
        completedAt: new Date(),
        output: humanResult
      };
    }

    if (dec === 'reject') {
      await flowService.finishRun(run._id, {
        status: 'rejected',
        steps: stepResults,
        error: null
      });
      return flowService.getRunById(run._id);
    }

    await flowService.runsCol().updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'running',
          resumeToken: null,
          pendingStepIndex: null,
          pendingStepId: null,
          pausedContext: null,
          steps: stepResults
        }
      }
    );

    if (run.pendingNodeId || (Array.isArray(run.pendingNodeIds) && run.pendingNodeIds.length) || this.getCanvasNodes(flow).length) {
      const nextIds = Array.isArray(run.pendingNodeIds) && run.pendingNodeIds.length
        ? run.pendingNodeIds
        : (run.pendingNodeId ? [run.pendingNodeId] : []);
      await flowService.runsCol().updateOne(
        { _id: run._id },
        { $set: { pendingNodeId: null, pendingNodeIds: [] } }
      );
      return this.runGraph(flow, run, context, flowService, stepResults, nextIds);
    }

    const startIndex = Number.isFinite(pendingIdx) ? pendingIdx + 1 : 0;
    return this.runLinearSteps(flow, run, context, flowService, startIndex, stepResults);
  }

  /**
   * Si plusieurs déclencheurs matchent, un run par graphe.
   * Si un seul, pose triggerNodeId sur le payload et laisse execute/start continuer.
   */
  async executeEachStartTrigger(flow, options, triggerMode, triggerPayload, asyncStart = false) {
    if (triggerPayload && triggerPayload.triggerNodeId) return undefined;
    const starts = findStartTriggerNodes(flow, launchOptsFromPayload(triggerMode, triggerPayload));
    if (!starts.length) {
      const m = String(triggerMode || '').toLowerCase();
      if (m === 'webhook' || m === 'http' || m === 'polling' || m === 'poll' || m === 'cron') {
        return null;
      }
      return undefined;
    }
    if (starts.length === 1) {
      triggerPayload.triggerNodeId = starts[0].id;
      return undefined;
    }
    let last = null;
    for (const start of starts) {
      const nextOpts = {
        ...options,
        triggerPayload: { ...triggerPayload, triggerNodeId: start.id }
      };
      last = asyncStart ? await this.start(flow, nextOpts) : await this.execute(flow, nextOpts);
    }
    return last;
  }

  triggerNodeIdOf(context) {
    return String(
      (context && context.trigger && context.trigger.nodeId) ||
      (context && context.trigger && context.trigger.payload && context.trigger.payload.triggerNodeId) ||
      ''
    ).trim() || null;
  }

  async markFlowTriggered(flowService, flow, context) {
    await flowService.markTriggered(flow._id, new Date(), this.triggerNodeIdOf(context));
  }

  buildContext(flow, triggerMode, triggeredBy, triggerPayload) {
    const payload = triggerPayload || {};
    const startTrigger = findStartTriggerNodes(flow, launchOptsFromPayload(triggerMode, payload))[0] || null;
    if (startTrigger && startTrigger.id && !payload.triggerNodeId) {
      payload.triggerNodeId = startTrigger.id;
    }
    let message = (payload && payload.message) || null;
    if (!message && Array.isArray(payload.messages) && payload.messages.length) {
      message = { items: payload.messages };
    }
    if (!message && payload && typeof payload === 'object' && (payload.text || payload.from || payload.subject || payload.items)) {
      message = payload;
    }
    if (message && typeof message === 'object') {
      message = asDataTable(message);
    }
    const triggerBrickId =
      payload.triggerBrickId ||
      (flow.trigger && flow.trigger.brickId) ||
      null;
    const channel =
      (payload.options && payload.options.channel) ||
      (message && message.channel) ||
      this.channelFromTrigger(triggerMode, triggerBrickId);

    const context = {
      entrepriseId: flow.entrepriseId,
      flowId: String(flow._id),
      channel,
      options: {
        channel,
        ...(payload.options && typeof payload.options === 'object' ? payload.options : {})
      },
      trigger: {
        mode: triggerMode,
        brickId: triggerBrickId,
        nodeId: (startTrigger && startTrigger.id) || payload.triggerNodeId || null,
        config: (startTrigger && startTrigger.config) || (flow.trigger && flow.trigger.config) || {},
        triggeredAt: new Date().toISOString(),
        triggeredBy: triggeredBy || null,
        payload
      },
      message,
      messages: Array.isArray(payload.messages) ? payload.messages : (message && message.items) || null,
      previous: null
    };
    if (context.message && typeof context.message === 'object') {
      context.previous = {
        type: 'trigger-message',
        ...context.message
      };
    }
    context.__compose = this.composeValueIndex(flow);
    return context;
  }

  composeValueIndex(flow) {
    const index = {};
    this.getCanvasNodes(flow).forEach((n) => {
      const slug = String((n && n.slug) || '').trim();
      if (!slug || !n.config) return;
      const values = n.config.values && typeof n.config.values === 'object' ? { ...n.config.values } : {};
      if (n.config.to && values.to == null) values.to = n.config.to;
      if (n.config.literals && n.config.literals.to && values.to == null) values.to = n.config.literals.to;
      index[slug] = values;
    });
    return index;
  }

  readComposeStoredValue(context, pathStr) {
    const path = normalizeNsPath(pathStr);
    if (!path || path.indexOf('.') < 0) return '';
    const slug = path.split('.')[0];
    const field = path.slice(slug.length + 1);
    const index = (context && context.__compose) || {};
    const bag = index[slug] || {};
    const keys = [field, 'to', 'destinataire', 'email', 'from'];
    const seen = {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!key || seen[key]) continue;
      seen[key] = true;
      const raw = bag[key];
      if (raw == null || String(raw).trim() === '') continue;
      return this.interpolateCompose(String(raw), context);
    }
    return '';
  }

  channelFromTrigger(triggerMode, brickId) {
    const m = String(triggerMode || '').toLowerCase();
    const b = String(brickId || '').toLowerCase();
    if (m.includes('facebook') || b === 'facebook') return 'facebook';
    if (m.includes('mail') || b === 'mail-in' || b === 'data') return 'mail';
    if (m === 'webhook' || m === 'http' || b === 'http-generic') return 'http';
    if (b === 'contact' || m.includes('contact')) return 'contact';
    if (b === 'trigger') return m === 'button' || m === 'cron' ? 'manual' : (m || 'manual');
    return m || b || 'manual';
  }

  getCanvasNodes(flow) {
    return flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  }

  resolveGraphStartNodeIds(flow, context, preferredNodeId = null) {
    const nodes = this.getCanvasNodes(flow);
    if (!nodes.length) return [];
    if (preferredNodeId) return [String(preferredNodeId)];

    const payload = (context && context.trigger && context.trigger.payload) || {};
    const starts = findStartTriggerNodes(flow, {
      triggerNodeId: payload.triggerNodeId || payload.nodeId || (context.trigger && context.trigger.nodeId),
      triggerMode: context && context.trigger && context.trigger.mode,
      instanceId: payload.instanceId || (context.message && context.message.instanceId),
      pageId: payload.pageId,
      accountRef: payload.accountRef
    });
    if (starts.length) return starts.map((t) => String(t.id)).filter(Boolean);

    const triggers = nodes.filter((n) => n.kind === 'trigger' || n.brickId === 'trigger');
    if (!triggers.length && nodes[0] && nodes[0].id) return [String(nodes[0].id)];
    return [];
  }

  resolveGraphStartNodeId(flow, context, preferredNodeId = null) {
    const ids = this.resolveGraphStartNodeIds(flow, context, preferredNodeId);
    return ids[0] || null;
  }

  async runSteps(flow, run, context, flowService, startIndex, stepResults) {
    if (context && !context.__compose) context.__compose = this.composeValueIndex(flow);
    const canvasNodes = this.getCanvasNodes(flow);
    if (canvasNodes.length) {
      const startId =
        (Array.isArray(run.pendingNodeIds) && run.pendingNodeIds.length)
          ? run.pendingNodeIds
          : (run.pendingNodeId || this.resolveGraphStartNodeIds(flow, context));
      return this.runGraph(flow, run, context, flowService, stepResults, startId);
    }
    return this.runLinearSteps(flow, run, context, flowService, startIndex, stepResults);
  }

  enqueueUnique(queue, seen, ids, byId, completed) {
    (ids || []).forEach((id) => {
      const s = id == null ? '' : String(id).trim();
      if (!s || queue.indexOf(s) !== -1) return;
      const n = byId && byId[s];
      if (n && n.brickId === 'loop') {
        delete seen[s];
        if (completed) delete completed[s];
      } else if (seen[s]) {
        return;
      }
      queue.push(s);
    });
  }

  clearLoopBodySeen(loopNode, seen, byId, completed) {
    const done = {};
    nodeNextFalseIds(loopNode).forEach((id) => { done[id] = true; });
    const queue = nodeNextIds(loopNode).slice();
    const visited = {};
    while (queue.length) {
      const id = queue.shift();
      if (!id || visited[id] || id === loopNode.id || done[id]) continue;
      visited[id] = true;
      delete seen[id];
      if (completed) delete completed[id];
      const n = byId[id];
      if (n) allOutgoingIds(n).forEach((next) => queue.push(next));
    }
  }

  pickReadyGraphBatch(queue, seen, completed, nodes, byId) {
    const snapshot = queue.slice();
    queue.length = 0;
    const ready = [];
    snapshot.forEach((id) => {
      const s = String(id || '').trim();
      if (!s || !byId[s]) return;
      if (seen[s] && !(byId[s] && byId[s].brickId === 'loop')) return;
      if (parentsReadyToJoin(s, nodes, snapshot, completed, byId)) ready.push(s);
      else queue.push(s);
    });
    return ready;
  }

  async runGraph(flow, run, context, flowService, stepResults, startNodeId) {
    const nodes = this.getCanvasNodes(flow);
    ensureAllSlugs(nodes);
    const byId = {};
    nodes.forEach((n) => {
      byId[n.id] = n;
    });

    const queue = Array.isArray(startNodeId)
      ? startNodeId.filter(Boolean).map((id) => String(id))
      : (startNodeId ? [String(startNodeId)] : []);
    const seen = {};
    const completed = {};
    (Array.isArray(stepResults) ? stepResults : []).forEach((s) => {
      const id = s && (s.stepId || s.id);
      if (!id) return;
      if (s.status === 'completed' || s.status === 'rejected') {
        completed[id] = true;
        seen[id] = true;
      }
    });
    if (context && Array.isArray(context.__graphQueue)) {
      this.enqueueUnique(queue, seen, context.__graphQueue, byId, completed);
    }
    let guard = 0;

    try {
      while (queue.length && guard < 2000) {
        guard += 1;
        const ready = this.pickReadyGraphBatch(queue, seen, completed, nodes, byId);
        if (!ready.length) {
          if (!queue.length) break;
          ready.push(queue.shift());
        }
        ready.forEach((id) => { seen[id] = true; });

        await flowService.touchRunProgress(run._id, {
          currentNodeId: ready[0] || null,
          steps: stepResults.concat(ready.map((id) => {
            const n = byId[id];
            return {
              stepId: id,
              brickId: n && n.brickId,
              operation: n && n.operation,
              status: 'running',
              startedAt: new Date(),
              completedAt: null
            };
          }))
        });

        const batch = await Promise.all(ready.map((id) => this.executeGraphNode(byId[id], context, flow, run, byId)));
        batch.sort((a, b) => ready.indexOf(a.node.id) - ready.indexOf(b.node.id));

        const failed = batch.find((item) => item && item.error);
        if (failed) {
          const node = failed.node;
          stepResults.push({
            stepId: node.id,
            brickId: node.brickId,
            operation: node.operation || null,
            status: 'failed',
            error: failed.error,
            startedAt: failed.startedAt,
            completedAt: new Date(),
            output: failed.output || null
          });
          await flowService.finishRun(run._id, {
            status: 'failed',
            steps: stepResults,
            error: failed.error
          });
          await this.markFlowTriggered(flowService, flow, context);
          return flowService.runsCol().findOne({ _id: run._id });
        }

        const waiting = batch.filter((item) => item && item.waitingHuman);
        const ok = batch.filter((item) => item && !item.waitingHuman);

        for (let i = 0; i < ok.length; i += 1) {
          const item = ok[i];
          const node = item.node;
          const output = item.output;
          const startedAt = item.startedAt;
          const stepError = extractOutputError(output);
          this.rememberLoopIaOutput(context, node, output);
          context.previous = this.mergeStepOutput(context.previous, output, node);
          if (output && output.loopDone) this.applyLoopCollectedIa(context, node);
          completed[node.id] = true;
          stepResults.push({
            stepId: node.id,
            brickId: node.brickId,
            operation: node.operation || null,
            status: stepError ? 'failed' : 'completed',
            error: stepError || null,
            startedAt,
            completedAt: new Date(),
            output
          });
          if (stepError) {
            await flowService.finishRun(run._id, {
              status: 'failed',
              steps: stepResults,
              error: stepError
            });
            await this.markFlowTriggered(flowService, flow, context);
            return flowService.runsCol().findOne({ _id: run._id });
          }
          const nexts = node.kind === 'trigger' || node.brickId === 'trigger'
            ? nodeNextIds(node)
            : resolveNextIds(node, output);
          if (output && output.__clearLoopBody) {
            this.clearLoopBodySeen(node, seen, byId, completed);
          }
          this.enqueueUnique(queue, seen, nexts, byId, completed);
        }

        if (waiting.length) {
          const item = waiting[0];
          const node = item.node;
          stepResults.push({
            stepId: node.id,
            brickId: node.brickId,
            operation: node.operation || null,
            status: 'waiting_human',
            startedAt: item.startedAt,
            completedAt: null,
            output: item.output
          });
          const pendingIds = nodeNextIds(node);
          if (context && typeof context === 'object') {
            context.__graphQueue = queue.slice();
          }
          const paused = await flowService.pauseRun(run._id, {
            steps: stepResults,
            pendingStepIndex: stepResults.length - 1,
            pendingStepId: node.id,
            pendingNodeId: pendingIds[0] || null,
            pendingNodeIds: pendingIds.concat(queue).filter(Boolean),
            pausedContext: context,
            reviewUrl: (item.output && item.output.reviewUrl) || null,
            output: item.output
          });
          await this.markFlowTriggered(flowService, flow, context);
          return paused;
        }

        await flowService.touchRunProgress(run._id, {
          currentNodeId: queue[0] || null,
          steps: stepResults
        });
      }

      await flowService.finishRun(run._id, { status: 'completed', steps: stepResults });
      await this.markFlowTriggered(flowService, flow, context);
      return flowService.runsCol().findOne({ _id: run._id });
    } catch (error) {
      stepResults.push({ status: 'failed', error: error.message });
      await flowService.finishRun(run._id, {
        status: 'failed',
        steps: stepResults,
        error: error.message
      });
      throw error;
    }
  }

  async executeGraphNode(node, context, flow, run, byId) {
    const startedAt = new Date();
    if (!node) return { node: { id: '' }, startedAt, output: null, error: 'Nœud introuvable' };
    if (node.kind === 'trigger' || node.brickId === 'trigger') {
      return {
        node,
        startedAt,
        output: { type: 'trigger-event' },
        waitingHuman: false,
        error: null
      };
    }
    const step = {
      id: node.id,
      brickId: node.brickId,
      operation: node.operation || null,
      config: { ...(node.config || {}) }
    };
    const brick = flowBrickRegistry.get(step.brickId);
    if (!brick) {
      return { node, startedAt, output: null, error: `Brique inconnue : ${step.brickId}` };
    }
    try {
      const nodes = this.getCanvasNodes(flow);
      const scoped = this.scopeContextToNode(context, node, nodes);
      const output = this.stampOutputPreview(
        await this.executeStep(step, scoped, flow, {
          runId: run._id,
          canvasNode: node,
          nextNodes: nodeNextIds(node).map((id) => byId[id]).filter(Boolean)
        }),
        scoped,
        { node, nodes }
      );
      return {
        node,
        startedAt,
        output,
        waitingHuman: !!(output && output.__waitingHuman),
        error: null
      };
    } catch (err) {
      return { node, startedAt, output: null, error: err && err.message ? err.message : String(err) };
    }
  }

  async runLinearSteps(flow, run, context, flowService, startIndex, stepResults) {
    const steps = Array.isArray(flow.steps) ? flow.steps : [];

    try {
      for (let i = startIndex; i < steps.length; i++) {
        const step = steps[i];
        const stepId = step.id || `step-${i + 1}`;
        const brick = flowBrickRegistry.get(step.brickId);
        if (!brick) {
          throw new Error(`Brique inconnue : ${step.brickId}`);
        }

        const startedAt = new Date();
        await flowService.touchRunProgress(run._id, {
          currentNodeId: stepId,
          steps: stepResults.concat([{
            stepId,
            brickId: step.brickId,
            operation: step.operation,
            status: 'running',
            startedAt,
            completedAt: null
          }])
        });
        const nextStep = steps[i + 1] || null;
        const output = this.stampOutputPreview(
          await this.executeStep(step, context, flow, {
            runId: run._id,
            nextNodes: nextStep ? [{ brickId: nextStep.brickId }] : []
          }),
          context,
          {
            node: {
              id: stepId,
              brickId: step.brickId,
              slug: step.slug || stepId,
              name: step.name || step.brickId,
              config: step.config || {}
            }
          }
        );

        if (output && output.__waitingHuman) {
          stepResults.push({
            stepId,
            brickId: step.brickId,
            operation: step.operation,
            status: 'waiting_human',
            startedAt,
            completedAt: null,
            output
          });
          const paused = await flowService.pauseRun(run._id, {
            steps: stepResults,
            pendingStepIndex: i,
            pendingStepId: stepId,
            pausedContext: context,
            reviewUrl: output.reviewUrl || null,
            output
          });
          await this.markFlowTriggered(flowService, flow, context);
          return paused;
        }

        context.previous = this.mergeStepOutput(context.previous, output, {
          id: stepId,
          slug: step.slug || stepId,
          name: step.name || stepId
        });
        const stepError = extractOutputError(output);
        stepResults.push({
          stepId,
          brickId: step.brickId,
          operation: step.operation,
          status: stepError ? 'failed' : 'completed',
          error: stepError || null,
          startedAt,
          completedAt: new Date(),
          output
        });
        if (stepError) {
          await flowService.finishRun(run._id, {
            status: 'failed',
            steps: stepResults,
            error: stepError
          });
          await this.markFlowTriggered(flowService, flow, context);
          return flowService.runsCol().findOne({ _id: run._id });
        }

        if (output && output.__skipRemaining) break;
        await flowService.touchRunProgress(run._id, {
          currentNodeId: null,
          steps: stepResults
        });
      }

      await flowService.finishRun(run._id, { status: 'completed', steps: stepResults });
      await this.markFlowTriggered(flowService, flow, context);
      return flowService.runsCol().findOne({ _id: run._id });
    } catch (error) {
      stepResults.push({
        status: 'failed',
        error: error.message
      });
      await flowService.finishRun(run._id, {
        status: 'failed',
        steps: stepResults,
        error: error.message
      });
      throw error;
    }
  }

  scopeContextToNode(context, node, nodes) {
    if (!context || !node || !Array.isArray(nodes) || !nodes.length) return context;
    const slugs = ancestorSlugs(node.id, nodes);
    return {
      ...context,
      previous: scopePreviousToSlugs(context.previous, slugs)
    };
  }

  snapshotMappedInputs(node, context) {
    if (!node || !node.config) return null;
    const mapping = getMapping(node.config);
    const keys = Object.keys(mapping);
    if (!keys.length) return null;
    const out = {};
    keys.forEach((slot) => {
      const resolved = resolveSlot(this, node.config, slot, context);
      let value = resolved.value;
      if (typeof value === 'string' && value.length > 800) value = `${value.slice(0, 800)}…`;
      else if (Array.isArray(value)) {
        value = looksLikeIntentionList(value)
          ? formatIntentionCatalog(value).slice(0, 800)
          : `${value.length} élément(s)`;
      } else if (value && typeof value === 'object') {
        try {
          const formatted = formatScalar(value);
          value = formatted ? String(formatted).slice(0, 800) : JSON.stringify(value).slice(0, 800);
        } catch (_) { value = '[objet]'; }
      }
      out[slot] = { from: mapping[slot], value: value == null ? '' : value };
    });
    return out;
  }

  stampOutputPreview(output, context, meta = {}) {
    if (!output || typeof output !== 'object') return output;
    const node = meta.node;
    const nodes = Array.isArray(meta.nodes) ? meta.nodes : [];
    const isSource = node && (node.brickId === 'data' || node.kind === 'trigger' || node.brickId === 'trigger');
    const slugs = node && nodes.length ? ancestorSlugs(node.id, nodes) : null;
    output.__incomingTables = isSource ? [] : snapshotIncomingTables(context && context.previous, slugs);
    const mapped = this.snapshotMappedInputs(node, context);
    if (mapped) output.__mapped = mapped;
    const brickId = node && node.brickId;
    if (output.debug && typeof output.debug === 'object') {
      if (mapped) {
        output.debug.request = { ...(output.debug.request || {}), mapping: mapped };
      }
    } else {
      const built = buildBlockIoDebug(output, brickId, mapped);
      if (built) output.debug = built;
    }
    if (brickId === 'ia') {
      output.debug = buildBlockIoDebug(output, 'ia', mapped);
    }
    return output;
  }

  /**
   * Chaque bloc enrichit le flux. writeMode=replace recopie response dans text/body.
   * Les flags de contrôle (__nextNodeId…) ne polluent pas previous.
   * Les champs du bloc sont aussi rangés sous previous.__ns[slug].
   */
  mergeStepOutput(previous, output, node) {
    if (!output || typeof output !== 'object') return previous;
    const writeMode = String(output.__writeMode || 'merge').toLowerCase();
    const data = {};
    Object.keys(output).forEach((key) => {
      if (key.startsWith('__') || key === 'debug') return;
      data[key] = output[key];
    });
    if (writeMode === 'replace' && data.response != null && String(data.response) !== '') {
      data.text = data.response;
      data.body = data.response;
    }
    const base = previous && typeof previous === 'object' ? previous : {};
    const prevNs = namespaceBag(base);
    const nextNs = { ...prevNs };
    const slug = node ? String(node.slug || '').trim() : '';
    let order = Array.isArray(base.__nsOrder)
      ? base.__nsOrder.map((s) => String(s || '').trim()).filter(Boolean)
      : Object.keys(prevNs);
    if (slug) {
      nextNs[slug] = { ...(nextNs[slug] || {}), ...data };
      order = order.filter((s) => s !== slug);
      order.push(slug);
    }
    return { ...base, ...data, __ns: nextNs, __nsOrder: order };
  }

  async executeStep(step, context, flow, extras = {}) {
    if (isFamilyBrick(step.brickId)) {
      return dispatchFamily(this, step, context, flow, extras);
    }
    throw new Error(`Brique non supportée (familles v2 uniquement) : ${step.brickId}`);
  }

  readContextField(context, fieldPath) {
    const pathStr = String(fieldPath || '').trim();
    if (!pathStr) return undefined;
    const prev = context && context.previous;
    const fromNs = readFromNamespaces(prev, pathStr);
    if (fromNs !== undefined) return fromNs;
    const extras = [context && context.message, context && context.options, context];
    for (const bag of extras) {
      const found = readFromBag(bag, pathStr);
      if (found !== undefined) return found;
    }
    if (!nsOrder(prev).length && prev) {
      return readFromBag(prev, pathStr);
    }
    return undefined;
  }

  readIntentionCatalog(context) {
    const prev = context && context.previous;
    const ns = namespaceBag(prev);
    const order = nsOrder(prev);
    const fromBag = (bag) => {
      if (!bag || typeof bag !== 'object') return null;
      if (Array.isArray(bag.intentions) && looksLikeIntentionList(bag.intentions)) return bag.intentions;
      if (Array.isArray(bag.items) && looksLikeIntentionList(bag.items)) return bag.items;
      return null;
    };
    for (let i = 0; i < order.length; i += 1) {
      const slug = order[i];
      const bag = ns[slug];
      if (!bag) continue;
      if (bag.resourceType === 'intentions' || String(slug).toLowerCase().indexOf('intention') >= 0) {
        const hit = fromBag(bag);
        if (hit) return hit;
      }
    }
    for (let i = 0; i < order.length; i += 1) {
      const hit = fromBag(ns[order[i]]);
      if (hit) return hit;
    }
    return [];
  }

  injectIntentionCatalog(rendered, catalog) {
    const list = Array.isArray(catalog) ? catalog : [];
    if (!list.length) return String(rendered || '');
    const marker = '--- Intentions autorisées ---';
    const body = String(rendered || '');
    if (body.indexOf(marker) >= 0) return body;
    const entries = list.map(intentionEntry).filter(Boolean);
    const ids = entries.map((it) => it.id);
    const lines = formatIntentionCatalog(list);
    const block = `${marker}
Le champ JSON "intention" doit être EXACTEMENT l'un de ces identifiants (le nom, pas un identifiant technique), rien d'autre :
${ids.join(', ')}

${lines}

Le champ "confiance" est un nombre entre 0 et 1 (1 = certain). Ne recopie pas la valeur d'exemple.
Le champ "resume" résume CE message (expéditeur, sujet, contenu) en une phrase. Ne recopie pas la définition de l'intention. N'écris pas le résumé dans "intention". Si aucune entrée ne convient, utilise "generic".`;
    return `${body.trim()}\n\n${block}`;
  }

  readDataTable(context, wantSlug) {
    const prev = context && context.previous;
    const want = String(wantSlug || '').trim();
    const ns = namespaceBag(prev);
    const order = nsOrder(prev);
    const picked = pickDataTable(ns, order, want);
    if (picked) {
      if (Array.isArray(picked)) return { items: picked };
      return picked;
    }
    if (want && !isDataTableAlias(want)) {
      const direct = readFromNamespaces(prev, want);
      if (Array.isArray(direct)) return { items: direct };
      if (direct && typeof direct === 'object' && (Array.isArray(direct.items) || direct.type === 'data-message' || direct.type === 'ia-result')) {
        return direct;
      }
    }
    if (prev && Array.isArray(prev.items) && !isDataTableAlias(want)) return prev;
    if (context && context.message && typeof context.message === 'object') return context.message;
    return null;
  }

  ctxStr(context, key) {
    const value = this.readContextField(context, key);
    if (value == null) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (_) {
        return '';
      }
    }
    return String(value);
  }

  evaluateCondition(actual, op, expected) {
    const operator = String(op || 'eq').toLowerCase();
    if (operator === 'truthy') return Boolean(actual);
    if (operator === 'falsy') return !actual;
    const aStr = actual == null ? '' : String(actual);
    const eStr = expected == null ? '' : String(expected);
    if (operator === 'eq') return aStr.toLowerCase() === eStr.toLowerCase();
    if (operator === 'neq') return aStr.toLowerCase() !== eStr.toLowerCase();
    if (operator === 'contains') return aStr.toLowerCase().includes(eStr.toLowerCase());
    if (operator === 'gt') return Number(actual) > Number(expected);
    if (operator === 'lt') return Number(actual) < Number(expected);
    return aStr.toLowerCase() === eStr.toLowerCase();
  }

  clampInt(value, fallback, min, max) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  collectLoopItems(config, context) {
    const field = String((config && config.field) || 'items').trim() || 'items';
    const raw = this.readContextField(context, field);
    if (Array.isArray(raw) && raw.length) return collectItems(raw);
    if (Array.isArray(raw) && !raw.length) return [];
    return collectItems(context.previous || context.message);
  }

  loopItemsOutput(state, body, done, mode, finished, stopReason) {
    const projected = projectCurrent(state.items || [], finished ? Math.max((state.n || 1) - 1, 0) : state.i);
    if (finished) {
      state.finished = true;
      return {
        type: 'loop-result',
        ...projected,
        loopIteration: state.i + 1,
        loopContinue: false,
        loopDone: true,
        loopStopReason: stopReason || 'items',
        mode,
        __nextNodeIds: done,
        __nextNodeId: done[0] || null
      };
    }
    return {
      type: 'loop-result',
      ...projected,
      loopIteration: state.i + 1,
      loopContinue: true,
      loopDone: false,
      mode,
      __clearLoopBody: true,
      __nextNodeIds: body,
      __nextNodeId: body[0] || null
    };
  }

  runLoop(config, context, canvasNode) {
    const mode = String((config && config.mode) || 'times').toLowerCase();
    const isItems = mode === 'items' || mode === 'foreach' || mode === 'each';
    const times = this.clampInt(config && config.times, 10, 1, 200);
    const maxIter = this.clampInt(config && config.maxIterations, 50, 1, 200);
    const body = nodeNextIds(canvasNode);
    const done = nodeNextFalseIds(canvasNode);

    if (!context.__loops || typeof context.__loops !== 'object') context.__loops = {};
    const loopId = (canvasNode && canvasNode.id) || 'loop';
    if (!context.__loops[loopId]) context.__loops[loopId] = { started: false, i: 0 };
    const state = context.__loops[loopId];

    if (!body.length) {
      return {
        type: 'loop-result',
        loopIteration: state.i || 0,
        loopContinue: false,
        loopDone: true,
        loopStopReason: 'no-body',
        mode,
        __nextNodeIds: done,
        __nextNodeId: done[0] || null
      };
    }

    if (isItems) {
      if (!state.started) {
        state.started = true;
        state.items = this.collectLoopItems(config, context);
        state.n = Math.min(state.items.length, maxIter);
        state.i = 0;
        if (!state.n) {
          return {
            type: 'loop-result',
            items: [],
            item: null,
            itemIndex: 0,
            itemsCount: 0,
            empty: true,
            loopIteration: 0,
            loopContinue: false,
            loopDone: true,
            loopStopReason: 'empty',
            mode,
            __nextNodeIds: done,
            __nextNodeId: done[0] || null
          };
        }
        return this.loopItemsOutput(state, body, done, mode, false);
      }
      if (state.i + 1 >= state.n) {
        return this.loopItemsOutput(state, body, done, mode, true, 'items');
      }
      state.i += 1;
      return this.loopItemsOutput(state, body, done, mode, false);
    }

    if (!state.started) {
      state.started = true;
      state.i = 1;
      return {
        type: 'loop-result',
        loopIteration: 1,
        loopContinue: true,
        loopDone: false,
        mode,
        __clearLoopBody: true,
        __nextNodeIds: body,
        __nextNodeId: body[0] || null
      };
    }

    const completed = state.i;
    let shouldContinue = false;
    let stopReason = 'done';
    if (mode === 'times') {
      shouldContinue = completed < times;
      if (!shouldContinue) stopReason = 'times';
    } else {
      const field = String((config && config.field) || 'success').trim();
      const op = (config && config.op) || 'truthy';
      const actual = this.readContextField(context, field);
      const pass = this.evaluateCondition(actual, op, config && config.value);
      if (pass) {
        shouldContinue = false;
        stopReason = 'until';
      } else if (completed >= maxIter) {
        shouldContinue = false;
        stopReason = 'maxIterations';
      } else {
        shouldContinue = true;
      }
    }

    if (shouldContinue) {
      state.i = completed + 1;
      return {
        type: 'loop-result',
        loopIteration: state.i,
        loopContinue: true,
        loopDone: false,
        mode,
        __clearLoopBody: true,
        __nextNodeIds: body,
        __nextNodeId: body[0] || null
      };
    }

    return {
      type: 'loop-result',
      loopIteration: completed,
      loopContinue: false,
      loopDone: true,
      loopStopReason: stopReason,
      mode,
      __nextNodeIds: done,
      __nextNodeId: done[0] || null
    };
  }

  normalizeConditionCases(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item, i) => {
      if (item == null) return null;
      if (typeof item !== 'object') {
        const value = String(item).trim();
        if (!value) return null;
        return { id: `c${i + 1}`, value, label: value };
      }
      const id = String(item.id || '').trim() || `c${i + 1}`;
      const value = item.value != null ? String(item.value) : '';
      const label = String(item.label || '').trim() || value || `Cas ${i + 1}`;
      return { id, value, label };
    }).filter(Boolean);
  }

  runLogicIf(config, context, canvasNode) {
    const mode = String((config && config.mode) || 'if').toLowerCase();
    if (mode === 'case' || mode === 'switch' || mode === 'cas') {
      return this.runLogicCase(config, context, canvasNode);
    }
    const field = String(config.field || 'intention_principale').trim();
    const op = config.op || 'eq';
    const value = config.value;
    const actual = this.readContextField(context, field);
    const pass = this.evaluateCondition(actual, op, value);

    const nextTrue = nodeNextIds(canvasNode);
    if (!nextTrue.length && config.nextTrueId) nextTrue.push(String(config.nextTrueId));
    const nextFalse = nodeNextFalseIds(canvasNode);
    if (!nextFalse.length && config.nextFalseId) nextFalse.push(String(config.nextFalseId));
    const chosen = pass ? nextTrue : nextFalse;

    const row = {
      field,
      op,
      value: value == null ? '' : value,
      actual: actual == null ? '' : actual,
      condition: pass ? 'vrai' : 'faux'
    };
    return {
      type: 'logic-if-result',
      condition: pass,
      field,
      op,
      value,
      actual: actual == null ? null : actual,
      items: [row],
      item: row,
      itemsCount: 1,
      itemIndex: 0,
      __nextNodeIds: chosen,
      __nextNodeId: chosen[0] || null
    };
  }

  runLogicCase(config, context, canvasNode) {
    const field = String((config && config.field) || 'intention_principale').trim();
    const op = String((config && config.caseOp) || 'eq').toLowerCase();
    const actual = this.readContextField(context, field);
    const cases = this.normalizeConditionCases(config && config.cases);
    let matched = null;
    for (let i = 0; i < cases.length; i += 1) {
      const c = cases[i];
      if (c.value === '' && op !== 'eq' && op !== 'neq') continue;
      if (this.evaluateCondition(actual, op, c.value)) {
        matched = c;
        break;
      }
    }
    const port = matched ? (`case:${matched.id}`) : 'default';
    const chosen = nodeNextPortIds(canvasNode, port);
    const label = matched ? (matched.label || matched.value) : 'défaut';
    const row = {
      field,
      op,
      value: matched ? matched.value : '',
      actual: actual == null ? '' : actual,
      condition: label,
      caseId: matched ? matched.id : 'default'
    };
    return {
      type: 'logic-case-result',
      condition: label,
      matched: !!matched,
      caseId: matched ? matched.id : 'default',
      field,
      op,
      value: matched ? matched.value : '',
      actual: actual == null ? null : actual,
      items: [row],
      item: row,
      itemsCount: 1,
      itemIndex: 0,
      __nextNodeIds: chosen,
      __nextNodeId: chosen[0] || null
    };
  }

  /**
   * Pause HITL — page de revue documentaire.
   */
  async runHumanDocReview(flow, config, context, extras = {}) {
    const atelier = await this.runAtelierPause(flow, config, context, extras);
    if (atelier) return atelier;

    const title = String(config.title || 'Revue documentaire').trim();
    const instructions = String(
      config.instructions ||
        'Vérifiez le contenu, modifiez si besoin, puis validez ou rejetez.'
    ).trim();
    const templateNamespace = String(config.templateNamespace || '').trim();

    const msg = context.message || {};
    const subject = this.ctxStr(context, 'subject') || (msg.metadata && msg.metadata.subject) || '';
    const from =
      this.ctxStr(context, 'from') ||
      this.ctxStr(context, 'author.email') ||
      this.ctxStr(context, 'author.name') ||
      (msg.author && (msg.author.email || msg.author.name)) ||
      '';
    const text = this.ctxStr(context, 'text') || this.ctxStr(context, 'body') || subject;
    const attachments = this.collectContextAttachments(context);
    const sourceRef = this.readContextField(context, 'sourceRef') || msg.sourceRef || null;
    const items = this.collectReviewItems(context);
    const itemsHtml = this.renderReviewItemsHtml(items);
    const dataHtml = items.length
      ? items
          .map((it) => `<p>${escapeHtml(it.label)}${it.value ? ` — ${escapeHtml(it.value)}` : ''}</p>`)
          .join('')
      : (text ? `<p>${escapeHtml(String(text))}</p>` : '<p><em>Aucune donnée</em></p>');

    const attachmentsHtml = attachments.length
      ? `<ul>${attachments
          .map((a) => {
            const label = escapeHtml(a.filename || 'fichier');
            if (a.url) {
              return `<li><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${label}</a></li>`;
            }
            return `<li>${label}</li>`;
          })
          .join('')}</ul>`
      : '<p><em>Aucune pièce jointe</em></p>';

    const reviewVars = this.collectProductionReviewVars(context, {
      from,
      subject,
      text,
      sourceRef,
      messageId: this.readContextField(context, 'messageId') || msg.messageId || '',
      channel: this.readContextField(context, 'channel') || context.channel || detectChannel(context) || '',
      attachments_html: attachmentsHtml,
      attachmentCount: String(attachments.length),
      items_html: itemsHtml,
      itemsCount: String(items.length),
      data_html: dataHtml
    });

    let htmlBody = this.readContextField(context, 'editedHtml') || null;
    if (!htmlBody && config.templateId) {
      try {
        const bound = await this.boundTemplate(flow, config, context);
        if (bound && String(bound.html || '').trim()) htmlBody = bound.html;
        else if (bound && String(bound.text || '').trim()) htmlBody = `<pre>${escapeHtml(bound.text)}</pre>`;
      } catch (err) {
        console.warn('validation template:', err.message);
      }
    }
    const pageLocals = buildProductionLocals(reviewVars);
    if (!htmlBody && templateNamespace) {
      try {
        htmlBody = await this.renderDocReviewTemplate(templateNamespace, pageLocals);
      } catch (err) {
        console.warn('human-doc-review template:', err.message);
      }
    }
    if (!htmlBody) {
      htmlBody = this.renderProductionReviewHtml(flow, config, context, reviewVars);
    }
    if (!htmlBody) {
      const metaLines = [];
      if (from) metaLines.push(`<p><strong>De :</strong> ${escapeHtml(String(from))}</p>`);
      if (subject) metaLines.push(`<p><strong>Sujet :</strong> ${escapeHtml(String(subject))}</p>`);
      htmlBody = `${metaLines.join('')}<p>${escapeHtml(String(text))}</p>${attachmentsHtml}`;
    }

    const runId = extras.runId != null ? String(extras.runId) : '';
    const reviewUrl = runId
      ? `pages/agent-human-review.php?runId=${encodeURIComponent(runId)}`
      : null;

    return {
      __waitingHuman: true,
      type: 'human-doc-review-pause',
      title,
      instructions,
      templateNamespace: templateNamespace || null,
      draftHtml: htmlBody,
      draftText: String(text),
      subject: String(subject || ''),
      from: String(from || ''),
      attachments,
      items,
      items_html: itemsHtml,
      sourceRef,
      reviewUrl,
      productionTemplateId: String((config && config.productionTemplateId) || '') || null,
      message: context.message || null,
      previous: context.previous || null
    };
  }

  async runAtelierPause(flow, config, context, extras = {}) {
    const presetId = String((config && config.collectionPreset) || '').trim();
    const collectionId = String((config && config.collectionId) || '').trim();
    if (!presetId && !collectionId) return null;

    const {
      loadAtelierCollection,
      ensureAtelierCollection,
      latestAtelierRecord,
      defaultsFromFields
    } = require('./atelierPresets');
    const { renderAtelierPage } = require('./atelierPage');

    let pack = await loadAtelierCollection(flow.entrepriseId, { collectionId, presetId });
    if (!pack && presetId) {
      pack = await ensureAtelierCollection(flow.entrepriseId, presetId);
    }
    if (!pack || !pack.fields || !pack.fields.length) {
      throw new Error('Atelier : collection introuvable ou sans champs.');
    }

    const record = await latestAtelierRecord(flow.entrepriseId, pack.collectionId, flow._id || flow.id);
    const values = { ...defaultsFromFields(pack.fields) };
    pack.fields.forEach((field) => {
      const fromCtx = this.readContextField(context, field.key);
      if (fromCtx !== undefined && fromCtx !== null && String(fromCtx).trim() !== '') {
        values[field.key] = fromCtx;
      } else if (record && record[field.key] !== undefined) {
        values[field.key] = record[field.key];
      }
    });

    const title = String((config && config.title) || pack.name || 'Atelier').trim();
    const instructions = String(
      (config && config.instructions) || 'Renseignez les champs, puis validez.'
    ).trim();
    const htmlBody = renderAtelierPage({
      title,
      instructions,
      fields: pack.fields,
      values
    });
    const runId = extras.runId != null ? String(extras.runId) : '';
    const reviewUrl = runId
      ? `pages/agent-human-review.php?runId=${encodeURIComponent(runId)}`
      : null;

    return {
      __waitingHuman: true,
      type: 'atelier-pause',
      atelier: true,
      title,
      instructions,
      collectionId: pack.collectionId,
      collectionPreset: presetId || null,
      fields: pack.fields,
      values,
      draftHtml: htmlBody,
      draftText: '',
      reviewUrl,
      message: context.message || null,
      previous: context.previous || null
    };
  }

  collectProductionReviewVars(context, base) {
    const extra = {
      intention: this.ctxStr(context, 'intention') || this.ctxStr(context, 'intention_principale'),
      confiance: this.readContextField(context, 'confiance') || this.readContextField(context, 'confidence'),
      resume: this.ctxStr(context, 'resume') || this.ctxStr(context, 'summary'),
      response: this.ctxStr(context, 'response'),
      nom: this.ctxStr(context, 'nom'),
      email: this.ctxStr(context, 'email'),
      telephone: this.ctxStr(context, 'telephone'),
      objet: this.ctxStr(context, 'objet'),
      montant: this.readContextField(context, 'montant'),
      date: this.ctxStr(context, 'date'),
      title: this.ctxStr(context, 'title') || this.ctxStr(context, 'page_title') || this.ctxStr(context, 'subject') || 'Validation',
      page_title: this.ctxStr(context, 'page_title') || this.ctxStr(context, 'title') || this.ctxStr(context, 'subject') || 'Validation',
      kicker: this.ctxStr(context, 'kicker') || 'À traiter',
      lead: this.ctxStr(context, 'lead') || this.ctxStr(context, 'instructions') || 'Vérifiez les informations, puis validez ou rejetez.',
      cta: this.ctxStr(context, 'cta') || 'Valider',
      aside: this.ctxStr(context, 'aside'),
      stats: this.readContextField(context, 'stats'),
      sections: this.readContextField(context, 'sections')
    };
    extra['author.email'] = this.ctxStr(context, 'author.email');
    extra['author.name'] = this.ctxStr(context, 'author.name');
    extra['metadata.accountRef'] = this.ctxStr(context, 'metadata.accountRef');
    extra['metadata.mailbox'] = this.ctxStr(context, 'metadata.mailbox');
    return { ...extra, ...(base || {}) };
  }

  renderProductionReviewHtml(flow, config, context, vars) {
    const explicit = String((config && config.productionTemplateId) || '').trim();
    const channel = String((vars && vars.channel) || detectChannel(context) || '').toLowerCase();
    const fields = Object.keys(vars || {}).filter((k) => {
      const v = vars[k];
      return v != null && String(v).trim() !== '' && String(v).trim() !== '—';
    });
    const doc = (explicit && explicit !== 'auto')
      ? getProductionTemplate(explicit)
      : matchProductionTemplate({
        usage: 'validation',
        brief: [config && config.reviewContext, flow && flow.agentContext, config && config.title].filter(Boolean).join(' '),
        reviewContext: config && config.reviewContext,
        agentContext: flow && flow.agentContext,
        channel,
        fields
      });
    if (!doc || !doc.html) return '';
    const locals = buildProductionLocals(vars);
    const safe = {};
    Object.keys(locals).forEach((key) => {
      if (/_html$/.test(key) || key === 'confiance_pct') {
        safe[key] = locals[key];
        return;
      }
      safe[key] = escapeHtml(locals[key]);
    });
    return this.interpolateCompose(doc.html, context, safe);
  }

  bindProductionPrompt(config, context) {
    const id = String((config && config.productionTemplateId) || '').trim();
    if (!id || id === 'auto') return null;
    const doc = getProductionTemplate(id);
    if (!doc || doc.kind !== 'prompt' || !doc.values) return null;
    const values = doc.values;
    const interp = (chunk) => this.interpolateCompose(String(chunk || ''), context);
    const fills = {
      prompt: !!String(values.prompt || '').trim(),
      context: !!String(values.context || '').trim(),
      rag: !!String(values.rag || '').trim()
    };
    return {
      fills,
      iaParts: {
        fills,
        prompt: fills.prompt ? interp(values.prompt) : '',
        context: fills.context ? interp(values.context) : '',
        rag: fills.rag ? interp(values.rag) : '',
        outputHint: interp(doc.outputHint || ''),
        outputFormat: doc.outputFormat || 'text'
      }
    };
  }

  async renderDocReviewTemplate(namespace, variables = {}) {
    const HtmlRenderService = require(path.resolve(
      __dirname,
      '../../modules/agent-documentaire-v2/services/HtmlRenderService.js'
    ));
    const { getTemplateService } = require(path.resolve(
      __dirname,
      '../../modules/agent-documentaire-v2/service-container.js'
    ));
    const svc = getTemplateService();
    if (svc && typeof svc.init === 'function' && !svc.collection) {
      await svc.init();
    }
    let template = await svc.getByNamespace(namespace);
    if (!template && namespace === 'agent:review:invoice') {
      template = await svc.ensureSeedTemplate(namespace);
    }
    if (!template) {
      throw new Error(`Template « ${namespace} » introuvable`);
    }
    return HtmlRenderService.renderTemplate(template, variables);
  }

  collectReviewItems(context) {
    const prev = (context && context.previous) || {};
    const ns = namespaceBag(prev);
    const order = nsOrder(prev);
    const bags = [];
    for (let i = order.length - 1; i >= 0; i -= 1) {
      if (ns[order[i]]) bags.push(ns[order[i]]);
    }
    bags.push(context && context.message);
    if (!order.length) bags.push(prev);
    for (const bag of bags) {
      if (!bag || typeof bag !== 'object') continue;
      if (Array.isArray(bag.items)) {
        return bag.items.map((raw, i) => this.normalizeReviewItem(raw, i));
      }
      for (const key of ['rows', 'records']) {
        if (Array.isArray(bag[key]) && bag[key].length) {
          return bag[key].map((raw, i) => this.normalizeReviewItem(raw, i));
        }
      }
    }
    const skip = new Set([
      'type', 'ok', 'passthrough', 'empty', 'message', 'previous', 'trigger',
      'channel', 'provider', 'attachments', 'html', 'editedHtml', '__ns', '__nsOrder'
    ]);
    const snapshot = bags[0] && typeof bags[0] === 'object' ? bags[0] : prev;
    const rows = [];
    Object.keys(snapshot || {}).forEach((k) => {
      if (skip.has(k) || k.startsWith('__') || snapshot[k] == null || typeof snapshot[k] === 'object') return;
      const val = String(snapshot[k]).trim();
      if (!val) return;
      rows.push({ id: k, label: k, value: val, checked: true });
    });
    return rows;
  }

  normalizeReviewItem(raw, index) {
    if (raw == null) {
      return { id: String(index), label: `Élément ${index + 1}`, value: '', checked: true };
    }
    if (typeof raw !== 'object') {
      return { id: String(index), label: String(raw), value: '', checked: true };
    }
    const label = raw.label || raw.filename || raw.name || raw.subject || raw.title || raw.from || `Élément ${index + 1}`;
    const value = raw.value != null
      ? String(raw.value)
      : (raw.text || raw.body || raw.url || raw.from || '');
    return {
      id: String(raw.id || raw.filename || index),
      label: String(label),
      value: String(value || ''),
      checked: raw.checked !== false
    };
  }

  renderReviewItemsHtml(items) {
    if (!items.length) {
      return '<p><em>Aucune donnée à valider</em></p>';
    }
    const lis = items.map((it, i) => {
      const extra = it.value && it.value !== it.label ? ` — ${escapeHtml(it.value)}` : '';
      const checked = it.checked === false ? '' : ' checked';
      return `<li><label><input type="checkbox" class="review-item-check" value="${escapeHtml(it.id)}" data-index="${i}"${checked}> ${escapeHtml(it.label)}${extra}</label></li>`;
    }).join('');
    return `<ul class="review-check-list">${lis}</ul>`;
  }

  collectContextAttachments(context) {
    const prev = (context && context.previous) || {};
    const ns = namespaceBag(prev);
    const order = nsOrder(prev);
    const bags = [];
    for (let i = order.length - 1; i >= 0; i -= 1) {
      if (ns[order[i]]) bags.push(ns[order[i]]);
    }
    bags.push(context && context.message);
    bags.push(context && context.trigger && context.trigger.payload && context.trigger.payload.message);
    if (!order.length) bags.push(prev);
    for (const bag of bags) {
      const list = attachmentsFromBag(bag);
      if (list && list.length) {
        return list.map((a) => ({
          filename: a.filename || a.name || 'fichier',
          contentType: a.contentType || a.mimeType || null,
          size: a.size || null,
          url: a.url || null,
          path: a.path || null
        }));
      }
    }
    return [];
  }

  safeDownloadFileName(name) {
    return String(name || 'fichier.bin')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'fichier.bin';
  }

  /**
   * Copie les PJ du mail vers uploads/downloads pour téléchargement utilisateur.
   */
  async runMailSaveAttachments(entrepriseId, config, context) {
    const attachments = this.collectContextAttachments(context);
    const requireAttachments = config.requireAttachments === true;
    if (!attachments.length) {
      if (requireAttachments) {
        throw new Error('Aucune pièce jointe à télécharger sur ce mail');
      }
      return {
        type: 'mail-attachments-saved',
        success: true,
        count: 0,
        attachments: [],
        folderUrl: null,
        skipped: true,
        reason: 'no-attachments'
      };
    }

    const subfolderRaw = String(config.subfolder || 'factures').trim() || 'factures';
    const subfolder = subfolderRaw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
    const day = new Date().toISOString().slice(0, 10);
    const uid = this.readContextField(context, 'sourceRef')
      || (context.message && context.message.sourceRef)
      || 'mail';
    const relParts = [
      'downloads',
      String(entrepriseId || 'entity'),
      subfolder,
      day,
      String(uid)
    ];
    const absDir = path.join(__dirname, '../../uploads', ...relParts);
    fs.mkdirSync(absDir, { recursive: true });

    const saved = [];
    for (const att of attachments) {
      const filename = this.safeDownloadFileName(att.filename);
      const destPath = path.join(absDir, filename);
      if (att.path && fs.existsSync(att.path)) {
        fs.copyFileSync(att.path, destPath);
      } else {
        continue;
      }
      const stat = fs.statSync(destPath);
      const url = `/uploads/${relParts.map(encodeURIComponent).join('/')}/${encodeURIComponent(filename)}`;
      saved.push({
        filename,
        contentType: att.contentType || 'application/octet-stream',
        size: stat.size,
        path: destPath,
        url
      });
    }

    if (!saved.length && requireAttachments) {
      throw new Error('Pièces jointes introuvables sur le disque (relancez le poll mail-in avec PJ)');
    }

    // Propager vers le message pour la revue / étapes suivantes
    if (context.message && typeof context.message === 'object') {
      context.message.attachments = saved;
    }

    const folderUrl = `/uploads/${relParts.map(encodeURIComponent).join('/')}`;
    return {
      type: 'mail-attachments-saved',
      success: true,
      count: saved.length,
      attachments: saved,
      folderUrl,
      subfolder,
      sourceRef: uid
    };
  }

  /**
   * Supprime le mail IMAP d'origine (UID = sourceRef mail-in).
   */
  async runMailDelete(entrepriseId, config, context) {
    const onlyOnApprove = config.onlyOnApprove !== false;
    const decision = this.readContextField(context, 'decision');
    const resultType = this.readContextField(context, 'type');
    if (onlyOnApprove && resultType === 'human-review-result' && decision !== 'approve') {
      return {
        type: 'mail-delete-result',
        success: false,
        skipped: true,
        reason: `decision=${decision || 'unknown'}`
      };
    }

    const msg = context.message || {};
    const uid =
      this.readContextField(context, 'sourceRef') ||
      msg.sourceRef ||
      (msg.raw && (msg.raw.sourceRef || msg.raw.uid)) ||
      null;
    if (!uid) {
      throw new Error('Impossible de supprimer : sourceRef / UID IMAP introuvable dans le contexte');
    }

    const accountRef =
      String(config.accountRef || '').trim() ||
      (msg.metadata && msg.metadata.accountRef) ||
      (context.trigger &&
        context.trigger.payload &&
        context.trigger.payload.accountRef) ||
      '';
    if (!accountRef) {
      throw new Error('Compte mail (accountRef) requis pour supprimer le message');
    }

    const mailbox =
      String(config.mailbox || '').trim() ||
      (msg.metadata && msg.metadata.mailbox) ||
      'INBOX';

    const {
      loadMailConfigForConnector,
      resolveImapConfigForAccount
    } = require('../connectors/mail-infra-helper');

    const mailConfig = await loadMailConfigForConnector(this.database, entrepriseId);
    if (!mailConfig) {
      throw new Error('Configuration mail introuvable pour cette entité');
    }
    const imapRaw = resolveImapConfigForAccount(mailConfig, accountRef, mailbox);
    if (!imapRaw) {
      throw new Error(`Configuration IMAP introuvable pour le compte ${accountRef}`);
    }

    let mailModule;
    try {
      mailModule = require(path.resolve(__dirname, '../../../modules/mail/backend/index.js'));
    } catch (error) {
      throw new Error(`Module mail indisponible : ${error.message}`);
    }

    const result = await mailModule.getMailService().getImapService().deleteMessage(imapRaw, uid);
    return {
      type: 'mail-delete-result',
      success: true,
      uid: String(uid),
      accountRef: String(accountRef),
      mailbox,
      action: 'delete',
      data: result
    };
  }

  async runAnalyseIntention(flow, config, context) {
    const doc = await this.brickConfig.getConfig(flow._id, 'analyse-intention');
    const analyseCfg = (doc && doc.config) || this.brickConfig.getDefaultAnalyseConfig();

    const resolved = resolveIntentionList(analyseCfg, context, config);
    const intentions = resolved.intentions;
    const prompt = resolvePrompt(analyseCfg, config, context);
    const messages = resolveMessages(context, config);
    const text = messages.map((m) => m.text || m.message || '').join('\n').trim();

    if (!text) {
      throw new Error('Aucun texte à analyser (message vide).');
    }

    const IntentionService = require(path.resolve(
      __dirname,
      '../../../modules/analyse-intention/backend/services/IntentionService'
    ));
    const PromptService = require(path.resolve(
      __dirname,
      '../../../modules/prompt/backend/services/PromptService'
    ));

    const service = new IntentionService(this.database);
    service.setPromptServiceFactory(async (entityId) => {
      if (entityId) return PromptService.forEntity(entityId);
      return PromptService.global();
    });

    const result = await service.analyzeIntentions(
      messages,
      prompt,
      intentions,
      null,
      { entityId: flow.entrepriseId, skipSave: false }
    );

    if (!result.success) {
      throw new Error(result.error?.message || 'Échec analyse d\'intention');
    }

    const data = result.data || { analyses: [] };
    const first = Array.isArray(data.analyses) ? data.analyses[0] : null;
    const intention =
      (first && first.etape2_multi_intentions && first.etape2_multi_intentions.intention_principale) ||
      null;
    const reponseRequise =
      first && first.etape1_generique ? first.etape1_generique.reponse_requise : null;
    const src = context.message || {};

    return {
      type: 'analyse-result',
      analyses: data.analyses || [],
      intention_principale: intention,
      reponse_requise: reponseRequise,
      text: String(text),
      subject: src.subject || '',
      from: src.from || '',
      channel: detectChannel(context),
      intentionListSource: resolved.source,
      intentionPresetId: resolved.presetId || null,
      metadata: result.metadata || {}
    };
  }

  async runIaGenerate(flow, config, context) {
    return this.runIaCompose(flow, config, context);
  }

  prepareCompose(config, context) {
    const { migrateComposeConfig } = require('./zoneContracts');
    const cfg = migrateComposeConfig(config || {});
    const variables = Array.isArray(cfg.variables) ? cfg.variables : [];
    const values = cfg.values && typeof cfg.values === 'object' ? cfg.values : {};

    const templates = {};
    const rendered = {};

    const renderField = (v, locals) => {
      const key = String((v && v.key) || '').trim();
      if (!key) return;
      const raw = values[key] != null
        ? String(values[key])
        : (key === 'prompt' ? String(cfg.prompt || '') : '');
      templates[key] = raw;
      const text = this.interpolateCompose(raw, context, locals);
      const isNum = this.isNumberFieldType(v && v.type);
      const numeric = this.tryEvaluateArithmetic(text);
      if (numeric != null) {
        rendered[key] = isNum ? numeric : String(numeric);
      } else if (isNum) {
        const n = Number(String(text).replace(',', '.').trim());
        rendered[key] = String(text).trim() !== '' && Number.isFinite(n) ? n : text;
      } else {
        rendered[key] = text;
      }
    };

    variables.forEach((v) => renderField(v, rendered));
    variables.forEach((v) => renderField(v, rendered));

    const filled = Object.keys(templates).filter((key) => String(templates[key] || '').trim());
    if (!filled.length) {
      return {
        type: 'compose-result',
        success: true,
        mode: 'empty',
        prepared: true,
        result: null,
        prompt: '',
        rendered: '',
        zones: {},
        channel: detectChannel(context),
        debug: {
          request: { templates },
          response: { mode: 'empty', rendered: '' }
        }
      };
    }

    const formulaKeys = filled.filter((key) => {
      return this.tryEvaluateArithmetic(this.interpolateCompose(templates[key], context, rendered)) != null;
    });
    const isFormula = filled.length === 1 && formulaKeys.length === 1;
    const formulaValue = isFormula
      ? this.tryEvaluateArithmetic(this.interpolateCompose(templates[filled[0]], context, rendered))
      : null;

    const promptRaw = templates.prompt != null ? templates.prompt : templates[filled[0]];
    const promptRendered = rendered.prompt != null ? rendered.prompt : rendered[filled[0]];

    return {
      type: 'compose-result',
      success: true,
      mode: isFormula ? 'formula' : 'prompt',
      prepared: true,
      result: isFormula ? formulaValue : null,
      response: isFormula ? String(formulaValue) : undefined,
      prompt: promptRaw || '',
      rendered: promptRendered || '',
      zones: rendered,
      ...rendered,
      channel: detectChannel(context),
      debug: {
        request: { templates },
        response: { mode: isFormula ? 'formula' : 'prompt', rendered: promptRendered || '', zones: rendered }
      }
    };
  }

  interpolateCompose(template, context, locals) {
    const extra = locals && typeof locals === 'object' ? locals : {};
    return interpolateTable(template, (key, rowLocals) => {
      const idx = loopItemIndex(rowLocals);
      const expanded = expandIndexTokens(key, idx, rowLocals);
      const path = normalizeNsPath(expanded) || expanded;
      if (path === 'today' || key === 'today') return new Date().toISOString().slice(0, 10);
      if (path === 'date' || key === 'date') return new Date().toLocaleString('fr-FR');
      if (looksLikeIntentionCatalogPath(path) || looksLikeIntentionCatalogPath(key)) {
        const catalog = this.readIntentionCatalog(context);
        const localVal = readPath(rowLocals || extra, path);
        if (looksLikeIntentionList(localVal)) return localVal;
        if (catalog.length) return catalog;
      }
      if (path === 'items.length' || path === 'item.length' || key === 'items.length' || key === 'item.length') {
        const items = this.readContextField(context, 'items');
        if (Array.isArray(items)) return items.length;
        const n = this.readContextField(context, 'itemsCount');
        if (n != null && n !== '') return n;
      }
      const bag = rowLocals || extra;
      const fromLocals = readPath(bag, path);
      if (looksLikeIntentionCatalogPath(path) && looksLikeMessageList(fromLocals)) {
        const catalog = this.readIntentionCatalog(context);
        if (catalog.length) return catalog;
      }
      const shadowedTable = fromLocals && typeof fromLocals === 'object' && !Array.isArray(fromLocals)
        && !Array.isArray(fromLocals.items)
        && (isDataTableAlias(path)
          || (rowLocals && rowLocals.__loopSlug && loopKeysMatch(path, rowLocals.__loopSlug)));
      if (fromLocals !== undefined && fromLocals !== null && fromLocals !== '' && !shadowedTable) {
        return fromLocals;
      }
      if (Object.prototype.hasOwnProperty.call(extra, path) && extra[path] != null && extra[path] !== '') {
        return extra[path];
      }
      const root = path.split('.')[0];
      let rest = path.indexOf('.') >= 0 ? path.slice(root.length + 1) : '';
      if (/^item\.\d+/.test(rest)) rest = 'items.' + rest.slice(5);
      if (/^\d+/.test(rest)) rest = 'items.' + rest;
      if (isDataTableAlias(root)
        || (rowLocals && rowLocals.__loopSlug && loopKeysMatch(root, rowLocals.__loopSlug))) {
        const table = this.readDataTable(context, root);
        if (table) {
          if (!rest) return table;
          if (rest === 'length' || rest === 'lenght') {
            if (Array.isArray(table.items)) return table.items.length;
            if (Array.isArray(table)) return table.length;
            if (table.itemsCount != null) return Number(table.itemsCount);
            return 0;
          }
          const indexed = readIndexedField(table, rest, rowLocals);
          if (indexed !== undefined) return indexed;
          const nested = readFromBag(table, rest);
          if (nested !== undefined) return nested;
        }
      }
      if (rest) {
        const nsBag = this.readContextField(context, root);
        const indexed = readIndexedField(nsBag, rest, rowLocals);
        if (indexed !== undefined) return indexed;
      }
      let value = this.readContextField(context, path);
      if ((value == null || value === '') && path.indexOf('.') >= 0) {
        value = this.readComposeStoredValue(context, path);
      }
      return value;
    });
  }

  isNumberFieldType(type) {
    const t = String(type || '').toLowerCase();
    return t === 'number' || t === 'int' || t === 'integer' || t === 'float'
      || t === 'currency' || t === 'nombre' || t === 'chiffre';
  }

  /**
   * Formule arithmétique après interpolation → nombre, sinon null.
   * Opérateurs : + − × ÷ % puissance (** ou ^) parenthèses.
   */
  tryEvaluateArithmetic(text) {
    let compact = String(text || '')
      .replace(/,/g, '.')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '**')
      .replace(/\s+/g, '');
    if (!compact) return null;
    const hasOp = /[+\-*/%]/.test(compact) || compact.includes('**');
    if (!hasOp) return null;
    const normalized = compact.replace(/\*\*/g, '^');
    if (!/^[0-9+\-*/%().^]+$/.test(normalized)) return null;
    if (/[+\-*/%]{2,}/.test(normalized.replace(/^\-/, '').replace(/\^/g, ''))) return null;
    try {
      const value = Function('"use strict"; return (' + compact + ')')();
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  async runIaCompose(flow, config, context) {
    const prepared = this.prepareCompose(config, context);
    if (prepared.mode === 'formula') return prepared;
    return this.runIaExecute(flow, { ...config, prompt: prepared.rendered }, context);
  }

  assembleIaPrompt(parts) {
    const src = parts && typeof parts === 'object' ? parts : {};
    return [src.context, src.rag, src.prompt]
      .map((chunk) => String(chunk == null ? '' : chunk).trim())
      .filter(Boolean)
      .join('\n\n');
  }

  async boundTemplate(flow, config, context) {
    return renderBound(this, flow, config, context);
  }

  looksLikeObjectId(value) {
    return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
  }

  looksLikeLlmRef(value) {
    return /^srv:[a-fA-F0-9]{24}:.+$/.test(String(value || '').trim());
  }

  resolveIaCallOptions(config, context) {
    const llmRaw = resolveSlotNonEmpty(this, config, 'llmId', context)
      || resolveSlotNonEmpty(this, config, 'llm', context)
      || '';
    const modelRaw = resolveSlotNonEmpty(this, config, 'model', context) || '';
    const asRef = this.looksLikeLlmRef(llmRaw)
      ? String(llmRaw).trim()
      : (this.looksLikeLlmRef(modelRaw) ? String(modelRaw).trim() : '');
    const asOid = this.looksLikeObjectId(llmRaw)
      ? String(llmRaw).trim()
      : (this.looksLikeObjectId(modelRaw) ? String(modelRaw).trim() : '');
    const asId = asRef || asOid;
    const plainModel = (!this.looksLikeObjectId(modelRaw) && !this.looksLikeLlmRef(modelRaw))
      ? String(modelRaw || '').trim()
      : '';
    const asName = asId ? plainModel : (llmRaw || modelRaw);
    const tempRaw = resolveSlotNonEmpty(this, config, 'temperature', context);
    const maxRaw = resolveSlotNonEmpty(this, config, 'maxTokens', context)
      || resolveSlotNonEmpty(this, config, 'max_tokens', context);
    const options = { max_tokens: 800 };
    if (asName) options.model = asName;
    const temp = Number(tempRaw);
    if (tempRaw != null && String(tempRaw).trim() !== '' && Number.isFinite(temp)) {
      options.temperature = temp;
    }
    const max = parseInt(maxRaw, 10);
    if (maxRaw != null && Number.isFinite(max) && max > 0) {
      options.max_tokens = max;
    }
    return { llmId: asId || null, options };
  }

  productionTemplateOf(config) {
    const id = String((config && config.productionTemplateId) || '').trim();
    if (!id || id === 'auto') return null;
    return getProductionTemplate(id);
  }

  async applyProductionCallOptions(flow, config, context, call) {
    const doc = this.productionTemplateOf(config);
    if (!doc || !call || !call.options) return call;
    const spec = modelSpecOf(doc);
    try {
      const { listAvailableLlms } = require(path.resolve(
        __dirname,
        '../../../modules/ia/backend/services/AvailableModels'
      ));
      const llms = await listAvailableLlms(flow && flow.entrepriseId);
      const picked = pickModelForTemplate(doc, llms);
      if (picked && picked.id) call.llmId = picked.id;
      if (picked && picked.model) call.options.model = picked.model;
    } catch (err) {
      console.warn('production model pick:', err && err.message);
    }
    if (spec.temperature != null) call.options.temperature = spec.temperature;
    if (spec.maxTokens) call.options.max_tokens = spec.maxTokens;
    return call;
  }

  tryParseJsonSlice(text, startChar, endChar) {
    const src = String(text || '');
    const start = src.indexOf(startChar);
    const end = src.lastIndexOf(endChar);
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(src.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }

  recoverJsonObjects(text) {
    const src = String(text || '');
    const rows = [];
    let i = 0;
    while (i < src.length) {
      const start = src.indexOf('{', i);
      if (start < 0) break;
      let depth = 0;
      let inStr = false;
      let esc = false;
      let end = -1;
      for (let j = start; j < src.length; j += 1) {
        const c = src[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth += 1;
        else if (c === '}') {
          depth -= 1;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
      if (end < 0) break;
      try {
        const obj = JSON.parse(src.slice(start, end + 1));
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) rows.push(obj);
      } catch (_) {
        // objet incomplet
      }
      i = end + 1;
    }
    return rows;
  }

  parseIaStructuredResponse(raw, expectCount) {
    let text = String(raw || '').trim();
    if (!text) return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = String(fence[1] || '').trim();
    const n = Number(expectCount) || 0;
    if (n > 1) {
      const arr = this.tryParseJsonSlice(text, '[', ']');
      if (Array.isArray(arr) && arr.length) return arr;
      const recovered = this.recoverJsonObjects(text);
      if (recovered.length) return recovered;
    }
    const iObj = text.indexOf('{');
    const iArr = text.indexOf('[');
    let parsed = null;
    if (iObj >= 0 && (iArr < 0 || iObj < iArr)) {
      parsed = this.tryParseJsonSlice(text, '{', '}');
    } else if (iArr >= 0) {
      parsed = this.tryParseJsonSlice(text, '[', ']');
    }
    if (parsed != null) return parsed;
    const recovered = this.recoverJsonObjects(text);
    return recovered.length ? recovered : null;
  }

  iaRowsFromParsed(parsed) {
    if (Array.isArray(parsed)) return parsed.slice();
    if (parsed && Array.isArray(parsed.items)) return parsed.items.slice();
    if (parsed && Array.isArray(parsed.results)) return parsed.results.slice();
    if (parsed && typeof parsed === 'object') return [parsed];
    return [];
  }

  enrichIaResult(base, parsed) {
    const reserved = {
      response: true, rendered: true, success: true, model: true, type: true,
      mode: true, prompt: true, channel: true, metadata: true, result: true
    };
    if (parsed == null) return base;
    if (Array.isArray(parsed)) {
      const first = parsed[0] && typeof parsed[0] === 'object' ? parsed[0] : null;
      base.items = parsed;
      base.item = first || parsed[0] || null;
      base.itemsCount = parsed.length;
      base.itemIndex = 0;
      if (first) {
        Object.keys(first).forEach((key) => {
          if (!reserved[key]) base[key] = first[key];
        });
      }
    } else if (typeof parsed === 'object') {
      base.item = parsed;
      base.items = [parsed];
      base.itemsCount = 1;
      base.itemIndex = 0;
      Object.keys(parsed).forEach((key) => {
        if (!reserved[key]) base[key] = parsed[key];
      });
    } else {
      return base;
    }
    if (base.intention && base.intention_principale == null) base.intention_principale = base.intention;
    applyIaConfiance(base);
    return base;
  }

  sourceItemsForIa(context) {
    const table = this.readDataTable(context);
    return table ? collectItems(table) : [];
  }

  formatSourceTableForPrompt(list) {
    return (list || []).map((row, i) => {
      const r = row && typeof row === 'object' ? row : { text: row };
      const text = String(r.text || r.body || r.texte || r.message || '').slice(0, 2000);
      const from = r.from || r.expediteur || '';
      const subject = r.subject || r.sujet || '';
      return `${i + 1}. De: ${from} | Sujet: ${subject} | Texte: ${text}`;
    }).join('\n');
  }

  injectSourceTable(rendered, list) {
    const n = (list || []).length;
    if (n < 2) return String(rendered || '');
    const marker = '--- Messages (tableau) ---';
    const body = String(rendered || '');
    if (body.indexOf(marker) >= 0) return body;
    return `${body.trim()}\n\n${marker}\n${n} message(s), dans cet ordre :\n${this.formatSourceTableForPrompt(list)}`;
  }

  ensureArrayOutputContract(rendered, n, hint) {
    if (n < 2) return String(rendered || '');
    let body = String(rendered || '').trim();
    body = body.replace(/\n*Réponds uniquement en JSON\s*:\s*\{[\s\S]*\}\s*$/i, '');
    const marker = 'un objet par message, même ordre';
    if (body.toLowerCase().indexOf(marker) >= 0) return body;
    let sample = String(hint || '').trim();
    if (!sample || sample.charAt(0) === '{') {
      const obj = sample && sample.charAt(0) === '{'
        ? sample
        : '{ "intention": "…", "confiance": 0.8, "resume": "…" }';
      sample = '[\n  ' + obj + '\n]';
    }
    return `${body}\n\nLe tableau d'entrée a ${n} message(s). Réponds avec un JSON tableau de ${n} objets (${marker}).\n${sample}`;
  }

  normalizeParsedIaItems(parsed, list, catalog) {
    let rows = this.iaRowsFromParsed(parsed);
    const sources = Array.isArray(list) ? list : [];
    const n = sources.length;
    if (n > 0) {
      if (rows.length > n) rows = rows.slice(0, n);
      while (rows.length < n) rows.push(null);
    }
    if (!rows.length) return parsed;
    return rows.map((row, i) => {
      const missing = row == null;
      const src = sources[i];
      const obj = row && typeof row === 'object' && !Array.isArray(row)
        ? { ...row }
        : (missing ? {} : { text: row, response: row });
      obj.itemIndex = i;
      obj.itemNumber = i + 1;
      if (src && typeof src === 'object') {
        if (obj.from == null && src.from) obj.from = src.from;
        if (obj.subject == null && src.subject) obj.subject = src.subject;
        obj.sourceItemIndex = i;
      }
      if (missing) {
        if (obj.confiance == null && obj.confidence == null) obj.confiance = 0;
        if (!obj.resume && !obj.summary && !obj.résumé) {
          obj.resume = `Analyse manquante pour le message ${i + 1}/${n || rows.length}`;
        }
      }
      if (obj.intention && obj.intention_principale == null) obj.intention_principale = obj.intention;
      if (obj.intention_principale && obj.intention == null) obj.intention = obj.intention_principale;
      applyCatalogToIaRow(obj, catalog);
      return obj;
    });
  }

  iaItemFromCall(one, sourceRow, index) {
    const parsed = this.parseIaStructuredResponse(one && one.response);
    let row;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      row = { ...parsed };
    } else if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
      row = { ...parsed[0] };
    } else {
      row = { response: one && one.response, text: one && one.response };
    }
    row.response = (one && one.response) || row.response || '';
    row.itemIndex = index;
    row.itemNumber = index + 1;
    if (sourceRow && typeof sourceRow === 'object') {
      if (row.from == null && sourceRow.from) row.from = sourceRow.from;
      if (row.subject == null && sourceRow.subject) row.subject = sourceRow.subject;
      row.sourceItemIndex = index;
    }
    if (row.intention && row.intention_principale == null) row.intention_principale = row.intention;
    if (row.intention_principale && row.intention == null) row.intention = row.intention_principale;
    applyIaConfiance(row);
    return row;
  }

  rememberLoopIaOutput(context, node, output) {
    if (!context || !node || node.brickId !== 'ia' || !output) return;
    const loops = context.__loops;
    if (!loops || typeof loops !== 'object') return;
    Object.keys(loops).forEach((id) => {
      const state = loops[id];
      if (!state || !state.started || state.finished || !Array.isArray(state.items) || !state.n) return;
      const slug = String(node.slug || '').trim();
      if (!slug) return;
      if (!state.iaItems) state.iaItems = {};
      if (!Array.isArray(state.iaItems[slug])) state.iaItems[slug] = [];
      const row = output.item && typeof output.item === 'object'
        ? { ...output.item, response: output.response }
        : this.iaItemFromCall(output, null, state.iaItems[slug].length);
      state.iaItems[slug].push(row);
    });
  }

  applyLoopCollectedIa(context, node) {
    const loopId = node && node.id;
    const state = context && context.__loops && context.__loops[loopId];
    if (!state || !state.iaItems) return;
    const prev = context.previous;
    if (!prev || typeof prev !== 'object') return;
    const ns = { ...namespaceBag(prev) };
    Object.keys(state.iaItems).forEach((slug) => {
      const rows = (state.iaItems[slug] || []).filter(Boolean);
      if (!rows.length) return;
      const first = rows[0] && typeof rows[0] === 'object' ? rows[0] : {};
      ns[slug] = {
        ...(ns[slug] || {}),
        ...first,
        items: rows,
        item: rows[0],
        itemsCount: rows.length,
        itemIndex: 0,
        perItem: true
      };
    });
    context.previous = { ...prev, __ns: ns, __nsOrder: nsOrder(prev) };
  }

  /**
   * Appel modèle. Un tableau de N mails → un JSON tableau de N sorties (un seul appel).
   */
  async runIaExecute(flow, config, context) {
    return this.runIaExecuteOnce(flow, config, context);
  }

  /**
   * Un appel modèle (une ligne). Prompt = mapping d’entrée, sinon champs namespacés.
   */
  async runIaExecuteOnce(flow, config, context) {
    const source = String((config && config.source) || 'previous').toLowerCase();
    const custom = String((config && config.prompt) || '').trim();
    const nsPrompt = this.ctxStr(context, 'rendered') || this.ctxStr(context, 'prompt');
    const nsContext = this.ctxStr(context, 'context');
    const nsRag = this.ctxStr(context, 'rag');
    const nsMode = this.readContextField(context, 'mode');
    const nsResult = this.readContextField(context, 'result');
    const nsResponse = this.readContextField(context, 'response');
    const mappedPrompt = resolveSlotString(this, config, 'prompt', context);
    const mappedContext = resolveSlotString(this, config, 'context', context);
    const mappedRag = resolveSlotString(this, config, 'rag', context);
    const hasMapping = mappedPrompt !== undefined || mappedContext !== undefined || mappedRag !== undefined;
    let bound = await this.boundTemplate(flow, config, context);
    if (!bound || !(bound.iaParts || String(bound.text || '').trim())) {
      const prodBound = this.bindProductionPrompt(config, context);
      if (prodBound) bound = { ...(bound || {}), ...prodBound };
    }

    if (source !== 'custom' && !hasMapping && !bound && nsMode === 'formula' && nsResult != null) {
      return {
        type: 'ia-result',
        success: true,
        skipped: true,
        mode: 'formula',
        result: nsResult,
        response: nsResponse != null ? nsResponse : String(nsResult),
        prompt: this.ctxStr(context, 'prompt'),
        rendered: this.ctxStr(context, 'rendered'),
        channel: detectChannel(context)
      };
    }

    let rendered = '';
    let promptTemplate = '';
    const fills = (bound && bound.iaParts && bound.iaParts.fills)
      ? bound.iaParts.fills
      : ((bound && bound.fills) || {});
    if (bound && bound.iaParts) {
      const parts = bound.iaParts;
      let prompt = fills.prompt
        ? parts.prompt
        : (mappedPrompt != null ? String(mappedPrompt) : nsPrompt);
      if (String(parts.outputHint || '').trim()) {
        const title = parts.outputFormat === 'json' ? 'Réponds uniquement en JSON :' : 'Format de sortie :';
        prompt = [String(prompt || '').trim(), `${title}\n${String(parts.outputHint).trim()}`]
          .filter(Boolean)
          .join('\n\n');
      }
      promptTemplate = prompt;
      rendered = this.assembleIaPrompt({
        prompt,
        context: fills.context ? parts.context : (mappedContext != null ? mappedContext : nsContext),
        rag: fills.rag ? parts.rag : (mappedRag != null ? mappedRag : nsRag)
      });
    } else if (bound && String(bound.text || '').trim()) {
      promptTemplate = bound.text;
      rendered = this.assembleIaPrompt({
        prompt: bound.text,
        context: fills.context ? '' : (mappedContext != null ? mappedContext : nsContext),
        rag: fills.rag ? '' : (mappedRag != null ? mappedRag : nsRag)
      });
    } else if (hasMapping) {
      promptTemplate = mappedPrompt != null ? String(mappedPrompt) : '';
      rendered = this.assembleIaPrompt({
        prompt: promptTemplate,
        context: mappedContext != null ? mappedContext : nsContext,
        rag: mappedRag != null ? mappedRag : nsRag
      });
    } else if (source === 'custom') {
      promptTemplate = custom;
      rendered = this.assembleIaPrompt({
        prompt: this.interpolateCompose(custom, context),
        context: nsContext,
        rag: nsRag
      });
    } else {
      promptTemplate = nsPrompt || custom;
      rendered = this.assembleIaPrompt({
        prompt: nsPrompt || this.interpolateCompose(custom, context),
        context: nsContext,
        rag: nsRag
      });
    }

    if (!rendered) {
      throw new Error('Aucun prompt à exécuter. Mappez un champ sur le slot Prompt de ce bloc IA, ou saisissez une valeur libre.');
    }

    const list = this.sourceItemsForIa(context);
    const hint = (bound && bound.iaParts && bound.iaParts.outputHint)
      || (config && (config.outputHint || (config.values && config.values.outputHint)))
      || '';
    if (list.length > 1) {
      rendered = this.injectSourceTable(rendered, list);
      rendered = this.ensureArrayOutputContract(rendered, list.length, hint);
    }
    rendered = this.injectIntentionCatalog(rendered, this.readIntentionCatalog(context));

    const PromptService = require(path.resolve(
      __dirname,
      '../../../modules/prompt/backend/services/PromptService'
    ));
    const call = this.resolveIaCallOptions(config, context);
    await this.applyProductionCallOptions(flow, config, context, call);
    if (list.length > 1) {
      const floor = Math.max(800, list.length * 400);
      if (!Number.isFinite(Number(call.options.max_tokens)) || Number(call.options.max_tokens) < floor) {
        call.options.max_tokens = floor;
      }
    }
    const service = await PromptService.forEntity(flow.entrepriseId, call.llmId);
    const result = await service.generate(rendered, call.options);
    if (!result.success) {
      throw new Error((result.error && result.error.message) || 'Échec génération IA');
    }
    let response = String(result.raw || '').trim();
    if (!response) {
      const used = (result.meta && result.meta.model) || call.options.model || call.llmId || 'modèle';
      throw new Error(
        'L’IA (' + used + ') n’a renvoyé aucun texte. Le modèle a peut-être tout utilisé en « réflexion ». Réessayez, ou choisissez un autre modèle.'
      );
    }
    const usedModel = (result.meta && result.meta.model) || call.options.model || '';
    const catalog = this.readIntentionCatalog(context);
    let parsedRaw = this.parseIaStructuredResponse(response, list.length);
    let got = this.iaRowsFromParsed(parsedRaw).length;
    if (list.length > 1 && got < list.length) {
      const retryPrompt = [
        rendered,
        '',
        `Réponse précédente incomplète : ${got} objet(s) pour ${list.length} message(s).`,
        `Renvoie UNIQUEMENT un JSON tableau de ${list.length} objets, un par message, même ordre.`,
        '[{ "intention": "…", "confiance": 0.8, "resume": "…" }]'
      ].join('\n');
      const retry = await service.generate(retryPrompt, call.options);
      if (retry && retry.success && String(retry.raw || '').trim()) {
        const retryText = String(retry.raw).trim();
        const retryParsed = this.parseIaStructuredResponse(retryText, list.length);
        const gotRetry = this.iaRowsFromParsed(retryParsed).length;
        if (gotRetry > got) {
          parsedRaw = retryParsed;
          response = retryText;
          got = gotRetry;
        }
      }
    }
    const parsed = this.normalizeParsedIaItems(parsedRaw, list, catalog);
    return this.enrichIaResult({
      type: 'ia-result',
      success: true,
      mode: 'ia',
      response,
      result: null,
      prompt: promptTemplate || rendered,
      rendered,
      model: usedModel,
      channel: detectChannel(context),
      metadata: {
        ...(result.meta || {}),
        sourceItems: list.length,
        outputItems: Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0)
      }
    }, parsed);
  }

  runPickFields(config, context, actionId) {
    const defaults = String(actionId || '').startsWith('facebook.')
      ? ['text', 'from']
      : ['subject', 'text'];
    const fields = Array.isArray(config.pickFields) && config.pickFields.length
      ? config.pickFields.map(String)
      : defaults;
    const out = {
      type: 'pick-result',
      success: true,
      action: actionId,
      picked: fields
    };
    fields.forEach((key) => {
      const value = this.readContextField(context, key);
      if (value !== undefined) out[key] = value;
    });
    return out;
  }

  resolveMailImapTarget(entrepriseId, config, context) {
    const msg = context.message || {};
    const uid =
      this.readContextField(context, 'sourceRef') ||
      msg.sourceRef ||
      (msg.raw && (msg.raw.sourceRef || msg.raw.uid)) ||
      null;
    const accountRef =
      String(config.accountRef || '').trim() ||
      this.ctxStr(context, 'metadata.accountRef') ||
      (msg.metadata && msg.metadata.accountRef) ||
      (context.trigger &&
        context.trigger.payload &&
        context.trigger.payload.accountRef) ||
      '';
    const mailbox =
      String(config.mailbox || '').trim() ||
      this.ctxStr(context, 'metadata.mailbox') ||
      this.ctxStr(context, 'mailbox') ||
      (msg.metadata && msg.metadata.mailbox) ||
      'INBOX';
    return { uid, accountRef, mailbox, msg };
  }

  async runMailImapAction(entrepriseId, config, context, actionId) {
    const target = this.resolveMailImapTarget(entrepriseId, config, context);
    if (!target.uid) {
      throw new Error('sourceRef / UID IMAP introuvable dans le contexte');
    }
    if (!target.accountRef) {
      throw new Error('Compte mail (accountRef) requis');
    }

    const {
      loadMailConfigForConnector,
      resolveImapConfigForAccount
    } = require('../connectors/mail-infra-helper');
    const mailConfig = await loadMailConfigForConnector(this.database, entrepriseId);
    if (!mailConfig) {
      throw new Error('Configuration mail introuvable pour cette entité');
    }
    const imapRaw = resolveImapConfigForAccount(mailConfig, target.accountRef, target.mailbox);
    if (!imapRaw) {
      throw new Error(`Configuration IMAP introuvable pour le compte ${target.accountRef}`);
    }

    let mailModule;
    try {
      mailModule = require(path.resolve(__dirname, '../../../modules/mail/backend/index.js'));
    } catch (error) {
      throw new Error(`Module mail indisponible : ${error.message}`);
    }
    const imap = mailModule.getMailService().getImapService();
    const op = String(actionId || '');
    let result;
    let extra = {};
    if (op === 'mail.mark-seen') {
      result = await imap.markSeen(imapRaw, target.uid);
      extra.mailFlag = 'seen';
    } else if (op === 'mail.mark-unseen') {
      result = await imap.markUnseen(imapRaw, target.uid);
      extra.mailFlag = 'unseen';
    } else if (op === 'mail.move') {
      const folder = String(config.folder || '').trim();
      if (!folder) throw new Error('Dossier IMAP de destination requis');
      result = await imap.moveMessage(imapRaw, target.uid, folder);
      extra.mailbox = folder;
    } else {
      throw new Error(`Action IMAP inconnue : ${op}`);
    }

    return {
      type: 'mail-imap-result',
      success: true,
      action: op,
      uid: String(target.uid),
      accountRef: String(target.accountRef),
      mailbox: extra.mailbox || target.mailbox,
      data: result,
      ...extra
    };
  }

  async runFacebookAction(entrepriseId, config, context, actionId) {
    const {
      facebookObjectAction
    } = require('../connectors/facebook-graph-helper');
    const msg = context.message || {};
    const objectId =
      this.readContextField(context, 'sourceRef') ||
      this.readContextField(context, 'messageId') ||
      this.readContextField(context, 'commentId') ||
      this.readContextField(context, 'postId') ||
      msg.sourceRef ||
      msg.messageId ||
      msg.commentId ||
      '';
    const pageId = config.pageId
      || this.readContextField(context, 'pageId')
      || msg.pageId
      || null;
    const map = {
      'facebook.hide-comment': 'hide',
      'facebook.like': 'like',
      'facebook.delete': 'delete'
    };
    const action = map[String(actionId || '')];
    if (!action) throw new Error(`Action Facebook inconnue : ${actionId}`);
    const result = await facebookObjectAction(this.database, entrepriseId, {
      action,
      objectId,
      pageId
    });
    const flags = {};
    if (action === 'hide') flags.facebookHidden = true;
    if (action === 'like') flags.facebookLiked = true;
    if (action === 'delete') flags.facebookDeleted = true;
    return {
      type: 'facebook-action-result',
      success: true,
      action: actionId,
      objectId: String(objectId),
      ...flags,
      facebookResponse: result.facebookResponse || {}
    };
  }

  async runRouteIntention(flow, config, context) {
    const { normalizeRouteTarget } = require('./intentionPresets');
    const doc = await this.brickConfig.getConfig(flow._id, 'route-intention');
    const routeCfg = (doc && doc.config) || this.brickConfig.getDefaultRouteConfig();
    const intention = this.ctxStr(context, 'intention_principale').trim();

    const rules = Array.isArray(routeCfg.rules) ? routeCfg.rules : [];
    let matched = rules.find((r) => {
      const when = (r.when && r.when.intention) || '';
      return String(when).toLowerCase() === intention.toLowerCase();
    });
    if (!matched) {
      matched = { target: routeCfg.defaultTarget || { type: 'emails', to: [] } };
    }

    const target = normalizeRouteTarget(matched.target || {});
    const targetType = target.type;
    let toList = [];
    /** undefined = suivre nextId canvas ; null = stop ; string = branche */
    let nextOverride;

    if (targetType === 'emails') {
      toList = Array.isArray(target.to) ? target.to.slice() : [];
    } else if (targetType === 'annuaire-service') {
      if (!target.serviceId) {
        throw new Error('Routage annuaire-service : serviceId manquant');
      }
      toList = await this.resolveAnnuaireServiceEmails(flow.entrepriseId, target.serviceId);
    } else if (targetType === 'flow-branch') {
      if (!target.nextStepId) {
        throw new Error('Routage flow-branch : nextStepId (nœud cible) manquant');
      }
      nextOverride = target.nextStepId;
    } else if (targetType === 'stop') {
      nextOverride = null;
    }
    // continue → nextOverride reste undefined → lien canvas

    toList = toList.map((e) => String(e || '').trim()).filter(Boolean);
    const isMailTarget = targetType === 'emails' || targetType === 'annuaire-service';

    const subjectTpl = routeCfg.subjectTemplate || '[{{intention}}] {{subject}}';
    const bodyTpl = routeCfg.bodyTemplate || 'Intention: {{intention}}\n\n{{body}}';
    const vars = {
      intention: intention || 'generic',
      subject: this.ctxStr(context, 'subject'),
      body: this.ctxStr(context, 'body') || this.ctxStr(context, 'text'),
      from: this.ctxStr(context, 'from'),
      date: new Date().toLocaleString('fr-FR')
    };

    const result = {
      type: 'route-result',
      intention: intention || null,
      targetType,
      to: isMailTarget ? toList.join(', ') : '',
      toList: isMailTarget ? toList : [],
      subject: isMailTarget ? this.applyVars(subjectTpl, vars) : '',
      body: isMailTarget ? this.applyVars(bodyTpl, vars) : '',
      target
    };

    if (nextOverride !== undefined) {
      result.__nextNodeId = nextOverride;
    }

    return result;
  }

  async resolveAnnuaireServiceEmails(entrepriseId, serviceId) {
    try {
      const database = this.database;
      const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
      if (!entrepriseDb) return [];
      const contacts = await entrepriseDb
        .collection('annuaire_contacts')
        .find({
          $or: [
            { serviceIds: String(serviceId) },
            { serviceId: String(serviceId) },
            { 'services.id': String(serviceId) }
          ]
        })
        .project({ email: 1, emails: 1 })
        .limit(50)
        .toArray();
      const out = [];
      for (const c of contacts) {
        if (c.email) out.push(String(c.email));
        if (Array.isArray(c.emails)) out.push(...c.emails.map(String));
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  async runDataBackup(entrepriseId, config, context) {
    let backupService;
    try {
      const backupModule = require(path.resolve(
        __dirname,
        '../../../modules/data-backup/backend/index.js'
      ));
      backupService = backupModule.getBackupService();
    } catch (error) {
      throw new Error(`Module data-backup indisponible : ${error.message}`);
    }

    if (config.scope || (Array.isArray(config.collections) && config.collections.length)) {
      await backupService.saveEntityConfig(entrepriseId, {
        scope: config.scope || 'full',
        collections: config.collections || []
      });
    }

    const run = await backupService.runBackup(entrepriseId, {
      trigger: 'agent-flow',
      requestedBy: context.trigger.triggeredBy || 'agent-flow'
    });

    return {
      type: 'backup-result',
      runId: String(run._id),
      entrepriseId,
      status: run.status,
      sizeBytes: run.sizeBytes || 0,
      documentCount: run.documentCount || 0,
      collectionCount: run.collectionCount || 0,
      fileName: run.fileName,
      filePath: run.filePath
    };
  }

  async runFacebookOut(entrepriseId, config, context, operation = 'emit.reply') {
    const {
      sendFacebookReply,
      publishFacebookPost
    } = require('../connectors/facebook-graph-helper');
    const msg = context.message || {};
    const meta = (msg.raw && msg.raw.metadata) || msg.metadata || {};
    const useRoute = config.usePreviousRoute !== false
      && this.readContextField(context, 'type') === 'route-result';

    const op = String(operation || '').toLowerCase();
    const action =
      String(config.action || '').toLowerCase() ||
      (op.includes('publish') ? 'publish' : 'reply');

    const mappedMessage = resolveSlotString(this, config, 'message', context);
    let text = mappedMessage !== undefined
      ? String(mappedMessage).trim()
      : String(config.message || '').trim();
    if (useRoute && (!text || text === '{{body}}') && this.ctxStr(context, 'body')) {
      text = this.ctxStr(context, 'body');
    }
    if (mappedMessage === undefined) {
      text = this.interpolateTemplate(text || (action === 'publish' ? '' : '{{body}}'), context).trim();
    }
    const bound = await this.boundTemplate({ entrepriseId }, config, context);
    if (bound && (bound.text || bound.html)) {
      text = String(bound.text || bound.html).trim() || text;
    }

    const pageId =
      String(config.pageId || '').trim() ||
      this.ctxStr(context, 'pageId') ||
      String(msg.pageId || meta.pageId || '').trim() ||
      null;

    const link = this.interpolateTemplate(String(config.link || ''), context).trim();
    const imageUrl = this.interpolateTemplate(
      String(config.imageUrl || config.image_url || ''),
      context
    ).trim();

    if (action === 'publish') {
      if (!pageId) {
        throw new Error('Compte / page Facebook requis pour publier — choisissez une page sur le bloc');
      }
      if (!text && !link && !imageUrl) {
        throw new Error('Publication Facebook : indiquez un texte, un lien ou une image');
      }
      const result = await publishFacebookPost(this.database, entrepriseId, {
        pageId,
        message: text,
        link: link || null,
        imageUrl: imageUrl || null,
        published: config.published !== false && config.published !== 'false'
      });
      return {
        type: 'facebook-out-result',
        success: true,
        channel: 'publish',
        pageId: result.pageId,
        postId: result.postId,
        message: text,
        link: link || null,
        imageUrl: imageUrl || null,
        facebookResponse: result.facebookResponse || {}
      };
    }

    if (!text) {
      throw new Error('Texte de réponse Facebook vide — configurez le message ou le routage');
    }

    const commentId =
      String(config.commentId || '').trim() ||
      this.ctxStr(context, 'commentId') ||
      String(meta.comment_id || msg.commentId || '').trim() ||
      ((msg.resourceType === 'comment' || msg.type === 'commentaire' || msg.type === 'comment'
        || this.readContextField(context, 'type') === 'commentaire')
        ? String(this.readContextField(context, 'messageId') || this.readContextField(context, 'sourceRef') || msg.messageId || msg.sourceRef || '')
        : '') ||
      '';

    const postId =
      String(config.postId || '').trim() ||
      this.ctxStr(context, 'postId') ||
      String(meta.postId || meta.post_id || msg.postId || '').trim() ||
      ((msg.resourceType === 'post' || msg.type === 'post' || this.readContextField(context, 'type') === 'post')
        ? String(this.readContextField(context, 'messageId') || this.readContextField(context, 'sourceRef') || msg.messageId || msg.sourceRef || '')
        : '') ||
      '';

    const authorId =
      this.readContextField(context, 'author.id') ||
      (msg.raw && msg.raw.author && msg.raw.author.id) ||
      (msg.author && msg.author.id) ||
      meta.fromId ||
      meta.authorId ||
      null;
    const psid = String(config.recipientId || authorId || '').trim();

    const result = await sendFacebookReply(this.database, entrepriseId, {
      pageId,
      replyMode: config.replyMode || 'auto',
      message: text,
      commentId: commentId || null,
      postId: postId || null,
      recipientId: psid || null
    });

    return {
      type: 'facebook-out-result',
      success: true,
      channel: result.channel,
      pageId: result.pageId,
      message: text,
      facebookResponse: result.facebookResponse || {}
    };
  }

  extractEmail(value) {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const found = this.extractEmail(value[i]);
        if (found) return found;
      }
      return '';
    }
    if (typeof value === 'object') {
      return this.extractEmail(value.email || value.address || value.mail || value.from || '');
    }
    const text = String(value).trim();
    if (!text || text === '{{to}}' || text === '{{from}}') return '';
    const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0] : '';
  }

  resolveMailRecipient(config, context, useRoute) {
    const mappedTo = resolveSlotNonEmpty(this, config, 'to', context);
    const mappedFrom = resolveSlotNonEmpty(this, config, 'from', context);
    const literalTo = config.literals && String(config.literals.to || '').trim()
      ? this.interpolateCompose(String(config.literals.to), context).trim()
      : '';
    const rawFixed = String(config.to || '').trim();
    const fixedTo = rawFixed && rawFixed !== '{{to}}'
      ? this.interpolateCompose(rawFixed, context).trim()
      : '';
    const routedTo = useRoute ? this.ctxStr(context, 'to').trim() : '';
    const mapping = (config && config.mapping && typeof config.mapping === 'object')
      ? config.mapping
      : {};
    const mappedPath = String(mapping.to || '').trim();
    const siblings = [];
    if (mappedPath && mappedPath !== '__literal__' && mappedPath.indexOf('.') >= 0) {
      const slug = normalizeNsPath(mappedPath).split('.')[0];
      siblings.push(
        this.ctxStr(context, `${slug}.author.email`),
        this.ctxStr(context, `${slug}.from`),
        this.ctxStr(context, `${slug}.to`),
        this.readComposeStoredValue(context, mappedPath)
      );
    }
    const candidates = [
      mappedTo,
      literalTo,
      fixedTo,
      routedTo,
      mappedFrom,
      this.ctxStr(context, 'to'),
      this.ctxStr(context, 'author.email'),
      this.ctxStr(context, 'from'),
      ...siblings,
      this.interpolateTemplate('{{to}}', context),
      this.interpolateTemplate('{{from}}', context)
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const email = this.extractEmail(candidates[i]);
      if (email) return email;
    }
    return '';
  }

  async runMailOut(entrepriseId, config, context) {
    const useRoute = config.usePreviousRoute !== false
      && this.readContextField(context, 'type') === 'route-result';
    const targetType = this.readContextField(context, 'targetType');

    const mappedTo = resolveSlotNonEmpty(this, config, 'to', context);
    const literalTo = config.literals && String(config.literals.to || '').trim()
      ? this.interpolateCompose(String(config.literals.to), context).trim()
      : '';
    const fixedTo = String(config.to || '').trim() && String(config.to).trim() !== '{{to}}'
      ? this.interpolateCompose(String(config.to), context).trim()
      : '';
    const hasLocalTo = Boolean(
      this.extractEmail(mappedTo)
      || this.extractEmail(literalTo)
      || this.extractEmail(fixedTo)
      || String(literalTo || mappedTo || fixedTo || '').trim()
    );

    if (useRoute && targetType && targetType !== 'emails' && targetType !== 'annuaire-service' && !hasLocalTo) {
      throw new Error(
        `mail-out attend un routage mail (emails / annuaire-service), reçu : ${targetType}`
      );
    }

    let accountRef = String(config.accountRef || '').trim();
    let to = this.resolveMailRecipient(config, context, useRoute);
    if (!to) {
      const mapping = (config && config.mapping) || {};
      const mappedPath = String(mapping.to || '').trim();
      const fromNode = mappedPath && mappedPath !== '__literal__'
        ? this.readComposeStoredValue(context, mappedPath)
        : '';
      to = this.extractEmail(fromNode);
    }

    if (!accountRef) {
      throw new Error('Compte mail (accountRef) requis — configurez un compte dans Connecteurs > Mail');
    }
    if (!to) {
      const mapping = (config && config.mapping) || {};
      const mappedPath = String(mapping.to || '').trim();
      if (mappedPath && mappedPath !== '__literal__') {
        throw new Error(
          'Destinataire (to) requis — {{' + mappedPath + '}} est vide. Saisissez une adresse e-mail dans ce champ du bloc Action, ou choisissez « Valeur fixe… » sur la Sortie.'
        );
      }
      throw new Error('Destinataire (to) requis — saisissez une adresse sur la Sortie ({{…to}}), ou mappez {{slug.from}} / {{slug.author.email}}');
    }

    const mappedSubject = resolveSlotNonEmpty(this, config, 'subject', context);
    const mappedBody = resolveSlotNonEmpty(this, config, 'body', context);
    const bound = await this.boundTemplate({ entrepriseId }, config, context);
    const mapping = (config && config.mapping) || {};
    const literals = (config && config.literals) || {};

    const storedSubject = mapping.subject && mapping.subject !== '__literal__'
      ? this.readComposeStoredValue(context, mapping.subject)
      : '';
    const storedBody = mapping.body && mapping.body !== '__literal__'
      ? this.readComposeStoredValue(context, mapping.body)
      : '';
    const literalSubject = String(literals.subject || '').trim()
      ? this.interpolateCompose(String(literals.subject), context).trim()
      : '';
    const literalBody = String(literals.body || '').trim()
      ? this.interpolateCompose(String(literals.body), context).trim()
      : '';

    let subject = String(
      mappedSubject
      || storedSubject
      || literalSubject
      || (config.subject && config.subject !== '{{subject}}'
        ? this.interpolateCompose(String(config.subject), context)
        : '')
      || (bound && bound.subject)
      || this.ctxStr(context, 'subject')
      || ''
    ).trim();
    if (!subject || subject === '{{subject}}') subject = 'Sans objet';

    const htmlBody = bound && bound.html ? bound.html : '';
    let body = String(
      mappedBody
      || storedBody
      || literalBody
      || (htmlBody ? ((bound && bound.text) || subject) : '')
      || (config.body && config.body !== '{{body}}'
        ? this.interpolateCompose(String(config.body), context)
        : '')
      || this.ctxStr(context, 'body')
      || this.ctxStr(context, 'text')
      || this.ctxStr(context, 'response')
      || subject
      || ' '
    ).trim();
    if (!body || body === '{{body}}') body = subject || ' ';

    const attachments = [];
    const attachPrevious = config.attachPrevious === true;
    const filePath = this.readContextField(context, 'filePath');
    const fileName = this.readContextField(context, 'fileName');
    if (attachPrevious && filePath && fs.existsSync(filePath)) {
      attachments.push({
        filename: fileName || path.basename(filePath),
        path: filePath
      });
    }
    const mappedAtt = resolveSlot(this, config, 'attachments', context);
    const nsAtt = this.readContextField(context, 'attachments');
    const extraAtt = mappedAtt.mapped
      ? (Array.isArray(mappedAtt.value) ? mappedAtt.value : [])
      : (Array.isArray(nsAtt) ? nsAtt : []);
    extraAtt.forEach((att) => {
      if (!att) return;
      if (typeof att === 'string') {
        if (fs.existsSync(att)) attachments.push({ filename: path.basename(att), path: att });
        return;
      }
      if (att.path && fs.existsSync(att.path)) {
        attachments.push({
          filename: att.filename || att.fileName || path.basename(att.path),
          path: att.path
        });
      }
    });

    let mailModule;
    try {
      mailModule = require(path.resolve(__dirname, '../../../modules/mail/backend/index.js'));
    } catch (error) {
      throw new Error(`Module mail indisponible : ${error.message}`);
    }

    const mail = mailModule.getMailService();
    await mail.init();

    const result = await mail.send({
      to,
      subject,
      body: body || subject || ' ',
      body_html: htmlBody || null,
      attachments,
      profile: accountRef,
      module_name: 'mail',
      entity_id: entrepriseId
    });

    if (!result.success) {
      throw new Error(result.error || 'Échec envoi mail');
    }

    return {
      type: 'mail-result',
      success: true,
      email_id: result.email_id || null,
      to,
      subject,
      html: htmlBody || undefined,
      templateId: bound && bound.templateId ? bound.templateId : undefined,
      attachmentCount: attachments.length,
      debug: {
        request: {
          accountRef,
          to,
          subject,
          body: String(body || '').slice(0, 500)
        },
        response: {
          success: true,
          email_id: result.email_id || null
        }
      }
    };
  }

  async runHttpEmit(entrepriseId, config, context) {
    const emitUrl = String(config.emitUrl || '').trim();
    if (!emitUrl) {
      throw new Error('URL de destination (emitUrl) requise');
    }

    const method = String(config.emitMethod || 'POST').toUpperCase();
    const headers = { 'Content-Type': 'application/json' };
    if (config.bearerToken) {
      headers.Authorization = `Bearer ${config.bearerToken}`;
    }

    const body = {
      entrepriseId: String(entrepriseId),
      flowId: context.flowId,
      triggeredAt: context.trigger.triggeredAt,
      triggerMode: context.trigger.mode
    };

    if (config.includeMetadata !== false) {
      body.previous = {
        type: this.readContextField(context, 'type'),
        runId: this.readContextField(context, 'runId'),
        fileName: this.readContextField(context, 'fileName'),
        sizeBytes: this.readContextField(context, 'sizeBytes'),
        documentCount: this.readContextField(context, 'documentCount'),
        status: this.readContextField(context, 'status')
      };
    }

    const filePath = this.readContextField(context, 'filePath');
    const fileName = this.readContextField(context, 'fileName');
    if (config.includeFileBase64 && filePath && fs.existsSync(filePath)) {
      const buf = await fs.promises.readFile(filePath);
      body.fileBase64 = buf.toString('base64');
      body.fileName = fileName || path.basename(filePath);
      body.fileMime = 'application/gzip';
    }

    const response = await fetch(emitUrl, {
      method,
      headers,
      body: JSON.stringify(body)
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return {
      type: 'http-result',
      success: true,
      status: response.status,
      data
    };
  }

  applyVars(template, vars) {
    let out = String(template || '');
    Object.keys(vars || {}).forEach((key) => {
      out = out.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), String(vars[key] ?? ''));
    });
    return out;
  }

  interpolateTemplate(template, context) {
    return this.interpolateCompose(template, context);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { FlowExecutor };
