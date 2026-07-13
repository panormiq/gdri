/**
 * FICHIER : modules/gderpi/backend/services/commande-client/processCommandeConfirmation.js
 * RÔLE : À la confirmation interne — besoins stock + commandes fournisseur brouillon.
 */

const getCommandeClientById = require('./getCommandeClientById');
const buildBesoinsFromLignes = require('../besoins/buildBesoinsFromLignes');
const ensureCommandesFournisseurFromClient = require('../commande-fournisseur/ensureCommandesFournisseurFromClient');
const setCommandeClientStatut = require('./setCommandeClientStatut');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');

const COLLECTION = 'gderpi_commandes_client';

async function processCommandeConfirmation(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');

  const existingBesoins = Array.isArray(commande.besoins) ? commande.besoins : [];
  let besoins = existingBesoins;
  const now = new Date();

  if (!existingBesoins.length) {
    besoins = await buildBesoinsFromLignes(db, entrepriseId, commande.lignes);
    if (besoins.length) {
      await db.collection(COLLECTION).updateOne(
        { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
        { $set: { besoins, updatedAt: now } }
      );
    }
  }

  let commandesFournisseurCount = 0;
  let achatsError = null;
  const openBesoins = besoins.filter((b) => String(b.statut) === 'ouvert');

  if (openBesoins.length > 0 && commandeNeedsAchats({ ...commande, besoins })) {
    try {
      const created = await ensureCommandesFournisseurFromClient(db, entrepriseId, commandeClientId);
      commandesFournisseurCount = Array.isArray(created) ? created.length : 0;
      if (commandesFournisseurCount) {
        await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'achats_en_cours', {
          historique: { action: 'preparer_achats', count: commandesFournisseurCount }
        });
      }
    } catch (error) {
      achatsError = error.message || 'Erreur génération commandes fournisseur';
    }
  }

  return {
    besoinsCount: besoins.length,
    commandesFournisseurCount,
    achatsError
  };
}

module.exports = processCommandeConfirmation;
