/**
 * FICHIER : modules/gderpi/backend/services/boutiques/ensureBoutiqueIndexes.js
 * RÔLE : Crée les index Mongo sur les boutiques.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : aucun
 * NE PAS : CRUD
 *
 * APPELÉ PAR : listBoutiques.js, createBoutique.js
 */

const COLLECTION = 'gderpi_boutiques';

async function ensureBoutiqueIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, updatedAt: -1 });
  await col.createIndex({ entrepriseId: 1, boutiqueId: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, slug: 1 }, { unique: true });
  await col.createIndex({ entrepriseId: 1, annuaireOrganisationId: 1 }, { sparse: true });
  await col.createIndex({ entrepriseId: 1, isPrincipale: 1 });
}

module.exports = ensureBoutiqueIndexes;
