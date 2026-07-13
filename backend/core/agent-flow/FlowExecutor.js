/**
 * Exécution séquentielle des steps d'un flow agent.
 * Fichier : backend/core/agent-flow/FlowExecutor.js
 */

const fs = require('fs');
const path = require('path');
const flowBrickRegistry = require('./FlowBrickRegistry');

class FlowExecutor {
  constructor(database) {
    this.database = database;
  }

  /**
   * @param {Object} flow
   * @param {{ triggerMode?: string, triggeredBy?: string }} options
   */
  async execute(flow, options = {}) {
    const triggerMode = options.triggerMode || 'manual';
    const { AgentFlowService } = require('./AgentFlowService');
    const flowService = new AgentFlowService(this.database);

    const run = await flowService.createRun(flow, triggerMode, {
      triggeredBy: options.triggeredBy || null
    });

    const context = {
      entrepriseId: flow.entrepriseId,
      flowId: String(flow._id),
      trigger: {
        mode: triggerMode,
        brickId: flow.trigger && flow.trigger.brickId,
        config: (flow.trigger && flow.trigger.config) || {},
        triggeredAt: new Date().toISOString(),
        triggeredBy: options.triggeredBy || null
      },
      previous: null
    };

    const stepResults = [];
    const steps = Array.isArray(flow.steps) ? flow.steps : [];

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepId = step.id || `step-${i + 1}`;
        const brick = flowBrickRegistry.get(step.brickId);
        if (!brick) {
          throw new Error(`Brique inconnue : ${step.brickId}`);
        }

        const startedAt = new Date();
        const output = await this.executeStep(step, context, flow);
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

  async executeStep(step, context, flow) {
    const operation = step.operation;
    const config = { ...(step.config || {}) };
    const entrepriseId = flow.entrepriseId;

    if (step.brickId === 'data-backup' && operation === 'backup.run') {
      return this.runDataBackup(entrepriseId, config, context);
    }

    if (step.brickId === 'mail-out' && (operation === 'emit.mail' || operation === 'mail')) {
      return this.runMailOut(entrepriseId, config, context);
    }

    if (step.brickId === 'http-generic' && (operation === 'emit.http' || operation === 'http')) {
      return this.runHttpEmit(entrepriseId, config, context);
    }

    if (step.brickId === 'cron-trigger' || step.brickId === 'manual-trigger') {
      return { ok: true, trigger: context.trigger };
    }

    throw new Error(`Opération non supportée : ${step.brickId}.${operation}`);
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

  async runMailOut(entrepriseId, config, context) {
    const accountRef = String(config.accountRef || '').trim();
    const to = String(config.to || '').trim();
    if (!accountRef || !to) {
      throw new Error('Compte mail (accountRef) et destinataire (to) requis');
    }

    const subject = this.interpolateTemplate(
      config.subject || 'Sauvegarde GDRI {{date}}',
      context
    );
    const body = this.interpolateTemplate(
      config.body || 'Sauvegarde automatique GDRI.',
      context
    );

    const attachments = [];
    const attachPrevious = config.attachPrevious !== false;
    const prev = context.previous;
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

  interpolateTemplate(template, context) {
    const date = new Date().toLocaleString('fr-FR');
    const prev = context.previous || {};
    return String(template)
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{fileName\}\}/g, prev.fileName || '')
      .replace(/\{\{sizeBytes\}\}/g, String(prev.sizeBytes || ''))
      .replace(/\{\{runId\}\}/g, prev.runId || '');
  }
}

module.exports = { FlowExecutor };
