# 🚀 Déploiement Rapide - Protection SYN Flood

## ⚡ Déploiement en 5 minutes

### 1️⃣ Configuration Windows (2 minutes)

**Ouvrir PowerShell en tant qu'administrateur** puis :

```powershell
cd C:\xampp\htdocs\gdri\install
.\configure-syn-flood-protection.ps1
```

✅ Ce script configure automatiquement :
- SYN cookies Windows
- Paramètres TCP/IP optimisés
- Registre Windows (protection SYN flood)

### 2️⃣ Configuration Apache (2 minutes)

1. **Ouvrir** `C:\xampp\apache\conf\httpd.conf`

2. **Vérifier/Activer** le module (chercher et décommenter si nécessaire) :
   ```apache
   LoadModule reqtimeout_module modules/mod_reqtimeout.so
   ```

3. **Ajouter** à la fin du fichier `httpd.conf` :
   ```apache
   # Protection Anti-SYN Flood
   Include "C:/xampp/htdocs/gdri/install/apache-syn-flood-config.conf"
   ```

4. **Redémarrer Apache** depuis le XAMPP Control Panel

### 3️⃣ Installation Node.js (1 minute)

```powershell
cd C:\xampp\htdocs\gdri
npm install
```

### 4️⃣ Redémarrer le Backend

```powershell
# Arrêter le backend actuel (Ctrl+C dans la console)
# Puis redémarrer
npm start
```

## ✅ Vérification

### Tester le monitoring

```powershell
cd C:\xampp\htdocs\gdri\install
.\monitor-syn-flood.ps1
```

Vous devriez voir :
- ✅ Apache en cours d'exécution
- ✅ Node.js backend en cours d'exécution (GDRI port 3000)
- ✅ Connexions SYN_RECEIVED < 20 (normal)
- ✅ Si lostingame est actif : détection automatique (port 5001)

### Tester le rate limiting

Faire plusieurs requêtes rapides vers votre API. Après 100 requêtes/minute, vous devriez recevoir une erreur 429.

## 🎮 Protection pour LostInGame

**Bonne nouvelle** : La protection Windows et Apache (si config global) protège **automatiquement** lostingame aussi !

- ✅ **Protection Windows** : Protège TOUT le serveur (tous les ports)
- ✅ **Protection Apache** : Si config dans `httpd.conf`, protège tous les VirtualHosts
- ⚠️ **Rate limiting Node.js** : Spécifique à chaque backend (optionnel pour lostingame)

📚 **Voir** : `install/PROTECTION-SYN-FLOOD-LOSTINGAME.md` pour les détails

## 📊 Surveillance continue

Pour surveiller en temps réel :

```powershell
.\monitor-syn-flood.ps1 -Continuous
```

## 🚨 En cas d'attaque

Si vous détectez une attaque active :

1. **Bloquer l'IP** :
   ```powershell
   netsh advfirewall firewall add rule name="Block Attacker" dir=in action=block remoteip=XXX.XXX.XXX.XXX
   ```

2. **Surveiller** :
   ```powershell
   .\monitor-syn-flood.ps1 -Continuous -Interval 5
   ```

3. **Vérifier les logs Apache** :
   - `C:\xampp\apache\logs\gdri-ssl-access.log`
   - Chercher les IPs avec beaucoup de requêtes

## 📝 Fichiers modifiés/créés

- ✅ `install/configure-syn-flood-protection.ps1` (nouveau)
- ✅ `install/apache-syn-flood-config.conf` (nouveau)
- ✅ `backend/middleware/rate-limiter.js` (nouveau)
- ✅ `backend/server.js` (modifié - middleware ajouté)
- ✅ `package.json` (modifié - dépendance express-rate-limit ajoutée)
- ✅ `install/monitor-syn-flood.ps1` (nouveau)

## 🔍 Dépannage rapide

**Apache ne démarre pas ?**
```powershell
C:\xampp\apache\bin\httpd.exe -t
```
Vérifie la syntaxe de la configuration.

**Le rate limiting bloque tout ?**
Modifier `backend/middleware/rate-limiter.js` ligne 18 : `max: 100` → `max: 200`

**Le script PowerShell échoue ?**
Vérifier que PowerShell est lancé en tant qu'administrateur.

---

📚 **Documentation complète** : Voir `install/PROTECTION-SYN-FLOOD.md`


