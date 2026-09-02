/**
 * FICHIER : modules/gderpi/backend/services/workflow/isPrestationHeureUnite.js
 * RÔLE : Distingue une unité temps (heures / jours) d'un forfait.
 *
 * ENTRÉES : unite
 * SORTIES : boolean
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : applyAvancementLignes.js, bindRecetteModal.js
 */

function isPrestationHeureUnite(unite) {
  const u = String(unite || '').trim().toLowerCase();
  if (!u) return false;
  return /^(h|heure|heures|hrs?|jour|jours|jh|j\/h|homme[- ]?jour)$/.test(u)
    || u.includes('heure')
    || u.includes('jour');
}

module.exports = isPrestationHeureUnite;
