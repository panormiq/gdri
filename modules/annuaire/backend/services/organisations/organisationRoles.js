/**
 * FICHIER : modules/annuaire/backend/services/organisations/organisationRoles.js
 */

const ROLES = new Set(['prospect', 'client', 'fournisseur', 'partenaire', 'interne', 'boutique']);

function normalizeRoles(raw) {
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return [...new Set(list.map((r) => String(r || '').trim().toLowerCase()).filter((r) => ROLES.has(r)))];
}

module.exports = { ROLES, normalizeRoles };
