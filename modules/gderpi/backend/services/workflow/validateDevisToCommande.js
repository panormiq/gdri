/**
 * FICHIER : modules/gderpi/backend/services/workflow/validateDevisToCommande.js
 * RÔLE : Vérifie qu'un devis peut être transformé en commande client.
 *
 * ENTRÉES : devis
 * SORTIES : void (throw si invalide)
 *
 * DÉPEND DE : —
 * NE PAS : création commande
 *
 * APPELÉ PAR : createFromDevis.js
 */

function validateDevisToCommande(devis, opts = {}) {
  if (!devis) throw new Error('Devis introuvable');
  if (devis.statut !== 'accepte') {
    throw new Error('Le devis doit être accepté avant transformation en commande');
  }
  if (devis.commandeClientId) {
    throw new Error('Une commande client existe déjà pour ce devis');
  }
  if (!devis.lignes || !devis.lignes.length) {
    throw new Error('Le devis ne contient aucune ligne');
  }
  if (!opts.allowExpired && devis.dateValidite) {
    const expiry = new Date(devis.dateValidite);
    if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) {
      throw new Error('Le devis est expiré');
    }
  }
}

module.exports = validateDevisToCommande;
