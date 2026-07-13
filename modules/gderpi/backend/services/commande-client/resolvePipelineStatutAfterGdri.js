/**
 * FICHIER : modules/gderpi/backend/services/commande-client/resolvePipelineStatutAfterGdri.js
 * RÔLE : Détermine le statut pipeline après validation GDRI (ou création conforme).
 */

const { commandeClientKind } = require('../workflow/commandeClientKind');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');

function resolvePipelineStatutAfterGdri(commande) {
  const kind = commandeClientKind(commande);
  const needsAchats = commandeNeedsAchats(commande);

  if (needsAchats) return 'validee_gdri';
  if (kind === 'produit' || kind === 'mixte' || kind === 'autre') return 'a_livrer';
  return 'validee_gdri';
}

module.exports = resolvePipelineStatutAfterGdri;
