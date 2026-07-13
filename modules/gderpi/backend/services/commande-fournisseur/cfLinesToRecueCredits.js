/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/cfLinesToRecueCredits.js
 * RÔLE : Convertit les lignes CF en crédits quantiteRecueFrs pour la commande client.
 */

function cfLinesToRecueCredits(commandeFournisseur) {
  const cf = commandeFournisseur && typeof commandeFournisseur === 'object' ? commandeFournisseur : {};
  const statut = String(cf.statut || '');
  const lines = Array.isArray(cf.lignes) ? cf.lignes : [];

  return lines.map((line) => {
    const recue = Number(line?.quantiteRecue) || 0;
    const qty = recue > 0
      ? recue
      : (statut === 'recue' ? Number(line?.quantite) || 0 : 0);
    return { ...line, quantite: qty };
  }).filter((line) => Number(line.quantite) > 0);
}

module.exports = cfLinesToRecueCredits;
