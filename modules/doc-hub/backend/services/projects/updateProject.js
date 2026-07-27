/**
 * FICHIER : modules/doc-hub/backend/services/projects/updateProject.js
 * RÔLE : Met à jour un projet (titre, référence, métadonnées, statut draft/active/closed).
 */

const toProjectObjectId = require('./toProjectObjectId');
const getProjectById = require('./getProjectById');

async function updateProject(entrepriseDb, id, payload) {
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
    { _id: toProjectObjectId(id) },
    { $set: updates }
  );

  if (result.matchedCount === 0) return null;
  return getProjectById(entrepriseDb, id);
}

module.exports = updateProject;
