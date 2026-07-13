/**
 * FICHIER : modules/annuaire/backend/services/organisations/normalizeOrganisation.js
 */

const crypto = require('crypto');
const { normalizeRoles } = require('./organisationRoles');

const SCOPES = new Set(['interne', 'externe']);
const TYPES = new Set(['entreprise', 'particulier']);

function normalizeOrganisation(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const scopeRaw = String(o.scope || 'externe').trim().toLowerCase();
  const typeRaw = String(o.type || 'entreprise').trim().toLowerCase();
  return {
    id: String(o.id || o.organisationId || '').trim() || crypto.randomUUID(),
    raisonSociale: String(o.raisonSociale || o.nom || '').trim(),
    prenom: String(o.prenom || '').trim(),
    nom: String(o.nom || '').trim(),
    type: TYPES.has(typeRaw) ? typeRaw : 'entreprise',
    scope: SCOPES.has(scopeRaw) ? scopeRaw : 'externe',
    roles: normalizeRoles(o.roles),
    siret: String(o.siret || '').trim(),
    formeJuridique: String(o.formeJuridique || '').trim(),
    tvaIntracommunautaire: String(o.tvaIntracommunautaire || '').trim(),
    rcs: String(o.rcs || '').trim(),
    capitalSocial: String(o.capitalSocial || '').trim(),
    adresse: String(o.adresse || '').trim(),
    adresseComplement: String(o.adresseComplement || '').trim(),
    codePostal: String(o.codePostal || '').trim(),
    ville: String(o.ville || '').trim(),
    pays: String(o.pays || 'France').trim() || 'France',
    email: String(o.email || '').trim(),
    telephone: String(o.telephone || '').trim(),
    siteWeb: String(o.siteWeb || '').trim(),
    logo: String(o.logo || o.logoUrl || '').trim(),
    notes: String(o.notes || '').trim(),
    identitySource: String(o.identitySource || 'bootstrap').trim() === 'client' ? 'client' : 'bootstrap',
    isPrimaryCompany: o.isPrimaryCompany === true,
    isOwnEntity: o.isOwnEntity === true,
    gderpiClientId: o.gderpiClientId != null ? String(o.gderpiClientId).trim() || null : null,
    gderpiFournisseurId: o.gderpiFournisseurId != null ? String(o.gderpiFournisseurId).trim() || null : null,
    gderpiBoutiqueId: o.gderpiBoutiqueId != null ? String(o.gderpiBoutiqueId).trim() || null : null,
    createdAt: o.createdAt || null,
    updatedAt: o.updatedAt || null
  };
}

module.exports = normalizeOrganisation;
