/**
 * Vue commande pour rendu PDF/HTML d'un avoir (lignes + totaux crédités).
 */

const buildFactureSnapshotLignes = require('./buildFactureSnapshotLignes');
const calculateDevisTotals = require('../devis/calculateDevisTotals');

function buildCommandeForAvoirRender(commande, facture, avoir) {
  if (!commande || !facture || !avoir) throw new Error('Avoir introuvable');

  const lignes = buildFactureSnapshotLignes(commande.lignes, avoir.lignes);
  const totaux = avoir.totaux && avoir.totaux.totalHt != null
    ? avoir.totaux
    : calculateDevisTotals(lignes);

  return {
    ...commande,
    avoirNumero: avoir.numero,
    avoirDate: avoir.date,
    avoirId: avoir.id,
    motif: avoir.motif || '',
    factureNumero: facture.numero,
    factureDate: facture.date,
    factureOrigineNumero: facture.numero,
    factureOrigineDate: facture.date,
    lignes,
    totaux
  };
}

module.exports = buildCommandeForAvoirRender;
