/**
 * FICHIER : modules/gderpi/backend/services/devis/calculateDevisTotals.js
 * RÔLE : Calcule totaux HT, TVA par taux et TTC à partir de lignes normalisées.
 *
 * ENTRÉES : lignes[]
 * SORTIES : { totalHt, totalTva, totalTtc, tvaParTaux }
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : createDevis.js, updateDevis.js, createFromDevis.js
 */

function addHtToTvaBuckets(tvaParTaux, ht, rate) {
  const amount = Number(ht) || 0;
  const taux = Number.isFinite(Number(rate)) ? Number(rate) : 0;
  if (!amount) return 0;
  const key = String(taux);
  if (!tvaParTaux[key]) tvaParTaux[key] = { tauxTva: taux, baseHt: 0, montantTva: 0 };
  tvaParTaux[key].baseHt = Math.round((tvaParTaux[key].baseHt + amount) * 100) / 100;
  return amount;
}

function calculateDevisTotals(lignes, options) {
  const list = Array.isArray(lignes) ? lignes : [];
  const opts = options && typeof options === 'object' ? options : {};
  const fraisPortHt = Number(opts.fraisPortHt) || 0;
  const fraisPortTauxTva = Number.isFinite(Number(opts.fraisPortTauxTva))
    ? Number(opts.fraisPortTauxTva)
    : 20;
  const tvaParTaux = {};
  let totalHt = 0;

  list.forEach((line) => {
    totalHt += addHtToTvaBuckets(tvaParTaux, line.montantHt, line.tauxTva);
  });

  if (fraisPortHt > 0) {
    totalHt += addHtToTvaBuckets(tvaParTaux, fraisPortHt, fraisPortTauxTva);
  }

  let totalTva = 0;
  Object.values(tvaParTaux).forEach((bucket) => {
    bucket.montantTva = Math.round(bucket.baseHt * bucket.tauxTva / 100 * 100) / 100;
    totalTva += bucket.montantTva;
  });

  totalHt = Math.round(totalHt * 100) / 100;
  totalTva = Math.round(totalTva * 100) / 100;

  return {
    totalHt,
    totalTva,
    totalTtc: Math.round((totalHt + totalTva) * 100) / 100,
    tvaParTaux,
    fraisPortHt: fraisPortHt > 0 ? Math.round(fraisPortHt * 100) / 100 : 0,
    fraisPortTauxTva: fraisPortHt > 0 ? fraisPortTauxTva : 0
  };
}

module.exports = calculateDevisTotals;
