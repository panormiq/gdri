# Guide d'utilisation du Security Monitor

## 📋 Description

Le Security Monitor est un système de surveillance et d'alerte qui analyse les logs Apache pour détecter les attaques et envoie des notifications par email.

## 🚀 Installation et Configuration

### 1. Variables d'environnement

Créez un fichier `.env` à la racine du projet (ou ajoutez ces variables à votre fichier existant) :

```env
# Configuration SMTP pour les alertes
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
SMTP_FROM=security@gdri.fr

# Email de destination pour les alertes
SECURITY_ALERT_EMAIL=admin@gdri.fr
```

**Note pour Gmail :** Vous devez utiliser un "Mot de passe d'application" et non votre mot de passe habituel. Activez la validation en 2 étapes et générez un mot de passe d'application.

### 2. Configuration du monitoring

Le fichier `backend/security-monitor.js` contient la configuration par défaut :

```javascript
const CONFIG = {
  // Chemins des logs Apache
  accessLogPath: 'C:/xampp/apache/logs/gdri-ssl-access.log',
  errorLogPath: 'C:/xampp/apache/logs/gdri-ssl-error.log',
  
  // Email de destination pour les alertes
  alertEmail: process.env.SECURITY_ALERT_EMAIL || 'admin@gdri.fr',
  
  // Seuil d'alertes (nombre d'attaques avant d'envoyer une alerte)
  alertThreshold: 5, // Envoyer une alerte après 5 attaques
  
  // Intervalle de vérification (en millisecondes)
  checkInterval: 60000, // 1 minute
};
```

**Adaptez les chemins des logs** selon votre configuration Apache.

## 🎯 Utilisation

### Démarrer le monitoring

```bash
npm run security-monitor
```

Le monitoring démarre et vérifie les logs toutes les minutes. Les attaques détectées sont affichées dans la console et des alertes sont envoyées par email lorsque le seuil est atteint.

### Arrêter le monitoring

Appuyez sur `Ctrl+C` pour arrêter proprement le monitoring. L'état est sauvegardé automatiquement.

## 📊 Types d'attaques détectées

Le système détecte automatiquement :

1. **User-Agent suspects** : nikto, acunetix, sqlmap, havij, etc.
2. **Injection SQL** : union select, exec(), execute(), etc.
3. **XSS (Cross-Site Scripting)** : <script>, <embed>, <object>, <iframe>
4. **Accès fichiers sensibles** : .env, .git, .sql, backup, dump, etc.
5. **Traversée de répertoires** : ../, ..\\
6. **Méthodes HTTP suspectes** : TRACE, TRACK, DEBUG

## 📧 Format des alertes

Les alertes par email contiennent :

- **Nombre total d'attaques** détectées
- **Répartition par type d'attaque**
- **Adresses IP suspectes** avec le nombre d'attaques par IP
- **Détails des attaques** (tableau avec heure, IP, type, URI, User-Agent)

## ⚙️ Exécution en arrière-plan (Windows)

### Option 1 : Utiliser PM2 (recommandé)

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer le monitoring
pm2 start backend/security-monitor.js --name security-monitor

# Voir les logs
pm2 logs security-monitor

# Arrêter
pm2 stop security-monitor

# Démarrer au démarrage de Windows
pm2 startup
pm2 save
```

### Option 2 : Utiliser un service Windows

Créez un fichier `start-security-monitor.bat` :

```batch
@echo off
cd /d C:\xampp\htdocs\gdri
node backend/security-monitor.js
```

Puis utilisez NSSM (Non-Sucking Service Manager) pour créer un service Windows :

```bash
# Télécharger NSSM depuis https://nssm.cc/download
# Installer le service
nssm install SecurityMonitor "C:\Program Files\nodejs\node.exe" "C:\xampp\htdocs\gdri\backend\security-monitor.js"
nssm set SecurityMonitor AppDirectory "C:\xampp\htdocs\gdri"
nssm start SecurityMonitor
```

## 🔍 Vérification des logs

Le système sauvegarde son état dans `backend/.security-monitor-state.json`. Ce fichier contient :

- La position de lecture dans les logs
- Le nombre d'attaques détectées
- La date de la dernière alerte

## 🛠️ Dépannage

### Le monitoring ne détecte pas d'attaques

1. Vérifiez que les chemins des logs sont corrects
2. Vérifiez que les logs Apache sont bien générés
3. Testez avec une attaque manuelle (ex: accéder à `https://www.gdri.fr/.env`)

### Les emails ne sont pas envoyés

1. Vérifiez les variables d'environnement SMTP
2. Vérifiez que le service Mail est correctement configuré
3. Consultez les logs de la console pour les erreurs

### Le monitoring consomme trop de ressources

1. Augmentez `checkInterval` (ex: 300000 pour 5 minutes)
2. Augmentez `alertThreshold` pour moins d'alertes
3. Limitez le nombre d'attaques conservées en mémoire

## 📝 Personnalisation

### Ajouter de nouveaux patterns d'attaque

Modifiez `CONFIG.attackPatterns` dans `backend/security-monitor.js` :

```javascript
attackPatterns: {
  userAgent: ['nouveau-bot', 'autre-scanner'],
  sqlInjection: ['nouveau-pattern'],
  // ...
}
```

### Modifier le format des alertes

Modifiez la méthode `sendAlert()` dans `backend/security-monitor.js` pour personnaliser le format de l'email.

## 🔐 Sécurité

- Les alertes contiennent des informations sensibles (IPs, URIs, User-Agents)
- Assurez-vous que l'email de destination est sécurisé
- Ne partagez pas les logs d'attaques publiquement
- Considérez l'ajout d'un chiffrement pour les emails d'alerte

## 📞 Support

En cas de problème, vérifiez :
1. Les logs de la console
2. Les logs Apache
3. La configuration SMTP
4. Les permissions des fichiers de logs


