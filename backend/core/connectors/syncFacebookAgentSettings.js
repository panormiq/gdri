/**
 * FICHIER : backend/core/connectors/syncFacebookAgentSettings.js
 * RÔLE : Appliquer la config du bloc Facebook (flow) sur les connector_instances poll.
 */

const {
  resolveLookbackHours,
  resolveWebhookEvents,
  resolvePollConfig,
  normalizeIdList
} = require('./facebook-graph-helper');

/**
 * @param {Object} database
 * @param {string} entrepriseId
 * @param {Object} facebookConfig config du nœud / trigger facebook
 * @returns {Promise<{ matched: number, modified: number }>}
 */
async function syncFacebookAgentSettings(database, entrepriseId, facebookConfig = {}) {
  const eid = String(entrepriseId || '').trim();
  if (!eid || !facebookConfig || typeof facebookConfig !== 'object') {
    return { matched: 0, modified: 0 };
  }

  const poll = resolvePollConfig(facebookConfig);
  const lookbackHours = poll.lookbackHours;
  const webhookEvents = resolveWebhookEvents(facebookConfig);
  const ingestModes = Array.isArray(facebookConfig.ingestModes) && facebookConfig.ingestModes.length
    ? facebookConfig.ingestModes.map(String).filter((m) => m === 'push' || m === 'poll')
    : ['poll'];

  const pageId = String(facebookConfig.pageId || '').trim();
  const pageName = String(facebookConfig.pageName || '').trim();
  const filter = {
    entrepriseId: eid,
    connectorId: 'facebook'
  };
  if (pageId) {
    filter['settings.pageId'] = pageId;
  }

  const col = database.getCollection('connector_instances');
  let instances = await col.find(filter).toArray();

  // Si une page est choisie mais aucune instance n'existe encore : créer / rattacher
  if (!instances.length && pageId) {
    const anyFb = await col.findOne({ entrepriseId: eid, connectorId: 'facebook' });
    if (anyFb) {
      await col.updateOne(
        { _id: anyFb._id },
        {
          $set: {
            'settings.pageId': pageId,
            ...(pageName ? { 'settings.pageName': pageName, name: pageName } : {}),
            updated_at: new Date()
          }
        }
      );
      instances = await col.find(filter).toArray();
    }
  }

  if (!instances.length) {
    return { matched: 0, modified: 0 };
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const windowStartUnix = Math.max(0, nowUnix - lookbackHours * 3600);
  let modified = 0;

  for (const inst of instances) {
    const prevLookback = resolveLookbackHours(inst.settings || {});
    const $set = {
      ingestModes,
      'settings.limit': poll.postLimit,
      'settings.postLimit': poll.postLimit,
      'settings.lookbackHours': lookbackHours,
      'settings.pollIntervalMinutes': poll.pollIntervalMinutes,
      'settings.commentCatchupLimit': poll.commentPostsToScan,
      'settings.commentPostsToScan': poll.commentPostsToScan,
      'settings.commentsPerPost': poll.commentsPerPost,
      'settings.commentsFetchAll': poll.commentsFetchAll,
      'settings.commentPostIds': normalizeIdList(facebookConfig.commentPostIds),
      'settings.messageConversationsLimit': poll.messageConversationsLimit,
      'settings.messagesPerConversation': poll.messagesPerConversation,
      'settings.resources': poll.resources,
      'settings.webhookEvents': webhookEvents,
      updated_at: new Date()
    };
    if (pageId) {
      $set['settings.pageId'] = pageId;
      if (pageName) {
        $set['settings.pageName'] = pageName;
        $set.name = pageName;
      }
    }
    if (prevLookback !== lookbackHours) {
      $set['cursor.sinceUnix'] = windowStartUnix;
      $set['cursor.commentsSinceUnix'] = windowStartUnix;
      $set['cursor.messagesSinceUnix'] = windowStartUnix;
    }

    const result = await col.updateOne({ _id: inst._id }, { $set });
    if (result.modifiedCount) modified += 1;
  }

  return { matched: instances.length, modified };
}

/**
 * Extrait la 1ère config facebook d'un flow (canvas / triggers).
 * @param {Object} flow
 * @returns {Object|null}
 */
function extractFacebookConfigFromFlow(flow) {
  if (!flow) return null;
  const nodes = flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  const node = nodes.find((n) => n && n.brickId === 'facebook');
  if (node && node.config) return node.config;

  if (Array.isArray(flow.triggers)) {
    const t = flow.triggers.find((x) => x && x.brickId === 'facebook');
    if (t && t.config) return t.config;
  }
  if (flow.trigger && flow.trigger.brickId === 'facebook') {
    return flow.trigger.config || {};
  }
  return null;
}

module.exports = {
  syncFacebookAgentSettings,
  extractFacebookConfigFromFlow
};
