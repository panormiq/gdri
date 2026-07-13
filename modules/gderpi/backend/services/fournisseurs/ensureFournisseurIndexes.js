/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/ensureFournisseurIndexes.js
 * RÔLE : Crée les index Mongo fournisseurs.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : aucun
 * NE PAS : CRUD
 *
 * APPELÉ PAR : listFournisseurs.js, createFournisseur.js
 */

const COLLECTION = 'gderpi_fournisseurs';

async function ensureFournisseurIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, updatedAt: -1 });
  await col.createIndex({ entrepriseId: 1, fournisseurId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, annuaireOrganisationId: 1 }, { sparse: true });
}

module.exports = ensureFournisseurIndexes;
