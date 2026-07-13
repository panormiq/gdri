/**
 * FICHIER : modules/gderpi/backend/services/commande-client/confirmerReceptionAchats.js
 * RÔLE : Confirme la réception fournisseur complète (raccourci).
 */

const enregistrerReceptionFournisseurCommande = require('./enregistrerReceptionFournisseurCommande');

async function confirmerReceptionAchats(db, entrepriseId, commandeClientId) {
  return enregistrerReceptionFournisseurCommande(db, entrepriseId, commandeClientId, { mode: 'complet' });
}

module.exports = confirmerReceptionAchats;
