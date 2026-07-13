/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/omitContactsFromGderpiFields.js
 * RÔLE : Retire contacts d'un objet avant persistance GDERPI.
 */

function omitContactsFromGderpiFields(fields) {
  if (!fields || typeof fields !== 'object') return fields;
  const { contacts, ...rest } = fields;
  return rest;
}

module.exports = omitContactsFromGderpiFields;
