/**

 * FICHIER : modules/gderpi/backend/services/fournisseurs/normalizeFournisseur.js

 * RÔLE : Normalise un fournisseur.

 *

 * ENTRÉES : raw objet fournisseur

 * SORTIES : fournisseur normalisé

 *

 * DÉPEND DE : crypto, normalizeClientContact.js, normalizeClientAdresse.js, devisConditionsPaiementOptions.js

 * NE PAS : persistance

 *

 * APPELÉ PAR : createFournisseur.js, updateFournisseur.js, toFournisseurEntry.js

 */



const crypto = require('crypto');

const normalizeClientContact = require('../clients/normalizeClientContact');

const normalizeClientAdresse = require('../clients/normalizeClientAdresse');
const normalizeTierDocuments = require('../tiers/normalizeTierDocuments');

const { MOYENS, ECHEANCES, labelMoyen, labelEcheance } = require('../devis/devisConditionsPaiementOptions');



function buildContactsFromLegacy(f) {

  const list = Array.isArray(f.contacts) ? f.contacts.map(normalizeClientContact) : [];

  if (list.length) return list;



  const legacyNom = String(f.contactNom || '').trim();

  const legacyParts = legacyNom.split(/\s+/).filter(Boolean);

  const hasLegacy = legacyNom || f.contactFonction || f.email || f.telephone;

  if (!hasLegacy) return [];



  return [normalizeClientContact({

    prenom: legacyParts.length > 1 ? legacyParts[0] : '',

    nom: legacyParts.length > 1 ? legacyParts.slice(1).join(' ') : legacyNom,

    fonction: f.contactFonction,

    email: f.email,

    telephone: f.telephone,

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



function buildAdressesFromLegacy(f) {

  const list = Array.isArray(f.adresses) ? f.adresses.map(normalizeClientAdresse) : [];

  const filled = list.filter(hasAddressContent);

  if (filled.length) return filled;



  const legacy = normalizeClientAdresse({

    type: 'generique',

    adresse: f.adresse,

    complement: f.adresseComplement,

    codePostal: f.codePostal,

    ville: f.ville,

    pays: f.pays

  });



  if (hasAddressContent(legacy)) return [legacy];

  return [];

}



function pickAdresseByType(adresses, type) {

  return adresses.find((a) => a.type === type) || null;

}



function resolveAdresseForType(adresses, type) {

  const specific = pickAdresseByType(adresses, type);

  if (specific) return specific;

  const generic = pickAdresseByType(adresses, 'generique');

  if (generic) return { ...generic, type };

  const fallback = adresses.find(hasAddressContent);

  if (fallback) return { ...fallback, type };

  return null;

}



function buildConditionsPaiementLabel(moyen, echeance, complement, legacy) {

  const legacyText = String(legacy || '').trim();

  const parts = [labelMoyen(moyen), labelEcheance(echeance), String(complement || '').trim()].filter(Boolean);

  if (parts.length) return parts.join(' — ');

  return legacyText;

}



function normalizeFournisseur(raw) {

  const f = raw && typeof raw === 'object' ? raw : {};

  const delai = Number(f.delaiLivraisonJours);



  const adresses = buildAdressesFromLegacy(f);

  const adressePrincipale = resolveAdresseForType(adresses, 'generique')

    || resolveAdresseForType(adresses, 'siege')

    || adresses.find(hasAddressContent)

    || normalizeClientAdresse({ type: 'generique' });



  const contacts = ensureSinglePrincipalContact(buildContactsFromLegacy(f));

  const principal = contacts.find((ct) => ct.principal) || contacts[0] || null;



  const moyenRaw = String(f.conditionsPaiementMoyen || '').trim();

  const echeanceRaw = String(f.conditionsPaiementEcheance || '').trim();

  const complement = String(f.conditionsPaiementComplement || '').trim();

  const conditionsPaiementMoyen = MOYENS[moyenRaw] ? moyenRaw : '';

  const conditionsPaiementEcheance = ECHEANCES[echeanceRaw] ? echeanceRaw : '';



  return {

    id: String(f.id || f.fournisseurId || '').trim() || crypto.randomUUID(),

    raisonSociale: String(f.raisonSociale || '').trim(),

    siret: String(f.siret || '').trim(),

    tvaIntracommunautaire: String(f.tvaIntracommunautaire || '').trim(),

    adresses,

    contacts,

    adresse: adressePrincipale.adresse,

    adresseComplement: adressePrincipale.complement,

    codePostal: adressePrincipale.codePostal,

    ville: adressePrincipale.ville,

    pays: adressePrincipale.pays,

    telephone: principal?.telephone || String(f.telephone || '').trim(),

    email: principal?.email || String(f.email || '').trim(),

    contactNom: principal ? `${principal.prenom} ${principal.nom}`.trim() : String(f.contactNom || '').trim(),

    contactFonction: principal?.fonction || String(f.contactFonction || '').trim(),

    conditionsPaiementMoyen,

    conditionsPaiementEcheance,

    conditionsPaiementComplement: complement,

    conditionsPaiement: buildConditionsPaiementLabel(

      conditionsPaiementMoyen,

      conditionsPaiementEcheance,

      complement,

      f.conditionsPaiement

    ),

    delaiLivraisonJours: Number.isFinite(delai) ? delai : null,

    notes: String(f.notes || '').trim(),

    documents: normalizeTierDocuments(f.documents),

    actif: f.actif !== false,

    annuaireOrganisationId: f.annuaireOrganisationId != null
      ? String(f.annuaireOrganisationId).trim() || null
      : null,

    createdAt: f.createdAt || null,

    updatedAt: f.updatedAt || null

  };

}



module.exports = normalizeFournisseur;

