/**
 * Modèle pour développeur de connecteur tiers.
 * Copier ce dossier vers connectors/<votre-id>/ et adapter.
 * Fichier : connectors/_template/index.js
 */

const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');

class TemplateConnector extends BaseConnector {
  async testConnection(ctx) {
    return { success: true, message: 'Remplacez testConnection()' };
  }

  async ingestPush(ctx, req) {
    return [this.normalize(req.body, ctx.instance.mapping, {
      source: this.id,
      entrepriseId: ctx.entrepriseId,
      instanceId: ctx.instance._id
    })];
  }

  async ingestPoll(ctx, cursor) {
    return { messages: [], cursor };
  }

  async emit(ctx, operation, payload) {
    return { success: false, message: 'Implémentez emit()' };
  }
}

module.exports = TemplateConnector;
