# TODO - Agent Documentaire

Fichier de suivi des fonctionnalités à implémenter et des points de réflexion en cours.

---

## ✅ Fonctionnalités terminées

### Export PDF
- [x] Ajout du bouton "Exporter PDF" dans l'interface
- [x] Route API backend `/document/:documentId/pdf`
- [x] Méthode `generatePdfFromHtml()` dans DocumentService
- [x] Génération PDF depuis HTML avec Puppeteer
- [x] Téléchargement automatique du PDF
- [x] Installation de Puppeteer
- [x] **Améliorations pixel perfect** :
  - [x] Conversion des images en base64 pour inclusion dans le PDF
  - [x] Utilisation des marges du document Word
  - [x] Attente du chargement complet des images
  - [x] Viewport optimisé pour rendu A4
  - [x] Styles CSS pour éviter les coupures de page
  - [x] Options de qualité (scale, format, etc.)

---

## 🚧 Fonctionnalités en cours

*Aucune pour le moment*

---

## 📋 Fonctionnalités à implémenter

### 1. Système de paramétrage / Canevas

**Objectif :** Normaliser les styles pour créer un canevas cohérent et unifier les marges/formatages.

#### Structure proposée dans le JSON :
```javascript
{
  canvas: {
    titles: {
      level1: { fontFamily, fontSize, fontWeight, color, marginTop, marginBottom, backgroundColor, ... },
      level2: { ... },
      level3: { ... }
    },
    paragraphs: {
      default: { fontFamily, fontSize, lineHeight, marginTop, marginBottom, textAlign, ... }
    },
    images: {
      default: { maxWidth, marginTop, marginBottom, border, borderRadius, ... }
    },
    annexes: {
      default: { ... }
    },
    pageMargins: { top, right, bottom, left },
    locked: {
      pageMargins: true,  // Propriétés verrouillées
      titles: { level1: { fontSize: true } }
    }
  }
}
```

#### Tâches :
- [ ] Créer la structure `canvas` dans le JSON du document
- [ ] Créer les modals de configuration :
  - [ ] Modal "Titres" (configuration par niveau)
  - [ ] Modal "Paragraphes"
  - [ ] Modal "Images"
  - [ ] Modal "Annexes"
- [ ] Afficher les modals avant le premier chargement (ou à la demande)
- [ ] Sauvegarder la configuration dans le JSON
- [ ] Appliquer le canevas lors du rendu HTML (au lieu des styles Word bruts)
- [ ] Système de verrous (propriétés non modifiables)
- [ ] Option "Édition du canevas" dans la vue actuelle
- [ ] Normalisation automatique : tous les éléments de même niveau ont le même CSS

#### Points de réflexion :
- Faut-il un système de "presets" de canevas (ex: "Standard", "Compact", "Large") ?
- Les modals s'affichent-ils uniquement au premier chargement ou à chaque fois qu'on veut modifier ?
- Comment gérer la migration des documents existants (sans canevas) ?

---

### 2. Édition des sections

**Objectif :** Permettre l'édition complète du contenu des sections (pas seulement le titre).

#### Tâches :
- [ ] Reconstruire les sections de manière plus propre :
  - [ ] `title` (déjà éditable)
  - [ ] `content[]` (paragraphes, images, tableaux) - éditable
  - [ ] `metadata` (auteur, date, tags, etc.)
  - [ ] `variables[]` (références aux variables du document)
- [ ] Interface d'édition :
  - [ ] Clic sur un élément → panneau de propriétés à droite
  - [ ] Édition inline (double-clic sur un paragraphe)
  - [ ] Bouton "Ajouter contenu" dans chaque section
- [ ] Réorganisation du contenu (drag & drop des paragraphes)

#### Points de réflexion :
- Voulez-vous une édition WYSIWYG complète ou plutôt des formulaires structurés ?
- Faut-il pouvoir réorganiser le contenu (drag & drop des paragraphes) ?

---

### 3. Système de variables

**Objectif :** Variables réutilisables dans tout le document (ex: modèle du bateau, moteur).

#### Structure proposée dans le JSON :
```javascript
{
  variables: {
    "modele_bateau": {
      type: "text",
      value: "Bateau XYZ-3000",
      occurrences: ["sec_123", "sec_456"]  // IDs des sections où elle est utilisée
    },
    "equipements": {
      type: "array",
      items: [
        { id: "eq_1", title: "Équipement A", description: "..." },
        { id: "eq_2", title: "Équipement B", description: "..." }
      ],
      occurrences: ["sec_789"]
    }
  }
}
```

#### Tâches :
- [ ] Créer la structure `variables` dans le JSON
- [ ] Panneau "Variables" dans la vue texte (colonne de droite ou modal)
- [ ] Interface de gestion :
  - [ ] Créer/éditer/supprimer des variables
  - [ ] Voir où chaque variable est utilisée
  - [ ] Auto-complétion lors de la saisie : `{{` → liste des variables
