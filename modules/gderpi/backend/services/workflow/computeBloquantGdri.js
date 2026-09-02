/**
 * FICHIER : modules/gderpi/backend/services/workflow/computeBloquantGdri.js
 * RÔLE : Calcule le bloquant GDRI prioritaire pour une commande client.
 */

const { commandeClientKind } = require('./commandeClientKind');
const commandeNeedsAchats = require('./commandeNeedsAchats');
const isPrestationLine = require('./isPrestationLine');
const remainingLineQty = require('./remainingLineQty');
const isCommandeFullyDelivered = require('./isCommandeFullyDelivered');
const isCommandeFullyRecetted = require('./isCommandeFullyRecetted');
const isCommandeFulfillmentComplete = require('./isCommandeFulfillmentComplete');
const listLignesFacturables = require('../facturation/listLignesFacturables');
const isCommandeFullyFacturee = require('../facturation/isCommandeFullyFacturee');
const { hasLivrableProductLines } = require('./hasLivrableProductLines');
const lineRequiresRecette = require('./lineRequiresRecette');

const FULFILLMENT_COMPLETE_STATUTS = new Set([
  'validee_gdri',
  'prestation_en_cours',
  'achats_en_cours',
  'attente_livraison_frs',
  'a_livrer'
]);

function productLinesRemaining(commande) {
  const lines = Array.isArray(commande?.lignes) ? commande.lignes : [];
  return lines.filter((l) => {
    if (isPrestationLine(l)) return false;
    return remainingLineQty(l) > 0;
  });
}

function devLinesRemaining(commande) {
  const requiresRecette = typeof lineRequiresRecette === 'function'
    ? lineRequiresRecette
    : require('./lineRequiresRecette');
  return (Array.isArray(commande?.lignes) ? commande.lignes : []).filter((l) => {
    return requiresRecette(l) && !l.recetteValideeAt;
  });
}

function hasLignesFacturables(commande) {
  return listLignesFacturables(commande).length > 0;
}

function computeBloquantGdri(commande, opts = {}) {
  const cmd = commande && typeof commande === 'object' ? commande : {};
  const statut = String(cmd.statut || '');
  const kind = commandeClientKind(cmd);

  if (['annulee', 'facturee'].includes(statut)) return null;
  if (cmd.validationGdriRequise && statut === 'a_valider_gdri') return 'validation_gdri';
  if (statut === 'a_valider_gdri') return 'validation_gdri';

  if (statut === 'validee_gdri') {
    if (commandeNeedsAchats(cmd)) {
      const brouillon = Number(opts.commandesFournisseurBrouillonCount) || 0;
      const total = Number(opts.commandesFournisseurCount) || 0;
      if (!total) return 'achats_a_generer';
      if (brouillon > 0) return 'achats_a_valider';
    }
    if (kind === 'dev' || kind === 'mixte') {
      if (devLinesRemaining(cmd).length) return 'recette_a_valider';
    }
    if ((kind === 'produit' || kind === 'mixte') && productLinesRemaining(cmd).length) {
      if (!commandeNeedsAchats(cmd)) return 'bl_a_creer';
    }
  }

  if (statut === 'prestation_en_cours') {
    if (hasLignesFacturables(cmd)) return 'facture_a_emettre';
    if (devLinesRemaining(cmd).length) return 'recette_a_valider';
  }

  if (statut === 'achats_en_cours') {
    if (hasLivrableProductLines(cmd)) return 'bl_a_creer';
    const brouillon = Number(opts.commandesFournisseurBrouillonCount) || 0;
    if (brouillon > 0) return 'achats_a_valider';
  }

  if (statut === 'attente_livraison_frs') {
    if (hasLivrableProductLines(cmd)) return 'bl_a_creer';
    return 'reception_a_confirmer';
  }

  if (statut === 'a_livrer' && productLinesRemaining(cmd).length) return 'bl_a_creer';

  if (statut === 'validee_gdri' && kind === 'dev' && devLinesRemaining(cmd).length) {
    return 'recette_a_valider';
  }

  if (statut === 'facturee_partiellement') {
    if (devLinesRemaining(cmd).length) return 'recette_a_valider';
    if (productLinesRemaining(cmd).length && hasLivrableProductLines(cmd)) return 'bl_a_creer';
  }

  if (['livree', 'a_facturer', 'facturee_partiellement'].includes(statut) && hasLignesFacturables(cmd)) {
    return 'facture_a_emettre';
  }

  if (statut === 'validee_gdri' && kind === 'mixte') {
    if (devLinesRemaining(cmd).length) return 'recette_a_valider';
    if (productLinesRemaining(cmd).length && !commandeNeedsAchats(cmd)) return 'bl_a_creer';
  }

  if (statut === 'livree' && !isCommandeFullyDelivered(cmd) && productLinesRemaining(cmd).length) {
    return 'bl_a_creer';
  }

  if (statut === 'livree' && !isCommandeFullyRecetted(cmd) && devLinesRemaining(cmd).length) {
    return 'recette_a_valider';
  }

  if (FULFILLMENT_COMPLETE_STATUTS.has(statut) && hasLignesFacturables(cmd) && isCommandeFulfillmentComplete(cmd)) {
    return 'facture_a_emettre';
  }

  if (hasLignesFacturables(cmd) && !isCommandeFullyFacturee(cmd)) {
    if (['a_livrer', 'validee_gdri', 'achats_en_cours', 'attente_livraison_frs'].includes(statut)) {
      return null;
    }
  }

  return null;
}

module.exports = computeBloquantGdri;
