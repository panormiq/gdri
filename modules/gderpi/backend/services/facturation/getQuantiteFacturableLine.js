/**
 * Quantité facturable maintenant sur une ligne (livré − déjà facturé).
 */

const getQuantiteFactureeLine = require('./getQuantiteFactureeLine');
const isDevServiceLine = require('./isDevServiceLine');
const lineRequiresRecette = require('../workflow/lineRequiresRecette');

function getQuantiteFacturableLine(commande, line) {
  if (!line) return 0;
  const ordered = Number(line.quantite) || 0;
  if (ordered <= 0) return 0;

  const facturee = getQuantiteFactureeLine(commande, line.id);
  const reste = Math.max(0, Math.round((ordered - facturee) * 10000) / 10000);
  if (reste <= 0) return 0;

  if (isDevServiceLine(line)) {
    if (line.recetteValideeAt) return reste;
    const livree = Number(line.quantiteLivree) || 0;
    if (livree > 0) {
      const dispo = Math.max(0, Math.round((livree - facturee) * 10000) / 10000);
      return Math.min(reste, dispo);
    }
    if (!lineRequiresRecette(line) && String(commande?.statut || '') !== 'prestation_en_cours') {
      return reste;
    }
    return 0;
  }

  const livree = Number(line.quantiteLivree) || 0;
  const dispo = Math.max(0, Math.round((livree - facturee) * 10000) / 10000);
  return Math.min(reste, dispo);
}

module.exports = getQuantiteFacturableLine;
