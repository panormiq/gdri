/**
 * FICHIER : modules/gderpi/backend/services/commande-client/maybeAdvanceCommandeFromCf.js
 * RÔLE : Avance la commande client quand toutes les CF sont reçues.
 */

const getCommandeClientById = require('./getCommandeClientById');
const listCommandesFournisseur = require('../commande-fournisseur/listCommandesFournisseur');
const setCommandeClientStatut = require('./setCommandeClientStatut');

async function maybeAdvanceCommandeFromCf(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande || commande.statut !== 'attente_livraison_frs') return commande;

  const cfs = await listCommandesFournisseur(db, entrepriseId, { commandeClientId });
  const active = cfs.filter((c) => String(c.statut) !== 'annulee');
  if (!active.length) return commande;

  const allRecue = active.every((c) => String(c.statut) === 'recue');
  if (!allRecue) return commande;

  return setCommandeClientStatut(db, entrepriseId, commandeClientId, 'a_livrer', {
    historique: { action: 'auto_reception_complete' }
  });
}

module.exports = maybeAdvanceCommandeFromCf;
