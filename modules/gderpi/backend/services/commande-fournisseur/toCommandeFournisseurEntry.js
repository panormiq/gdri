/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/toCommandeFournisseurEntry.js
 * RÔLE : Formate un document Mongo commande fournisseur pour l'API.
 *
 * ENTRÉES : doc Mongo
 * SORTIES : commande fournisseur API ou null
 *
 * DÉPEND DE : normalizeCommandeFournisseur.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listCommandesFournisseur.js, getCommandeFournisseurById.js
 */

const normalizeCommandeFournisseur = require('./normalizeCommandeFournisseur');
const enrichLignesWithReceptionCf = require('./enrichLignesWithReceptionCf');

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toCommandeFournisseurEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeCommandeFournisseur(doc);
  const lignes = enrichLignesWithReceptionCf(normalized);
  return {
    ...normalized,
    lignes,
    commandeFournisseurId: normalized.id,
    createdAt: isoDate(doc.createdAt) || normalized.createdAt,
    updatedAt: isoDate(doc.updatedAt) || normalized.updatedAt
  };
}

module.exports = toCommandeFournisseurEntry;
