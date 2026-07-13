/**
 * FICHIER : modules/gderpi/backend/services/devis/normalizeDevisLine.js
 * RÔLE : Normalise une ligne de devis / commande.
 *
 * ENTRÉES : raw ligne, index optionnel
 * SORTIES : ligne normalisée
 *
 * DÉPEND DE : crypto
 * NE PAS : persistance, calcul totaux
 *
 * APPELÉ PAR : normalizeDevis.js, copyDevisLinesToCommande.js
 */

const crypto = require('crypto');

function stableDevisLineId(raw, index) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const seed = [
    String(Number.isFinite(Number(index)) ? Number(index) : 0),
    String(l.sourceDevisLineId || l.devisLineId || l.lineId || (l._id != null ? String(l._id) : '') || ''),
    String(l.articleId || l.catalogId || ''),
    String(l.reference || ''),
    String(l.libelle || ''),
    String(l.unite || ''),
    String(l.prixHt ?? '')
  ].join('\u0001');
  const hex = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

function normalizeDevisLine(raw, index) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const qty = Number(l.quantite ?? l.qty ?? l.quantity ?? 1);
  const prixHt = Number(l.prixHt ?? l.prix ?? l.prixUnitaireHt);
  const remise = Number(l.remise ?? l.remisePct ?? 0);
  const tauxTva = Number(l.tauxTva ?? l.tva ?? 20);
  const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const prix = Number.isFinite(prixHt) ? prixHt : 0;
  const rem = Number.isFinite(remise) && remise >= 0 ? Math.min(remise, 100) : 0;
  const tva = Number.isFinite(tauxTva) ? tauxTva : 20;
  const montantHt = Math.round(q * prix * (1 - rem / 100) * 100) / 100;

  return {
    id: String(l.id || l.lineId || l.devisLineId || (l._id != null ? String(l._id) : '') || '').trim()
      || stableDevisLineId(l, index),
    articleId: l.articleId != null ? String(l.articleId || l.catalogId || '').trim() || null : null,
    articleType: String(l.articleType || l.type || '').trim(),
    reference: String(l.reference || '').trim(),
    referenceClient: String(l.referenceClient || l.refClient || '').trim(),
    referenceFournisseur: String(l.referenceFournisseur || l.refFournisseur || '').trim(),
    libelle: String(l.libelle || '').trim(),
    description: String(l.description || '').trim(),
    commentaire: String(l.commentaire || '').trim(),
    unite: String(l.unite || 'piece').trim(),
    quantite: q,
    prixHt: prix,
    remisePct: rem,
    tauxTva: tva,
    montantHt,
    fournisseurId: l.fournisseurId != null ? String(l.fournisseurId).trim() || null : null,
    boutiqueFournisseurId: l.boutiqueFournisseurId != null ? String(l.boutiqueFournisseurId).trim() || null : null,
    sourceDevisLineId: l.sourceDevisLineId != null ? String(l.sourceDevisLineId).trim() || null : null,
    ordre: Number.isFinite(Number(index)) ? Number(index) : (Number(l.ordre) || 0),
    quantiteLivree: Number.isFinite(Number(l.quantiteLivree)) && Number(l.quantiteLivree) > 0
      ? Math.round(Number(l.quantiteLivree) * 10000) / 10000
      : 0,
    quantiteRecueFrs: Number.isFinite(Number(l.quantiteRecueFrs)) && Number(l.quantiteRecueFrs) > 0
      ? Math.round(Number(l.quantiteRecueFrs) * 10000) / 10000
      : 0,
    quantiteRecue: Number.isFinite(Number(l.quantiteRecue)) && Number(l.quantiteRecue) > 0
      ? Math.round(Number(l.quantiteRecue) * 10000) / 10000
      : 0,
    quantiteFacturee: Number.isFinite(Number(l.quantiteFacturee)) && Number(l.quantiteFacturee) > 0
      ? Math.round(Number(l.quantiteFacturee) * 10000) / 10000
      : 0,
    recetteValideeAt: l.recetteValideeAt || null
  };
}

module.exports = normalizeDevisLine;
