/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/setCommandeFournisseurReglee.js
 * RÔLE : Marque une commande fournisseur comme réglée ou non réglée.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId, reglee
 * SORTIES : CommandeFournisseur
 *
 * DÉPEND DE : getCommandeFournisseurById.js
 * NE PAS : changement de statut pipeline (envoyée / reçue)
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeFournisseurById = require('./getCommandeFournisseurById');

const COLLECTION = 'gderpi_commandes_fournisseur';

async function setCommandeFournisseurReglee(db, entrepriseId, commandeFournisseurId, reglee) {
  const existing = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId, {
    skipRepair: true
  });
  if (!existing) throw new Error('Commande fournisseur introuvable');
  if (String(existing.statut) === 'annulee') {
    throw new Error('Une commande fournisseur annulée ne peut pas être réglée');
  }

  const isReglee = reglee === true || reglee === 'true' || reglee === 1 || reglee === '1';
  const now = new Date();
  const id = String(commandeFournisseurId).trim();

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeFournisseurId: id },
    {
      $set: {
        reglee: isReglee,
        regleeAt: isReglee ? now : null,
        updatedAt: now
      },
      $push: {
        historique: {
          action: isReglee ? 'reglee' : 'non_reglee',
          date: now
        }
      }
    }
  );

  return getCommandeFournisseurById(db, entrepriseId, id, { skipRepair: true });
}

module.exports = setCommandeFournisseurReglee;
