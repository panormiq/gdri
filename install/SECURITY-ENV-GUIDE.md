# 🔒 Guide de Sécurité - Fichiers .env

## ✅ Protection actuelle

### 1. Fichier `.env` dans `.gitignore`
✅ **Le fichier `.env` est bien protégé** dans `.gitignore` (ligne 7)
- Il ne sera **jamais** commité dans Git
- Les secrets ne seront pas exposés dans le dépôt

### 2. Fichier `.env.example`
✅ **Un fichier `.env.example` existe** dans `backend/`
- Documente les variables nécessaires
- **Sans valeurs sensibles**
- Permet aux développeurs de savoir quelles variables configurer

## ⚠️ Bonnes pratiques de sécurité

### 1. Ne jamais commiter le `.env`
```bash
# Vérifier que .env n'est pas tracké
git status
# Si .env apparaît, il faut l'ajouter à .gitignore
```

### 2. Utiliser des mots de passe forts
- Minimum 16 caractères
- Mélange de majuscules, minuscules, chiffres, caractères spéciaux
- Ne pas réutiliser des mots de passe

### 3. Permissions du fichier `.env`
Sur Linux/Mac, restreindre les permissions :
```bash
chmod 600 backend/.env  # Lecture/écriture uniquement pour le propriétaire
```

Sur Windows, le fichier est protégé par défaut.

### 4. Rotation des secrets
- Changer régulièrement les mots de passe
- En cas de compromission, changer immédiatement tous les secrets

### 5. Variables d'environnement en production
En production, utilisez :
- **Gestionnaires de secrets** : AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
- **Variables d'environnement système** : plutôt que fichier `.env`
- **Docker secrets** : si vous utilisez Docker

## 🚨 Secrets hardcodés détectés

### ⚠️ Problème dans `backendIA/app/core/config.py`
Des secrets sont hardcodés dans le code :
- Mots de passe MongoDB
- Tokens de service
- Clés JWT

**Action recommandée :**
1. Déplacer tous les secrets vers un fichier `.env`
2. Utiliser `pydantic-settings` pour charger depuis `.env`
3. Supprimer les valeurs hardcodées du code

## 📋 Checklist de sécurité

- [x] `.env` dans `.gitignore`
- [x] `.env.example` créé (sans secrets)
- [ ] Secrets hardcodés supprimés du code
- [ ] Permissions du fichier `.env` restreintes (Linux/Mac)
- [ ] Rotation des secrets planifiée
- [ ] Gestionnaire de secrets en production (recommandé)

## 🔍 Vérification

Pour vérifier que votre `.env` n'est pas tracké par Git :
```bash
git ls-files | grep .env
# Ne doit rien retourner
```

Si quelque chose apparaît, c'est qu'un `.env` est tracké et doit être supprimé de Git :
```bash
git rm --cached backend/.env
git commit -m "Remove .env from tracking"
```
