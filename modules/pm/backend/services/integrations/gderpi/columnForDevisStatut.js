/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/columnForDevisStatut.js
 * RÔLE : Colonne Kanban cible selon statut devis GDERPI.
 */

function columnForDevisStatut(statut) {
  const s = String(statut || '').toLowerCase();
  if (s === 'brouillon') return 'devis';
  if (s === 'envoye') return 'devis';
  if (s === 'accepte') return 'en_cours';
  if (s === 'refuse' || s === 'expire') return 'termine';
  return 'devis';
}

module.exports = columnForDevisStatut;
