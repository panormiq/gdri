/**
 * FICHIER : modules/doc-hub/backend/services/documents/removeManyDocuments.js
 * RÔLE : Supprime plusieurs documents d'un projet (vérifie l'appartenance au projet).
 *
 * SORTIES : { deleted: number, failed: string[] }
 */

const getDocumentById = require('./getDocumentById');
const removeDocument = require('./removeDocument');

async function removeManyDocuments(entrepriseDb, projectId, documentIds, entrepriseId) {
  const ids = [...new Set((documentIds || []).map(String).filter(Boolean))];
  let deleted = 0;
  const failed = [];

  for (const id of ids) {
    const doc = await getDocumentById(entrepriseDb, id);
    if (!doc || String(doc.projectId) !== String(projectId)) {
      failed.push(id);
      continue;
    }
    const ok = await removeDocument(entrepriseDb, id, entrepriseId);
    if (ok) deleted++;
    else failed.push(id);
  }

  return { deleted, failed };
}

module.exports = removeManyDocuments;
