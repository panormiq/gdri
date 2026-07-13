/**
 * FICHIER : modules/gderpi/backend/services/devis/devisConditionsPaiementOptions.js
 * RÔLE : Libellés des moyens et échéances de paiement sur un devis.
 */

const MOYENS = {
  virement: 'Virement bancaire',
  cheque: 'Chèque',
  carte: 'Carte bancaire',
  prelevement: 'Prélèvement SEPA',
  especes: 'Espèces',
  autre: 'Autre'
};

const ECHEANCES = {
  '30j': 'Paiement à 30 jours date de facture',
  a_reception_facture: 'Paiement à réception de la facture',
  comptant_commande: 'Paiement comptant à la commande',
  a_livraison: 'Paiement à la livraison',
  acompte_solde: 'Acompte à la commande, solde à l\'expédition ou à la livraison',
  autre: 'Autre'
};

const CGV_PROFILS = {
  auto: 'Automatique (selon le client)',
  b2b: 'B2B — Professionnels',
  b2c: 'B2C — Particuliers'
};

function labelMoyen(key) {
  return MOYENS[String(key || '').trim()] || '';
}

function labelEcheance(key) {
  return ECHEANCES[String(key || '').trim()] || '';
}

function labelCgvProfil(key) {
  return CGV_PROFILS[String(key || '').trim()] || CGV_PROFILS.auto;
}

module.exports = {
  MOYENS,
  ECHEANCES,
  CGV_PROFILS,
  labelMoyen,
  labelEcheance,
  labelCgvProfil
};
