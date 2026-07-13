/**
 * FICHIER : modules/gderpi/backend/services/boutiques/toBoutiqueEntry.js
 * RÔLE : Formate un document Mongo boutique pour l'API.
 *
 * ENTRÉES : doc Mongo
 * SORTIES : boutique API ou null
 *
 * DÉPEND DE : normalizeBoutique.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listBoutiques.js, getBoutiqueById.js, createBoutique.js, updateBoutique.js
 */

const normalizeBoutique = require('./normalizeBoutique');

function toBoutiqueEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeBoutique(doc);
  return {
    ...normalized,
    boutiqueId: normalized.id,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
  };
}

module.exports = toBoutiqueEntry;
