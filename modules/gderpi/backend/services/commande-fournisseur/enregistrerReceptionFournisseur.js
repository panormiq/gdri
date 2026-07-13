/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/enregistrerReceptionFournisseur.js
 * RÔLE : Enregistre une réception partielle ou complète sur une commande fournisseur.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId, payload
 * SORTIES : CommandeFournisseur mise à jour
 *
 * DÉPEND DE : getCommandeFournisseurById.js, applyQuantiteRecueCfLignes.js, resolveCfStatutAfterReception.js
 * NE PAS : mettre à jour commande client
 *
 * APPELÉ PAR : enregistrerReceptionFournisseurCommande.js
 */

const getCommandeFournisseurById = require('./getCommandeFournisseurById');
const applyQuantiteRecueCfLignes = require('./applyQuantiteRecueCfLignes');
const resolveCfStatutAfterReception = require('./resolveCfStatutAfterReception');
const isCfEligibleReception = require('./isCfEligibleReception');
const remainingCfLineQty = require('../workflow/remainingCfLineQty');

const COLLECTION = 'gderpi_commandes_fournisseur';

function buildReceptionLignes(commandeFournisseur, payloadLignes, mode) {
  const remaining = (commandeFournisseur.lignes || []).filter((l) => remainingCfLineQty(l) > 0);
  if (!remaining.length) throw new Error('Aucune ligne restante à recevoir sur cette commande fournisseur');

  if (mode === 'complet' || !Array.isArray(payloadLignes) || !payloadLignes.length) {
    return remaining.map((l) => ({
      id: l.id,
      articleId: l.articleId,
      reference: l.reference,
      libelle: l.libelle,
      quantite: remainingCfLineQty(l)
    }));
  }

  const byId = new Map(remaining.map((l) => [String(l.id), l]));
  const lignes = [];
  payloadLignes.forEach((raw, i) => {
    const qty = Number(raw.quantite) || 0;
    if (qty <= 0) return;
    const lineId = String(raw.id || raw.lineId || '').trim();
    const source = lineId ? byId.get(lineId) : remaining.find((l) =>
      l.reference === String(raw.reference || '').trim() &&
      l.libelle === String(raw.libelle || '').trim()
    );
    if (!source) throw new Error('Ligne fournisseur introuvable : ' + (raw.libelle || lineId || i + 1));
    const maxQty = remainingCfLineQty(source);
    if (qty > maxQty + 0.0001) {
      throw new Error('Quantité reçue supérieure au reste pour « ' + (source.libelle || source.reference) + ' »');
    }
    lignes.push({
      id: source.id,
      articleId: source.articleId,
      reference: source.reference,
      libelle: source.libelle,
      quantite: qty
    });
  });
  if (!lignes.length) throw new Error('Indiquez au moins une quantité reçue');
  return lignes;
}

async function enregistrerReceptionFournisseur(db, entrepriseId, commandeFournisseurId, payload = {}) {
  const existing = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
  if (!existing) throw new Error('Commande fournisseur introuvable');
  if (!isCfEligibleReception(existing)) {
    throw new Error('Cette commande fournisseur n\'est pas en attente de réception');
  }

  const p = payload && typeof payload === 'object' ? payload : {};
  const mode = String(p.mode || '').trim().toLowerCase();
  const receptionLignes = buildReceptionLignes(existing, p.lignes, mode);
  const updatedLignes = applyQuantiteRecueCfLignes(existing.lignes, receptionLignes);
  const nextStatut = resolveCfStatutAfterReception({ ...existing, lignes: updatedLignes });
  const now = new Date();
  const notes = String(p.notes || '').trim();

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeFournisseurId: String(commandeFournisseurId).trim() },
    {
      $set: {
        lignes: updatedLignes,
        statut: nextStatut,
        updatedAt: now
      },
      $push: {
        historique: {
          statut: nextStatut,
          date: now,
          action: mode === 'complet' ? 'reception_complete' : 'reception_partielle',
          notes,
          lignes: receptionLignes
        }
      }
    }
  );

  return getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
}

module.exports = enregistrerReceptionFournisseur;
