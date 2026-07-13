/**
 * FICHIER : modules/gderpi/backend/services/tiers/normalizeTierDocument.js
 * RÔLE : Normalise une pièce jointe tiers (client / fournisseur).
 */

const crypto = require('crypto');

const DOCUMENT_TYPES = new Set([
  'kbis',
  'rib',
  'contrat',
  'devis',
  'bon_commande',
  'facture',
  'autre'
]);

function normalizeTierDocument(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const type = String(d.type || 'autre').trim().toLowerCase();
  const uploadedAt = d.uploadedAt instanceof Date
    ? d.uploadedAt.toISOString()
    : (d.uploadedAt || null);

  return {
    id: String(d.id || '').trim() || crypto.randomUUID(),
    label: String(d.label || d.originalName || '').trim(),
    type: DOCUMENT_TYPES.has(type) ? type : 'autre',
    scope: String(d.scope || '').trim(),
    filename: String(d.filename || '').trim(),
    originalName: String(d.originalName || '').trim(),
    mimeType: String(d.mimeType || '').trim(),
    sizeBytes: Number.isFinite(Number(d.sizeBytes)) ? Math.max(0, Number(d.sizeBytes)) : 0,
    uploadedAt
  };
}

module.exports = { normalizeTierDocument, DOCUMENT_TYPES };
