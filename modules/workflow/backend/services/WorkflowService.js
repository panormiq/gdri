/**
 * Service Workflow
 * Fichier : backend/modules/workflow/services/WorkflowService.js
 */

const { ObjectId } = require('mongodb');

function getCollection(db) {
  return db.collection('workflows');
}

function buildUserStamp(user) {
  return {
    userId: user?.user_id || null,
    email: user?.email || null,
    role: user?.role || null
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listWorkflows(db, { limit, skip, search }) {
  const collection = getCollection(db);
  const query = {};

  if (search) {
    query.name = new RegExp(escapeRegex(search), 'i');
  }

  const items = await collection.find(query)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await collection.countDocuments(query);

  return { items, total };
}

async function getWorkflowById(db, id) {
  const collection = getCollection(db);
  return collection.findOne({ _id: new ObjectId(id) });
}

async function createWorkflow(db, payload, user, entrepriseId) {
  const collection = getCollection(db);
  const now = new Date();
  const workflow = {
    name: payload.name,
    description: payload.description || '',
    status: payload.status || 'draft',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    payload: payload.payload || {},
    metadata: payload.metadata || {},
    schemaVersion: 1,
    entrepriseId: entrepriseId || null,
    createdAt: now,
    updatedAt: now,
    createdBy: buildUserStamp(user),
    updatedBy: buildUserStamp(user)
  };

  const result = await collection.insertOne(workflow);
  return { ...workflow, _id: result.insertedId };
}

async function updateWorkflow(db, id, payload, user) {
  const collection = getCollection(db);
  const updates = {
    updatedAt: new Date(),
    updatedBy: buildUserStamp(user)
  };

  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.tags !== undefined) {
    updates.tags = Array.isArray(payload.tags) ? payload.tags : [];
  }
  if (payload.payload !== undefined) updates.payload = payload.payload;
  if (payload.metadata !== undefined) updates.metadata = payload.metadata;

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );

  return result.value;
}

async function deleteWorkflow(db, id) {
  const collection = getCollection(db);
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

module.exports = {
  listWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
};
