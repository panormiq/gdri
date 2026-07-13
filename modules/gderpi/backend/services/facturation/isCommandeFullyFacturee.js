/**
 * Indique si toutes les lignes commandées sont entièrement facturées.
 */

const getQuantiteFactureeLine = require('./getQuantiteFactureeLine');

function isCommandeFullyFacturee(commande) {
  const lignes = Array.isArray(commande?.lignes) ? commande.lignes : [];
  if (!lignes.length) return false;
  return lignes.every((line) => {
    const ordered = Number(line.quantite) || 0;
    if (ordered <= 0) return true;
    return getQuantiteFactureeLine(commande, line.id) >= ordered - 0.0001;
  });
}

module.exports = isCommandeFullyFacturee;
