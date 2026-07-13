/**
 * FICHIER : modules/gderpi/backend/services/clients/normalizeClient.js
 * RÔLE : Normalise un client (particulier ou entreprise).
 *
 * ENTRÉES : raw objet client
 * SORTIES : client normalisé
 *
 * DÉPEND DE : crypto, normalizeClientContact.js, normalizeClientAdresse.js, normalizeClientAddress.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createClient.js, updateClient.js, toClientEntry.js
 */

const crypto = require('crypto');
const normalizeClientAddress = require('./normalizeClientAddress');
const normalizeClientContact = require('./normalizeClientContact');
const normalizeClientAdresse = require('./normalizeClientAdresse');
const { MOYENS, ECHEANCES } = require('../devis/devisConditionsPaiementOptions');
const normalizeTierDocuments = require('../tiers/normalizeTierDocuments');

function buildContactsFromLegacy(c) {
  const list = Array.isArray(c.contacts) ? c.contacts.map(normalizeClientContact) : [];
  if (list.length) return list;

  const legacyNom = String(c.contactNom || '').trim();
  const legacyParts = legacyNom.split(/\s+/).filter(Boolean);
  const hasLegacy = legacyNom || c.contactFonction || c.email || c.telephone;
  if (!hasLegacy) return [];

  return [normalizeClientContact({
    prenom: legacyParts.length > 1 ? legacyParts[0] : '',
    nom: legacyParts.length > 1 ? legacyParts.slice(1).join(' ') : legacyNom,
    fonction: c.contactFonction,
    email: c.email,
    telephone: c.telephone,
    principal: true
  })];
}

function ensureSinglePrincipalContact(contacts) {
  const list = contacts.map(normalizeClientContact);
  if (!list.length) return list;
  const principalIdx = list.findIndex((ct) => ct.principal);
  const idx = principalIdx >= 0 ? principalIdx : 0;
  return list.map((ct, i) => ({ ...ct, principal: i === idx }));
}

function hasAddressContent(addr) {
  return Boolean(
    addr.adresse || addr.complement || addr.codePostal || addr.ville || addr.libelle
  );
}

function buildAdressesFromLegacy(c) {
  const list = Array.isArray(c.adresses) ? c.adresses.map(normalizeClientAdresse) : [];
  const filled = list.filter(hasAddressContent);
  if (filled.length) return filled;

  const legacyFlat = normalizeClientAddress({
    adresse: c.adresse,
    complement: c.adresseComplement,
    codePostal: c.codePostal,
    ville: c.ville,
    pays: c.pays
  });

  let facturation = normalizeClientAdresse({
    type: 'facturation',
    ...(c.adresseFacturation || {}),
    ...(!c.adresseFacturation?.adresse && legacyFlat.adresse ? legacyFlat : {})
  });

  const livraisonIdentique = c.livraisonIdentiqueFacturation !== false;
  let livraison = normalizeClientAdresse({
    type: 'livraison',
    ...(c.adresseLivraison || {})
  });

  const adresses = [];
  if (hasAddressContent(facturation)) adresses.push(facturation);
  if (!livraisonIdentique && hasAddressContent(livraison)) {
    adresses.push(livraison);
  }
  return adresses;
}

function pickAdresseByType(adresses, type) {
  return adresses.find((a) => a.type === type) || null;
}

/** Adresse typée, sinon générique, sinon première adresse renseignée (rétrocompat). */
function resolveAdresseForType(adresses, type) {
  const specific = pickAdresseByType(adresses, type);
  if (specific) return specific;
  const generic = pickAdresseByType(adresses, 'generique');
  if (generic) return { ...generic, type };
  const fallback = adresses.find(hasAddressContent);
  if (fallback) return { ...fallback, type };
  return null;
}

function normalizeClient(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const type = String(c.type || 'entreprise').trim() === 'particulier' ? 'particulier' : 'entreprise';

  const adresses = buildAdressesFromLegacy(c);
  const adresseFacturation = resolveAdresseForType(adresses, 'facturation')
    || normalizeClientAdresse({ type: 'facturation' });
  const livraisonSpecific = pickAdresseByType(adresses, 'livraison');
  const adresseLivraison = livraisonSpecific
    || { ...adresseFacturation, type: 'livraison' };
  const livraisonIdentique = !livraisonSpecific;

  const contacts = ensureSinglePrincipalContact(buildContactsFromLegacy(c));
  const principal = contacts.find((ct) => ct.principal) || contacts[0] || null;
  const moyenRaw = String(c.conditionsPaiementMoyen || '').trim();
  const echeanceRaw = String(c.conditionsPaiementEcheance || '').trim();

  return {
    id: String(c.id || c.clientId || '').trim() || crypto.randomUUID(),
    type,
    raisonSociale: String(c.raisonSociale || '').trim(),
    prenom: String(c.prenom || '').trim(),
    nom: String(c.nom || '').trim(),
    siret: String(c.siret || '').trim(),
    tvaIntracommunautaire: String(c.tvaIntracommunautaire || '').trim(),
    siteWeb: String(c.siteWeb || '').trim(),
    adresses,
    adresseFacturation: normalizeClientAddress(adresseFacturation),
    adresseLivraison: normalizeClientAddress(adresseLivraison),
    livraisonIdentiqueFacturation: livraisonIdentique,
    contacts,
    adresse: adresseFacturation.adresse,
    adresseComplement: adresseFacturation.complement,
    codePostal: adresseFacturation.codePostal,
    ville: adresseFacturation.ville,
    pays: adresseFacturation.pays,
    telephone: principal?.telephone || String(c.telephone || '').trim(),
    email: principal?.email || String(c.email || '').trim(),
    contactNom: principal ? `${principal.prenom} ${principal.nom}`.trim() : String(c.contactNom || '').trim(),
    contactFonction: principal?.fonction || String(c.contactFonction || '').trim(),
    conditionsPaiementMoyen: MOYENS[moyenRaw] ? moyenRaw : '',
    conditionsPaiementEcheance: ECHEANCES[echeanceRaw] ? echeanceRaw : '',
    conditionsPaiementComplement: String(c.conditionsPaiementComplement || '').trim(),
    afficherBonPourAccordParDefaut: c.afficherBonPourAccordParDefaut === true,
    notes: String(c.notes || '').trim(),
    documents: normalizeTierDocuments(c.documents),
    annuaireOrganisationId: c.annuaireOrganisationId != null
      ? String(c.annuaireOrganisationId).trim() || null
      : null,
    createdAt: c.createdAt || null,
    updatedAt: c.updatedAt || null
  };
}

module.exports = normalizeClient;
