/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/isAnnuaireAvailable.js
 * RÔLE : Vérifie si le module Annuaire est installé.
 */

const path = require('path');
const fs = require('fs');

let cached = null;

function isAnnuaireAvailable() {
  if (cached !== null) return cached;
  const p = path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/createOrganisation.js'
  );
  cached = fs.existsSync(p);
  return cached;
}

module.exports = isAnnuaireAvailable;
