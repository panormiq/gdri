# Protection contre les attaques SYN Flood

Ce guide explique comment mettre en place une protection complète contre les attaques SYN flood sur votre serveur GDRI.

## 📋 Vue d'ensemble

Une attaque SYN flood est une attaque réseau de bas niveau qui cible la couche TCP/IP. Elle consiste à envoyer un grand nombre de paquets SYN sans compléter le handshake TCP, saturant les ressources du serveur.

## 🛡️ Solution multi-niveaux

La protection est mise en place à 4 niveaux :

1. **Niveau système Windows** : Configuration TCP/IP et registre
2. **Niveau Apache** : Timeouts stricts et limitation des connexions
3. **Niveau applicatif Node.js** : Rate limiting et détection des connexions suspectes
4. **Monitoring** : Scripts de surveillance pour détecter les attaques

## 🚀 Installation

### Étape 1 : Configuration Windows (SYN cookies, registre)

**IMPORTANT : Exécuter en tant qu'administrateur**

```powershell
# Depuis le répertoire install/
PowerShell -ExecutionPolicy Bypass -File .\configure-syn-flood-protection.ps1
```

Ce script configure :
- ✅ SYN cookies (protection contre SYN flood)
- ✅ Paramètres TCP/IP optimisés
- ✅ Registre Windows (TcpMaxHalfOpen, SynAttackProtect, etc.)
- ✅ Timeouts TCP réduits

**⚠️ Note :** Un redémarrage du serveur peut être nécessaire pour que certaines modifications du registre prennent effet.

### Étape 2 : Configuration Apache

1. **Activer le module mod_reqtimeout** dans `C:\xampp\apache\conf\httpd.conf` :
   ```apache
   LoadModule reqtimeout_module modules/mod_reqtimeout.so
   ```

2. **Ajouter la configuration anti-SYN flood** :
   - Option A : Ajouter le contenu de `install/apache-syn-flood-config.conf` dans `httpd.conf` (global)
   - Option B : Ajouter dans chaque VirtualHost dans `httpd-vhosts.conf` (recommandé)

3. **Redémarrer Apache** depuis le XAMPP Control Panel

### Étape 3 : Installation des dépendances Node.js

```powershell
# Depuis la racine du projet
npm install
```

Cela installera :
- `express-rate-limit` : Rate limiting pour Express
- `rate-limit-memory` : Store en mémoire pour le rate limiting

### Étape 4 : Redémarrer le backend Node.js

Le middleware de rate limiting est déjà intégré dans `backend/server.js`. Il suffit de redémarrer le serveur :

```powershell
# Arrêter le serveur actuel (Ctrl+C)
# Puis redémarrer
npm start
# ou
npm run dev
```

## 📊 Monitoring

### Surveillance en temps réel

```powershell
# Analyse ponctuelle
PowerShell -ExecutionPolicy Bypass -File .\install\monitor-syn-flood.ps1

# Surveillance continue (toutes les 30 secondes)
PowerShell -ExecutionPolicy Bypass -File .\install\monitor-syn-flood.ps1 -Continuous

# Surveillance avec intervalle personnalisé (toutes les 10 secondes)
PowerShell -ExecutionPolicy Bypass -File .\install\monitor-syn-flood.ps1 -Continuous -Interval 10
```

Le script de monitoring analyse :
- ✅ Connexions réseau (état SYN_RECEIVED, TIME_WAIT)
- ✅ Logs Apache (IPs suspectes, erreurs 429/503)
- ✅ État du serveur (CPU, mémoire, processus)
- ✅ Détection des patterns d'attaque

## 🔧 Configuration

### Rate Limiting (Node.js)

Les limites sont configurées dans `backend/middleware/rate-limiter.js` :

- **Global** : 100 requêtes/minute par IP
- **Strict** (routes sensibles) : 5 requêtes/15 minutes par IP
- **Upload** : 10 uploads/heure par IP
- **API publique** : 200 requêtes/minute par IP

Pour ajuster, modifiez les valeurs dans le fichier.

### Apache Timeouts

