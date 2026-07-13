/**
 * FICHIER : modules/gderpi/backend/services/clients/deleteClientDocument.js
 * RÔLE : Supprime une pièce jointe d'un client GDERPI.
 */

const getClientById = require('./getClientById');
const normalizeTierDocuments = require('../tiers/normalizeTierDocuments');
const deleteGderpiDocumentFile = require('../uploads/deleteGderpiDocumentFile');

const COLLECTION = 'gderpi_clients';

async function deleteClientDocument(db, entrepriseId, clientId, docId) {
  const id = String(clientId || '').trim();
  const documentId = String(docId || '').trim();
  if (!id || !documentId) throw new Error('Identifiants requis');

  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), clientId: id });
  if (!existing) throw new Error('Client introuvable');

  const documents = normalizeTierDocuments(existing.documents);
  const target = documents.find((d) => d.id === documentId);
  if (!target) throw new Error('Document introuvable');

  deleteGderpiDocumentFile(entrepriseId, target.scope, target.filename);

  const now = new Date();
  await col.updateOne(
    { entrepriseId: String(entrepriseId), clientId: id },
    {
      $set: {
        documents: documents.filter((d) => d.id !== documentId),
        updatedAt: now
      }
    }
  );

  return getClientById(db, entrepriseId, id);
}

module.exports = deleteClientDocument;
