/**
 * FICHIER : modules/gderpi/backend/services/besoins/normalizeBesoin.js
 * RÔLE : Normalise un besoin d'achat lié à une commande client.
 */

const crypto = require('crypto');

const STATUTS = new Set(['ouvert', 'commande', 'annule']);

function normalizeBesoin(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const statutRaw = String(b.statut || 'ouvert').trim().toLowerCase();
  const qty = Number(b.quantite);
  const prix = Number(b.prixAchatHt);

  return {
    besoinId: String(b.besoinId || '').trim() || crypto.randomUUID(),
    articleId: b.articleId != null ? String(b.articleId).trim() || null : null,
    reference: String(b.reference || '').trim(),
    referenceFournisseur: String(b.referenceFournisseur || '').trim(),
    libelle: String(b.libelle || '').trim(),
    quantite: Number.isFinite(qty) && qty > 0 ? qty : 0,
    unite: String(b.unite || 'piece').trim(),
    fournisseurId: b.fournisseurId != null ? String(b.fournisseurId).trim() || null : null,
    boutiqueFournisseurId: b.boutiqueFournisseurId != null ? String(b.boutiqueFournisseurId).trim() || null : null,
    prixAchatHt: Number.isFinite(prix) ? prix : 0,
    statut: STATUTS.has(statutRaw) ? statutRaw : 'ouvert',
    commandeFournisseurId: b.commandeFournisseurId != null
      ? String(b.commandeFournisseurId).trim() || null
      : null,
    createdAt: b.createdAt || null
  };
}

module.exports = normalizeBesoin;
