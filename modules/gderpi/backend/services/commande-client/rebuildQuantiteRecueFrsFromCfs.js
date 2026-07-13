/**
 * FICHIER : modules/gderpi/backend/services/commande-client/rebuildQuantiteRecueFrsFromCfs.js
 * RÔLE : Recalcule quantiteRecueFrs depuis toutes les CF reçues (idempotent).
 *
 * ENTRÉES : db, entrepriseId, commandeClientId
 * SORTIES : commande client mise à jour ou null
 *
 * DÉPEND DE : getCommandeClientById.js, listCommandesFournisseur.js, applyQuantiteRecueFrs.js
 * NE PAS : changer le statut commande
 *
 * APPELÉ PAR : confirmerReceptionAchats.js, updateCommandeFournisseurStatus.js
 */

const getCommandeClientById = require('./getCommandeClientById');
const listCommandesFournisseur = require('../commande-fournisseur/listCommandesFournisseur');
const applyQuantiteRecueFrs = require('./applyQuantiteRecueFrs');
const cfLinesToRecueCredits = require('../commande-fournisseur/cfLinesToRecueCredits');
const lineRequiresReceptionFrs = require('../workflow/lineRequiresReceptionFrs');

const COLLECTION = 'gderpi_commandes_client';

function resetRecueFrsOnLines(lignes, commande) {
  return (Array.isArray(lignes) ? lignes : []).map((line) => {
    if (!lineRequiresReceptionFrs(line, commande)) return { ...line };
    return { ...line, quantiteRecueFrs: 0 };
  });
}

function cfHasReceptionCredit(cf) {
  const statut = String(cf?.statut || '');
  if (statut === 'recue' || statut === 'partiellement_recue') return true;
  return (cf?.lignes || []).some((l) => (Number(l.quantiteRecue) || 0) > 0);
}

async function rebuildQuantiteRecueFrsFromCfs(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) return null;

  const cfs = await listCommandesFournisseur(db, entrepriseId, { commandeClientId });
  const withCredits = cfs.filter((c) => String(c.statut) !== 'annulee' && cfHasReceptionCredit(c));
  if (!withCredits.length) return commande;

  let lignes = resetRecueFrsOnLines(commande.lignes, commande);
  withCredits.forEach((cf) => {
    lignes = applyQuantiteRecueFrs(lignes, cfLinesToRecueCredits(cf));
  });

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        lignes,
        updatedAt: now
      }
    }
  );

  return getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
}

module.exports = rebuildQuantiteRecueFrsFromCfs;
