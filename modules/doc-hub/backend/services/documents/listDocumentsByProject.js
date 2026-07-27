/**
 * FICHIER : modules/doc-hub/backend/services/documents/listDocumentsByProject.js
 * RÔLE : Liste les documents d'un projet (filtres type de pièce et tag).
 */

async function listDocumentsByProject(entrepriseDb, projectId, { slotCode = null, tag = null } = {}) {
  const filter = { projectId: String(projectId) };
  if (slotCode) filter.slotCode = slotCode;
  if (tag) filter.tags = tag;

  return entrepriseDb
    .collection('doc_hub_documents')
    .find(filter)
    .sort({ uploadedAt: -1 })
    .toArray();
}

module.exports = listDocumentsByProject;
