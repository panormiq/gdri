/**
 * FICHIER : modules/annuaire/backend/services/integrations/isGderpiAvailable.js
 */

const path = require('path');
const fs = require('fs');

let cached = null;

function isGderpiAvailable() {
  if (cached !== null) return cached;
  const p = path.join(__dirname, '../../../../gderpi/backend/services/clients/createClient.js');
  cached = fs.existsSync(p);
  return cached;
}

module.exports = isGderpiAvailable;
