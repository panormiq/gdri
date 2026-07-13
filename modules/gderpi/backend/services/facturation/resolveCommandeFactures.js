/**
 * Retourne le tableau factures d'une commande (migration legacy facture unique).
 */

const normalizeFacture = require('./normalizeFacture');

function resolveCommandeFactures(commande) {
  const c = commande && typeof commande === 'object' ? commande : {};
  const commandeClientId = String(c.id || c.commandeClientId || '').trim();

  if (Array.isArray(c.factures) && c.factures.length) {
    return c.factures.map((f) => normalizeFacture(f, commandeClientId)).filter((f) => f.numero);
  }
  if (c.factureNumero) {
    const lignes = (Array.isArray(c.lignes) ? c.lignes : []).map((l) => ({
      id: String(l.id || '').trim(),
      quantite: Number(l.quantite) || 0
    })).filter((l) => l.id && l.quantite > 0);
    return [normalizeFacture({
      id: c.factureId || commandeClientId,
      numero: c.factureNumero,
      date: c.factureDate,
      payee: c.facturePayee,
      payeeAt: c.facturePayeeAt,
      lignes,
      totaux: c.totaux
    }, commandeClientId)];
  }
  return [];
}

module.exports = resolveCommandeFactures;
