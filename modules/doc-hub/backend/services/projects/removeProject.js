/**
 * FICHIER : modules/doc-hub/backend/services/projects/removeProject.js
 * RÔLE : Supprime un projet et ses documents/diffusions associés.
 */

const toProjectObjectId = require('./toProjectObjectId');

async function removeProject(entrepriseDb, id) {
  const projectId = toProjectObjectId(id);
  const db = entrepriseDb;

  await db.collection('doc_hub_documents').deleteMany({ projectId });
  await db.collection('doc_hub_diffusions').deleteMany({ projectId: id });

  const result = await db.collection('doc_hub_projects').deleteOne({ _id: projectId });
  return result.deletedCount > 0;
}

module.exports = removeProject;
