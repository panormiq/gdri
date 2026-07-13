/**
 * FICHIER : modules/gderpi/backend/services/commande-client/maybeAdvanceCommandeAfterReceptionFrs.js
 * RÔLE : Passe la commande en « à livrer » dès qu'une réception fournisseur est enregistrée.
 */

const getCommandeClientById = require('./getCommandeClientById');
const setCommandeClientStatut = require('./setCommandeClientStatut');

const ADVANCE_FROM = new Set(['achats_en_cours', 'attente_livraison_frs']);

async function maybeAdvanceCommandeAfterReceptionFrs(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande || !ADVANCE_FROM.has(String(commande.statut))) return commande;

  const hasRecue = (commande.lignes || []).some((l) => (Number(l.quantiteRecueFrs) || 0) > 0);
  if (!hasRecue) return commande;

  return setCommandeClientStatut(db, entrepriseId, commandeClientId, 'a_livrer', {
    historique: { action: 'reception_frs_enregistree' }
  });
}

module.exports = maybeAdvanceCommandeAfterReceptionFrs;
