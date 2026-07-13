/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/summarizeCommandesFournisseurByClient.js
 * RÔLE : Compte les commandes fournisseur actives par commande client (total / brouillon).
 */

const COLLECTION = 'gderpi_commandes_fournisseur';

async function summarizeCommandesFournisseurByClient(db, entrepriseId, commandeClientIds) {
  const ids = (Array.isArray(commandeClientIds) ? commandeClientIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await db.collection(COLLECTION).aggregate([
    {
      $match: {
        entrepriseId: String(entrepriseId),
        commandeClientId: { $in: ids },
        statut: { $ne: 'annulee' }
      }
    },
    {
      $group: {
        _id: '$commandeClientId',
        total: { $sum: 1 },
        brouillon: {
          $sum: { $cond: [{ $eq: ['$statut', 'brouillon'] }, 1, 0] }
        }
      }
    }
  ]).toArray();

  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row._id), {
      commandesFournisseurCount: Number(row.total) || 0,
      commandesFournisseurBrouillonCount: Number(row.brouillon) || 0
    });
  });
  return map;
}

async function summarizeCommandesFournisseurForClient(db, entrepriseId, commandeClientId) {
  const map = await summarizeCommandesFournisseurByClient(db, entrepriseId, [commandeClientId]);
  return map.get(String(commandeClientId)) || {
    commandesFournisseurCount: 0,
    commandesFournisseurBrouillonCount: 0
  };
}

module.exports = {
  summarizeCommandesFournisseurByClient,
  summarizeCommandesFournisseurForClient
};
