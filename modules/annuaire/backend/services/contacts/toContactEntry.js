/**
 * FICHIER : modules/annuaire/backend/services/contacts/toContactEntry.js
 */

const normalizeContact = require('./normalizeContact');

function iso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function toContactEntry(doc, extra = {}) {
  if (!doc) return null;
  const n = normalizeContact(doc);
  return {
    ...n,
    contactId: n.id,
    displayName: `${n.prenom} ${n.nom}`.trim() || n.email || 'Contact',
    organisationName: extra.organisationName || doc.organisationName || '',
    serviceLabel: extra.serviceLabel || doc.serviceLabel || n.serviceLibelle || '',
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt)
  };
}

module.exports = toContactEntry;
