/**
 * Appliquer la config du bloc Données mail (flow) sur l’instance mail-in.
 */

const { ObjectId } = require('mongodb');
const {
  resolveMailPollQuery,
  mailQueryFingerprint
} = require('./mail-query-helper');

function toObjectId(id) {
  try {
    if (id instanceof ObjectId) return id;
    const s = String(id || '').trim();
    if (s && ObjectId.isValid(s)) return new ObjectId(s);
  } catch (e) { /* ignore */ }
  return null;
}

function isMailDataNode(node) {
  if (!node || node.brickId !== 'data') return false;
  return String((node.config && node.config.provider) || '').toLowerCase() === 'mail';
}

function extractMailConfigsFromFlow(flow) {
  if (!flow) return [];
  const nodes = flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  return nodes.filter(isMailDataNode).map((n) => ({
    ...(n.config || {}),
    nodeId: n.id
  }));
}

function mailConfigMatchesAccount(cfg, match = {}) {
  if (!cfg || typeof cfg !== 'object') return false;
  const instanceId = String(match.instanceId || '').trim();
  const accountRef = String(match.accountRef || '').trim();
  const cfgInst = String(cfg.instanceId || '').trim();
  const cfgRef = String(cfg.accountRef || '').trim();
  if (cfgInst && instanceId && cfgInst === instanceId) return true;
  if (cfgRef && accountRef && cfgRef === accountRef) return true;
  return false;
}

async function syncMailAgentSettings(database, entrepriseId, mailConfig = {}) {
  const eid = String(entrepriseId || '').trim();
  if (!eid || !mailConfig || typeof mailConfig !== 'object') {
    return { matched: 0, modified: 0 };
  }

  const query = resolveMailPollQuery(mailConfig);
  const instanceOid = toObjectId(mailConfig.instanceId);
  const accountRef = String(mailConfig.accountRef || '').trim();
  if (!instanceOid && !accountRef) {
    return { matched: 0, modified: 0 };
  }
  const filter = {
    entrepriseId: eid,
    connectorId: 'mail-in'
  };
  if (instanceOid) {
    filter._id = instanceOid;
  } else if (accountRef) {
    filter['settings.accountRef'] = accountRef;
  }

  const col = database.getCollection('connector_instances');
  const instances = await col.find(filter).toArray();
  if (!instances.length) {
    return { matched: 0, modified: 0 };
  }

  const nextFp = mailQueryFingerprint(query);
  let modified = 0;

  for (const inst of instances) {
    const prevQuery = resolveMailPollQuery(inst.settings || {});
    const prevFp = mailQueryFingerprint(prevQuery);
    const $set = {
      'settings.unseenOnly': query.unseenOnly,
      'settings.fromContains': query.fromContains,
      'settings.subjectContains': query.subjectContains,
      'settings.lookbackHours': query.lookbackHours,
      'settings.pollByDate': query.pollByDate,
      'settings.pollByCount': query.pollByCount,
      'settings.pollLimit': query.pollLimit,
      updated_at: new Date()
    };
    if (query.mailbox) $set['settings.mailbox'] = query.mailbox;
    if (prevFp !== nextFp) {
      $set['cursor.lastUid'] = 0;
    }
    const result = await col.updateOne({ _id: inst._id }, { $set });
    if (result.modifiedCount) modified += 1;
  }

  return { matched: instances.length, modified };
}

module.exports = {
  syncMailAgentSettings,
  extractMailConfigsFromFlow,
  mailConfigMatchesAccount,
  isMailDataNode
};
