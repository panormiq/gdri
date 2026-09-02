/**
 * FICHIER : modules/gderpi/backend/services/commande-client/resolvePipelineStatutAfterGdri.js
 * RÔLE : Détermine le statut pipeline après validation GDRI (ou création conforme).
 */

const { commandeClientKind } = require('../workflow/commandeClientKind');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');
const lineRequiresRecette = require('../workflow/lineRequiresRecette');

function resolvePipelineStatutAfterGdri(commande) {
  const kind = commandeClientKind(commande);
  const needsAchats = commandeNeedsAchats(commande);
  const needsRecette = (Array.isArray(commande?.lignes) ? commande.lignes : []).some(lineRequiresRecette);

  if (needsAchats) return 'validee_gdri';
  if (kind === 'dev') return needsRecette ? 'prestation_en_cours' : 'a_facturer';
  if (kind === 'produit' || kind === 'mixte' || kind === 'autre') return 'a_livrer';
  return 'prestation_en_cours';
}

module.exports = resolvePipelineStatutAfterGdri;
