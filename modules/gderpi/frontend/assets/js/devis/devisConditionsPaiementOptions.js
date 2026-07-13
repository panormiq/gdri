/**
 * FICHIER : modules/gderpi/frontend/assets/js/devis/devisConditionsPaiementOptions.js
 * RÔLE : Options moyens et échéances de paiement sur un devis (miroir backend).
 */
(function initGderpiDevisConditionsPaiementOptions(global) {
  'use strict';

  const MOYENS = [
    { value: 'virement', label: 'Virement bancaire' },
    { value: 'cheque', label: 'Chèque' },
    { value: 'carte', label: 'Carte bancaire' },
    { value: 'prelevement', label: 'Prélèvement SEPA' },
    { value: 'especes', label: 'Espèces' },
    { value: 'autre', label: 'Autre (préciser ci-dessous)' }
  ];

  const ECHEANCES = [
    { value: '30j', label: 'Paiement à 30 jours date de facture' },
    { value: 'a_reception_facture', label: 'Paiement à réception de la facture' },
    { value: 'comptant_commande', label: 'Paiement comptant à la commande' },
    { value: 'a_livraison', label: 'Paiement à la livraison' },
    { value: 'acompte_solde', label: 'Acompte à la commande, solde à l\'expédition ou à la livraison' },
    { value: 'autre', label: 'Autre (préciser ci-dessous)' }
  ];

  function fillSelect(selectEl, options, selectedValue) {
    if (!selectEl) return;
    const pick = String(selectedValue || '').trim();
    selectEl.innerHTML = '<option value="">— Non précisé —</option>' +
      options.map((opt) => {
        const sel = opt.value === pick ? ' selected' : '';
        return '<option value="' + opt.value + '"' + sel + '>' + opt.label + '</option>';
      }).join('');
  }

  global.GderpiDevisPaiementOptions = {
    MOYENS,
    ECHEANCES,
    fillSelect,
    needsComplement(moyen, echeance) {
      return moyen === 'autre' || echeance === 'autre';
    }
  };
})(window);
