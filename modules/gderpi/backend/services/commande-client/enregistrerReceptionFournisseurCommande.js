/**
 * FICHIER : modules/gderpi/backend/services/commande-client/enregistrerReceptionFournisseurCommande.js
 * RÔLE : Enregistre réception(s) fournisseur liées à une commande client.
 *
 * ENTRÉES : db, entrepriseId, commandeClientId, payload
 * SORTIES : commande client mise à jour
 *
 * DÉPEND DE : listCommandesFournisseur.js, enregistrerReceptionFournisseur.js, rebuildQuantiteRecueFrsFromCfs.js
 * NE PAS : facturation
 *
 * APPELÉ PAR : workflowController, confirmerReceptionAchats.js
 */

const getCommandeClientById = require('./getCommandeClientById');
const listCommandesFournisseur = require('../commande-fournisseur/listCommandesFournisseur');
const enregistrerReceptionFournisseur = require('../commande-fournisseur/enregistrerReceptionFournisseur');
const isCfEligibleReception = require('../commande-fournisseur/isCfEligibleReception');
const applyReceptionFournisseurSideEffects = require('./applyReceptionFournisseurSideEffects');

const ELIGIBLE_CMD_STATUTS = new Set(['achats_en_cours', 'attente_livraison_frs', 'a_livrer']);

async function enregistrerReceptionFournisseurCommande(db, entrepriseId, commandeClientId, payload = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');
  if (!ELIGIBLE_CMD_STATUTS.has(String(commande.statut))) {
    throw new Error('Cette commande n\'est pas en attente de réception fournisseur');
  }

  const p = payload && typeof payload === 'object' ? payload : {};
  const mode = String(p.mode || '').trim().toLowerCase();
  const notes = String(p.notes || '').trim();

  const cfs = await listCommandesFournisseur(db, entrepriseId, { commandeClientId });
  const eligible = cfs.filter((c) => String(c.statut) !== 'annulee' && isCfEligibleReception(c));
  if (!eligible.length) throw new Error('Aucune commande fournisseur en attente de réception');

  if (mode === 'complet') {
    for (const cf of eligible) {
      const id = cf.commandeFournisseurId || cf.id;
      await enregistrerReceptionFournisseur(db, entrepriseId, id, { mode: 'complet', notes });
    }
  } else {
    const groups = new Map();
    (Array.isArray(p.lignes) ? p.lignes : []).forEach((raw) => {
      const cfId = String(raw.commandeFournisseurId || raw.cfId || '').trim();
      if (!cfId) return;
      if (!groups.has(cfId)) groups.set(cfId, []);
      groups.get(cfId).push(raw);
    });
    if (!groups.size) throw new Error('Indiquez au moins une quantité reçue');

    for (const [cfId, lignes] of groups.entries()) {
      const exists = eligible.some((c) => String(c.commandeFournisseurId || c.id) === cfId);
      if (!exists) throw new Error('Commande fournisseur non éligible : ' + cfId);
    }

    for (const [cfId, lignes] of groups.entries()) {
      await enregistrerReceptionFournisseur(db, entrepriseId, cfId, { lignes, notes });
    }
  }

  await applyReceptionFournisseurSideEffects(db, entrepriseId, commandeClientId);

  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = enregistrerReceptionFournisseurCommande;
