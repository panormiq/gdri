/**
 * FICHIER : modules/gderpi/backend/services/unites/toUniteEntry.js
 * RÔLE : Formate un document Mongo unité pour l'API.
 */

const normalizeUnite = require('./normalizeUnite');

function toUniteEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeUnite(doc);
  return {
    ...normalized,
    uniteId: normalized.id,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
  };
}

module.exports = toUniteEntry;
