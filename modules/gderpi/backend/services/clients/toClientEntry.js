/**
 * FICHIER : modules/gderpi/backend/services/clients/toClientEntry.js
 * RÔLE : Formate un document Mongo client pour l'API.
 *
 * ENTRÉES : doc Mongo
 * SORTIES : client API ou null
 *
 * DÉPEND DE : normalizeClient.js, displayNameClient.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listClients.js, getClientById.js, createClient.js, updateClient.js
 */

const normalizeClient = require('./normalizeClient');
const displayNameClient = require('./displayNameClient');

function toClientEntry(doc) {
  if (!doc) return null;
  const normalized = normalizeClient(doc);
  return {
    ...normalized,
    clientId: normalized.id,
    displayName: displayNameClient(normalized),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
  };
}

module.exports = toClientEntry;
