/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/addFournisseurDocument.js
 * RÔLE : Ajoute une pièce jointe à un fournisseur GDERPI.
 */

const crypto = require('crypto');
const getFournisseurById = require('./getFournisseurById');
const { normalizeTierDocument } = require('../tiers/normalizeTierDocument');
const normalizeTierDocuments = require('../tiers/normalizeTierDocuments');
const { saveGderpiDocumentFile } = require('../uploads/saveGderpiDocumentFile');

const COLLECTION = 'gderpi_fournisseurs';
const SCOPE = 'fournisseur-document';

async function addFournisseurDocument(db, entrepriseId, fournisseurId, file, meta = {}) {
  const id = String(fournisseurId || '').trim();
  if (!id) throw new Error('Identifiant fournisseur requis');
  if (!file) throw new Error('Aucun fichier reçu');

  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), fournisseurId: id });
  if (!existing) throw new Error('Fournisseur introuvable');

  const saved = saveGderpiDocumentFile(entrepriseId, SCOPE, file);
  const now = new Date();
  const doc = normalizeTierDocument({
    id: crypto.randomUUID(),
    label: String(meta.label || saved.originalName || '').trim(),
    type: meta.type,
    scope: saved.scope,
    filename: saved.filename,
    originalName: saved.originalName,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
    uploadedAt: now
  });

  const documents = [...normalizeTierDocuments(existing.documents), doc];
  await col.updateOne(
    { entrepriseId: String(entrepriseId), fournisseurId: id },
    { $set: { documents, updatedAt: now } }
  );

  const entry = await getFournisseurById(db, entrepriseId, id);
  return { fournisseur: entry, document: { ...doc, mediaPath: saved.mediaPath } };
}

module.exports = addFournisseurDocument;
