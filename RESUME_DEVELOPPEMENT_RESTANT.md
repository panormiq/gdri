# 📋 Résumé - Ce qu'il reste à développer

**Date :** 2024-12-19

---

## ✅ **Fonctionnalités terminées récemment**

- ✅ Système de templates documentaires (création, chargement, suppression)
- ✅ Création de documents depuis un template
- ✅ Copie automatique des images lors de la création depuis un template
- ✅ Normalisation des accents dans les noms de templates (é → e)
- ✅ Page d'accueil avec 3 options : créer depuis Word, nouveau modèle, charger existant

---

## 🎯 **PRIORITÉ 1 : Système de templates et sections**

### Frontend - Panel "Disponible"
- [ ] **11** - Créer panel 'Disponible' dans vue Card (sous panel Options)
- [ ] **12** - Afficher liste des templates sauvegardés dans panel 'Disponible' (filtre par scope)
- [ ] **13** - Boutons dans header panel 'Disponible' (Créer, Importer)
- [ ] **16** - Fonction pour générer namespace automatiquement (template:section)
- [ ] **17** - Fonction pour ajouter template depuis panel 'Disponible' au document

### Gestion des propriétés de sections
- [ ] **18** - Gestion choix multiple (sélection variante)
- [ ] **19** - Gestion duplication section (allowMultiple)

---

## 🎯 **PRIORITÉ 2 : Page de gestion des modèles**

- [ ] **20** - Page models.php pour gestion complète des templates
- [ ] **21** - Interface création/édition template dans models.php
- [ ] **22** - Gestion champs/models (ajouter/modifier/supprimer)
- [ ] **23** - Gestion variantes (pour choix multiple)
- [ ] **24** - Prévisualisation template dans models.php
- [ ] **25** - Option standalone (activer/désactiver)

---

## 🎯 **PRIORITÉ 3 : Système de variables**

### Variables de base
- [ ] **26** - Frontend - Système de variables (syntaxe {{variable}} dans le contenu)
- [ ] **27** - Backend - Logique de rendu avec variables (remplacement {{variable}})

### Variables d'images (NOUVEAU)
- [ ] **35** - Frontend - Transformer une image en variable (système de variables pour images)
- [ ] **36** - Backend - Gestion des images en tant que variables dans les templates

---

## 🎯 **PRIORITÉ 4 : Logique backend avancée**

- [ ] **28** - Backend - Logique standalone vs héritage (canvas)
- [ ] **29** - Backend - Logique de sauvegarde automatique des templates lors de la sauvegarde du document
- [ ] **30** - Backend - Logique de reconstruction du document depuis les templates sauvegardés

---

## 📊 **Résumé par catégorie**

### **Frontend** (13 tâches restantes)
- Panel "Disponible" : 5 tâches
- Page models.php : 5 tâches  
- Variables : 1 tâche
- Images en variables : 1 tâche
- Propriétés sections : 2 tâches

### **Backend** (4 tâches restantes)
- Variables : 1 tâche
- Images en variables : 1 tâche
- Logique templates : 3 tâches

### **Total : 17 tâches restantes**

---

## 🚀 **Ordre d'implémentation suggéré**

### **Phase 1 : Panel "Disponible" (tâches 11-17)**
1. Créer le panel "Disponible" sous Options
2. Afficher les templates disponibles
3. Permettre d'ajouter une section depuis un template
4. Gérer les propriétés (choix multiple, duplication)

### **Phase 2 : Gestion des modèles (tâches 20-25)**
1. Créer la page models.php
2. Interface de création/édition de templates
3. Gestion des champs et variantes

### **Phase 3 : Variables (tâches 26-27, 35-36)**
1. Système de variables texte
2. Système de variables images
3. Rendu avec remplacement

### **Phase 4 : Backend avancé (tâches 28-30)**
1. Logique standalone vs héritage
2. Sauvegarde automatique des templates
3. Reconstruction depuis templates

---

## 📝 **Notes importantes**

- **Tâches annulées** : 14 et 15 (sauvegarde manuelle de sections) - la sauvegarde est maintenant automatique
- **Tâche 35-36** : Nouvelle fonctionnalité demandée - transformer une image en variable
- Tous les templates sont maintenant sauvegardés automatiquement avec les sections lors de la création du template document

---

**Dernière mise à jour :** 2024-12-19



