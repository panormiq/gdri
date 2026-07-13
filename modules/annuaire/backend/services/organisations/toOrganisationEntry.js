/**
 * FICHIER : modules/annuaire/backend/services/organisations/toOrganisationEntry.js
 */

const normalizeOrganisation = require('./normalizeOrganisation');

function iso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function displayName(org) {
  if (org.type === 'particulier') {
    return `${org.prenom} ${org.nom}`.trim() || org.raisonSociale || 'Particulier';
  }
  return org.raisonSociale || `${org.prenom} ${org.nom}`.trim() || 'Organisation';
}

function toOrganisationEntry(doc) {
  if (!doc) return null;
  const n = normalizeOrganisation(doc);
  return {
    ...n,
    organisationId: n.id,
    displayName: displayName(n),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt)
  };
}

module.exports = toOrganisationEntry;
