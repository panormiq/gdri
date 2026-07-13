/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/requireAnnuaireForTiers.js
 * RÔLE : Refuse les opérations tiers GDERPI si le module Annuaire est absent.
 */

const isAnnuaireAvailable = require('./isAnnuaireAvailable');

function requireAnnuaireForTiers() {
  if (!isAnnuaireAvailable()) {
    throw new Error('Le module Annuaire est requis avec GDERPI — clients et contacts ne peuvent pas être dissociés');
  }
}

module.exports = requireAnnuaireForTiers;
