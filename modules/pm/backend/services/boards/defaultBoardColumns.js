/**
 * FICHIER : modules/pm/backend/services/boards/defaultBoardColumns.js
 * RÔLE : Colonnes Kanban par défaut du tableau PM.
 */

function defaultBoardColumns() {
  return [
    { id: 'inbox', label: 'À traiter', order: 0, kind: 'inbox' },
    { id: 'qualification', label: 'Qualification', order: 1, kind: 'qualification' },
    { id: 'devis', label: 'Devis', order: 2, kind: 'devis' },
    { id: 'en_cours', label: 'En cours', order: 3, kind: 'execution' },
    { id: 'termine', label: 'Terminé', order: 4, kind: 'done' }
  ];
}

module.exports = defaultBoardColumns;
