/**
 * FICHIER : modules/gderpi/backend/services/clients/normalizeClientContact.js
 * RÔLE : Normalise un contact rattaché à un client.
 *
 * ENTRÉES : raw objet contact
 * SORTIES : contact normalisé
 *
 * DÉPEND DE : crypto
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : normalizeClient.js
 */

const crypto = require('crypto');

function normalizeClientContact(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(c.id || c.contactId || '').trim() || crypto.randomUUID(),
    prenom: String(c.prenom || '').trim(),
    nom: String(c.nom || '').trim(),
    service: String(c.service || c.contactService || '').trim(),
    fonction: String(c.fonction || c.contactFonction || '').trim(),
    email: String(c.email || '').trim(),
    telephone: String(c.telephone || '').trim(),
    principal: c.principal === true
  };
}

module.exports = normalizeClientContact;
