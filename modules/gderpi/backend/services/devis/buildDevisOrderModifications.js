/**
 * Résumé des écarts entre devis source et commande confirmée par le client.
 */

const { formatMoney } = require('./applyDevisMailTemplate');

function normQty(v) {
  return Math.round((Number(v) || 0) * 10000) / 10000;
}

function buildDevisOrderModifications(devis, commande) {
  const devisLines = Array.isArray(devis?.lignes) ? devis.lignes : [];
  const cmdLines = Array.isArray(commande?.lignes) ? commande.lignes : [];
  const cmdBySource = new Map();

  cmdLines.forEach((line) => {
    const key = String(line.sourceDevisLineId || line.id || '').trim();
    if (key) cmdBySource.set(key, line);
  });

  const changes = [];

  devisLines.forEach((line) => {
    const id = String(line.id || '').trim();
    const cmdLine = cmdBySource.get(id);
    const devisQty = normQty(line.quantite);
    const cmdQty = cmdLine ? normQty(cmdLine.quantite) : 0;

    if (!cmdLine || cmdQty <= 0) {
      changes.push({
        type: 'removed',
        libelle: line.libelle || line.reference || 'Article',
        reference: line.reference || '',
        devisQty,
        commandeQty: 0
      });
      return;
    }

    if (devisQty !== cmdQty) {
      changes.push({
        type: 'qty_changed',
        libelle: line.libelle || line.reference || 'Article',
        reference: line.reference || '',
        devisQty,
        commandeQty: cmdQty
      });
    }
  });

  const devisTotaux = devis?.totaux || {};
  const cmdTotaux = commande?.totaux || {};

  return {
    changes,
    devisMontantTtc: formatMoney(devisTotaux.totalTtc ?? devisTotaux.ttc),
    commandeMontantTtc: formatMoney(cmdTotaux.totalTtc),
    hasChanges: changes.length > 0
  };
}

module.exports = buildDevisOrderModifications;
