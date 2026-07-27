/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/updateCommandeFournisseur.js
 * RÔLE : Met à jour une commande fournisseur (objet, notes, lignes, frais de port, fournisseur en brouillon).
 */

const getCommandeFournisseurById = require('./getCommandeFournisseurById');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');

const COLLECTION = 'gderpi_commandes_fournisseur';
const EDITABLE_STATUTS = new Set(['brouillon', 'envoyee']);

async function updateCommandeFournisseur(db, entrepriseId, commandeFournisseurId, patch) {
  const existing = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
  if (!existing) throw new Error('Commande fournisseur introuvable');
  if (!EDITABLE_STATUTS.has(existing.statut)) {
    throw new Error('Cette commande fournisseur n\'est plus modifiable');
  }

  const p = patch && typeof patch === 'object' ? patch : {};
  const update = { updatedAt: new Date() };

  if (p.objet !== undefined) update.objet = String(p.objet || '').trim();
  if (p.notes !== undefined) update.notes = String(p.notes || '').trim();

  if (p.fraisPortHt !== undefined) {
    const frais = Number(p.fraisPortHt) || 0;
    update.fraisPortHt = frais > 0 ? Math.round(frais * 100) / 100 : 0;
  }
  if (p.fraisPortTauxTva !== undefined) {
    const tva = Number(p.fraisPortTauxTva);
    update.fraisPortTauxTva = Number.isFinite(tva) ? tva : 20;
  }

  let headerFournisseurId = existing.fournisseurId;
  let headerFournisseurBoutiqueId = existing.fournisseurBoutiqueId;

  const supplierPatch = p.fournisseurId !== undefined || p.fournisseurBoutiqueId !== undefined;
  if (supplierPatch) {
    if (existing.statut !== 'brouillon') {
      throw new Error('Le fournisseur n\'est modifiable qu\'en brouillon');
    }
    headerFournisseurId = p.fournisseurId != null ? String(p.fournisseurId).trim() || null : null;
    headerFournisseurBoutiqueId = p.fournisseurBoutiqueId != null
      ? String(p.fournisseurBoutiqueId).trim() || null
      : null;
    if (!headerFournisseurId && !headerFournisseurBoutiqueId) {
      throw new Error('Fournisseur requis');
    }
    update.fournisseurId = headerFournisseurId;
    update.fournisseurBoutiqueId = headerFournisseurBoutiqueId;
  }

  const fraisPortHt = update.fraisPortHt !== undefined
    ? update.fraisPortHt
    : (Number(existing.fraisPortHt) || 0);
  const fraisPortTauxTva = update.fraisPortTauxTva !== undefined
    ? update.fraisPortTauxTva
    : (Number.isFinite(Number(existing.fraisPortTauxTva)) ? Number(existing.fraisPortTauxTva) : 20);

  const needsTotals = Array.isArray(p.lignes)
    || p.fraisPortHt !== undefined
    || p.fraisPortTauxTva !== undefined
    || supplierPatch;

  if (Array.isArray(p.lignes)) {
    const existingById = new Map((existing.lignes || []).map((l) => [l.id, l]));
    const lignes = p.lignes.map((l, i) => {
      const normalized = normalizeDevisLine(l, i);
      const prev = existingById.get(normalized.id);
      if (prev && Number(prev.quantiteRecue) > 0) {
        normalized.quantiteRecue = prev.quantiteRecue;
      }
      normalized.fournisseurId = headerFournisseurId;
      normalized.boutiqueFournisseurId = headerFournisseurBoutiqueId;
      return normalized;
    });
    if (!lignes.length) throw new Error('Au moins une ligne requise');
    update.lignes = lignes;
  } else if (supplierPatch && Array.isArray(existing.lignes)) {
    update.lignes = existing.lignes.map((l, i) => {
      const normalized = normalizeDevisLine(l, i);
      normalized.fournisseurId = headerFournisseurId;
      normalized.boutiqueFournisseurId = headerFournisseurBoutiqueId;
      return normalized;
    });
  }

  if (needsTotals) {
    const lignes = update.lignes || existing.lignes || [];
    update.totaux = calculateDevisTotals(lignes, { fraisPortHt, fraisPortTauxTva });
    if (fraisPortHt <= 0) update.fraisPortTauxTva = 0;
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeFournisseurId: String(commandeFournisseurId).trim() },
    { $set: update }
  );

  return getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
}

module.exports = updateCommandeFournisseur;
