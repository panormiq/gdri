/**
 * Projets Doc-Hub
 */

const { ObjectId } = require('mongodb');

function toObjectId(id) {
  if (!ObjectId.isValid(id)) throw new Error('ID invalide');
  return new ObjectId(id);
}

async function list(entrepriseDb, { limit = 50, skip = 0, search = '', status = null } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: re }, { reference: re }];
  }

  const col = entrepriseDb.collection('doc_hub_projects');
  const [items, total] = await Promise.all([
    col.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter)
  ]);

  return { items, total };
}

async function getById(entrepriseDb, id) {
  return entrepriseDb.collection('doc_hub_projects').findOne({ _id: toObjectId(id) });
}

async function create(entrepriseDb, payload, userId) {
  const now = new Date();
  const doc = {
    title: String(payload.title).trim(),
    reference: payload.reference ? String(payload.reference).trim() : null,
    status: 'draft',
    metadataCollectionId: payload.metadataCollectionId || null,
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    closedAt: null
  };

  const result = await entrepriseDb.collection('doc_hub_projects').insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function update(entrepriseDb, id, payload) {
  const updates = { updatedAt: new Date() };
  if (payload.title !== undefined) updates.title = String(payload.title).trim();
  if (payload.reference !== undefined) updates.reference = payload.reference ? String(payload.reference).trim() : null;
  if (payload.metadata !== undefined) updates.metadata = payload.metadata;
  if (payload.metadataCollectionId !== undefined) updates.metadataCollectionId = payload.metadataCollectionId;

  if (payload.status === 'closed') {
    updates.status = 'closed';
    updates.closedAt = new Date();
  } else if (payload.status === 'active' || payload.status === 'draft') {
    updates.status = payload.status;
    if (payload.status !== 'closed') updates.closedAt = null;
  }

  const result = await entrepriseDb.collection('doc_hub_projects').updateOne(
    { _id: toObjectId(id) },
    { $set: updates }
  );

  if (result.matchedCount === 0) return null;
  return getById(entrepriseDb, id);
}

async function remove(entrepriseDb, id) {
  const projectId = toObjectId(id);
  const db = entrepriseDb;

  await db.collection('doc_hub_documents').deleteMany({ projectId });
  await db.collection('doc_hub_diffusions').deleteMany({ projectId: id });

  const result = await db.collection('doc_hub_projects').deleteOne({ _id: projectId });
  return result.deletedCount > 0;
}

module.exports = { list, getById, create, update, remove, toObjectId };
