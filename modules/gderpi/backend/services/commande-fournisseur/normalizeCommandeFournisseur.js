/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/normalizeCommandeFournisseur.js
 * RÔLE : Normalise un document commande fournisseur.
 *
 * ENTRÉES : raw objet
 * SORTIES : commande fournisseur normalisée
 *
 * DÉPEND DE : crypto, normalizeDevisLine.js, calculateDevisTotals.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createFromCommandeClient.js, toCommandeFournisseurEntry.js
 */

const crypto = require('crypto');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');

const STATUTS = new Set(['brouillon', 'envoyee', 'confirmee', 'partiellement_recue', 'recue', 'annulee']);

function normalizeCommandeFournisseur(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const lignesRaw = Array.isArray(c.lignes) ? c.lignes : [];
  const lignes = lignesRaw.map((l, i) => normalizeDevisLine(l, i));
  const fraisPortHt = Number(c.fraisPortHt) || 0;
  const fraisPortTauxTva = Number.isFinite(Number(c.fraisPortTauxTva))
    ? Number(c.fraisPortTauxTva)
    : 20;
  const totaux = c.totaux && typeof c.totaux === 'object'
    ? c.totaux
    : calculateDevisTotals(lignes, { fraisPortHt, fraisPortTauxTva });
  const statutRaw = String(c.statut || 'brouillon').trim().toLowerCase();

  return {
    id: String(c.id || c.commandeFournisseurId || '').trim() || crypto.randomUUID(),
    boutiqueId: String(c.boutiqueId || '').trim(),
    fournisseurId: c.fournisseurId != null ? String(c.fournisseurId).trim() || null : null,
    fournisseurBoutiqueId: c.fournisseurBoutiqueId != null ? String(c.fournisseurBoutiqueId).trim() || null : null,
    commandeClientId: c.commandeClientId != null ? String(c.commandeClientId).trim() || null : null,
    origine: String(c.origine || '').trim() || null,
    numero: String(c.numero || '').trim(),
    statut: STATUTS.has(statutRaw) ? statutRaw : 'brouillon',
    objet: String(c.objet || '').trim(),
    notes: String(c.notes || '').trim(),
    fraisPortHt: fraisPortHt > 0 ? Math.round(fraisPortHt * 100) / 100 : 0,
    fraisPortTauxTva: fraisPortHt > 0 ? fraisPortTauxTva : 0,
    lignes,
    totaux,
    historique: Array.isArray(c.historique) ? c.historique : [],
    createdAt: c.createdAt || null,
    updatedAt: c.updatedAt || null
  };
}

module.exports = normalizeCommandeFournisseur;
