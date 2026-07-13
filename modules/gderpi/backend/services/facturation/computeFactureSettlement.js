/**
 * Calcule le solde d'une facture après avoirs (facturé, crédité, reste dû).
 */

const normalizeAvoir = require('./normalizeAvoir');

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function sumAvoirTtc(facture) {
  let total = 0;
  (Array.isArray(facture?.avoirs) ? facture.avoirs : []).forEach((raw) => {
    const avoir = normalizeAvoir(raw);
    total += Number(avoir.totaux?.totalTtc) || 0;
  });
  return roundMoney(total);
}

function listRemboursementsEnAttente(facture) {
  return (Array.isArray(facture?.avoirs) ? facture.avoirs : [])
    .map((raw) => normalizeAvoir(raw))
    .filter((a) => a.mode === 'remboursement' && a.remboursementStatut === 'en_attente');
}

function computeFactureSettlement(facture) {
  const f = facture && typeof facture === 'object' ? facture : {};
  const totalFactureTtc = roundMoney(f.totaux?.totalTtc);
  const totalAvoirTtc = sumAvoirTtc(f);
  const resteDuTtc = Math.max(0, roundMoney(totalFactureTtc - totalAvoirTtc));
  const fullyCredited = totalAvoirTtc > 0 && resteDuTtc <= 0.0001;
  const remboursementsEnAttente = listRemboursementsEnAttente(f);
  const remboursementEnAttente = remboursementsEnAttente.length > 0;
  const montantRemboursementEnAttente = roundMoney(
    remboursementsEnAttente.reduce((s, a) => s + (Number(a.totaux?.totalTtc) || 0), 0)
  );

  return {
    totalFactureTtc,
    totalAvoirTtc,
    resteDuTtc,
    fullyCredited,
    remboursementEnAttente,
    montantRemboursementEnAttente,
    remboursementsEnAttente
  };
}

module.exports = computeFactureSettlement;
module.exports.sumAvoirTtc = sumAvoirTtc;
