/**
 * FICHIER : modules/doc-hub/backend/services/tags/createTag.js
 * RÔLE : Crée un tag (code normalisé kebab-case, unicité garantie par index).
 */

async function createTag(entrepriseDb, { code, label, color }) {
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

module.exports = createTag;
