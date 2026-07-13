/**
 * FICHIER : modules/gderpi/backend/services/commande-client/creditQuantiteRecueFrsFromCf.js
 * RÔLE : Crédite quantiteRecueFrs sur la commande client à la réception d'une CF.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseur
 * SORTIES : commande client mise à jour ou null
 *
 * DÉPEND DE : getCommandeClientById.js, applyQuantiteRecueFrs.js
 * NE PAS : changer le statut commande
 *
 * APPELÉ PAR : updateCommandeFournisseurStatus.js
 */

const getCommandeClientById = require('./getCommandeClientById');
const applyQuantiteRecueFrs = require('./applyQuantiteRecueFrs');

const COLLECTION = 'gderpi_commandes_client';

async function creditQuantiteRecueFrsFromCf(db, entrepriseId, commandeFournisseur) {
  const cf = commandeFournisseur && typeof commandeFournisseur === 'object' ? commandeFournisseur : null;
  const commandeClientId = cf?.commandeClientId ? String(cf.commandeClientId).trim() : '';
  if (!commandeClientId) return null;

  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) return null;

  const cfLignes = Array.isArray(cf.lignes) ? cf.lignes : [];
  if (!cfLignes.length) return commande;

  const updatedLignes = applyQuantiteRecueFrs(commande.lignes, cfLignes);
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId },
    {
      $set: {
        lignes: updatedLignes,
        updatedAt: now
      },
      $push: {
        historique: {
          action: 'credit_reception_frs',
          date: now,
          commandeFournisseurId: cf.commandeFournisseurId || cf.id,
          commandeFournisseurNumero: cf.numero || ''
        }
      }
    }
  );

  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = creditQuantiteRecueFrsFromCf;
