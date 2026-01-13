# Modifications pour le menu contextuel (clic droit) sur les colonnes

## Changements nécessaires

1. **Modifier le header du tableau** : Ajouter des classes et data-attributes sur les colonnes pour permettre le clic droit
2. **Ajouter le menu contextuel HTML** : Créer un menu contextuel avec les options "Ajouter" et "Supprimer"
3. **Ajouter les styles CSS** : Styles pour le menu contextuel
4. **Modifier le JavaScript** : 
   - Supprimer la référence au bouton `addColumnBtn` qui n'existe plus
   - Ajouter les événements de clic droit sur les colonnes
   - Gérer l'affichage/masquage du menu contextuel
   - Gérer les actions du menu (ajouter/supprimer colonne)

## Détails techniques

- Les colonnes du header auront une classe `column-header` et un `data-field-name` pour identifier la colonne
- Le menu contextuel s'affichera à la position du clic droit
- Les options du menu permettront d'ajouter une colonne (après celle cliquée) ou de supprimer la colonne cliquée


