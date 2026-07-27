/**
 * Connecteur Facebook sortant — publication + réponse commentaire / post / MP.
 * Fichier : connectors/facebook-out/index.js
 */

const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');
const {
  resolveFacebookPageConfig,
  sendFacebookReply,
  publishFacebookPost
} = require('../../backend/core/connectors/facebook-graph-helper');

class FacebookOutConnector extends BaseConnector {
  async testConnection(ctx) {
    const pageId = ctx.instance.settings?.pageId || null;
    try {
      const config = await resolveFacebookPageConfig(ctx.database, ctx.entrepriseId, pageId);
      return {
        success: true,
        message: `Page OK pour publication / réponse : ${config.pageName || config.pageId}`
      };
    } catch (e) {
      return { success: false, message: e.message || 'Test Facebook out échoué' };
    }
  }

  async emit(ctx, operation, payload = {}) {
    const settings = ctx.instance.settings || {};
    const op = String(operation || '').toLowerCase();
    const action =
      String(payload.action || settings.action || '').toLowerCase() ||
      (op.includes('publish') ? 'publish' : 'reply');

    try {
      if (action === 'publish' || op === 'publish' || op === 'emit.publish') {
        return await publishFacebookPost(ctx.database, ctx.entrepriseId, {
          pageId: payload.pageId || settings.pageId || null,
          message: payload.message || payload.body || payload.text || '',
          link: payload.link || payload.linkUrl || null,
          imageUrl: payload.imageUrl || payload.image_url || null,
          published: payload.published !== undefined ? payload.published : true,
          graphVersion: settings.graphVersion || payload.graphVersion
        });
      }

      if (op === 'reply' || op === 'emit.reply' || action === 'reply') {
        return await sendFacebookReply(ctx.database, ctx.entrepriseId, {
          pageId: payload.pageId || settings.pageId || null,
          replyMode: payload.replyMode || settings.replyMode || 'auto',
          message: payload.message || payload.body || payload.text || '',
          commentId: payload.commentId || null,
          postId: payload.postId || null,
          recipientId: payload.recipientId || payload.psid || null,
          graphVersion: settings.graphVersion || payload.graphVersion
        });
      }

      return { success: false, message: `Opération ${operation} non supportée` };
    } catch (e) {
      return { success: false, message: e.message || 'Échec Facebook sortant' };
    }
  }
}

module.exports = FacebookOutConnector;
