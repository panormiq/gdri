/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/updateCommandeFournisseur.js
 * RÔLE : Met à jour une commande fournisseur (objet, notes, lignes, fournisseur en brouillon).
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
    update.totaux = calculateDevisTotals(lignes);
  } else if (supplierPatch && Array.isArray(existing.lignes)) {
    update.lignes = existing.lignes.map((l, i) => {
      const normalized = normalizeDevisLine(l, i);
      normalized.fournisseurId = headerFournisseurId;
      normalized.boutiqueFournisseurId = headerFournisseurBoutiqueId;
      return normalized;
    });
    update.totaux = calculateDevisTotals(update.lignes);
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeFournisseurId: String(commandeFournisseurId).trim() },
    { $set: update }
  );

  return getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
}

module.exports = updateCommandeFournisseur;
