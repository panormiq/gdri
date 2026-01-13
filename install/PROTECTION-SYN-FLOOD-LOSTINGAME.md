# Protection SYN Flood pour LostInGame

## ✅ Ce qui fonctionne AUTOMATIQUEMENT pour LostInGame

### 1. Protection Windows (Niveau Système) ✅

**La protection Windows protège TOUT le serveur**, donc lostingame est déjà protégé :
- ✅ SYN cookies activés
- ✅ Paramètres TCP/IP optimisés
- ✅ Registre Windows configuré
- ✅ Protection au niveau du système d'exploitation

**→ Aucune action supplémentaire nécessaire**

### 2. Protection Apache (Niveau Serveur Web) ✅

Si vous avez ajouté la configuration dans `httpd.conf` (global), **tous les VirtualHosts sont protégés**, y compris lostingame si il passe par Apache.

**Configuration actuelle :**
- Si la config est dans `httpd.conf` → ✅ LostInGame protégé
- Si la config est uniquement dans le VirtualHost GDRI → ⚠️ LostInGame non protégé au niveau Apache

**Vérification :**
Ouvrir `C:\xampp\apache\conf\httpd.conf` et chercher :
```apache
Include "C:/xampp/htdocs/gdri/install/apache-syn-flood-config.conf"
```

Si cette ligne existe → ✅ LostInGame est protégé au niveau Apache

### 3. Protection Node.js (Niveau Application) ⚠️

**Le rate limiting Node.js est spécifique à chaque backend.**

- ✅ **GDRI Backend (port 3000)** : Protégé (middleware déjà intégré)
- ❌ **LostInGame Backend (port 5001)** : Non protégé (à ajouter)

## 🔧 Ajouter la protection pour LostInGame Backend

### Option 1 : Protection complète (recommandé)

Si lostingame a un backend Node.js similaire à GDRI, ajouter le rate limiting :

1. **Créer le middleware** dans lostingame :
   ```powershell
   # Copier le middleware depuis GDRI
   Copy-Item "C:\xampp\htdocs\gdri\backend\middleware\rate-limiter.js" "C:\xampp\htdocs\lostingame\backend\middleware\rate-limiter.js"
   ```

2. **Installer la dépendance** :
   ```powershell
   cd C:\xampp\htdocs\lostingame\backend
   npm install express-rate-limit
   ```

3. **Intégrer dans le serveur** :
   Ouvrir `C:\xampp\htdocs\lostingame\backend\server.js` (ou fichier principal) et ajouter :
   ```javascript
   const { globalLimiter, detectSuspiciousConnections } = require('./middleware/rate-limiter');
   
   // Avant les autres middlewares
   app.use(detectSuspiciousConnections);
   app.use('/api', globalLimiter);
   ```

### Option 2 : Protection minimale (si lostingame est différent)

Si lostingame a une architecture différente, vous pouvez juste ajouter le rate limiting basique :

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: 'Trop de requêtes depuis cette IP'
});

app.use('/api', limiter);
```

## 📊 Monitoring pour LostInGame

Le script de monitoring détecte automatiquement lostingame s'il est en cours d'exécution :

```powershell
cd C:\xampp\htdocs\gdri\install
.\monitor-syn-flood.ps1
```

Le script vérifie :
- ✅ Toutes les connexions réseau (tous les ports)
- ✅ Tous les processus Node.js (y compris lostingame sur port 5001)
- ✅ Logs Apache (si lostingame passe par Apache)

## 🔍 Vérification rapide

### 1. Vérifier que lostingame est protégé au niveau Windows

```powershell
# Vérifier les paramètres TCP/IP
Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "SynAttackProtect"
```

Doit retourner `2` → ✅ Protégé

### 2. Vérifier que lostingame est protégé au niveau Apache

```powershell
# Vérifier si la config est dans httpd.conf
Select-String -Path "C:\xampp\apache\conf\httpd.conf" -Pattern "apache-syn-flood-config"
```

Si trouvé → ✅ LostInGame protégé au niveau Apache

### 3. Vérifier les connexions lostingame

```powershell
# Voir les connexions sur le port 5001
Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue | Format-Table
```

## 📝 Résumé

| Protection | GDRI | LostInGame | Action |
|-----------|------|------------|--------|
| **Windows (Système)** | ✅ | ✅ | Aucune (déjà fait) |
| **Apache (Global)** | ✅ | ✅ | Vérifier config dans httpd.conf |
| **Apache (VirtualHost)** | ✅ | ⚠️ | Ajouter config si VirtualHost séparé |
| **Node.js Backend** | ✅ | ❌ | Ajouter middleware (optionnel) |

## 🚀 Actions recommandées

1. ✅ **Vérifier la config Apache** : S'assurer que la protection est globale (dans httpd.conf)
2. ⚠️ **Ajouter rate limiting** : Si lostingame a un backend Node.js important
3. ✅ **Tester le monitoring** : Vérifier que lostingame est détecté

---

**Note** : Même sans rate limiting Node.js, lostingame est protégé au niveau système (Windows) et serveur web (Apache si config global), ce qui est déjà très efficace contre les SYN flood.


