/**
 * FICHIER : modules/annuaire/backend/services/services/toServiceEntry.js
 */

const normalizeService = require('./normalizeService');

function iso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function toServiceEntry(doc) {
  if (!doc) return null;
  const n = normalizeService(doc);
  return {
    ...n,
    serviceId: n.id,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt)
  };
}

module.exports = toServiceEntry;
