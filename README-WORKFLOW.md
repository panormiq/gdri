# 🔄 Workflow Git - Développement vs Production

## 📋 Vue d'ensemble

Ce projet utilise un workflow **Git Flow** pour séparer le développement de la production.

## 🌿 Branches

### `master` (Production)
- **Rôle** : Code en production sur www.gdri.fr
- **Règle** : Ne jamais modifier directement, uniquement via merge
- **Protection** : Toujours tester avant de merger

### `develop` (Développement)
- **Rôle** : Branche de développement principale
- **Règle** : Tous les développements passent par ici
- **Usage** : Travailler quotidiennement sur cette branche

### `feature/*` (Fonctionnalités)
- **Rôle** : Nouvelles fonctionnalités en cours
- **Exemple** : `feature/nouvelle-page`, `feature/integration-api`
- **Usage** : Créer une branche pour chaque nouvelle fonctionnalité

### `hotfix/*` (Corrections urgentes)
- **Rôle** : Corrections urgentes en production
- **Exemple** : `hotfix/bug-critique`, `hotfix/security-fix`
- **Usage** : Pour corriger rapidement la production sans attendre develop

## 🚀 Workflow quotidien

### Développement normal

```bash
# 1. Se mettre sur develop
git checkout develop

# 2. Récupérer les dernières modifications
git pull origin develop

# 3. Créer une branche feature (optionnel, ou travailler directement sur develop)
git checkout -b feature/ma-fonctionnalite

# 4. Développer, modifier, tester...
# ...

# 5. Commit
git add .
git commit -m "Ajout: description de la fonctionnalité"

# 6. Push sur develop
git push origin develop
# OU si vous êtes sur une feature:
git checkout develop
git merge feature/ma-fonctionnalite
git push origin develop
```

### Mise en production (quand tout est prêt et testé)

```bash
# 1. S'assurer que develop est à jour et testé
git checkout develop
git pull origin develop

# 2. Tester en local que tout fonctionne
# ...

# 3. Se mettre sur master
git checkout master

# 4. Fusionner develop dans master
git merge develop

# 5. Push vers production
git push origin master
```

### Correction urgente en production

```bash
# 1. Créer une branche hotfix depuis master
git checkout master
git pull origin master
git checkout -b hotfix/correction-urgente

# 2. Corriger le problème
# ...

# 3. Commit
git add .
git commit -m "Fix: description de la correction"

# 4. Fusionner dans master (production)
git checkout master
git merge hotfix/correction-urgente
git push origin master

# 5. Fusionner aussi dans develop (pour ne pas perdre la correction)
git checkout develop
git merge hotfix/correction-urgente
git push origin develop
```

## 📝 Règles d'or

1. ✅ **TOUJOURS** travailler sur `develop` pour le développement
2. ✅ **TOUJOURS** tester en local avant de merger dans `master`
3. ✅ **JAMAIS** modifier directement `master` (sauf hotfix)
4. ✅ **TOUJOURS** merger les hotfix dans `develop` aussi
5. ✅ **TOUJOURS** commit régulièrement avec des messages clairs

## 🔍 Commandes utiles

```bash
# Voir toutes les branches
git branch -a

# Voir sur quelle branche on est
git branch

# Changer de branche
git checkout nom-branche

# Voir les différences entre develop et master
git diff develop..master

# Voir l'historique
git log --oneline --graph --all
```

## 🎯 Résumé

- **Développement quotidien** → `develop`
- **Mise en production** → Merge `develop` → `master`
- **Correction urgente** → `hotfix/*` → Merge dans `master` ET `develop`

