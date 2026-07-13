/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/markCfLignesFullyReceived.js
 * RÔLE : Marque toutes les lignes CF comme entièrement reçues.
 */

function markCfLignesFullyReceived(lignes) {
  return (Array.isArray(lignes) ? lignes : []).map((line) => ({
    ...line,
    quantiteRecue: Math.round((Number(line?.quantite) || 0) * 10000) / 10000
  }));
}

module.exports = markCfLignesFullyReceived;
