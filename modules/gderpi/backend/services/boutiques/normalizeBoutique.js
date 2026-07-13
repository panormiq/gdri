/**
 * FICHIER : modules/gderpi/backend/services/boutiques/normalizeBoutique.js
 * RÔLE : Normalise un document boutique (paramétrage backoffice).
 *
 * ENTRÉES : raw objet boutique
 * SORTIES : boutique normalisée
 *
 * DÉPEND DE : crypto, makeBoutiqueSlug.js
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : createBoutique.js, updateBoutique.js, toBoutiqueEntry.js
 */

const crypto = require('crypto');
const makeBoutiqueSlug = require('./makeBoutiqueSlug');
const normalizeClientContact = require('../clients/normalizeClientContact');
const normalizeConditionsVenteBlocks = require('./normalizeConditionsVenteBlocks');
const resolveDevisConditions = require('../pdf/resolveDevisConditions');
const { normalizeBoutiqueDevise } = require('./boutiqueDeviseOptions');

function hasContactContent(contact) {
  return Boolean(
    contact.prenom || contact.nom || contact.fonction || contact.email || contact.telephone
  );
}

function ensureSinglePrincipalContact(contacts) {
  const list = contacts.map(normalizeClientContact);
  if (!list.length) return list;
  const principalIdx = list.findIndex((ct) => ct.principal);
  const idx = principalIdx >= 0 ? principalIdx : 0;
  return list.map((ct, i) => ({ ...ct, principal: i === idx }));
}

function buildContactsFromLegacy(b) {
  const list = Array.isArray(b.contacts) ? b.contacts.map(normalizeClientContact) : [];
  const filled = list.filter(hasContactContent);
  if (filled.length) return ensureSinglePrincipalContact(filled);

  const email = String(b.email || '').trim();
  const telephone = String(b.telephone || '').trim();
  if (!email && !telephone) return [];
  return [normalizeClientContact({
    nom: '',
    email,
    telephone,
    principal: true
  })];
}

function normalizeBoutique(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const nom = String(b.nom || '').trim();
  const slugRaw = String(b.slug || '').trim();
  const validite = Number(b.validiteDevisJours);
  const contacts = buildContactsFromLegacy(b);
  const principal = contacts.find((ct) => ct.principal) || contacts[0] || null;
  const email = principal?.email || String(b.email || '').trim();
  const telephone = principal?.telephone || String(b.telephone || '').trim();
  const conditionsVenteBlocks = normalizeConditionsVenteBlocks(b);
  const conditionsVente = String(b.conditionsVente || '').trim()
    || resolveDevisConditions({ conditionsVenteBlocks }, null).plainText;
  return {
    id: String(b.id || b.boutiqueId || '').trim() || crypto.randomUUID(),
    nom,
    slug: makeBoutiqueSlug(slugRaw || nom),
    actif: b.actif !== false,
    raisonSociale: String(b.raisonSociale || '').trim(),
    siret: String(b.siret || '').trim(),
    tvaIntracommunautaire: String(b.tvaIntracommunautaire || '').trim(),
    rcs: String(b.rcs || '').trim(),
    capital: String(b.capital || '').trim(),
    formeJuridique: String(b.formeJuridique || '').trim(),
    devise: normalizeBoutiqueDevise(b.devise),
    adresse: String(b.adresse || '').trim(),
    codePostal: String(b.codePostal || '').trim(),
    ville: String(b.ville || '').trim(),
    pays: String(b.pays || 'France').trim(),
    contacts,
    email,
    telephone,
    siteWeb: String(b.siteWeb || '').trim(),
    logoUrl: String(b.logoUrl || '').trim(),
    piedDePage: String(b.piedDePage || '').trim(),
    conditionsVenteBlocks,
    conditionsVente,
    validiteDevisJours: Number.isFinite(validite) && validite > 0 ? Math.round(validite) : 30,
    isPrincipale: b.isPrincipale === true,
    annuaireOrganisationId: b.annuaireOrganisationId != null
      ? String(b.annuaireOrganisationId).trim() || null
      : null,
    createdAt: b.createdAt || null,
    updatedAt: b.updatedAt || null
  };
}

module.exports = normalizeBoutique;
