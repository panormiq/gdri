/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/ensureCommandeFournisseurIndexes.js
 * RÔLE : Crée les index Mongo pour commandes fournisseur.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : —
 * NE PAS : CRUD
 *
 * APPELÉ PAR : listCommandesFournisseur.js, createFromCommandeClient.js
 */

const COLLECTION = 'gderpi_commandes_fournisseur';

async function ensureCommandeFournisseurIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { entrepriseId: 1, commandeFournisseurId: 1 },
    { unique: true, name: 'gderpi_cmd_frs_ent_id' }
  );
  await col.createIndex({ entrepriseId: 1, statut: 1 }, { name: 'gderpi_cmd_frs_statut' });
  await col.createIndex({ entrepriseId: 1, commandeClientId: 1 }, { name: 'gderpi_cmd_frs_cmd_client' });
}

module.exports = ensureCommandeFournisseurIndexes;
