# 🧪 Test d'envoi d'email du Security Monitor

## 📋 Description

Ce guide vous permet de tester la fonctionnalité d'envoi d'email du Security Monitor sans avoir besoin de détecter de vraies attaques.

## ✅ Prérequis

1. **Fichier `.env` configuré** à la racine du projet avec :
   ```env
   # Configuration SMTP
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=votre-email@gmail.com
   SMTP_PASS=votre-mot-de-passe-app
   SMTP_FROM=security@gdri.fr
   
   # Email de destination pour les alertes
   SECURITY_ALERT_EMAIL=admin@gdri.fr
   ```

2. **MongoDB démarré** (pour le service Mail)

3. **Node.js et npm installés**

## 🚀 Exécution du test

### Méthode 1 : Via npm (recommandé)

```powershell
npm run test-security-email
```

### Méthode 2 : Directement avec Node.js

```powershell
node backend/test-security-monitor-email.js
```

## 📧 Ce que fait le test

1. ✅ Vérifie que toutes les variables d'environnement sont configurées
2. ✅ Se connecte à MongoDB
3. ✅ Initialise le service Mail (comme le fait le Security Monitor)
4. ✅ Configure le module pour les alertes de sécurité
5. ✅ Crée des attaques de test (simulées)
6. ✅ Génère un rapport HTML (identique au format réel)
7. ✅ Envoie un email de test à l'adresse configurée

## 📬 Résultat attendu

Si tout fonctionne, vous devriez voir :

```
✅ Email envoyé avec succès !
   Message ID: <xxx>
   Status: sent

📬 Vérifiez votre boîte mail (et les spams) pour confirmer la réception.
```

**Important :** L'email de test contient le préfixe "🧪 TEST" dans le sujet et le contenu pour le distinguer des vraies alertes.

## ❌ Résolution des problèmes

### Erreur : Variables d'environnement manquantes

**Symptôme :**
```
❌ Variables d'environnement manquantes:
   - SMTP_HOST
   - SMTP_USER
```

**Solution :**
1. Créez un fichier `.env` à la racine du projet (`C:\xampp\htdocs\gdri\.env`)
2. Ajoutez toutes les variables requises (voir Prérequis)

### Erreur : Authentification SMTP (EAUTH)

**Symptôme :**
```
❌ Erreur lors du test:
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

**Solution pour Gmail :**
1. Activez la **validation en 2 étapes** sur votre compte Gmail
2. Générez un **"Mot de passe d'application"** :
   - Allez sur https://myaccount.google.com/apppasswords
   - Sélectionnez "Autre (nom personnalisé)" → "Security Monitor"
   - Copiez le mot de passe généré (16 caractères)
   - Utilisez ce mot de passe dans `SMTP_PASS` (pas votre mot de passe Gmail habituel)

**Solution pour autres serveurs SMTP :**
- Vérifiez vos identifiants `SMTP_USER` et `SMTP_PASS`
- Vérifiez que le compte email est actif

### Erreur : Connexion SMTP refusée (ECONNREFUSED)

**Symptôme :**
```
❌ Erreur lors du test:
Error: connect ECONNREFUSED
```

**Solution :**
1. Vérifiez `SMTP_HOST` et `SMTP_PORT`
2. Vérifiez votre connexion internet
3. Vérifiez que le pare-feu n'bloque pas le port SMTP (587 ou 465)
4. Pour Gmail : utilisez `smtp.gmail.com` avec le port `587`

### Erreur : Timeout (ETIMEDOUT)

**Symptôme :**
```
❌ Erreur lors du test:
Error: connect ETIMEDOUT
```

**Solution :**
1. Le serveur SMTP ne répond pas
2. Vérifiez `SMTP_HOST` et `SMTP_PORT`
3. Vérifiez que le serveur SMTP est accessible depuis votre réseau
4. Essayez avec un autre serveur SMTP (ex: Outlook, Yahoo)

### Erreur : MongoDB non connecté

**Symptôme :**
```
❌ Erreur de connexion MongoDB
```

**Solution :**
1. Démarrez MongoDB (via XAMPP Control Panel ou service Windows)
2. Vérifiez que MongoDB écoute sur le port 27017
3. Vérifiez les identifiants MongoDB dans `backend/config/database.js`

## 📝 Format de l'email de test

L'email de test contient :
- **Sujet :** `🧪 TEST - Alerte Sécurité - 2 attaque(s) détectée(s)`
- **Contenu :** Rapport HTML avec :
  - Nombre total d'attaques
  - Répartition par type d'attaque
  - Adresses IP suspectes
  - Tableau détaillé des attaques

## 🔍 Vérification après le test

1. **Vérifiez votre boîte mail** (et le dossier spam)
2. **Vérifiez le format** de l'email (HTML bien rendu)
3. **Vérifiez les informations** (IPs, types d'attaques, etc.)

Si l'email de test arrive correctement, le Security Monitor pourra envoyer des alertes réelles en cas d'attaques détectées.

## 🎯 Prochaines étapes

Une fois le test réussi :
1. Le Security Monitor est prêt à envoyer des alertes réelles
2. Les alertes seront envoyées automatiquement quand le seuil est atteint (5 attaques par défaut)
3. Vous pouvez démarrer le Security Monitor avec : `npm run security-monitor`

## 📞 Support

En cas de problème persistant :
1. Vérifiez les logs de la console
2. Vérifiez la configuration SMTP
3. Testez avec un autre client email (ex: Outlook, Thunderbird) pour vérifier que le serveur SMTP fonctionne
