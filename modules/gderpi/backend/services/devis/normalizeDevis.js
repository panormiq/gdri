/**
 * FICHIER : modules/gderpi/backend/services/devis/normalizeDevis.js
 * RÔLE : Normalise un document devis (hors persistance).
 *
 * ENTRÉES : raw objet devis
 * SORTIES : devis normalisé
 *
 * DÉPEND DE : crypto, normalizeDevisLine.js, calculateDevisTotals.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : createDevis.js, updateDevis.js, toDevisEntry.js
 */

const crypto = require('crypto');
const normalizeDevisLine = require('./normalizeDevisLine');
const normalizeDevisContact = require('./normalizeDevisContact');
const normalizeDevisEmetteurContact = require('./normalizeDevisEmetteurContact');
const calculateDevisTotals = require('./calculateDevisTotals');
const { MOYENS, ECHEANCES } = require('./devisConditionsPaiementOptions');

const STATUTS = new Set(['brouillon', 'envoye', 'accepte', 'refuse', 'expire']);
const CGV_PROFILS = new Set(['auto', 'b2b', 'b2c']);

function normalizeDevis(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const lignesRaw = Array.isArray(d.lignes) ? d.lignes : [];
  const lignes = lignesRaw.map((l, i) => normalizeDevisLine(l, i));
  const fraisPortHt = Number(d.fraisPortHt) || 0;
  const fraisPortTauxTva = Number.isFinite(Number(d.fraisPortTauxTva))
    ? Number(d.fraisPortTauxTva)
    : 20;
  const totaux = d.totaux && typeof d.totaux === 'object'
    ? d.totaux
    : calculateDevisTotals(lignes, { fraisPortHt, fraisPortTauxTva });
  const statutRaw = String(d.statut || 'brouillon').trim().toLowerCase();
  const contact = normalizeDevisContact(d);
  const emetteurContact = normalizeDevisEmetteurContact(d);
  const moyenRaw = String(d.conditionsPaiementMoyen || '').trim();
  const echeanceRaw = String(d.conditionsPaiementEcheance || '').trim();
  const cgvProfilRaw = String(d.cgvProfil || 'auto').trim().toLowerCase();

  return {
    id: String(d.id || d.devisId || '').trim() || crypto.randomUUID(),
    boutiqueId: String(d.boutiqueId || '').trim(),
    clientId: d.clientId != null ? String(d.clientId).trim() || null : null,
    numero: String(d.numero || '').trim(),
    statut: STATUTS.has(statutRaw) ? statutRaw : 'brouillon',
    objet: String(d.objet || d.sujet || '').trim(),
    notes: String(d.notes || '').trim(),
    documentClient: contact.documentClient,
    referenceClient: contact.referenceClient,
    contactClientId: contact.contactClientId,
    contactNom: contact.contactNom,
    contactService: contact.contactService,
    contactFonction: contact.contactFonction,
    contactEmail: contact.contactEmail,
    contactTelephone: contact.contactTelephone,
    emetteurContactId: emetteurContact.emetteurContactId,
    emetteurContactNom: emetteurContact.emetteurContactNom,
    emetteurContactFonction: emetteurContact.emetteurContactFonction,
    emetteurContactEmail: emetteurContact.emetteurContactEmail,
    emetteurContactTelephone: emetteurContact.emetteurContactTelephone,
    dateValidite: d.dateValidite || null,
    conditionsPaiementMoyen: MOYENS[moyenRaw] ? moyenRaw : '',
    conditionsPaiementEcheance: ECHEANCES[echeanceRaw] ? echeanceRaw : '',
    conditionsPaiementComplement: String(d.conditionsPaiementComplement || '').trim(),
    joindreCgvAnnexe: d.joindreCgvAnnexe === true,
    cgvProfil: CGV_PROFILS.has(cgvProfilRaw) ? cgvProfilRaw : 'auto',
    afficherBonPourAccord: d.afficherBonPourAccord === true,
    lignes,
    fraisPortHt: fraisPortHt > 0 ? Math.round(fraisPortHt * 100) / 100 : 0,
    fraisPortTauxTva: fraisPortHt > 0 ? fraisPortTauxTva : 0,
    totaux,
    historique: Array.isArray(d.historique) ? d.historique : [],
    commandeClientId: d.commandeClientId != null ? String(d.commandeClientId).trim() || null : null,
    commandeClientNumero: String(d.commandeClientNumero || '').trim(),
    pmCardId: d.pmCardId != null ? String(d.pmCardId).trim() || null : null,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null
  };
}

module.exports = normalizeDevis;
