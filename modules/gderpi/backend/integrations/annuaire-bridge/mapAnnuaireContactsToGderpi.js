/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/mapAnnuaireContactsToGderpi.js
 * RÔLE : Convertit des contacts Annuaire en contacts embarqués GDERPI.
 */

function mapAnnuaireContactsToGderpi(contacts) {
  return (Array.isArray(contacts) ? contacts : []).map((c) => ({
    id: c.contactId || c.id,
    prenom: c.prenom || '',
    nom: c.nom || '',
    fonction: c.fonction || '',
    email: c.email || '',
    telephone: c.telephone || '',
    service: c.serviceLibelle || c.serviceLabel || '',
    principal: c.principal === true
  }));
}

module.exports = mapAnnuaireContactsToGderpi;
