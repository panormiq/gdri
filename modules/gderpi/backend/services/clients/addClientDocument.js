/**
 * FICHIER : modules/gderpi/backend/services/clients/addClientDocument.js
 * RÔLE : Ajoute une pièce jointe à un client GDERPI.
 */

const crypto = require('crypto');
const getClientById = require('./getClientById');
const { normalizeTierDocument } = require('../tiers/normalizeTierDocument');
const normalizeTierDocuments = require('../tiers/normalizeTierDocuments');
const { saveGderpiDocumentFile } = require('../uploads/saveGderpiDocumentFile');

const COLLECTION = 'gderpi_clients';
const SCOPE = 'client-document';

async function addClientDocument(db, entrepriseId, clientId, file, meta = {}) {
  const id = String(clientId || '').trim();
  if (!id) throw new Error('Identifiant client requis');
  if (!file) throw new Error('Aucun fichier reçu');

  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), clientId: id });
  if (!existing) throw new Error('Client introuvable');

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
    { entrepriseId: String(entrepriseId), clientId: id },
    { $set: { documents, updatedAt: now } }
  );

  const entry = await getClientById(db, entrepriseId, id);
  return { client: entry, document: { ...doc, mediaPath: saved.mediaPath } };
}

module.exports = addClientDocument;
