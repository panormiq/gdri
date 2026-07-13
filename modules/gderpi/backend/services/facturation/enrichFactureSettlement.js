/**
 * Ajoute les champs de solde (reste dû, statut paiement enrichi) à une facture normalisée.
 */

const computeFactureSettlement = require('./computeFactureSettlement');

function enrichFactureSettlement(facture) {
  const f = facture && typeof facture === 'object' ? facture : {};
  const settlement = computeFactureSettlement(f);
  const soldeeParAvoir = f.soldeeParAvoir === true
    || (!f.payee && settlement.fullyCredited && settlement.totalAvoirTtc > 0);

  let statutPaiement = 'non_payee';
  if (settlement.remboursementEnAttente) {
    statutPaiement = 'remboursement_en_attente';
  } else if (f.payee === true) {
    statutPaiement = 'payee';
  } else if (soldeeParAvoir || settlement.fullyCredited) {
    statutPaiement = 'soldee_avoir';
  } else if (settlement.totalAvoirTtc > 0 && settlement.resteDuTtc > 0) {
    statutPaiement = 'partiellement_creditee';
  }

  return {
    ...f,
    ...settlement,
    soldeeParAvoir,
    soldeeParAvoirAt: f.soldeeParAvoirAt || null,
    statutPaiement
  };
}

module.exports = enrichFactureSettlement;
