/**
 * FICHIER : modules/gderpi/backend/services/commande-client/normalizeCommandeClient.js
 * RÔLE : Normalise un document commande client.
 *
 * ENTRÉES : raw objet
 * SORTIES : commande normalisée
 *
 * DÉPEND DE : crypto, normalizeDevisLine.js, calculateDevisTotals.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createFromDevis.js, toCommandeClientEntry.js
 */

const crypto = require('crypto');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const normalizeBesoin = require('../besoins/normalizeBesoin');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const { normalizeCommandeStatut } = require('../workflow/commandeClientStatuts');
const normalizeFacture = require('../facturation/normalizeFacture');
const resolveCommandeFactures = require('../facturation/resolveCommandeFactures');
const enrichFactureSettlement = require('../facturation/enrichFactureSettlement');
const normalizeDevisContact = require('../devis/normalizeDevisContact');
const normalizeDevisEmetteurContact = require('../devis/normalizeDevisEmetteurContact');

function normalizeCommandeClient(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const lignesRaw = Array.isArray(c.lignes) ? c.lignes : [];
  const lignes = lignesRaw.map((l, i) => normalizeDevisLine(l, i));
  const totaux = c.totaux && typeof c.totaux === 'object' ? c.totaux : calculateDevisTotals(lignes);
  const cmdId = String(c.id || c.commandeClientId || '').trim() || crypto.randomUUID();
  const factures = resolveCommandeFactures(c);
  const lastFacture = factures[factures.length - 1] || null;
  const contact = normalizeDevisContact(c);
  const emetteur = normalizeDevisEmetteurContact(c);

  return {
    id: cmdId,
    boutiqueId: String(c.boutiqueId || '').trim(),
    clientId: c.clientId != null ? String(c.clientId).trim() || null : null,
    devisId: c.devisId != null ? String(c.devisId).trim() || null : null,
    devisNumero: String(c.devisNumero || '').trim(),
    documentClient: String(c.documentClient || '').trim(),
    referenceClient: String(c.referenceClient || '').trim(),
    sansBonCommandeClient: String(c.referenceClient || '').trim() ? false : c.sansBonCommandeClient === true,
    contactClientId: contact.contactClientId,
    contactNom: contact.contactNom,
    contactService: contact.contactService,
    contactFonction: contact.contactFonction,
    contactEmail: contact.contactEmail,
    contactTelephone: contact.contactTelephone,
    emetteurContactId: emetteur.emetteurContactId,
    emetteurContactNom: emetteur.emetteurContactNom,
    emetteurContactFonction: emetteur.emetteurContactFonction,
    emetteurContactEmail: emetteur.emetteurContactEmail,
    emetteurContactTelephone: emetteur.emetteurContactTelephone,
    numero: String(c.numero || '').trim(),
    statut: normalizeCommandeStatut(c.statut),
    conformeAuDevis: c.conformeAuDevis === true,
    modifieeParClient: c.modifieeParClient === true,
    validationGdriRequise: c.validationGdriRequise === true,
    validationGdriAt: c.validationGdriAt || null,
    objet: String(c.objet || '').trim(),
    notes: String(c.notes || '').trim(),
    lignes,
    totaux,
    factureNumero: lastFacture?.numero || (c.factureNumero != null ? String(c.factureNumero).trim() || null : null),
    factureDate: lastFacture?.date || c.factureDate || null,
    facturePayee: lastFacture ? lastFacture.payee : c.facturePayee === true,
    facturePayeeAt: lastFacture?.payeeAt || c.facturePayeeAt || null,
    factures: factures.map((f) => enrichFactureSettlement(normalizeFacture(f, cmdId))),
    bonLivraisonId: c.bonLivraisonId != null ? String(c.bonLivraisonId).trim() || null : null,
    bonLivraisonNumero: c.bonLivraisonNumero != null ? String(c.bonLivraisonNumero).trim() || null : null,
    recetteValideeAt: c.recetteValideeAt || null,
    recetteNotes: String(c.recetteNotes || '').trim(),
    recetteLibelle: String(c.recetteLibelle || '').trim(),
    avancements: Array.isArray(c.avancements) ? c.avancements : [],
    besoins: Array.isArray(c.besoins) ? c.besoins.map(normalizeBesoin) : [],
    historique: Array.isArray(c.historique) ? c.historique : [],
    createdAt: c.createdAt || null,
    updatedAt: c.updatedAt || null
  };
}

module.exports = normalizeCommandeClient;
