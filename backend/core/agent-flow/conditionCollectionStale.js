/**
 * Condition « cas » liée à une collection : snapshot figé + dérive (version / révision).
 * Les cas ne viennent jamais des items du run : uniquement des lignes persistées.
 * Fichier : backend/core/agent-flow/conditionCollectionStale.js
 */

const { ObjectId } = require('mongodb');

function isCaseConditionConfig(config) {
  const m = String((config && config.mode) || 'if').toLowerCase();
  return m === 'case' || m === 'switch' || m === 'cas';
}

function collectionIdFromConditionNode(node) {
  const c = node && node.config;
  if (!c || !isCaseConditionConfig(c)) return '';
  if (String(c.caseSource || '') !== 'collection') return '';
  return String(c.caseCollectionId || c.collectionId || '').trim();
}

function revisionOf(col) {
  if (!col || col.dataRevision == null || col.dataRevision === '') return null;
  const n = Number(col.dataRevision);
  return Number.isFinite(n) ? n : null;
}

function versionOf(col) {
  return String((col && col.version) || '').trim();
}

function snapshotMs(config) {
  const snap = config && config.casesSnapshotAt ? Date.parse(config.casesSnapshotAt) : 0;
  return Number.isFinite(snap) ? snap : 0;
}

function updatedMs(col) {
  if (!col || !col.updatedAt) return 0;
  const t = Date.parse(col.updatedAt);
  return Number.isFinite(t) ? t : 0;
}

/**
 * True si le snapshot du bloc n’est plus aligné sur la collection.
 * Priorité : dataRevision (lignes) puis version de schéma, sinon updatedAt.
 */
function nodeConditionCollectionStale(node, collectionsById) {
  if (!node || (node.brickId !== 'condition' && node.brickId !== 'logic-if')) return false;
  const c = node.config;
  if (!c || !isCaseConditionConfig(c) || String(c.caseSource || '') !== 'collection') return false;
  const id = collectionIdFromConditionNode(node);
  if (!id) return true;
  const col = collectionsById && (collectionsById[id] || collectionsById[String(id)]);
  if (!col) return true;

  const storedRev = c.casesCollectionRevision;
  const colRev = revisionOf(col);
  if (storedRev != null && storedRev !== '' && colRev != null) {
    if (Number(storedRev) !== colRev) return true;
  } else {
    const snap = snapshotMs(c);
    if (!snap) return true;
    if (updatedMs(col) > snap + 1000) return true;
  }

  const storedVer = String(c.casesCollectionVersion || '').trim();
  const colVer = versionOf(col);
  if (storedVer && colVer && storedVer !== colVer) return true;
  return false;
}

function flowConditionCollectionStale(flow, collectionsById) {
  const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  return nodes.some((n) => nodeConditionCollectionStale(n, collectionsById));
}

function collectConditionCollectionIds(flows) {
  const ids = [];
  const seen = {};
  (Array.isArray(flows) ? flows : []).forEach((flow) => {
    const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
    nodes.forEach((n) => {
      const id = collectionIdFromConditionNode(n);
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    });
  });
  return ids;
}

function asObjectId(value) {
  const s = String(value || '').trim();
  if (s && ObjectId.isValid(s) && s.length === 24) return new ObjectId(s);
  return null;
}

async function loadCollectionsForConditionStale(db, ids) {
  const list = Array.isArray(ids) ? ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
  if (!db || !list.length) return {};
  const oids = [];
  const slugs = [];
  list.forEach((id) => {
    const oid = asObjectId(id);
    if (oid) oids.push(oid);
    else slugs.push(id);
  });
  const or = [];
  if (oids.length) or.push({ _id: { $in: oids } });
  if (slugs.length) or.push({ slug: { $in: slugs } });
  if (!or.length) return {};
  const cols = await db.collection('collections')
    .find(or.length === 1 ? or[0] : { $or: or }, {
      projection: { updatedAt: 1, version: 1, dataRevision: 1, slug: 1, name: 1 }
    })
    .toArray();
  const map = {};
  cols.forEach((col) => {
    map[String(col._id)] = col;
    if (col.slug) map[String(col.slug)] = col;
  });
  return map;
}

module.exports = {
  collectionIdFromConditionNode,
  nodeConditionCollectionStale,
  flowConditionCollectionStale,
  collectConditionCollectionIds,
  loadCollectionsForConditionStale
};
