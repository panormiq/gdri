/**
 * FICHIER : backend/core/connectors/syncFacebookAgentSettings.js
 * RÔLE : Appliquer la config du bloc Facebook (flow) sur les connector_instances poll.
 */

const { ObjectId } = require('mongodb');
const {
  resolveLookbackHours,
  resolveWebhookEvents,
  resolvePollConfig,
  normalizeIdList
} = require('./facebook-graph-helper');

function toObjectId(id) {
  try {
    if (id instanceof ObjectId) return id;
    const s = String(id || '').trim();
    if (s && ObjectId.isValid(s)) return new ObjectId(s);
  } catch (e) { /* ignore */ }
  return null;
}

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
  const ingestModes = ['push', 'poll'];

  const pageId = String(facebookConfig.pageId || '').trim();
  const pageName = String(facebookConfig.pageName || '').trim();
  const instanceOid = toObjectId(facebookConfig.instanceId);
  const filter = {
    entrepriseId: eid,
    connectorId: 'facebook'
  };
  if (instanceOid) {
    filter._id = instanceOid;
  } else if (pageId) {
    filter['settings.pageId'] = pageId;
  }

  const col = database.getCollection('connector_instances');
  let instances = await col.find(filter).toArray();

  // Une seule instance Facebook orpheline : rattacher la page. Jamais si plusieurs comptes.
  if (!instances.length && pageId && !instanceOid) {
    const allFb = await col.find({ entrepriseId: eid, connectorId: 'facebook' }).toArray();
    if (allFb.length === 1) {
      await col.updateOne(
        { _id: allFb[0]._id },
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
      'settings.pollByDate': facebookConfig.pollByDate !== false,
      'settings.pollByCount': facebookConfig.pollByCount !== false,
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

function applyDataKindsToFacebookConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const kinds = Array.isArray(config.kinds) ? config.kinds.map(String) : [];
  if (!kinds.length) return config;
  return {
    ...config,
    resources: kinds.filter((k) => k === 'posts' || k === 'comments' || k === 'messages'),
    webhookEvents: kinds.filter((k) => k === 'posts' || k === 'comments' || k === 'messages' || k === 'notifications')
  };
}

function isFacebookDataNode(node) {
  if (!node) return false;
  if (node.brickId === 'facebook') return true;
  if (node.brickId !== 'data') return false;
  if (String((node.config && node.config.provider) || '') === 'facebook') return true;
  const kinds = Array.isArray(node.config && node.config.kinds) ? node.config.kinds : [];
  return kinds.some((k) => k === 'posts' || k === 'comments' || k === 'messages' || k === 'notifications');
}

/**
 * Toutes les configs Facebook d’un flow (un objet par bloc Données).
 * @param {Object} flow
 * @returns {Object[]}
 */
function extractFacebookConfigsFromFlow(flow) {
  if (!flow) return [];
  const nodes = flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  const fromCanvas = nodes.filter(isFacebookDataNode).map((n) => applyDataKindsToFacebookConfig({
    ...(n.config || {}),
    nodeId: n.id
  }));
  if (fromCanvas.length) return fromCanvas;

  const fromTriggers = [];
  if (Array.isArray(flow.triggers)) {
    flow.triggers.forEach((t) => {
      if (t && t.brickId === 'facebook' && t.config) fromTriggers.push({ ...t.config });
    });
  }
  if (!fromTriggers.length && flow.trigger && flow.trigger.brickId === 'facebook') {
    fromTriggers.push(flow.trigger.config || {});
  }
  return fromTriggers;
}

function facebookConfigMatchesAccount(cfg, match = {}) {
  if (!cfg || typeof cfg !== 'object') return false;
  const instanceId = String(match.instanceId || '').trim();
  const pageId = String(match.pageId || '').trim();
  const cfgInst = String(cfg.instanceId || '').trim();
  const cfgPage = String(cfg.pageId || '').trim();
  if (cfgInst && instanceId && cfgInst === instanceId) return true;
  if (cfgPage && pageId && cfgPage === pageId) return true;
  return false;
}

/**
 * Config Facebook du flow pour un compte (instance / page), sinon la 1ère.
 * @param {Object} flow
 * @param {{ instanceId?: string, pageId?: string }} [match]
 * @returns {Object|null}
 */
function extractFacebookConfigFromFlow(flow, match = {}) {
  const all = extractFacebookConfigsFromFlow(flow);
  if (!all.length) return null;
  const instanceId = String((match && match.instanceId) || '').trim();
  const pageId = String((match && match.pageId) || '').trim();
  if (instanceId || pageId) {
    const hit = all.find((cfg) => facebookConfigMatchesAccount(cfg, match));
    if (hit) return hit;
    return null;
  }
  return all[0];
}

module.exports = {
  syncFacebookAgentSettings,
  extractFacebookConfigFromFlow,
  extractFacebookConfigsFromFlow,
  facebookConfigMatchesAccount
};
