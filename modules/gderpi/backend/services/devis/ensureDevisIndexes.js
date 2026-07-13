/**
 * FICHIER : modules/gderpi/backend/services/devis/ensureDevisIndexes.js
 * RÔLE : Crée les index Mongo pour la collection devis.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : —
 * NE PAS : CRUD devis
 *
 * APPELÉ PAR : listDevis.js, createDevis.js
 */

const COLLECTION = 'gderpi_devis';

async function ensureDevisIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { entrepriseId: 1, devisId: 1 },
    { unique: true, name: 'gderpi_devis_ent_id' }
  );
  await col.createIndex({ entrepriseId: 1, boutiqueId: 1, statut: 1 }, { name: 'gderpi_devis_boutique_statut' });
  await col.createIndex({ entrepriseId: 1, numero: 1 }, { name: 'gderpi_devis_numero' });
}

module.exports = ensureDevisIndexes;
