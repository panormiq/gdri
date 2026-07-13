/**
 * FICHIER : modules/gderpi/backend/services/workflow/copyDevisLinesToCommande.js
 * RÔLE : Copie les lignes devis vers commande avec traçabilité sourceDevisLineId.
 *
 * ENTRÉES : lignes devis[]
 * SORTIES : lignes commande[]
 *
 * DÉPEND DE : normalizeDevisLine.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createFromDevis.js, createFromCommandeClient.js
 */

const crypto = require('crypto');
const normalizeDevisLine = require('../devis/normalizeDevisLine');

function copyDevisLinesToCommande(lignes) {
  const list = Array.isArray(lignes) ? lignes : [];
  return list.map((line, index) => {
    const normalized = normalizeDevisLine(line, index);
    return {
      ...normalized,
      id: crypto.randomUUID(),
      sourceDevisLineId: normalized.id
    };
  });
}

module.exports = copyDevisLinesToCommande;
