/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/gderpiContactsUnset.js
 * RÔLE : Opération Mongo pour ne plus stocker les contacts côté GDERPI.
 */

function gderpiContactsUnset() {
  return { contacts: '' };
}

module.exports = gderpiContactsUnset;
