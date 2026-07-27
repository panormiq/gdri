/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/repairCommandeFournisseurPrixAchat.js
 * RÔLE : Réapplique les tarifs d'achat catalogue sur une CF brouillon (corrige un prix de vente hérité).
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId | entrée CF
 * SORTIES : CommandeFournisseur réparée ou inchangée
 *
 * DÉPEND DE : getCommandeFournisseurById.js, applyPrixAchatHtToLignesFournisseur.js, calculateDevisTotals.js
 * NE PAS : modifier une CF hors brouillon
 *
 * APPELÉ PAR : ensureCommandesFournisseurFromClient.js, getCommandeFournisseurById.js
 */

const applyPrixAchatHtToLignesFournisseur = require('./applyPrixAchatHtToLignesFournisseur');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');

const COLLECTION = 'gderpi_commandes_fournisseur';

function pricesChanged(before, after) {
  const a = Array.isArray(before) ? before : [];
  const b = Array.isArray(after) ? after : [];
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i += 1) {
    if (Number(a[i]?.prixHt) !== Number(b[i]?.prixHt)) return true;
    if (String(a[i]?.referenceFournisseur || '') !== String(b[i]?.referenceFournisseur || '')) return true;
  }
  return false;
}

async function repairCommandeFournisseurPrixAchat(db, entrepriseId, commandeOrId) {
  let entry = commandeOrId;
  if (!entry || typeof entry !== 'object' || !entry.id) {
    const getCommandeFournisseurById = require('./getCommandeFournisseurById');
    entry = await getCommandeFournisseurById(db, entrepriseId, commandeOrId, { skipRepair: true });
  }
  if (!entry) return null;
  if (String(entry.statut) !== 'brouillon') return entry;

  const lignes = await applyPrixAchatHtToLignesFournisseur(db, entrepriseId, entry.lignes || [], {
    fournisseurId: entry.fournisseurId,
    fournisseurBoutiqueId: entry.fournisseurBoutiqueId
  });

  if (!pricesChanged(entry.lignes, lignes)) return entry;

  const fraisPortHt = Number(entry.fraisPortHt) || 0;
  const fraisPortTauxTva = Number.isFinite(Number(entry.fraisPortTauxTva))
    ? Number(entry.fraisPortTauxTva)
    : 20;
  const totaux = calculateDevisTotals(lignes, { fraisPortHt, fraisPortTauxTva });
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeFournisseurId: String(entry.id).trim() },
    {
      $set: {
        lignes,
        totaux,
        updatedAt: now
      }
    }
  );

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    commandeFournisseurId: String(entry.id).trim()
  });
  return toCommandeFournisseurEntry(doc);
}

module.exports = repairCommandeFournisseurPrixAchat;
