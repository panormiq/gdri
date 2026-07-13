/**
 * FICHIER : modules/gderpi/backend/services/devis/updateDevis.js
 * RÔLE : Met à jour un devis brouillon (lignes, client, objet).
 *
 * ENTRÉES : db, entrepriseId, devisId, patch
 * SORTIES : Devis mis à jour
 *
 * DÉPEND DE : getDevisById.js, normalizeDevis.js, calculateDevisTotals.js, toDevisEntry.js
 * NE PAS : changement de statut (changeDevisStatus)
 *
 * APPELÉ PAR : devisController
 */

const getDevisById = require('./getDevisById');
const normalizeDevisLine = require('./normalizeDevisLine');
const normalizeDevisContact = require('./normalizeDevisContact');
const normalizeDevisEmetteurContact = require('./normalizeDevisEmetteurContact');
const calculateDevisTotals = require('./calculateDevisTotals');
const toDevisEntry = require('./toDevisEntry');
const normalizeDevis = require('./normalizeDevis');

const COLLECTION = 'gderpi_devis';

async function updateDevis(db, entrepriseId, devisId, patch) {
  const existing = await getDevisById(db, entrepriseId, devisId);
  if (!existing) throw new Error('Devis introuvable');
  if (existing.statut !== 'brouillon') {
    throw new Error('Seuls les devis en brouillon sont modifiables');
  }

  const p = patch && typeof patch === 'object' ? patch : {};
  const update = { updatedAt: new Date() };

  if (p.clientId !== undefined) update.clientId = p.clientId ? String(p.clientId).trim() : null;
  if (p.objet !== undefined) update.objet = String(p.objet || '').trim();
  if (p.notes !== undefined) update.notes = String(p.notes || '').trim();
  if (p.pmCardId !== undefined) update.pmCardId = p.pmCardId ? String(p.pmCardId).trim() : null;
  if (p.documentClient !== undefined || p.referenceClient !== undefined || p.contactClientId !== undefined
    || p.contactNom !== undefined || p.contactService !== undefined || p.contactFonction !== undefined
    || p.contactEmail !== undefined || p.contactTelephone !== undefined) {
    const contact = normalizeDevisContact({ ...existing, ...p });
    update.documentClient = contact.documentClient;
    update.referenceClient = contact.referenceClient;
    update.contactClientId = contact.contactClientId;
    update.contactNom = contact.contactNom;
    update.contactService = contact.contactService;
    update.contactFonction = contact.contactFonction;
    update.contactEmail = contact.contactEmail;
    update.contactTelephone = contact.contactTelephone;
  }
  if (p.emetteurContactId !== undefined || p.emetteurContactNom !== undefined
    || p.emetteurContactFonction !== undefined || p.emetteurContactEmail !== undefined
    || p.emetteurContactTelephone !== undefined) {
    const emetteur = normalizeDevisEmetteurContact({ ...existing, ...p });
    update.emetteurContactId = emetteur.emetteurContactId;
    update.emetteurContactNom = emetteur.emetteurContactNom;
    update.emetteurContactFonction = emetteur.emetteurContactFonction;
    update.emetteurContactEmail = emetteur.emetteurContactEmail;
    update.emetteurContactTelephone = emetteur.emetteurContactTelephone;
  }
  if (p.fraisPortHt !== undefined) {
    const frais = Number(p.fraisPortHt) || 0;
    update.fraisPortHt = frais > 0 ? Math.round(frais * 100) / 100 : 0;
  }
  if (p.fraisPortTauxTva !== undefined) {
    const tva = Number(p.fraisPortTauxTva);
    update.fraisPortTauxTva = Number.isFinite(tva) ? tva : 20;
  }

  if (p.conditionsPaiementMoyen !== undefined || p.conditionsPaiementEcheance !== undefined
    || p.conditionsPaiementComplement !== undefined || p.joindreCgvAnnexe !== undefined
    || p.cgvProfil !== undefined || p.afficherBonPourAccord !== undefined) {
    const merged = normalizeDevis({ ...existing, ...p });
    update.conditionsPaiementMoyen = merged.conditionsPaiementMoyen;
    update.conditionsPaiementEcheance = merged.conditionsPaiementEcheance;
    update.conditionsPaiementComplement = merged.conditionsPaiementComplement;
    update.joindreCgvAnnexe = merged.joindreCgvAnnexe;
    update.cgvProfil = merged.cgvProfil;
    update.afficherBonPourAccord = merged.afficherBonPourAccord;
  }

  const lignes = Array.isArray(p.lignes)
    ? p.lignes.map((l, i) => normalizeDevisLine(l, i))
    : existing.lignes;
  const fraisPortHt = update.fraisPortHt !== undefined ? update.fraisPortHt : (Number(existing.fraisPortHt) || 0);
  const fraisPortTauxTva = update.fraisPortTauxTva !== undefined
    ? update.fraisPortTauxTva
    : (Number.isFinite(Number(existing.fraisPortTauxTva)) ? Number(existing.fraisPortTauxTva) : 20);

  if (Array.isArray(p.lignes) || p.fraisPortHt !== undefined || p.fraisPortTauxTva !== undefined) {
    update.lignes = lignes;
    update.totaux = calculateDevisTotals(lignes, { fraisPortHt, fraisPortTauxTva });
    if (fraisPortHt <= 0) update.fraisPortTauxTva = 0;
  }

  const col = db.collection(COLLECTION);
  await col.updateOne(
    { entrepriseId: String(entrepriseId), devisId: String(devisId).trim() },
    { $set: update }
  );

  const doc = await col.findOne({ entrepriseId: String(entrepriseId), devisId: String(devisId).trim() });
  const entry = toDevisEntry(doc);

  if (entry.pmCardId) {
    try {
      const notifyPmFromDevis = require('../../integrations/pm-bridge/notifyPmFromDevis');
      await notifyPmFromDevis(db, entrepriseId, entry);
    } catch (_) {}
  }

  return entry;
}

module.exports = updateDevis;
