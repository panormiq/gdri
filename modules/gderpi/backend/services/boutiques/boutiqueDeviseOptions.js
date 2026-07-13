/**
 * FICHIER : modules/gderpi/backend/services/boutiques/boutiqueDeviseOptions.js
 * RÔLE : Devises supportées pour le paramétrage boutique (capital, etc.).
 */

const BOUTIQUE_DEVISES = [
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'USD', label: 'Dollar ($)', symbol: '$' },
  { code: 'GBP', label: 'Livre (£)', symbol: '£' },
  { code: 'CHF', label: 'Franc suisse (CHF)', symbol: 'CHF' }
];

function normalizeBoutiqueDevise(raw) {
  const code = String(raw || 'EUR').trim().toUpperCase();
  return BOUTIQUE_DEVISES.some((d) => d.code === code) ? code : 'EUR';
}

function getBoutiqueDeviseSymbol(code) {
  const normalized = normalizeBoutiqueDevise(code);
  const found = BOUTIQUE_DEVISES.find((d) => d.code === normalized);
  return found ? found.symbol : '€';
}

module.exports = {
  BOUTIQUE_DEVISES,
  normalizeBoutiqueDevise,
  getBoutiqueDeviseSymbol
};
