/**
 * FICHIER : modules/pm/backend/services/integrations/annuaire/isAnnuaireAvailable.js
 */

const path = require('path');
const fs = require('fs');

let cached = null;

function isAnnuaireAvailable() {
  if (cached !== null) return cached;
  const p = path.join(
    __dirname,
    '../../../../../annuaire/backend/services/contacts/createContactFromEmail.js'
  );
  cached = fs.existsSync(p);
  return cached;
}

module.exports = isAnnuaireAvailable;
