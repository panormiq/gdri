/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/toFournisseurEntry.js
 * RÔLE : Formate un document Mongo fournisseur pour l'API.
 *
 * ENTRÉES : doc Mongo
 * SORTIES : fournisseur API ou null
 *
 * DÉPEND DE : normalizeFournisseur.js, displayNameFournisseur.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listFournisseurs.js, getFournisseurById.js, createFournisseur.js, updateFournisseur.js
 */

const normalizeFournisseur = require('./normalizeFournisseur');
const displayNameFournisseur = require('./displayNameFournisseur');

function toFournisseurEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeFournisseur(doc);
  return {
    ...normalized,
    fournisseurId: normalized.id,
    displayName: displayNameFournisseur(normalized),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
  };
}

module.exports = toFournisseurEntry;
