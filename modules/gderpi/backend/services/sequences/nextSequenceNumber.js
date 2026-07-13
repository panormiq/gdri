/**
 * FICHIER : modules/gderpi/backend/services/sequences/nextSequenceNumber.js
 * RÔLE : Incrémente atomiquement un compteur et retourne un numéro formaté (ex. DEV-2026-0001).
 *
 * ENTRÉES : db, entrepriseId, boutiqueId, type (devis|commande_client|commande_fournisseur|facture|avoir)
 * SORTIES : string numéro
 *
 * DÉPEND DE : ensureSequenceIndexes.js
 * NE PAS : logique document métier
 *
 * APPELÉ PAR : createDevis.js, createFromDevis.js, createFromCommandeClient.js, facturerCommandeClient.js
 */

const ensureSequenceIndexes = require('./ensureSequenceIndexes');

const COLLECTION = 'gderpi_sequences';

const PREFIX = {
  devis: 'DEV',
  commande_client: 'CMD',
  commande_fournisseur: 'CF',
  facture: 'FAC',
  avoir: 'AVO',
  bon_livraison: 'BL'
};

async function nextSequenceNumber(db, entrepriseId, boutiqueId, type) {
  const seqType = String(type || '').trim();
  const prefix = PREFIX[seqType];
  if (!prefix) throw new Error('Type de séquence invalide');

  await ensureSequenceIndexes(db);
  const col = db.collection(COLLECTION);
  const year = new Date().getFullYear();
  const key = {
    entrepriseId: String(entrepriseId),
    boutiqueId: String(boutiqueId || 'default'),
    type: seqType
  };

  const result = await col.findOneAndUpdate(
    { ...key, year },
    {
      $inc: { counter: 1 },
      $setOnInsert: { ...key, year, createdAt: new Date() },
      $set: { updatedAt: new Date() }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const counter = result?.counter ?? 1;
  return prefix + '-' + year + '-' + String(counter).padStart(4, '0');
}

module.exports = nextSequenceNumber;
