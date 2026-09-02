/**
 * FICHIER : modules/gderpi/backend/services/commande-client/ensureCommandeClientIndexes.js
 * RÔLE : Crée les index Mongo pour commandes client.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : —
 * NE PAS : CRUD
 *
 * APPELÉ PAR : listCommandesClient.js, createFromDevis.js, createCommandeClient.js
 */

const COLLECTION = 'gderpi_commandes_client';

async function ensureCommandeClientIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { entrepriseId: 1, commandeClientId: 1 },
    { unique: true, name: 'gderpi_cmd_client_ent_id' }
  );
  await col.createIndex({ entrepriseId: 1, statut: 1 }, { name: 'gderpi_cmd_client_statut' });
  await col.createIndex({ entrepriseId: 1, devisId: 1 }, { name: 'gderpi_cmd_client_devis' });
}

module.exports = ensureCommandeClientIndexes;