- [ ] Remplacement des variables dans le contenu :
  - [ ] Syntaxe : `{{nom_variable}}` dans les paragraphes
  - [ ] Remplacement automatique lors du rendu
- [ ] Variables tableau : gestion des items (ajout/suppression/modification)

#### Points de réflexion :
- Les variables doivent-elles être globales au document ou par section ?
- Faut-il un système de templates de variables (ex: "Équipement" avec champs prédéfinis) ?

---

### 4. Ajout de sections (Vue Cards + Sommaire)

**Objectif :** Permettre d'ajouter facilement des sections depuis la vue cards et le sommaire.

#### Vue Cards :
- [ ] Séparer en deux zones :
  - [ ] Haut : sections présentes (actuel)
  - [ ] Bas : sections disponibles à ajouter (bibliothèque de sections)
- [ ] Bibliothèque de sections :
  - [ ] Sections prédéfinies ou templates (ex: "Section Équipement", "Section Méthodologie")
  - [ ] Drag & drop depuis la bibliothèque vers les sections présentes

#### Sommaire :
- [ ] Bouton "+" à chaque niveau pour ajouter une section
- [ ] Améliorer le menu contextuel (clic droit) : "Ajouter section" (déjà présent)

#### Points de réflexion :
- La bibliothèque de sections doit-elle être partagée entre documents ou spécifique à chaque document ?
- Faut-il des templates de sections avec contenu pré-rempli ?

---

### 5. Système de tableaux automatiques

**Objectif :** Tableaux générés automatiquement à partir de variables/listes.

#### Exemple d'utilisation :
- Section "Équipements" avec variable `equipements[]`
- Paragraphe de résumé : "Le bateau dispose de {{equipements.length}} équipements : {{equipements.titles}}"
- Tableau automatique : défini dans le canevas, se remplit automatiquement avec les items de `equipements[]`

#### Structure proposée :
```javascript
{
  autoTables: {
    "equipements_table": {
      sourceVariable: "equipements",  // Variable tableau
      columns: [
        { field: "title", label: "Équipement" },
        { field: "description", label: "Description" }
      ],
      style: { ... }
    }
  }
}
```

#### Tâches :
- [ ] Créer la structure `autoTables` dans le canevas ou dans une section
- [ ] Interface de création de tableau automatique :
  - [ ] Sélectionner la variable source (tableau)
  - [ ] Définir les colonnes (champs à afficher)
  - [ ] Personnaliser le style
- [ ] Génération automatique du tableau lors du rendu
- [ ] Mise à jour automatique : ajout d'un équipement → tableau mis à jour
- [ ] Mise à jour du paragraphe de résumé automatique

#### Points de réflexion :
- Faut-il pouvoir personnaliser les colonnes du tableau ou utiliser une structure fixe ?
- Les tableaux automatiques doivent-ils être dans une section spécifique ou n'importe où ?

---

## 🔍 Points de réflexion généraux

### Architecture
- Comment gérer la migration des documents existants (sans canevas, sans variables) ?
- Faut-il un système de versioning pour le canevas (historique des modifications) ?
- Comment gérer les conflits si plusieurs utilisateurs modifient le même document ?

### Performance
- Le rendu HTML avec canevas sera-t-il assez rapide ?
- Faut-il mettre en cache le HTML généré ?
- Comment optimiser la génération PDF pour les gros documents ?

### UX/UI
- Comment rendre l'interface intuitive avec toutes ces fonctionnalités ?
- Faut-il un mode "expert" vs "simple" ?
- Comment gérer les erreurs de validation (ex: variable manquante) ?

---

## 📝 Notes de développement

### Ordre d'implémentation suggéré

**Phase 1 : Fondations**
1. ✅ Export PDF
2. Structure de canevas dans le JSON
3. Modals de configuration (affichage et sauvegarde)

**Phase 2 : Normalisation**
4. Application du canevas lors du rendu
5. Système de verrous
6. Édition du canevas

**Phase 3 : Variables**
7. Structure de variables dans le JSON
8. Interface de gestion des variables
9. Remplacement des variables dans le contenu

**Phase 4 : Édition avancée**
10. Édition du contenu des sections
11. Ajout de sections (bibliothèque)
12. Tableaux automatiques

---

## 🐛 Bugs connus

*Aucun pour le moment*

---

## 💡 Idées futures

- Export vers Word (régénération d'un .docx depuis le JSON)
- Collaboration en temps réel (multi-utilisateurs)
- Historique des modifications (versioning)
- Templates de documents réutilisables
- Intégration avec d'autres outils (ex: génération automatique de devis)

---

**Dernière mise à jour :** 2024-12-19

