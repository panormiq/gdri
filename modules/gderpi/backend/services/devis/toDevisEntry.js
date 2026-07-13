/**
 * FICHIER : modules/gderpi/backend/services/devis/toDevisEntry.js
 * RÔLE : Formate un document Mongo devis pour l'API.
 *
 * ENTRÉES : doc Mongo
 * SORTIES : devis API ou null
 *
 * DÉPEND DE : normalizeDevis.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listDevis.js, getDevisById.js, createDevis.js, updateDevis.js
 */

const normalizeDevis = require('./normalizeDevis');

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toDevisEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeDevis(doc);
  return {
    ...normalized,
    devisId: normalized.id,
    createdAt: isoDate(doc.createdAt) || normalized.createdAt,
    updatedAt: isoDate(doc.updatedAt) || normalized.updatedAt,
    dateValidite: isoDate(doc.dateValidite) || normalized.dateValidite
  };
}

module.exports = toDevisEntry;
