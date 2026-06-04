/**
 * Catalogue de tags Doc-Hub (entité)
 */

const { ObjectId } = require('mongodb');
const config = require('../config.json');

async function ensureDefaultTags(entrepriseDb) {
  const col = entrepriseDb.collection('doc_hub_tags');
  const templates = config.defaultTags || [];
  const now = new Date();

  for (let i = 0; i < templates.length; i++) {
    const tag = templates[i];
    if (!tag?.code) continue;
    await col.updateOne(
      { code: tag.code },
      {
        $setOnInsert: {
          code: tag.code,
          label: tag.label || tag.code,
          color: tag.color || '#6c757d',
          sortOrder: tag.sortOrder ?? i + 1,
          createdAt: now
        },
        $set: { updatedAt: now }
      },
      { upsert: true }
    );
  }
}

async function list(entrepriseDb) {
  return entrepriseDb
    .collection('doc_hub_tags')
    .find({})
    .sort({ sortOrder: 1, label: 1 })
    .toArray();
}

async function create(entrepriseDb, { code, label, color }) {
  const normalizedCode = String(code || label)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
  if (!normalizedCode) throw new Error('Code ou libellé tag requis');

  const now = new Date();
  const doc = {
    code: normalizedCode,
    label: String(label || code).trim(),
    color: color || '#6c757d',
    sortOrder: (await entrepriseDb.collection('doc_hub_tags').countDocuments()) + 1,
    createdAt: now,
    updatedAt: now
  };

  try {
    await entrepriseDb.collection('doc_hub_tags').insertOne(doc);
  } catch (err) {
    if (err.code === 11000) throw new Error('Ce tag existe déjà');
    throw err;
  }
  return doc;
}

async function update(entrepriseDb, id, payload) {
  const updates = { updatedAt: new Date() };
  if (payload.label !== undefined) updates.label = String(payload.label).trim();
  if (payload.color !== undefined) updates.color = payload.color;
  if (payload.sortOrder !== undefined) updates.sortOrder = Number(payload.sortOrder);

  const result = await entrepriseDb.collection('doc_hub_tags').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result;
}

async function remove(entrepriseDb, id) {
  const tag = await entrepriseDb.collection('doc_hub_tags').findOne({ _id: new ObjectId(id) });
  if (!tag) return false;

  await entrepriseDb.collection('doc_hub_documents').updateMany(
    { tags: tag.code },
    { $pull: { tags: tag.code } }
  );
  const result = await entrepriseDb.collection('doc_hub_tags').deleteOne({ _id: tag._id });
  return result.deletedCount > 0;
}

module.exports = { ensureDefaultTags, list, create, update, remove };
