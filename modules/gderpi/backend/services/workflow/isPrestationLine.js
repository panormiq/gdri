/**
 * FICHIER : modules/gderpi/backend/services/workflow/isPrestationLine.js
 * RÔLE : Une ligne est une prestation si elle est service/dev, ou vendue à l'heure / au jour.
 *
 * ENTRÉES : ligne commande / devis
 * SORTIES : boolean
 *
 * DÉPEND DE : isPrestationHeureUnite.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : commandeClientKind.js, lineRequiresRecette.js, commandeNeedsAchats.js
 */

const isPrestationHeureUnite = require('./isPrestationHeureUnite');

function isPrestationLine(line) {
  const t = String(line?.articleType || '').toLowerCase();
  if (t === 'developpement' || t === 'service') return true;
  return isPrestationHeureUnite(line?.unite);
}

module.exports = isPrestationLine;
