/**
 * FICHIER : modules/pm/backend/services/integrations/isGderpiAvailable.js
 * RÔLE : Vérifie si le module GDERPI est chargé (compatibilité optionnelle).
 */

const path = require('path');

let cached = null;

function isGderpiAvailable() {
  if (cached !== null) return cached;
  const createDevisPath = path.join(
    __dirname,
    '../../../../gderpi/backend/services/devis/createDevis.js'
  );
  const fs = require('fs');
  cached = fs.existsSync(createDevisPath);
  return cached;
}

module.exports = isGderpiAvailable;
