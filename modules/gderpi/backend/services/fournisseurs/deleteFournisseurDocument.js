/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/deleteFournisseurDocument.js
 * RÔLE : Supprime une pièce jointe d'un fournisseur GDERPI.
 */

const getFournisseurById = require('./getFournisseurById');
const normalizeTierDocuments = require('../tiers/normalizeTierDocuments');
const deleteGderpiDocumentFile = require('../uploads/deleteGderpiDocumentFile');

const COLLECTION = 'gderpi_fournisseurs';

async function deleteFournisseurDocument(db, entrepriseId, fournisseurId, docId) {
  const id = String(fournisseurId || '').trim();
  const documentId = String(docId || '').trim();
  if (!id || !documentId) throw new Error('Identifiants requis');

  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), fournisseurId: id });
  if (!existing) throw new Error('Fournisseur introuvable');

  const documents = normalizeTierDocuments(existing.documents);
  const target = documents.find((d) => d.id === documentId);
  if (!target) throw new Error('Document introuvable');

  deleteGderpiDocumentFile(entrepriseId, target.scope, target.filename);

  const now = new Date();
  await col.updateOne(
    { entrepriseId: String(entrepriseId), fournisseurId: id },
    {
      $set: {
        documents: documents.filter((d) => d.id !== documentId),
        updatedAt: now
      }
    }
  );

  return getFournisseurById(db, entrepriseId, id);
}

module.exports = deleteFournisseurDocument;
