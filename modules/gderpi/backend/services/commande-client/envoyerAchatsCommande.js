/**
 * FICHIER : modules/gderpi/backend/services/commande-client/envoyerAchatsCommande.js
 * RÔLE : Valide manuellement les commandes fournisseur brouillon et les marque comme envoyées.
 */

const getCommandeClientById = require('./getCommandeClientById');
const listCommandesFournisseur = require('../commande-fournisseur/listCommandesFournisseur');
const updateCommandeFournisseurStatus = require('../commande-fournisseur/updateCommandeFournisseurStatus');
const markBesoinsEnvoyesForClient = require('../besoins/markBesoinsEnvoyesForClient');
const setCommandeClientStatut = require('./setCommandeClientStatut');

async function envoyerAchatsCommande(db, entrepriseId, commandeClientId, req = null) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');
  if (!['validee_gdri', 'achats_en_cours'].includes(commande.statut)) {
    throw new Error('Les achats ne sont pas prêts pour validation');
  }

  const cfs = await listCommandesFournisseur(db, entrepriseId, { commandeClientId });
  const brouillons = cfs.filter((c) => String(c.statut) === 'brouillon');
  if (!brouillons.length) {
    throw new Error('Aucune commande fournisseur brouillon à valider');
  }

  await markBesoinsEnvoyesForClient(db, entrepriseId, commandeClientId, brouillons);

  for (const cf of brouillons) {
    await updateCommandeFournisseurStatus(
      db,
      entrepriseId,
      cf.commandeFournisseurId || cf.id,
      'envoyee',
      { req }
    );
  }

  await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'attente_livraison_frs', {
    historique: { action: 'valider_achats', count: brouillons.length }
  });

  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = envoyerAchatsCommande;
