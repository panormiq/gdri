/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/isPmAvailable.js
 * RÔLE : Vérifie si le module PM est chargé (compatibilité optionnelle).
 */

const path = require('path');

let cached = null;

function isPmAvailable() {
  if (cached !== null) return cached;
  const listCardsPath = path.join(
    __dirname,
    '../../../../pm/backend/services/cards/listCards.js'
  );
  cached = require('fs').existsSync(listCardsPath);
  return cached;
}

module.exports = isPmAvailable;
