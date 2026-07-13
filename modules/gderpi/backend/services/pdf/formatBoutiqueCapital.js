/**
 * FICHIER : modules/gderpi/backend/services/pdf/formatBoutiqueCapital.js
 * RÔLE : Formate le capital social avec la devise boutique.
 */

const { getBoutiqueDeviseSymbol } = require('../boutiques/boutiqueDeviseOptions');

function parseCapitalAmount(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const normalized = text
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasCurrencySymbol(text, symbol) {
  const value = String(text || '');
  if (symbol && value.includes(symbol)) return true;
  return /[€$£]/.test(value) || /\bCHF\b/i.test(value);
}

function formatBoutiqueCapital(capitalRaw, deviseCode) {
  const raw = String(capitalRaw || '').trim();
  if (!raw) return '';

  const symbol = getBoutiqueDeviseSymbol(deviseCode);
  const amount = parseCapitalAmount(raw);

  if (amount != null) {
    const formatted = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0
    }).format(amount);
    return `${formatted} ${symbol}`;
  }

  if (hasCurrencySymbol(raw, symbol)) return raw;
  return `${raw} ${symbol}`;
}

module.exports = formatBoutiqueCapital;
