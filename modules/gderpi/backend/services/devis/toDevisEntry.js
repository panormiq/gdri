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
  // Ne jamais régénérer d'UUID à la lecture : sinon la liste affiche un id
  // qui n'existe pas en base → « Devis introuvable » à l'envoi / GET.
  const persistedId = String(doc.devisId || doc.id || '').trim();
  if (!persistedId) return null;
  const normalized = normalizeDevis({ ...doc, id: persistedId, devisId: persistedId });
  return {
    ...normalized,
    id: persistedId,
    devisId: persistedId,
    createdAt: isoDate(doc.createdAt) || normalized.createdAt,
    updatedAt: isoDate(doc.updatedAt) || normalized.updatedAt,
    dateValidite: isoDate(doc.dateValidite) || normalized.dateValidite
  };
}

module.exports = toDevisEntry;
