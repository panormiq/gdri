/**
 * Connecteur Facebook — adaptateur (stub v1, à brancher sur le module existant).
 * Fichier : connectors/facebook/index.js
 */

const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');

class FacebookConnector extends BaseConnector {
  async testConnection(ctx) {
    const pageId = ctx.instance.settings?.pageId;
    if (!pageId) {
      return { success: false, message: 'pageId requis dans settings' };
    }
    return {
      success: true,
      message: `Connecteur Facebook configuré pour la page ${pageId} (runtime legacy actif via module facebook)`
    };
  }

  async ingestPush(ctx, req) {
    // Le webhook Facebook reste sur /api/facebook/webhook pour l'instant.
    // Ce connecteur formalise le contrat ; le branchement complet viendra en phase 2.
    const entry = req.body?.entry;
    if (!Array.isArray(entry)) return [];

    const messages = [];
    for (const item of entry) {
      const pageId = item.id != null ? String(item.id) : ctx.instance.settings?.pageId;
      if (item.messaging) {
        for (const evt of item.messaging) {
          const text = evt.message?.text || evt.postback?.title || '';
          if (!text) continue;
          messages.push(this.normalize(evt, ctx.instance.mapping, {
            source: 'facebook',
            sourceRef: evt.message?.mid || null,
            text,
            author: {
              id: evt.sender?.id || null,
              name: null
            },
            metadata: { pageId, type: 'messaging' }
          }));
        }
      }
    }
    return messages;
  }

  async ingestPoll(ctx, cursor) {
    return {
      messages: [],
      cursor,
      message: 'Poll Facebook : utiliser PollingService du module facebook (phase 2)'
    };
  }

  async emit(ctx, operation, payload = {}) {
    if (operation === 'reply' || operation === 'emit.reply') {
      return {
        success: false,
        message: 'Réponse Facebook : utiliser /api/facebook/email-actions (phase 2)'
      };
    }
    return super.emit(ctx, operation, payload);
  }
}

module.exports = FacebookConnector;
