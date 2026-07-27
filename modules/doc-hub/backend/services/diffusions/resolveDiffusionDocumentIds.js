/**
 * FICHIER : modules/doc-hub/backend/services/diffusions/resolveDiffusionDocumentIds.js
 * RÔLE : Résout les documents d'une diffusion (sélection manuelle, par tags ou par slot).
 */

const listDocumentsByProject = require('../documents/listDocumentsByProject');

async function resolveDiffusionDocumentIds(entrepriseDb, projectId, { documentIds = [], tags = [], slotCode = null }) {
  let docs = await listDocumentsByProject(entrepriseDb, projectId, { slotCode, tag: null });

  if (tags.length > 0) {
    docs = docs.filter((d) => (d.tags || []).some((t) => tags.includes(t)));
  }

  if (documentIds.length > 0) {
    const idSet = new Set(documentIds.map(String));
    docs = docs.filter((d) => idSet.has(d._id.toString()));
  }

  return docs;
}

module.exports = resolveDiffusionDocumentIds;
