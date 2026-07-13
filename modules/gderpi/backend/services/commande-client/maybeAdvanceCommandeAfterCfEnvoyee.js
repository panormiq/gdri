/**
 * FICHIER : modules/gderpi/backend/services/commande-client/maybeAdvanceCommandeAfterCfEnvoyee.js
 * RÔLE : Passe la commande client en attente livraison fournisseur quand toutes les CF actives sont envoyées.
 */

const getCommandeClientById = require('./getCommandeClientById');
const listCommandesFournisseur = require('../commande-fournisseur/listCommandesFournisseur');
const setCommandeClientStatut = require('./setCommandeClientStatut');

const ADVANCE_FROM = new Set(['validee_gdri', 'achats_en_cours']);

async function maybeAdvanceCommandeAfterCfEnvoyee(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande || !ADVANCE_FROM.has(String(commande.statut))) return commande;

  const cfs = await listCommandesFournisseur(db, entrepriseId, { commandeClientId });
  const active = cfs.filter((c) => String(c.statut) !== 'annulee');
  if (!active.length) return commande;

  const allSent = active.every((c) => String(c.statut) !== 'brouillon');
  if (!allSent) return commande;

  return setCommandeClientStatut(db, entrepriseId, commandeClientId, 'attente_livraison_frs', {
    historique: { action: 'cf_envoyees', count: active.length }
  });
}

module.exports = maybeAdvanceCommandeAfterCfEnvoyee;
