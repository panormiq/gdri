/**
 * FICHIER : modules/gderpi/backend/services/besoins/besoinsToLignesFournisseur.js
 * RÔLE : Convertit des besoins ouverts en lignes de commande fournisseur.
 */

const normalizeDevisLine = require('../devis/normalizeDevisLine');

function besoinsToLignesFournisseur(besoins) {
  const open = (Array.isArray(besoins) ? besoins : []).filter((b) => String(b.statut) === 'ouvert');
  return open.map((b, i) => normalizeDevisLine({
    articleId: b.articleId,
    articleType: 'produit',
    reference: b.reference,
    referenceClient: b.referenceFournisseur,
    libelle: b.libelle,
    unite: b.unite,
    quantite: b.quantite,
    fournisseurId: b.fournisseurId,
    boutiqueFournisseurId: b.boutiqueFournisseurId,
    prixHt: b.prixAchatHt,
    remisePct: 0,
    tauxTva: 20
  }, i));
}

module.exports = besoinsToLignesFournisseur;
