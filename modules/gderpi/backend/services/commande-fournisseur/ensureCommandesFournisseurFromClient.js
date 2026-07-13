/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/ensureCommandesFournisseurFromClient.js
 * RÔLE : Crée les commandes fournisseur brouillon depuis une commande client si besoin.
 */

const getCommandeClientById = require('../commande-client/getCommandeClientById');
const listCommandesFournisseur = require('./listCommandesFournisseur');
const createFromCommandeClient = require('./createFromCommandeClient');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');

async function ensureCommandesFournisseurFromClient(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');
  if (!commandeNeedsAchats(commande)) return [];

  const existing = await listCommandesFournisseur(db, entrepriseId, { commandeClientId });
  const active = existing.filter((c) => String(c.statut) !== 'annulee');
  if (active.length) return active;

  return createFromCommandeClient(db, entrepriseId, commandeClientId, { markBesoins: false });
}

module.exports = ensureCommandesFournisseurFromClient;
