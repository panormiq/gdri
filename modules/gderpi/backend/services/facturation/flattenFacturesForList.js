/**
 * Aplatit les factures d'une commande pour l'onglet facturation.
 */

const resolveCommandeFactures = require('./resolveCommandeFactures');
const enrichFactureSettlement = require('./enrichFactureSettlement');
const resolveFacturePositionLabel = require('./resolveFacturePositionLabel');

function flattenFacturesForList(commande) {
  const factures = resolveCommandeFactures(commande);
  if (!factures.length) return [];

  const cmdId = String(commande.id || commande.commandeClientId || '').trim();
  const facturesOnCommande = factures.length;

  return factures.map((raw) => {
    const f = enrichFactureSettlement(raw);
    const position = resolveFacturePositionLabel(commande, f.id);

    return {
      ...commande,
      commandeClientId: cmdId,
      facturesOnCommande,
      factureId: f.id,
      factureNumero: f.numero,
      factureDate: f.date,
      facturePayee: f.payee,
      facturePayeeAt: f.payeeAt,
      soldeeParAvoir: f.soldeeParAvoir,
      soldeeParAvoirAt: f.soldeeParAvoirAt,
      statutPaiement: f.statutPaiement,
      totalFactureTtc: f.totalFactureTtc,
      totalAvoirTtc: f.totalAvoirTtc,
      resteDuTtc: f.resteDuTtc,
      remboursementEnAttente: f.remboursementEnAttente,
      montantRemboursementEnAttente: f.montantRemboursementEnAttente,
      avoirRemboursementEnAttenteId: f.remboursementsEnAttente?.[0]?.id || null,
      factureAvoirs: f.avoirs,
      factureIndex: position.index,
      factureCount: position.count,
      factureNature: position.nature,
      facturePositionLabel: position.label,
      totaux: f.totaux && f.totaux.totalTtc != null ? f.totaux : commande.totaux
    };
  });
}

module.exports = flattenFacturesForList;
