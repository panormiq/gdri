/**
 * FICHIER : modules/gderpi/backend/services/clients/deleteClient.js
 * RÔLE : Supprime un client.
 *
 * ENTRÉES : db, entrepriseId, clientId
 * SORTIES : { deleted: boolean }
 *
 * DÉPEND DE : aucun
 * NE PAS : cascade devis
 *
 * APPELÉ PAR : clientsController
 */

const COLLECTION = 'gderpi_clients';

async function deleteClient(db, entrepriseId, clientId) {
  const id = String(clientId || '').trim();
  if (!id) return false;
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ entrepriseId: String(entrepriseId), clientId: id });
  return result.deletedCount > 0;
}

module.exports = deleteClient;
