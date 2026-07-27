/**
 * FICHIER : modules/annuaire/backend/services/contacts/normalizeContact.js
 */

const crypto = require('crypto');

function normalizeBoutiqueOrganisationIds(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach(function (item) {
    const id = String(item || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function normalizeContact(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const scopeRaw = String(c.scope || '').trim().toLowerCase();
  return {
    id: String(c.id || c.contactId || '').trim() || crypto.randomUUID(),
    organisationId: String(c.organisationId || '').trim(),
    serviceId: c.serviceId != null ? String(c.serviceId).trim() || null : null,
    serviceLibelle: String(c.serviceLibelle || c.service || '').trim(),
    prenom: String(c.prenom || '').trim(),
    nom: String(c.nom || '').trim(),
    fonction: String(c.fonction || c.contactFonction || '').trim(),
    email: String(c.email || '').trim().toLowerCase(),
    telephone: String(c.telephone || '').trim(),
    scope: scopeRaw === 'interne' ? 'interne' : (scopeRaw === 'externe' ? 'externe' : ''),
    principal: c.principal === true,
    userId: c.userId != null ? String(c.userId).trim() || null : null,
    ownerUserId: c.ownerUserId != null ? String(c.ownerUserId).trim() || null : null,
    createdByUserId: c.createdByUserId != null ? String(c.createdByUserId).trim() || null : null,
    notes: String(c.notes || '').trim(),
    boutiqueOrganisationIds: normalizeBoutiqueOrganisationIds(c.boutiqueOrganisationIds)
  };
}

module.exports = normalizeContact;
