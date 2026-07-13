/**
 * FICHIER : modules/gderpi/backend/services/devis/createDevis.js
 * RÔLE : Crée un devis en brouillon avec numérotation.
 *
 * ENTRÉES : db, entrepriseId, payload
 * SORTIES : Devis créé
 *
 * DÉPEND DE : ensureDevisIndexes.js, normalizeDevis.js, calculateDevisTotals.js, nextSequenceNumber.js, getBoutiqueById.js
 * NE PAS : mise à jour, workflow
 *
 * APPELÉ PAR : devisController
 */

const ensureDevisIndexes = require('./ensureDevisIndexes');
const normalizeDevis = require('./normalizeDevis');
const calculateDevisTotals = require('./calculateDevisTotals');
const nextSequenceNumber = require('../sequences/nextSequenceNumber');
const getBoutiqueById = require('../boutiques/getBoutiqueById');
const toDevisEntry = require('./toDevisEntry');

const COLLECTION = 'gderpi_devis';

async function createDevis(db, entrepriseId, data) {
  await ensureDevisIndexes(db);
  const normalized = normalizeDevis(data);
  if (!normalized.boutiqueId) throw new Error('Boutique requise');
  const boutique = await getBoutiqueById(db, entrepriseId, normalized.boutiqueId);
  if (!boutique) throw new Error('Boutique introuvable');

  const numero = await nextSequenceNumber(db, entrepriseId, normalized.boutiqueId, 'devis');
  const totaux = calculateDevisTotals(normalized.lignes, {
    fraisPortHt: normalized.fraisPortHt,
    fraisPortTauxTva: normalized.fraisPortTauxTva
  });
  const now = new Date();
  const validiteJours = Number(boutique.validiteDevisJours) || 30;
  const dateValidite = new Date(now);
  dateValidite.setDate(dateValidite.getDate() + validiteJours);

  const doc = {
    entrepriseId: String(entrepriseId),
    devisId: normalized.id,
    boutiqueId: normalized.boutiqueId,
    clientId: normalized.clientId,
    numero,
    statut: 'brouillon',
    objet: normalized.objet,
    notes: normalized.notes,
    documentClient: normalized.documentClient,
    referenceClient: normalized.referenceClient,
    contactClientId: normalized.contactClientId,
    contactNom: normalized.contactNom,
    contactService: normalized.contactService,
    contactFonction: normalized.contactFonction,
    contactEmail: normalized.contactEmail,
    contactTelephone: normalized.contactTelephone,
    emetteurContactId: normalized.emetteurContactId,
    emetteurContactNom: normalized.emetteurContactNom,
    emetteurContactFonction: normalized.emetteurContactFonction,
    emetteurContactEmail: normalized.emetteurContactEmail,
    emetteurContactTelephone: normalized.emetteurContactTelephone,
    conditionsPaiementMoyen: normalized.conditionsPaiementMoyen,
    conditionsPaiementEcheance: normalized.conditionsPaiementEcheance,
    conditionsPaiementComplement: normalized.conditionsPaiementComplement,
    joindreCgvAnnexe: normalized.joindreCgvAnnexe,
    cgvProfil: normalized.cgvProfil,
    afficherBonPourAccord: normalized.afficherBonPourAccord,
    dateValidite,
    fraisPortHt: normalized.fraisPortHt,
    fraisPortTauxTva: normalized.fraisPortTauxTva,
    lignes: normalized.lignes,
    totaux,
    historique: [{ statut: 'brouillon', date: now }],
    commandeClientId: null,
    commandeClientNumero: '',
    pmCardId: normalized.pmCardId || null,
    createdAt: now,
    updatedAt: now
  };

  await db.collection(COLLECTION).insertOne(doc);
  const entry = toDevisEntry(doc);

  if (entry.pmCardId) {
    try {
      const notifyPmFromDevis = require('../../integrations/pm-bridge/notifyPmFromDevis');
      await notifyPmFromDevis(db, entrepriseId, entry);
    } catch (_) {}
  }

  return entry;
}

module.exports = createDevis;
