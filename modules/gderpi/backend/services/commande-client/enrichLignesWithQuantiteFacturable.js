/**
 * Ajoute quantiteFacturee et quantiteFacturable aux lignes commande (API).
 */

const getQuantiteFactureeLine = require('../facturation/getQuantiteFactureeLine');
const getQuantiteFacturableLine = require('../facturation/getQuantiteFacturableLine');

function enrichLignesWithQuantiteFacturable(commande, lignes) {
  const cmd = commande && typeof commande === 'object' ? commande : {};
  return (Array.isArray(lignes) ? lignes : []).map((line) => ({
    ...line,
    quantiteFacturee: getQuantiteFactureeLine(cmd, line.id),
    quantiteFacturable: getQuantiteFacturableLine(cmd, line)
  }));
}

module.exports = enrichLignesWithQuantiteFacturable;
