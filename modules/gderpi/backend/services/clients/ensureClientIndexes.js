/**
 * FICHIER : modules/gderpi/backend/services/clients/ensureClientIndexes.js
 * RÔLE : Crée les index Mongo clients.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : aucun
 * NE PAS : CRUD
 *
 * APPELÉ PAR : listClients.js, createClient.js
 */

const COLLECTION = 'gderpi_clients';

async function ensureClientIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, updatedAt: -1 });
  await col.createIndex({ entrepriseId: 1, clientId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, annuaireOrganisationId: 1 }, { sparse: true });
}

module.exports = ensureClientIndexes;
