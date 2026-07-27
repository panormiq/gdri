/**
 * Exécution séquentielle des steps d'un flow agent.
 * Fichier : backend/core/agent-flow/FlowExecutor.js
 */

const fs = require('fs');
const path = require('path');
const flowBrickRegistry = require('./FlowBrickRegistry');
const { AgentBrickConfigService } = require('./AgentBrickConfigService');
const {
  detectChannel,
  resolveIntentionList,
  resolvePrompt,
  resolveMessages
} = require('./resolveIntentionInputs');

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
    const { AgentFlowService } = require('./AgentFlowService');
    const flowService = new AgentFlowService(this.database);

    const run = await flowService.createRun(flow, triggerMode, {
      triggeredBy: options.triggeredBy || null
    });

    const triggerPayload = options.triggerPayload || {};
    const context = this.buildContext(flow, triggerMode, options.triggeredBy, triggerPayload);

    return this.runSteps(flow, run, context, flowService, 0, []);
  }

  /**
   * Reprend un run en waiting_human après validation / rejet.
   */
  async resume(runId, { decision, editedHtml, editedText, resumeToken, resumedBy = null } = {}) {
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
    const msgAttachments =
      (context.message && Array.isArray(context.message.attachments) && context.message.attachments) ||
      (context.previous && Array.isArray(context.previous.attachments) && context.previous.attachments) ||
      [];
    const humanResult = {
      type: 'human-review-result',
      decision: dec,
      editedHtml: editedHtml != null ? String(editedHtml) : null,
      editedText: editedText != null ? String(editedText) : null,
      resumedAt: new Date().toISOString(),
      resumedBy,
      attachments: msgAttachments,
      sourceRef:
        (context.message && context.message.sourceRef) ||
        (context.previous && context.previous.sourceRef) ||
        null,
      message: context.message || null
    };
    context.previous = humanResult;

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

    if (run.pendingNodeId || this.getCanvasNodes(flow).length) {
      const nextId = run.pendingNodeId || null;
      // Nettoyer pending avant reprise graphe
      await flowService.runsCol().updateOne(
        { _id: run._id },
        { $set: { pendingNodeId: null } }
      );
      return this.runGraph(flow, run, context, flowService, stepResults, nextId);
    }

    const startIndex = Number.isFinite(pendingIdx) ? pendingIdx + 1 : 0;
    return this.runLinearSteps(flow, run, context, flowService, startIndex, stepResults);
  }

  buildContext(flow, triggerMode, triggeredBy, triggerPayload) {
    const payload = triggerPayload || {};
    const message = (payload && payload.message) || payload || null;
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
        config: (flow.trigger && flow.trigger.config) || {},
        triggeredAt: new Date().toISOString(),
        triggeredBy: triggeredBy || null,
        payload
      },
      message,
      messages: Array.isArray(payload.messages) ? payload.messages : null,
      previous: null
    };
    if (context.message && typeof context.message === 'object') {
      context.previous = {
        type: 'trigger-message',
        ...context.message
      };
    }
    return context;
  }

  channelFromTrigger(triggerMode, brickId) {
    const m = String(triggerMode || '').toLowerCase();
    const b = String(brickId || '').toLowerCase();
    if (m.includes('facebook') || b === 'facebook') return 'facebook';
    if (m.includes('mail') || b === 'mail-in') return 'mail';
    if (b === 'contact' || m.includes('contact')) return 'contact';
    return m || b || 'manual';
  }

  getCanvasNodes(flow) {
    return flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  }

  resolveGraphStartNodeId(flow, context, preferredNodeId = null) {
    const nodes = this.getCanvasNodes(flow);
    if (!nodes.length) return null;
    if (preferredNodeId) return preferredNodeId;

    const channel = detectChannel(context);
    const triggers = nodes.filter((n) => n.kind === 'trigger');
    let match = triggers.find((t) => {
      const id = String(t.brickId || '').toLowerCase();
      if (channel === 'facebook') return id === 'facebook';
      if (channel === 'mail') return id === 'mail-in';
      if (channel === 'contact') return id === 'contact' || id === 'manual-trigger';
      return false;
    });
    if (!match && context.trigger && context.trigger.brickId) {
      match = triggers.find((t) => t.brickId === context.trigger.brickId);
    }
    if (!match) match = triggers[0] || null;
    return match ? match.nextId || match.id : nodes[0].id;
  }

  async runSteps(flow, run, context, flowService, startIndex, stepResults) {
    const canvasNodes = this.getCanvasNodes(flow);
    if (canvasNodes.length) {
      const startId =
        run.pendingNodeId ||
        this.resolveGraphStartNodeId(flow, context);
      return this.runGraph(flow, run, context, flowService, stepResults, startId);
    }
    return this.runLinearSteps(flow, run, context, flowService, startIndex, stepResults);
  }

  async runGraph(flow, run, context, flowService, stepResults, startNodeId) {
    const nodes = this.getCanvasNodes(flow);
    const byId = {};
    nodes.forEach((n) => {
      byId[n.id] = n;
    });

    let nodeId = startNodeId;
    let guard = 0;

    try {
      while (nodeId && guard < 200) {
        guard++;
        const node = byId[nodeId];
        if (!node) break;

        if (node.kind === 'trigger') {
          nodeId = node.nextId || null;
          continue;
        }

        const step = {
          id: node.id,
          brickId: node.brickId,
          operation: node.operation || null,
          config: { ...(node.config || {}) }
        };
        const brick = flowBrickRegistry.get(step.brickId);
        if (!brick) {
          throw new Error(`Brique inconnue : ${step.brickId}`);
        }

        const startedAt = new Date();
        const output = await this.executeStep(step, context, flow, {
          runId: run._id,
          canvasNode: node
        });

        if (output && output.__waitingHuman) {
          stepResults.push({
            stepId: node.id,
            brickId: step.brickId,
            operation: step.operation,
            status: 'waiting_human',
            startedAt,
            completedAt: null,
            output
          });
          const paused = await flowService.pauseRun(run._id, {
            steps: stepResults,
            pendingStepIndex: stepResults.length - 1,
            pendingStepId: node.id,
            pendingNodeId: node.nextId || null,
            pausedContext: context,
            reviewUrl: output.reviewUrl || null,
            output
          });
          await flowService.markTriggered(flow._id);
          return paused;
        }

        context.previous = output;
        stepResults.push({
          stepId: node.id,
          brickId: step.brickId,
          operation: step.operation,
          status: 'completed',
          startedAt,
          completedAt: new Date(),
          output
        });

        if (output && output.__nextNodeId !== undefined) {
          nodeId = output.__nextNodeId || null;
        } else {
          nodeId = node.nextId || null;
        }
      }

      await flowService.finishRun(run._id, { status: 'completed', steps: stepResults });
      await flowService.markTriggered(flow._id);
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
        const output = await this.executeStep(step, context, flow, { runId: run._id });

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
          await flowService.markTriggered(flow._id);
          return paused;
        }

        context.previous = output;
        stepResults.push({
          stepId,
          brickId: step.brickId,
          operation: step.operation,
          status: 'completed',
          startedAt,
          completedAt: new Date(),
          output
        });

        if (output && output.__skipRemaining) break;
      }

      await flowService.finishRun(run._id, { status: 'completed', steps: stepResults });
      await flowService.markTriggered(flow._id);
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

  async executeStep(step, context, flow, extras = {}) {
    const operation = step.operation;
    const config = { ...(step.config || {}) };
    const entrepriseId = flow.entrepriseId;

    if (step.brickId === 'data-backup' && operation === 'backup.run') {
      return this.runDataBackup(entrepriseId, config, context);
    }

    if (step.brickId === 'mail-out' && (operation === 'emit.mail' || operation === 'mail')) {
      return this.runMailOut(entrepriseId, config, context);
    }

    if (
      step.brickId === 'facebook-out' &&
      (operation === 'emit.reply' ||
        operation === 'reply' ||
        operation === 'emit.publish' ||
        operation === 'publish')
    ) {
      return this.runFacebookOut(entrepriseId, config, context, operation);
    }

    if (step.brickId === 'http-generic' && (operation === 'emit.http' || operation === 'http')) {
      return this.runHttpEmit(entrepriseId, config, context);
    }

    if (step.brickId === 'analyse-intention' && (operation === 'analyse.run' || operation === 'analyse')) {
      return this.runAnalyseIntention(flow, config, context);
    }

    if (step.brickId === 'route-intention' && (operation === 'route.resolve' || operation === 'route')) {
      return this.runRouteIntention(flow, config, context);
    }

    if (step.brickId === 'logic-if' && (operation === 'logic.if' || operation === 'if' || !operation)) {
      return this.runLogicIf(config, context, extras.canvasNode || null);
    }

    if (
      step.brickId === 'human-doc-review' &&
      (operation === 'review.pause' || operation === 'review' || !operation)
    ) {
      return this.runHumanDocReview(flow, config, context, extras);
    }

    if (
      step.brickId === 'mail-delete' &&
      (operation === 'mail.delete' || operation === 'emit.delete' || operation === 'delete' || !operation)
    ) {
      return this.runMailDelete(entrepriseId, config, context);
    }

    if (
      step.brickId === 'mail-save-attachments' &&
      (operation === 'mail.saveAttachments' ||
        operation === 'saveAttachments' ||
        operation === 'save' ||
        !operation)
    ) {
      return this.runMailSaveAttachments(entrepriseId, config, context);
    }

    if (
      step.brickId === 'cron-trigger' ||
      step.brickId === 'manual-trigger' ||
      step.brickId === 'mail-in' ||
      step.brickId === 'facebook'
    ) {
      return { ok: true, trigger: context.trigger, message: context.message };
    }

    throw new Error(`Opération non supportée : ${step.brickId}.${operation}`);
  }

  readContextField(context, fieldPath) {
    const pathStr = String(fieldPath || '').trim();
    if (!pathStr) return undefined;
    const bags = [context.previous, context.message, context.options, context];
    for (const bag of bags) {
      if (!bag || typeof bag !== 'object') continue;
      if (Object.prototype.hasOwnProperty.call(bag, pathStr)) return bag[pathStr];
      const parts = pathStr.split('.');
      let cur = bag;
      let ok = true;
      for (const p of parts) {
        if (cur == null || typeof cur !== 'object' || !(p in cur)) {
          ok = false;
          break;
        }
        cur = cur[p];
      }
      if (ok) return cur;
    }
    return undefined;
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

  runLogicIf(config, context, canvasNode) {
    const field = String(config.field || 'intention_principale').trim();
    const op = config.op || 'eq';
    const value = config.value;
    const actual = this.readContextField(context, field);
    const pass = this.evaluateCondition(actual, op, value);

    let nextTrue = (canvasNode && canvasNode.nextId) || config.nextTrueId || null;
    let nextFalse = (canvasNode && canvasNode.nextFalseId) || config.nextFalseId || null;

    return {
      type: 'logic-if-result',
      condition: pass,
      field,
      op,
      value,
      actual: actual == null ? null : actual,
      __nextNodeId: pass ? nextTrue : nextFalse
    };
  }

  /**
   * Pause HITL — page de revue documentaire.
   */
  async runHumanDocReview(flow, config, context, extras = {}) {
    const title = String(config.title || 'Revue documentaire').trim();
    const instructions = String(
      config.instructions ||
        'Vérifiez le contenu, modifiez si besoin, puis validez ou rejetez.'
    ).trim();
    const templateNamespace = String(config.templateNamespace || '').trim();

    const msg = context.message || {};
    const src = context.previous || msg || {};
    const subject = msg.subject || (msg.metadata && msg.metadata.subject) || src.subject || '';
    const from =
      msg.from ||
      (msg.author && (msg.author.email || msg.author.name)) ||
      src.from ||
      '';
    const text =
      src.text ||
      src.body ||
      src.message ||
      msg.text ||
      subject ||
      '';
    const attachments = this.collectContextAttachments(context);
    const sourceRef = msg.sourceRef || src.sourceRef || null;
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

    let htmlBody = src.editedHtml || src.html || null;
    if (!htmlBody && templateNamespace) {
      try {
        const reviewVars = {
          from: String(from || ''),
          subject: String(subject || ''),
          text: String(text || ''),
          sourceRef: String(sourceRef || ''),
          messageId: String(msg.messageId || src.messageId || ''),
          channel: String(context.channel || 'mail'),
          attachments_html: attachmentsHtml,
          attachmentCount: String(attachments.length)
        };
        reviewVars['author.email'] = String((msg.author && msg.author.email) || '');
        reviewVars['author.name'] = String((msg.author && msg.author.name) || '');
        reviewVars['metadata.accountRef'] = String((msg.metadata && msg.metadata.accountRef) || '');
        reviewVars['metadata.mailbox'] = String((msg.metadata && msg.metadata.mailbox) || '');
        htmlBody = await this.renderDocReviewTemplate(templateNamespace, reviewVars);
      } catch (err) {
        console.warn('human-doc-review template:', err.message);
      }
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
      sourceRef,
      reviewUrl,
      message: context.message || null,
      previous: context.previous || null
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

  collectContextAttachments(context) {
    const bags = [
      context.previous,
      context.message,
      context.previous && context.previous.message,
      context.trigger && context.trigger.payload && context.trigger.payload.message
    ];
    for (const bag of bags) {
      if (bag && Array.isArray(bag.attachments) && bag.attachments.length) {
        return bag.attachments.map((a) => ({
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
    const uid =
      (context.message && context.message.sourceRef) ||
      (context.previous && context.previous.sourceRef) ||
      'mail';
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
    const prev = context.previous || {};
    if (onlyOnApprove && prev.type === 'human-review-result' && prev.decision !== 'approve') {
      return {
        type: 'mail-delete-result',
        success: false,
        skipped: true,
        reason: `decision=${prev.decision || 'unknown'}`
      };
    }

    const msg = context.message || prev.message || {};
    const uid =
      msg.sourceRef ||
      prev.sourceRef ||
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

  async runRouteIntention(flow, config, context) {
    const { normalizeRouteTarget } = require('./intentionPresets');
    const doc = await this.brickConfig.getConfig(flow._id, 'route-intention');
    const routeCfg = (doc && doc.config) || this.brickConfig.getDefaultRouteConfig();
    const prev = context.previous || {};
    const intention = String(prev.intention_principale || '').trim();

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
      subject: prev.subject || '',
      body: prev.text || '',
      from: prev.from || '',
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
    const prev = context.previous || {};
    const msg = context.message || {};
    const meta = (msg.raw && msg.raw.metadata) || msg.metadata || {};
    const useRoute = config.usePreviousRoute !== false && prev.type === 'route-result';

    const op = String(operation || '').toLowerCase();
    const action =
      String(config.action || '').toLowerCase() ||
      (op.includes('publish') ? 'publish' : 'reply');

    let text = String(config.message || '').trim();
    if (useRoute && (!text || text === '{{body}}') && prev.body) {
      text = String(prev.body);
    }
    text = this.interpolateTemplate(text || (action === 'publish' ? '' : '{{body}}'), context).trim();

    const pageId =
      String(config.pageId || '').trim() ||
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
      String(meta.comment_id || msg.commentId || '').trim() ||
      (msg.resourceType === 'comment' ? String(msg.messageId || msg.sourceRef || '') : '') ||
      '';

    const postId =
      String(config.postId || '').trim() ||
      String(meta.postId || meta.post_id || msg.postId || '').trim() ||
      (msg.resourceType === 'post' ? String(msg.messageId || msg.sourceRef || '') : '') ||
      '';

    const authorId =
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

  async runMailOut(entrepriseId, config, context) {
    const prev = context.previous || {};
    const useRoute = config.usePreviousRoute !== false && prev.type === 'route-result';

    if (useRoute && prev.targetType && prev.targetType !== 'emails' && prev.targetType !== 'annuaire-service') {
      throw new Error(
        `mail-out attend un routage mail (emails / annuaire-service), reçu : ${prev.targetType}`
      );
    }

    let accountRef = String(config.accountRef || '').trim();
    let to = String(config.to || '').trim();
    if (useRoute && !to && prev.to) to = String(prev.to).trim();

    if (!accountRef) {
      throw new Error('Compte mail (accountRef) requis — configurez un compte dans Connecteurs > Mail');
    }
    if (!to) {
      throw new Error('Destinataire (to) requis — définissez le routage ou un destinataire fixe');
    }

    const subject = this.interpolateTemplate(
      config.subject || (useRoute ? '{{subject}}' : 'Notification GDRI {{date}}'),
      context
    );
    const body = this.interpolateTemplate(
      config.body || (useRoute ? '{{body}}' : 'Notification automatique GDRI.'),
      context
    );

    const attachments = [];
    const attachPrevious = config.attachPrevious === true;
    if (attachPrevious && prev && prev.filePath && fs.existsSync(prev.filePath)) {
      attachments.push({
        filename: prev.fileName || path.basename(prev.filePath),
        path: prev.filePath
      });
    }

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
      body,
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
      attachmentCount: attachments.length
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

    if (config.includeMetadata !== false && context.previous) {
      body.previous = {
        type: context.previous.type,
        runId: context.previous.runId,
        fileName: context.previous.fileName,
        sizeBytes: context.previous.sizeBytes,
        documentCount: context.previous.documentCount,
        status: context.previous.status
      };
    }

    const prev = context.previous;
    if (config.includeFileBase64 && prev && prev.filePath && fs.existsSync(prev.filePath)) {
      const buf = await fs.promises.readFile(prev.filePath);
      body.fileBase64 = buf.toString('base64');
      body.fileName = prev.fileName || path.basename(prev.filePath);
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
    const date = new Date().toLocaleString('fr-FR');
    const prev = context.previous || {};
    const msg = context.message || {};
    return String(template)
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{fileName\}\}/g, prev.fileName || '')
      .replace(/\{\{sizeBytes\}\}/g, String(prev.sizeBytes || ''))
      .replace(/\{\{runId\}\}/g, prev.runId || '')
      .replace(/\{\{subject\}\}/g, prev.subject || msg.subject || '')
      .replace(/\{\{body\}\}/g, prev.body || prev.text || msg.text || '')
      .replace(/\{\{text\}\}/g, prev.text || msg.text || '')
      .replace(/\{\{intention\}\}/g, prev.intention || prev.intention_principale || '')
      .replace(/\{\{to\}\}/g, prev.to || '')
      .replace(/\{\{from\}\}/g, prev.from || msg.from || '');
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