Les timeouts sont configurés dans `install/apache-syn-flood-config.conf` :

- **Timeout** : 3 secondes (établissement connexion TCP)
- **KeepAliveTimeout** : 5 secondes
- **RequestReadTimeout** : 10-40 secondes (header + body)

Pour ajuster, modifiez les valeurs dans le fichier puis redémarrez Apache.

### Windows TCP/IP

Les paramètres sont dans le registre Windows. Pour les modifier :

1. Exécuter `regedit` en tant qu'administrateur
2. Naviguer vers `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters`
3. Modifier les valeurs (voir le script PowerShell pour les noms)

## 🚨 En cas d'attaque active

### Actions immédiates

1. **Bloquer l'IP attaquante** :
   ```powershell
   # Via le pare-feu Windows
   netsh advfirewall firewall add rule name="Block SYN Flood IP" dir=in action=block remoteip=XXX.XXX.XXX.XXX
   ```

2. **Réduire les timeouts Apache** :
   - Modifier `Timeout` à 1 seconde dans `apache-syn-flood-config.conf`
   - Redémarrer Apache

3. **Réduire le rate limiting** :
   - Modifier `max` dans `backend/middleware/rate-limiter.js` (ex: 50 au lieu de 100)
   - Redémarrer le backend Node.js

4. **Surveiller en continu** :
   ```powershell
   PowerShell -ExecutionPolicy Bypass -File .\install\monitor-syn-flood.ps1 -Continuous -Interval 5
   ```

### Vérification de l'efficacité

Après avoir appliqué les protections, vérifiez :

1. **Connexions SYN_RECEIVED** : Doivent être < 20 (normal) ou < 50 (acceptable)
2. **Erreurs 429** : Indiquent que le rate limiting fonctionne
3. **CPU/Mémoire** : Doivent revenir à des niveaux normaux
4. **Logs Apache** : Moins d'erreurs 503 (Service Unavailable)

## 📝 Fichiers créés

- `install/configure-syn-flood-protection.ps1` : Script de configuration Windows
- `install/apache-syn-flood-config.conf` : Configuration Apache
- `backend/middleware/rate-limiter.js` : Middleware de rate limiting
- `install/monitor-syn-flood.ps1` : Script de monitoring
- `install/PROTECTION-SYN-FLOOD.md` : Ce guide

## 🔍 Dépannage

### Le rate limiting bloque des utilisateurs légitimes

**Solution** : Augmenter les limites dans `backend/middleware/rate-limiter.js` :
- `max: 100` → `max: 200` (global)
- `max: 5` → `max: 10` (strict)

### Apache ne démarre pas après modification

**Solution** : Vérifier la syntaxe dans `apache-syn-flood-config.conf` :
```powershell
# Tester la configuration Apache
C:\xampp\apache\bin\httpd.exe -t
```

### Le script PowerShell échoue

**Solution** : Vérifier les droits administrateur :
```powershell
# Vérifier les droits
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

### Les connexions SYN_RECEIVED restent élevées

**Solution** : 
1. Vérifier que `SynAttackProtect` est à 2 dans le registre
2. Vérifier que `mod_reqtimeout` est activé dans Apache
3. Vérifier que les timeouts sont bien appliqués (redémarrer Apache)

## 📚 Ressources

- [Microsoft : Protection contre les attaques SYN](https://docs.microsoft.com/en-us/windows-server/security/tls/syn-attack-protection)
- [Apache mod_reqtimeout](https://httpd.apache.org/docs/2.4/mod/mod_reqtimeout.html)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)

## ✅ Checklist de déploiement

- [ ] Script Windows exécuté (en admin)
- [ ] Module `mod_reqtimeout` activé dans Apache
- [ ] Configuration Apache ajoutée et Apache redémarré
- [ ] Dépendances Node.js installées (`npm install`)
- [ ] Backend Node.js redémarré
- [ ] Monitoring testé
- [ ] Vérification que les protections fonctionnent (logs, connexions)

---

**Dernière mise à jour** : $(Get-Date -Format "yyyy-MM-dd")


