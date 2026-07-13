/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/columnForCommandeStatut.js
 * RÔLE : Colonne Kanban cible selon statut commande client GDERPI.
 */

function columnForCommandeStatut(statut) {
  const s = String(statut || '').toLowerCase();
  if (s === 'annulee') return 'termine';
  if (s === 'facturee') return 'termine';
  if (['validee_client', 'a_valider_gdri', 'validee_gdri'].includes(s)) return 'en_cours';
  if (['achats_en_cours', 'attente_livraison_frs', 'a_livrer', 'livree', 'a_facturer'].includes(s)) {
    return 'en_cours';
  }
  return 'en_cours';
}

module.exports = columnForCommandeStatut;
