/**
 * Vue commande pour rendu PDF/HTML d'une facture (lignes + totaux partiels).
 */

const buildFactureSnapshotLignes = require('./buildFactureSnapshotLignes');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const resolveFacturePositionLabel = require('./resolveFacturePositionLabel');

function buildCommandeForFactureRender(commande, facture) {
  if (!commande || !facture) throw new Error('Facture introuvable');
  const lignes = buildFactureSnapshotLignes(commande.lignes, facture.lignes);
  const totaux = facture.totaux && facture.totaux.totalHt != null
    ? facture.totaux
    : calculateDevisTotals(lignes);

  const position = resolveFacturePositionLabel(commande, facture.id);

  return {
    ...commande,
    factureNumero: facture.numero,
    factureDate: facture.date,
    facturePayee: facture.payee,
    factureId: facture.id,
    factureIndex: position.index,
    factureCount: position.count,
    factureNature: position.nature,
    facturePositionLabel: position.label,
    lignes,
    totaux
  };
}

module.exports = buildCommandeForFactureRender;
