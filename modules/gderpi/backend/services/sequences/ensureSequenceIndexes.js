/**
 * FICHIER : modules/gderpi/backend/services/sequences/ensureSequenceIndexes.js
 * RÔLE : Crée les index Mongo pour la collection séquences.
 *
 * ENTRÉES : db
 * SORTIES : void
 *
 * DÉPEND DE : —
 * NE PAS : incrément compteur
 *
 * APPELÉ PAR : nextSequenceNumber.js
 */

const COLLECTION = 'gderpi_sequences';

async function ensureSequenceIndexes(db) {
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { entrepriseId: 1, boutiqueId: 1, type: 1 },
    { unique: true, name: 'gderpi_sequences_ent_boutique_type' }
  );
}

module.exports = ensureSequenceIndexes;
