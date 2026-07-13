/**
 * FICHIER : modules/gderpi/backend/services/commande-client/genererAchatsCommande.js
 * RÔLE : Assure les commandes fournisseur brouillon et passe la commande client en achats en cours.
 */

const getCommandeClientById = require('./getCommandeClientById');
const ensureCommandesFournisseurFromClient = require('../commande-fournisseur/ensureCommandesFournisseurFromClient');
const setCommandeClientStatut = require('./setCommandeClientStatut');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');

async function genererAchatsCommande(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');
  if (!['validee_gdri', 'achats_en_cours'].includes(commande.statut)) {
    throw new Error('La commande n\'est pas prête pour la génération des achats');
  }
  if (!commandeNeedsAchats(commande)) {
    throw new Error('Cette commande ne nécessite pas d\'achats fournisseur');
  }

  const created = await ensureCommandesFournisseurFromClient(db, entrepriseId, commandeClientId);

  if (commande.statut === 'validee_gdri') {
    await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'achats_en_cours', {
      historique: { action: 'generer_achats', count: created.length }
    });
  }

  const item = await getCommandeClientById(db, entrepriseId, commandeClientId);
  return { commande: item, commandesFournisseur: created };
}

module.exports = genererAchatsCommande;
