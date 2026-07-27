/**
 * FICHIER : modules/doc-hub/backend/services/projects/createProject.js
 * RÔLE : Crée un projet Doc-Hub (statut initial "draft").
 */

async function createProject(entrepriseDb, payload, userId) {
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

module.exports = createProject;
