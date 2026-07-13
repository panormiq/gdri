/**
 * FICHIER : modules/gderpi/backend/services/clientServices/toClientServiceEntry.js
 */

const normalizeClientService = require('./normalizeClientService');

function toClientServiceEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeClientService(doc);
  return {
    ...normalized,
    clientServiceId: normalized.id,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
  };
}

module.exports = toClientServiceEntry;
