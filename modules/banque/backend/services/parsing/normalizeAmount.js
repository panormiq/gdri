/**
 * FICHIER : modules/banque/backend/services/parsing/normalizeAmount.js
 * RÔLE : Convertit un montant brut de relevé ("3 120,23") en chaîne décimale "120.23".
 */

function normalizeAmount(raw) {
  let source = String(raw || '').trim();

  // Cas OCR observé: "3 120,23" au lieu de "120,23" (le "3" vient du "20/03").
  // On supprime ce prefixe parasite pour éviter 3120.23.
  if (/^\d\s\d{3},\d{2}$/.test(source)) {
    source = source.replace(/^\d\s/, '');
  }

  const cleaned = source
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(2);
}

module.exports = normalizeAmount;
